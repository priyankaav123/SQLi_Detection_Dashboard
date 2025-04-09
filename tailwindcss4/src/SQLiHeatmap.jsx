import React, { useState, useEffect, useCallback } from "react";
import Plot from "react-plotly.js";
import { useWebSocket } from "./context/WebSocketContext"; // Import the WebSocket context

const SQLiHeatmap = () => {
  // Grid size configuration
  const GRID_ROWS = 10;
  const GRID_COLS = 10;

  // Initialize a 2D array for attack intensity
  const createEmptyGrid = () => Array(GRID_ROWS).fill().map(() => Array(GRID_COLS).fill(0));
  
  const [heatmapData, setHeatmapData] = useState(createEmptyGrid());
  const [totalAttacks, setTotalAttacks] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("--:--:--");
  const [attackSources, setAttackSources] = useState(new Map());
  
  // Get the WebSocket context
  const { logs, socketStatus, hasNewLogs, setHasNewLogs } = useWebSocket();

  // Generate a position from an IP address with better distribution
  const getPositionFromIP = useCallback((ip) => {
    if (!ip) return { row: Math.floor(Math.random() * GRID_ROWS), col: Math.floor(Math.random() * GRID_COLS) };
    
    // For a local environment where all IPs might be the same (like 127.0.0.1)
    // We need to ensure the attacks are distributed across the grid
    const existingSource = attackSources.get(ip);
    
    if (existingSource) {
      // Increment intensity at the existing position for this IP
      return existingSource;
    } else {
      // Find a cell with the least intensity to place a new source
      let minIntensity = Number.MAX_VALUE;
      let position = { row: 0, col: 0 };
      
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (heatmapData[r][c] < minIntensity) {
            minIntensity = heatmapData[r][c];
            position = { row: r, col: c };
          }
        }
      }
      
      // If many cells have the same minimum, choose one randomly
      const minCells = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (heatmapData[r][c] === minIntensity) {
            minCells.push({ row: r, col: c });
          }
        }
      }
      
      if (minCells.length > 0) {
        position = minCells[Math.floor(Math.random() * minCells.length)];
      }
      
      // Save this IP's position for future attacks
      setAttackSources(prev => {
        const newMap = new Map(prev);
        newMap.set(ip, position);
        return newMap;
      });
      
      return position;
    }
  }, [heatmapData, attackSources]);
  
  // Function to update heatmap based on a log entry
  const updateHeatmapFromLog = useCallback((log) => {
    // Only process SQL injection logs
    const isSQLi = log.status && log.status.toLowerCase().includes("sqli");
    
    if (isSQLi) {
      // Get the source IP (default to a unique identifier if IP is missing)
      const sourceIP = log.ip || `unknown-${Date.now()}`;
      
      // Generate position in the heatmap grid based on IP
      const { row, col } = getPositionFromIP(sourceIP);
      
      // Update attack intensity
      setHeatmapData(prevGrid => {
        const newGrid = prevGrid.map(r => [...r]);
        // Increase intensity, but ensure it scales properly
        const currentValue = newGrid[row][col];
        
        // Use a logarithmic scale for intensity to prevent outliers from dominating
        // This ensures the visualization remains useful even with many attacks from one source
        newGrid[row][col] = currentValue < 5 ? currentValue + 1 : Math.min(20, currentValue + 0.5);
        
        return newGrid;
      });
      
      setTotalAttacks(prev => prev + 1);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [getPositionFromIP]);
  
  // Process logs when they change - real-time updates
  useEffect(() => {
    if (hasNewLogs && logs.length > 0) {
      // Process only the newest log (at index 0)
      updateHeatmapFromLog(logs[0]);
      setHasNewLogs(false);
    }
  }, [logs, hasNewLogs, setHasNewLogs, updateHeatmapFromLog]);
  
  // Initial processing of all existing logs
  useEffect(() => {
    // Clear previous data
    setHeatmapData(createEmptyGrid());
    setAttackSources(new Map());
    
    // Process existing logs to build initial heatmap
    let attackCount = 0;
    const ipPositions = new Map();
    const newGrid = createEmptyGrid();
    
    logs.forEach(log => {
      if (log.status && log.status.toLowerCase().includes("sqli")) {
        attackCount++;
        
        // Get the source IP
        const sourceIP = log.ip || `unknown-${log.id || attackCount}`;
        
        // If this IP already has a position, use it
        let position;
        if (ipPositions.has(sourceIP)) {
          position = ipPositions.get(sourceIP);
        } else {
          // Find the cell with minimum intensity for a new IP
          let minIntensity = Number.MAX_VALUE;
          let minPositions = [];
          
          for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
              if (newGrid[r][c] < minIntensity) {
                minIntensity = newGrid[r][c];
                minPositions = [{ row: r, col: c }];
              } else if (newGrid[r][c] === minIntensity) {
                minPositions.push({ row: r, col: c });
              }
            }
          }
          
          // Choose a random position from the cells with minimum intensity
          position = minPositions[Math.floor(Math.random() * minPositions.length)];
          ipPositions.set(sourceIP, position);
        }
        
        // Increment intensity with proper scaling
        const { row, col } = position;
        const currentValue = newGrid[row][col];
        newGrid[row][col] = currentValue < 5 ? currentValue + 1 : Math.min(20, currentValue + 0.5);
      }
    });
    
    if (attackCount > 0) {
      setHeatmapData(newGrid);
      setAttackSources(ipPositions);
      setTotalAttacks(attackCount);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, []); // Run once on component mount
  
  // Handle reset view
  const handleResetView = () => {
    setHeatmapData(createEmptyGrid());
    setAttackSources(new Map());
    setTotalAttacks(0);
    setLastUpdated("--:--:--");
  };
  
  // Calculate max value for proper color scaling
  const maxValue = Math.max(...heatmapData.flat());
  
  return (
    <div className="w-full h-full rounded-lg bg-slate-800 shadow-lg p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <h2 className="text-xl font-bold text-white">SQL Injection Attack Heatmap</h2>
        <div className="flex flex-wrap gap-2">
          <div className="bg-slate-700 px-3 py-1 rounded-md">
            <span className="text-gray-400 text-xs">TOTAL ATTACKS</span>
            <p className="text-white font-bold">{totalAttacks}</p>
          </div>
          <div className="bg-slate-700 px-3 py-1 rounded-md">
            <span className="text-gray-400 text-xs">UNIQUE SOURCES</span>
            <p className="text-white font-bold">{attackSources.size}</p>
          </div>
          <div className="bg-slate-700 px-3 py-1 rounded-md">
            <span className="text-gray-400 text-xs">LAST UPDATE</span>
            <p className="text-white font-bold">{lastUpdated}</p>
          </div>
          <div className="bg-slate-700 px-3 py-1 rounded-md">
            <span className="text-gray-400 text-xs">STATUS</span>
            <p className={`font-bold ${socketStatus.connected ? 'text-green-500' : 'text-red-500'}`}>
              {socketStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="w-full h-96 transition-all duration-300 ease-in-out">
        <Plot
          data={[
            {
              z: heatmapData,
              type: "heatmap",
              colorscale: [
                [0, "rgba(255, 255, 255, 0.05)"],  // Almost transparent (no attacks)
                [0.2, "rgba(59, 130, 246, 0.5)"],  // Light blue (low attacks)
                [0.4, "rgba(255, 165, 0, 0.6)"],   // Orange (medium attacks)
                [0.7, "rgba(239, 68, 68, 0.8)"],   // Red (high attacks)
                [1.0, "rgba(153, 27, 27, 1)"],     // Dark red (critical attacks)
              ],
              showscale: true,
              colorbar: {
                title: "Attack Intensity",
                titlefont: { color: "#FFF" },
                tickvals: [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue],
                ticktext: ["None", "Low", "Medium", "High", "Critical"],
                tickfont: { color: "#FFF" },
              },
            },
          ]}
          layout={{
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(15,23,42,0.3)",
            font: { color: "#FFF" },
            margin: { l: 60, r: 30, t: 10, b: 60 },
            xaxis: { 
              title: "Attack Region (X)",
              tickfont: { color: "#BBB" },
              gridcolor: "rgba(255,255,255,0.1)",
              range: [-0.5, GRID_COLS - 0.5],  // Ensure grid fits properly
            },
            yaxis: { 
              title: "Attack Region (Y)", 
              tickfont: { color: "#BBB" },
              gridcolor: "rgba(255,255,255,0.1)",
              range: [-0.5, GRID_ROWS - 0.5],  // Ensure grid fits properly
              autorange: 'reversed',  // Ensure (0,0) is at the top-left
            },
            annotations: [
              {
                text: socketStatus.connected ? 'LIVE' : 'OFFLINE',
                x: 1,
                y: 1.05,
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {
                  family: 'Arial',
                  size: 12,
                  color: socketStatus.connected ? '#FF4136' : '#AAAAAA'
                },
                bgcolor: 'rgba(0,0,0,0.5)',
                bordercolor: socketStatus.connected ? '#FF4136' : '#AAAAAA',
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
              filename: 'sqli_heatmap',
            }
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between mt-4 gap-2">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
            <span className="text-xs text-gray-300">Low</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500 mr-1"></div>
            <span className="text-xs text-gray-300">Medium</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
            <span className="text-xs text-gray-300">High</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-800 mr-1"></div>
            <span className="text-xs text-gray-300">Critical</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded transition-colors"
            onClick={handleResetView}
          >
            Reset View
          </button>
          
          {!socketStatus.connected && (
            <button 
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded transition-colors"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SQLiHeatmap;