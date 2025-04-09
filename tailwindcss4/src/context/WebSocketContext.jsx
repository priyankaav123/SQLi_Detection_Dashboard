import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";

// Configuration for Socket.IO
const SOCKET_SERVER_URL = "http://localhost:5000";
const SOCKET_NAMESPACE = "/logs";
const SOCKET_OPTIONS = {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
};

// Create the context
const WebSocketContext = createContext(null);

// Hook to use the WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

// Parse incoming log data
const parseLog = (log) => {
  const logPattern = /\[(.*?) (.*?)\] \[IP: (.*?)\] \[(.*?)\] (.*)/;
  const match = log.match(logPattern);
  if (match) {
    const [, date, time, ip, status, remarks] = match;
    return { date, time, ip, status, remarks, timestamp: new Date().getTime() };
  }
  console.warn("Failed to parse log:", log);
  return null;
};

export const WebSocketProvider = ({ children }) => {
  // Socket reference
  const socketRef = useRef(null);
  
  // State
  const [logs, setLogs] = useState(() => {
    // Initialize from localStorage if available
    const savedLogs = localStorage.getItem("securityLogs");
    return savedLogs ? JSON.parse(savedLogs) : [];
  });
  
  const [alerts, setAlerts] = useState([]);
  const [socketStatus, setSocketStatus] = useState({
    connected: false,
    error: null,
    reconnecting: false,
    lastMessage: null
  });
  
  const reconnectTimerRef = useRef(null);
  const [hasNewLogs, setHasNewLogs] = useState(false);

  // Persist logs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("securityLogs", JSON.stringify(logs));
  }, [logs]);

  // Create alert notifications
  const createAlert = useCallback((type, title, log) => {
    console.log("Creating alert:", type, title, log);
    const newAlert = {
      id: Date.now(),
      type,
      title,
      log: log || { remarks: "No additional details available" }
    };
    
    setAlerts(prev => {
      const newAlerts = [newAlert, ...prev.slice(0, 4)]; // Keep only 5 alerts max
      console.log("New alerts state:", newAlerts);
      return newAlerts;
    });
    
    // Set timeout to 5 seconds
    setTimeout(() => {
      console.log("Removing alert:", newAlert.id);
      setAlerts(prev => prev.filter(alert => alert.id !== newAlert.id));
    }, 5000);
  }, []);

  // Manually reconnect socket
  const handleManualReconnect = useCallback(() => {
    if (socketRef.current && socketRef.current.disconnected) {
      setSocketStatus(prev => ({ ...prev, reconnecting: true }));
      socketRef.current.connect();
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      reconnectTimerRef.current = setTimeout(() => {
        if (socketRef.current && !socketRef.current.connected) {
          setSocketStatus(prev => ({ 
            ...prev, 
            reconnecting: false,
            error: "Manual reconnection failed. Please try again or check your server."
          }));
        }
      }, 5000);
    }
  }, []);

  // Handle new logs received from the server
  const handleNewLog = useCallback((data) => {
    console.log("New log received:", data);
    setSocketStatus(prev => ({ 
      ...prev, 
      connected: true, 
      error: null, 
      lastMessage: new Date() 
    }));
    
    if (data.log) {
      const parsedLog = parseLog(data.log);
      if (parsedLog) {
        // Check if this log is already in our logs (to prevent duplicates)
        setLogs(prevLogs => {
          // Simple duplicate check based on timestamp and content
          const isDuplicate = prevLogs.some(
            existingLog => 
              existingLog.date === parsedLog.date && 
              existingLog.time === parsedLog.time && 
              existingLog.ip === parsedLog.ip && 
              existingLog.remarks === parsedLog.remarks
          );
          
          if (isDuplicate) {
            return prevLogs; // Don't add duplicate logs
          }
          
          setHasNewLogs(true); // Indicate we have new logs
          
          // Add new log at the beginning
          return [parsedLog, ...prevLogs];
        });
        
        // Create alerts based on log status
        const lowerStatus = parsedLog.status.toLowerCase();
        if (lowerStatus.includes("sqli attempt")) {
          createAlert("danger", "SQL Injection Attempt Detected!", parsedLog);
        } else if (lowerStatus.includes("failed login")) {
          createAlert("warning", "Failed Login Attempt", parsedLog);
        } else if (lowerStatus.includes("successful login")) {
          createAlert("success", "Successful Login", parsedLog);
        }
      }
    }
  }, [createAlert]);

  // Request historical logs from server
  const fetchHistoricalLogs = useCallback(() => {
    // Only fetch historical logs if we don't already have some
    if (logs.length === 0 && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("get_historical_logs", { limit: 50 }, (response) => {
        if (response && response.logs && Array.isArray(response.logs)) {
          const parsedLogs = response.logs
            .map(log => parseLog(log))
            .filter(log => log !== null)
            .reverse();
          
          setLogs(parsedLogs);
          console.log("Historical logs loaded:", parsedLogs.length);
        } else {
          console.warn("Invalid historical logs response:", response);
        }
      });
    } else {
      // We already have logs, no need to fetch
      console.log("Using existing logs:", logs.length);
    }
  }, [logs.length]);

  // Clear all logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    setHasNewLogs(false);
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    // Initialize socket if not already created
    if (!socketRef.current) {
      console.log("Creating new socket connection");
      socketRef.current = io(`${SOCKET_SERVER_URL}${SOCKET_NAMESPACE}`, SOCKET_OPTIONS);
    }

    // Socket connection events
    const handleConnect = () => {
      console.log("Connected to socket server");
      setSocketStatus(prev => ({ 
        ...prev, 
        connected: true, 
        error: null, 
        reconnecting: false
      }));
      
      // Request historical logs
      fetchHistoricalLogs();
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    
    const handleDisconnect = (reason) => {
      console.log("Disconnected from socket server:", reason);
      setSocketStatus(prev => ({ 
        ...prev, 
        connected: false, 
        error: "Connection lost. Attempting to reconnect...",
        reconnecting: true
      }));
    };
    
    const handleError = (error) => {
      console.error("Socket error:", error);
      setSocketStatus(prev => ({ 
        ...prev, 
        error: "Connection error. Please check your server status.",
        reconnecting: false
      }));
    };
    
    const handleConnectError = (error) => {
      console.error("Connection error:", error);
      setSocketStatus(prev => ({ 
        ...prev, 
        connected: false, 
        error: "Failed to connect to the server. Is the Flask backend running?",
        reconnecting: false
      }));
    };

    // Register event handlers
    const socket = socketRef.current;
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("error", handleError);
    socket.on("connect_error", handleConnectError);
    socket.on("new_log", handleNewLog);
    
    // Additional event for historical logs
    socket.on("historical_logs", (data) => {
      console.log("Received historical logs:", data);
      if (data && data.logs && Array.isArray(data.logs)) {
        const parsedLogs = data.logs
          .map(log => parseLog(log))
          .filter(log => log !== null);
        
        // Only set logs if we don't already have logs
        if (logs.length === 0) {
          setLogs(parsedLogs);
        }
      }
    });

    // Check initial connection state
    if (socket.connected) {
      setSocketStatus(prev => ({ ...prev, connected: true }));
      fetchHistoricalLogs();
    } else {
      setSocketStatus(prev => ({ 
        ...prev, 
        connected: false, 
        error: "Connecting to server..."
      }));
    }

    // Cleanup on unmount
    return () => {
      // We don't close the socket on unmount to keep it alive across page navigation
      // Just remove the event listeners
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("error", handleError);
      socket.off("connect_error", handleConnectError);
      socket.off("new_log", handleNewLog);
      socket.off("historical_logs");
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [handleNewLog, fetchHistoricalLogs, logs.length]);

  // Context value
  const value = {
    logs,
    setLogs,
    clearLogs,
    alerts,
    setAlerts,
    createAlert,
    socketStatus,
    hasNewLogs,
    setHasNewLogs,
    handleManualReconnect
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;