import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import { useWebSocket } from "./context/WebSocketContext"; // Import the WebSocket context

const SQLiComparisonGraph = () => {
  const [timestamps, setTimestamps] = useState([]);
  const [sqliAttempts, setSqliAttempts] = useState([]);
  const [failedLogins, setFailedLogins] = useState([]);
  const [viewMode, setViewMode] = useState("split"); // split, ratio, overlay
  const [dataSource, setDataSource] = useState("real-time"); // real-time, historical
  const [stats, setStats] = useState({
    totalSQLi: 0,
    totalFailedLogins: 0,
    ratio: 0,
    lastUpdate: "--:--:--"
  });
  
  // Get websocket context
  const { logs, socketStatus } = useWebSocket();
  
  useEffect(() => {
    // Process logs when they change
    if (logs && logs.length > 0) {
      // Extract the most recent 50 logs
      const recentLogs = logs.slice(0, 50);
      
      // Extract timestamps
      const newTimestamps = recentLogs.map(log => log.time || "");
      
      // Count SQLi attempts and failed logins
      let sqliCount = 0;
      let failedLoginCount = 0;
      const newSqliAttempts = [];
      const newFailedLogins = [];
      
      recentLogs.forEach(log => {
        const status = log.status ? log.status.toLowerCase() : "";
        
        if (status.includes("sqli") || status.includes("sql injection")) {
          sqliCount++;
        } else if (status.includes("failed login")) {
          failedLoginCount++;
        }
        
        newSqliAttempts.push(sqliCount);
        newFailedLogins.push(failedLoginCount);
      });
      
      // Update state
      setTimestamps(newTimestamps.reverse()); // Reverse to show oldest to newest
      setSqliAttempts(newSqliAttempts.reverse());
      setFailedLogins(newFailedLogins.reverse());
      
      // Update stats
      setStats({
        totalSQLi: sqliCount,
        totalFailedLogins: failedLoginCount,
        ratio: sqliCount > 0 ? (failedLoginCount / sqliCount).toFixed(2) : 0,
        lastUpdate: new Date().toLocaleTimeString()
      });
    }
  }, [logs]);
  
  // Generate appropriate plot data based on viewMode
  const getPlotData = () => {
    const baseTrace1 = {
      x: timestamps,
      y: sqliAttempts,
      name: "SQL Injection Attempts",
      hovertemplate: "<b>Time:</b> %{x}<br><b>SQLi Count:</b> %{y}<extra></extra>",
    };
    
    const baseTrace2 = {
      x: timestamps,
      y: failedLogins,
      name: "Failed Logins",
      hovertemplate: "<b>Time:</b> %{x}<br><b>Failed Login Count:</b> %{y}<extra></extra>",
    };
    
    switch (viewMode) {
      case "overlay":
        return [
          {
            ...baseTrace1,
            type: "scatter",
            mode: "lines+markers",
            line: { color: "rgb(239, 68, 68)", width: 3 },
            marker: { size: 6, color: "rgb(239, 68, 68)" },
          },
          {
            ...baseTrace2,
            type: "scatter",
            mode: "lines+markers",
            line: { color: "rgb(59, 130, 246)", width: 3 },
            marker: { size: 6, color: "rgb(59, 130, 246)" },
          }
        ];
      case "ratio":
        // Calculate ratio over time
        const ratios = sqliAttempts.map((sqli, index) => {
          const login = failedLogins[index] || 0;
          return sqli > 0 ? login / sqli : 0;
        });
        
        return [
          {
            x: timestamps,
            y: ratios,
            type: "scatter",
            mode: "lines+markers",
            name: "Failed Login to SQLi Ratio",
            line: { color: "rgb(16, 185, 129)", width: 3 },
            marker: { size: 6, color: "rgb(16, 185, 129)" },
            hovertemplate: "<b>Time:</b> %{x}<br><b>Ratio:</b> %{y:.2f}<extra></extra>",
          }
        ];
      case "split":
      default:
        return [
          {
            ...baseTrace1,
            type: "scatter",
            mode: "lines",
            fill: "tozeroy",
            fillcolor: "rgba(239, 68, 68, 0.2)",
            line: { color: "rgb(239, 68, 68)", width: 2 },
          },
          {
            ...baseTrace2,
            type: "scatter",
            mode: "lines",
            fill: "tozeroy",
            fillcolor: "rgba(59, 130, 246, 0.2)",
            line: { color: "rgb(59, 130, 246)", width: 2 },
          }
        ];
    }
  };
  
  // Handle data source change
  const handleDataSourceChange = (source) => {
    setDataSource(source);
    // In a real implementation, you might fetch historical data here
    // or switch to real-time mode
  };
  
  return (
    <div className="w-full rounded-lg bg-slate-800 shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Attack Correlation Analysis</h2>
          <p className="text-gray-400 text-sm">SQLi Attempts vs. Failed Login Correlation</p>
        </div>
        
        <div className="flex space-x-3">
          <div className="bg-slate-700 px-3 py-1 rounded-md">
            <span className="text-gray-400 text-xs">SQLi</span>
            <p className="text-red-500 font-bold">{stats.totalSQLi}</p>
          </div>
          <div className="bg-slate-700 px-3 py-1 rounded-md">
            <span className="text-gray-400 text-xs">FAILED LOGINS</span>
            <p className="text-blue-500 font-bold">{stats.totalFailedLogins}</p>
          </div>
          <div className="bg-slate-700 px-3 py-1 rounded-md">
            <span className="text-gray-400 text-xs">RATIO</span>
            <p className="text-green-500 font-bold">{stats.ratio}</p>
          </div>
        </div>
      </div>
      
      <div className="flex mb-4">
        <div className="inline-flex bg-slate-700 rounded-md p-1 mr-4">
          <button 
            onClick={() => setViewMode("split")}
            className={`px-3 py-1 text-xs rounded-md ${viewMode === "split" ? 'bg-slate-600 text-white' : 'text-gray-300'}`}
          >
            Split View
          </button>
          <button 
            onClick={() => setViewMode("overlay")}
            className={`px-3 py-1 text-xs rounded-md ${viewMode === "overlay" ? 'bg-slate-600 text-white' : 'text-gray-300'}`}
          >
            Overlay
          </button>
          <button 
            onClick={() => setViewMode("ratio")}
            className={`px-3 py-1 text-xs rounded-md ${viewMode === "ratio" ? 'bg-slate-600 text-white' : 'text-gray-300'}`}
          >
            Ratio
          </button>
        </div>
        
        <div className="inline-flex bg-slate-700 rounded-md p-1">
          <button 
            onClick={() => handleDataSourceChange("real-time")}
            className={`px-3 py-1 text-xs rounded-md ${dataSource === "real-time" ? 'bg-slate-600 text-white' : 'text-gray-300'}`}
          >
            Real-time
          </button>
          <button 
            onClick={() => handleDataSourceChange("historical")}
            className={`px-3 py-1 text-xs rounded-md ${dataSource === "historical" ? 'bg-slate-600 text-white' : 'text-gray-300'}`}
          >
            Historical
          </button>
        </div>
      </div>
      
      <div className="w-full h-96 transition-all duration-300 ease-in-out">
        {socketStatus.connected ? (
          <Plot
            data={getPlotData()}
            layout={{
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(15,23,42,0.3)",
              font: { color: "#FFF" },
              margin: { l: 60, r: 30, t: 10, b: 60 },
              xaxis: {
                title: "Time",
                tickangle: -45,
                tickfont: { color: "#BBB" },
                gridcolor: "rgba(255,255,255,0.1)",
                zeroline: false,
              },
              yaxis: {
                title: viewMode === "ratio" ? "Ratio (Failed Logins / SQLi)" : "Count",
                tickfont: { color: "#BBB" },
                gridcolor: "rgba(255,255,255,0.1)",
                zeroline: false,
              },
              legend: {
                x: 0.01,
                y: 0.99,
                bgcolor: "rgba(0,0,0,0.5)",
                bordercolor: "rgba(255,255,255,0.2)",
                borderwidth: 1,
                font: { color: "#FFF" }
              },
              hovermode: "closest",
              annotations: [
                {
                  text: dataSource === "real-time" ? 'LIVE' : 'HISTORICAL',
                  x: 1,
                  y: 1.05,
                  xref: 'paper',
                  yref: 'paper',
                  showarrow: false,
                  font: {
                    family: 'Arial',
                    size: 12,
                    color: dataSource === "real-time" ? '#FF4136' : '#4CAF50'
                  },
                  bgcolor: 'rgba(0,0,0,0.5)',
                  bordercolor: dataSource === "real-time" ? '#FF4136' : '#4CAF50',
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
                filename: 'sqli_comparison',
              }
            }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-700 bg-opacity-50 rounded-lg">
            <div className="text-center">
              <p className="text-gray-300 mb-2">Waiting for WebSocket connection...</p>
              <p className="text-red-400 text-sm">{socketStatus.error || "Please check your server status."}</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-between mt-4">
        <div className="flex space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
            <span className="text-xs text-gray-300">SQL Injection</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
            <span className="text-xs text-gray-300">Failed Logins</span>
          </div>
          {viewMode === "ratio" && (
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
              <span className="text-xs text-gray-300">Ratio</span>
            </div>
          )}
        </div>
        <div>
          <span className="text-xs text-gray-400">
            Status: {socketStatus.connected ? 
              <span className="text-green-400">Connected</span> : 
              <span className="text-red-400">Disconnected</span>
            } | Last updated: {stats.lastUpdate}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SQLiComparisonGraph;