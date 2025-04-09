import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  AlertCircle, 
  Search, 
  Shield, 
  AlertTriangle, 
  XCircle,
  Clock,
  MapPin,
  WifiOff,
  RefreshCw,
  Trash2,
  CheckCircle
} from "lucide-react";
import { useWebSocket } from "./context/WebSocketContext"; // Import the WebSocket context hook

// CustomAlert component implementation (unchanged)
const CustomAlert = ({ type, title, children, onClose }) => {
  const getAlertStyles = () => {
    switch (type) {
      case "danger":
        return "bg-red-100 dark:bg-red-900/50 border-red-400 dark:border-red-800 text-red-700 dark:text-red-200";
      case "warning":
        return "bg-yellow-100 dark:bg-yellow-900/50 border-yellow-400 dark:border-yellow-800 text-yellow-700 dark:text-yellow-200";
      case "success":
        return "bg-green-100 dark:bg-green-900/50 border-green-400 dark:border-green-800 text-green-700 dark:text-green-200";
      default:
        return "bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-800 text-blue-700 dark:text-blue-200";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <AlertCircle className="h-5 w-5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5" />;
      case "success":
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  return (
    <div className={`border rounded-md p-4 shadow-lg animate-fadeIn ${getAlertStyles()}`}>
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <h3 className="font-medium">{title}</h3>
        </div>
        <button 
          onClick={onClose} 
          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Close alert"
        >
          <XCircle className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
};

const Dashboard = ({ isDarkMode, isSidebarExpanded }) => {
  // Use the WebSocket context instead of local state
  const { 
    logs, 
    clearLogs, 
    alerts, 
    setAlerts, 
    socketStatus, 
    hasNewLogs, 
    setHasNewLogs, 
    handleManualReconnect 
  } = useWebSocket();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const logsEndRef = useRef(null);

  // Set initial load to false after component mounts
  useEffect(() => {
    setIsInitialLoad(false);
  }, []);

  // Enhanced connection status message and icon
  const getConnectionStatus = () => {
    if (socketStatus.connected) {
      return {
        icon: <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>,
        text: "Connected to server",
        className: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800"
      };
    }
    if (socketStatus.reconnecting) {
      return {
        icon: <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" />,
        text: "Reconnecting...",
        className: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800"
      };
    }
    return {
      icon: <WifiOff className="h-4 w-4 text-red-500" />,
      text: "Disconnected",
      className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
    };
  };

  // Get row styling based on log status
  const getStatusStyles = (status) => {
    const normalizedStatus = status.toLowerCase().trim();
    if (normalizedStatus.includes("sqli attempt")) {
      return "dark:bg-red-900/30 dark:text-red-200 bg-red-50 text-red-800";
    } else if (normalizedStatus.includes("successful login")) {
      return "dark:bg-green-900/30 dark:text-green-200 bg-green-50 text-green-800";
    } else if (normalizedStatus.includes("failed login")) {
      return "dark:bg-orange-900/30 dark:text-orange-200 bg-orange-50 text-orange-800";
    }
    return isDarkMode ? "bg-gray-800 text-gray-200" : "bg-gray-50 text-gray-900";
  };

  // Filter logs based on search term
  const filteredLogs = logs.filter(log => 
    Object.values(log).some(value => 
      value && typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Handle clearing all logs
  const handleClearLogs = () => {
    if (window.confirm("Are you sure you want to clear all logs? This cannot be undone.")) {
      clearLogs();
      setHasNewLogs(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-all duration-300 ease-in-out
        ${isDarkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}
      role="main"
    >
      {socketStatus.error && (
        <div className="fixed top-4 left-4 z-50">
          <CustomAlert 
            type="warning" 
            title="Connection Issue" 
            onClose={() => socketStatus.setSocketStatus(prev => ({ ...prev, error: null }))}
          >
            <div className="flex flex-col gap-2">
              <p>{socketStatus.error}</p>
              {!socketStatus.connected && (
                <button
                  onClick={handleManualReconnect}
                  className="bg-orange-700 hover:bg-orange-800 text-white px-3 py-1 rounded flex items-center justify-center gap-2 mt-2"
                  disabled={socketStatus.reconnecting}
                >
                  <RefreshCw className={`h-4 w-4 ${socketStatus.reconnecting ? 'animate-spin' : ''}`} />
                  {socketStatus.reconnecting ? 'Reconnecting...' : 'Reconnect Now'}
                </button>
              )}
            </div>
          </CustomAlert>
        </div>
      )}

      {/* Alerts container - positioned at the top right */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-96 max-w-full px-2">
        {alerts.map((alert) => (
          <CustomAlert
            key={alert.id}
            type={alert.type}
            title={alert.title}
            onClose={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
          >
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{alert.log.ip || "Unknown IP"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{alert.log.time || "Unknown Time"}</span>
              </div>
            </div>
            <div className="mt-2">{alert.log.remarks || "No details available"}</div>
          </CustomAlert>
        ))}
      </div>

      <div className="p-6">
        <div className="w-full flex flex-col items-center">
          <div className="w-full mb-6 flex flex-col sm:flex-row justify-center items-center gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-10 w-10 text-blue-500" />
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-blue-300">
                SQLi Detection Dashboard
              </h1>
            </div>
            
            <div className={`flex items-center gap-2 ml-0 sm:ml-4 px-3 py-1.5 rounded-full border ${getConnectionStatus().className}`}>
              {getConnectionStatus().icon}
              <span className="text-sm font-medium">
                {getConnectionStatus().text}
              </span>
              {hasNewLogs && socketStatus.connected && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  New
                </span>
              )}
            </div>
          </div>
          
          <div className="w-full max-w-lg mb-8 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent
                  ${isDarkMode ? 
                    "bg-gray-800 border-gray-700 text-gray-100" : 
                    "bg-white border-gray-200 text-gray-900"
                  }`}
                aria-label="Search logs"
              />
            </div>
            
            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className={`px-4 py-3 rounded-lg border shadow-sm flex items-center gap-2 transition-colors
                  ${isDarkMode ? 
                    "bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700" : 
                    "bg-white border-gray-200 text-gray-900 hover:bg-gray-50"
                  }`}
                aria-label="Clear all logs"
                title="Clear all logs"
              >
                <Trash2 className="h-5 w-5 text-red-500" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div
          className={`w-full rounded-lg border shadow-lg overflow-hidden
            ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
          role="table"
        >
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`${isDarkMode ? "bg-gray-700" : "bg-gray-50"} sticky top-0 z-10`}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" scope="col">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" scope="col">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" scope="col">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" scope="col">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" scope="col">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log, index) => (
                    <tr
                      key={`${log.timestamp}-${index}`}
                      className={`${getStatusStyles(log.status)} transition-colors duration-200`}
                      role="row"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm" role="cell">{log.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" role="cell">{log.time}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" role="cell">{log.ip}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" role="cell">
                        <span className="inline-flex items-center gap-1">
                          {log.status.toLowerCase().includes("sqli attempt") && (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm" role="cell">{log.remarks}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-sm" role="cell">
                      {isInitialLoad ? (
                        <div className="flex justify-center items-center gap-2">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          <span>Loading logs...</span>
                        </div>
                      ) : socketStatus.connected ? (
                        "No logs found"
                      ) : (
                        "Waiting for connection to server..."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div ref={logsEndRef} />
    </div>
  );
};

export default Dashboard;