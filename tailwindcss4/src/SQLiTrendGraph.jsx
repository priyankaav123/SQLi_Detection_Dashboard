import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import { useWebSocket } from "./context/WebSocketContext";

const SQLiTrendGraph = () => {
  const [timestamps, setTimestamps] = useState([]);
  const [attackCounts, setAttackCounts] = useState([]);
  const [isAnimating, setIsAnimating] = useState(true);
  const [timeframe, setTimeframe] = useState("1h"); // 1h, 12h, 24h
  const [lastAttackTime, setLastAttackTime] = useState("--:--:--");
  const [allLogs, setAllLogs] = useState([]);
  
  // Use the global WebSocket context instead of creating a new connection
  const { 
    logs, 
    socketStatus, 
    hasNewLogs 
  } = useWebSocket();
  
  // Store all received logs
  useEffect(() => {
    if (hasNewLogs && logs.length > 0) {
      setAllLogs(prevLogs => {
        // Merge new logs with existing logs
        // Assuming logs have unique IDs to prevent duplicates
        const mergedLogs = [...prevLogs];
        logs.forEach(log => {
          if (!mergedLogs.some(existingLog => existingLog.id === log.id)) {
            mergedLogs.push({
              ...log,
              timestamp: new Date()
            });
          }
        });
        return mergedLogs;
      });
      
      const currentTime = new Date();
      const timeString = currentTime.toLocaleTimeString();
      setLastAttackTime(timeString);
    }
  }, [logs, hasNewLogs]);
  
  // Filter and process logs based on selected timeframe
  useEffect(() => {
    if (allLogs.length === 0) return;
    
    const currentTime = new Date();
    let timeLimit;
    
    switch (timeframe) {
      case "1h":
        timeLimit = new Date(currentTime - 60 * 60 * 1000);
        break;
      case "12h":
        timeLimit = new Date(currentTime - 12 * 60 * 60 * 1000);
        break;
      case "24h":
        timeLimit = new Date(currentTime - 24 * 60 * 60 * 1000);
        break;
      default:
        timeLimit = new Date(currentTime - 60 * 60 * 1000);
    }
    
    // Filter logs based on timeframe
    const filteredLogs = allLogs.filter(log => 
      log.timestamp >= timeLimit
    );
    
    // Group logs by minute for better visualization
    const logsByMinute = filteredLogs.reduce((acc, log) => {
      const minute = new Date(log.timestamp);
      minute.setSeconds(0, 0);
      const timeKey = minute.toLocaleTimeString();
      
      if (!acc[timeKey]) {
        acc[timeKey] = 0;
      }
      acc[timeKey]++;
      return acc;
    }, {});
    
    // Create arrays for Plotly
    const newTimestamps = Object.keys(logsByMinute);
    
    // Create cumulative counts
    let cumulative = 0;
    const newCounts = newTimestamps.map(time => {
      cumulative += logsByMinute[time];
      return cumulative;
    });
    
    setTimestamps(newTimestamps);
    setAttackCounts(newCounts);
  }, [allLogs, timeframe]);
  
  // Handle timeframe changes
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };
  
  // Toggle animation
  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
  };
  
  // Get a string representation of the socket status
  const getSocketStatusString = () => {
    if (typeof socketStatus === 'string') {
      return socketStatus;
    }
    
    if (socketStatus && typeof socketStatus === 'object') {
      if (socketStatus.connected) return 'connected';
      if (socketStatus.error) return 'error';
      if (socketStatus.reconnecting) return 'reconnecting';
      return 'disconnected';
    }
    
    return 'unknown';
  };
  
  const socketStatusString = getSocketStatusString();
  
  return (
    <div className="w-full rounded-lg bg-slate-800 shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Real-Time SQLi Attack Trends</h2>
        <div className="flex items-center space-x-3">
          <div className="bg-slate-700 px-3 py-1 rounded-md">
            <span className="text-gray-400 text-xs">LAST ATTACK</span>
            <p className="text-white font-bold">{lastAttackTime}</p>
          </div>
          <button 
            onClick={toggleAnimation}
            className={`px-3 py-1 rounded-md text-xs font-bold ${isAnimating ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300'}`}
          >
            {isAnimating ? 'LIVE' : 'PAUSED'}
          </button>
        </div>
      </div>
      
      <div className="w-full h-96 transition-all duration-300 ease-in-out">
        <Plot
          data={[
            {
              x: timestamps,
              y: attackCounts,
              type: "scatter",
              mode: "lines+markers",
              name: "SQLi Attempts",
              line: { 
                color: "rgb(239, 68, 68)", 
                width: 3,
                shape: "spline",
              },
              marker: { 
                size: 6, 
                color: "rgb(239, 68, 68)",
                symbol: "circle",
                line: {
                  color: "white",
                  width: 1
                }
              },
              fill: "tozeroy",
              fillcolor: "rgba(239, 68, 68, 0.1)",
              hovertemplate: "<b>Time:</b> %{x}<br><b>Attack #:</b> %{y}<extra></extra>",
            },
          ]}
          layout={{
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(15,23,42,0.3)",
            font: { color: "#FFF" },
            margin: { l: 60, r: 20, t: 10, b: 60 },
            xaxis: {
              title: "Time",
              tickangle: -45,
              tickfont: { color: "#BBB" },
              gridcolor: "rgba(255,255,255,0.1)",
              zeroline: false,
            },
            yaxis: {
              title: "SQLi Attempts (Cumulative)",
              tickfont: { color: "#BBB" },
              gridcolor: "rgba(255,255,255,0.1)",
              zeroline: false,
            },
            showlegend: false,
            hovermode: "closest",
            updatemenus: isAnimating ? [
              {
                type: 'buttons',
                showactive: false,
                x: 0.05,
                y: 1.15,
                xanchor: 'left',
                yanchor: 'top',
                buttons: [
                  {
                    label: 'Play',
                    method: 'animate',
                    args: [null, {
                      fromcurrent: true,
                      frame: { duration: 500, redraw: true },
                      transition: { duration: 500 }
                    }]
                  },
                  {
                    label: 'Pause',
                    method: 'animate',
                    args: [[null], {
                      mode: 'immediate',
                      transition: { duration: 0 },
                      frame: { duration: 0, redraw: false }
                    }]
                  }
                ]
              }
            ] : [],
            annotations: [
              {
                text: isAnimating ? 'LIVE' : 'PAUSED',
                x: 1,
                y: 1.05,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {
                  family: 'Arial',
                  size: 12,
                  color: isAnimating ? '#FF4136' : '#888'
                },
                bgcolor: 'rgba(0,0,0,0.5)',
                bordercolor: isAnimating ? '#FF4136' : '#888',
                borderwidth: 1,
                borderpad: 4,
                borderradius: 4
              }
            ]
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            toImageButtonOptions: {
              format: 'png',
              filename: 'sqli_trend',
            }
          }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler={true}
        />
      </div>
      
      <div className="flex justify-between mt-4">
        <div className="inline-flex bg-slate-700 rounded-md p-1">
          <button 
            onClick={() => handleTimeframeChange("1h")}
            className={`px-3 py-1 text-xs rounded-md ${timeframe === "1h" ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
          >
            1H
          </button>
          <button 
            onClick={() => handleTimeframeChange("12h")}
            className={`px-3 py-1 text-xs rounded-md ${timeframe === "12h" ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
          >
            12H
          </button>
          <button 
            onClick={() => handleTimeframeChange("24h")}
            className={`px-3 py-1 text-xs rounded-md ${timeframe === "24h" ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
          >
            24H
          </button>
        </div>
        <div className="flex space-x-2">
          <button className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded transition-colors">
            Export Data
          </button>
          <button className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded transition-colors">
            Alerts
          </button>
        </div>
      </div>
      
      {socketStatusString !== 'connected' && (
        <div className="mt-4 p-2 bg-red-900/50 text-red-300 text-sm rounded">
          Warning: WebSocket connection {socketStatusString}. Real-time updates may be delayed.
        </div>
      )}
    </div>
  );
};

export default SQLiTrendGraph;