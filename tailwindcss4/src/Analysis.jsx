import React, { useState, useEffect } from "react";
import { WebSocketProvider, useWebSocket } from "./context/WebSocketContext";
import SQLiPieChart from "./SQLiPieChart";
import SQLiHeatmap from "./SQLiHeatmap";
import SQLiTrendGraph from "./SQLiTrendGraph";
import SQLiComparisonGraph from "./SQLiComparisonGraph";

// AnalysisContent component that uses the WebSocket context
const AnalysisContent = () => {
  // Get data and functions from WebSocket context
  const { 
    logs, 
    socketStatus, 
    hasNewLogs, 
    setHasNewLogs, 
    handleManualReconnect,
    clearLogs 
  } = useWebSocket();

  // State derived from logs
  const [totalSQLi, setTotalSQLi] = useState(0);
  const [totalFailedLogins, setTotalFailedLogins] = useState(0);
  const [totalSuccessfulLogins, setTotalSuccessfulLogins] = useState(0);
  const [mostFrequentAttack, setMostFrequentAttack] = useState("N/A");
  const [peakAttackHour, setPeakAttackHour] = useState("N/A");
  const [lastUpdateTime, setLastUpdateTime] = useState("--:--:--");
  const [uniqueSources, setUniqueSources] = useState(0);

  // Process logs & update metrics when logs change
  useEffect(() => {
    if (!logs || logs.length === 0) {
      setTotalSQLi(0);
      setTotalFailedLogins(0);
      setTotalSuccessfulLogins(0);
      setMostFrequentAttack("N/A");
      setPeakAttackHour("N/A");
      setUniqueSources(0);
      return;
    }
    
    let sqliCount = 0;
    let failedCount = 0;
    let successfulCount = 0;
    let attackTypes = {};
    let hourlyAttacks = {};
    let uniqueIPs = new Set();

    logs.forEach((log) => {
      // Safely handle log data regardless of type
      const logString = typeof log === 'string' 
        ? log 
        : log.remarks || ""; // Use the remarks field from parsed logs
      
      // First check if log is string or has proper object properties
      const isSQLi = (typeof logString === 'string' && logString.includes("SQL Injection detected!")) || 
                     (log.status && typeof log.status === 'string' && log.status.toLowerCase().includes("sqli attempt"));
      
      const isFailedLogin = (typeof logString === 'string' && logString.includes("Incorrect password")) ||
                           (log.status && typeof log.status === 'string' && log.status.toLowerCase().includes("failed login"));
      
      const isSuccessfulLogin = (typeof logString === 'string' && logString.includes("logged in")) ||
                               (log.status && typeof log.status === 'string' && log.status.toLowerCase().includes("successful login"));

      if (isSQLi) sqliCount++;
      if (isFailedLogin) failedCount++;
      if (isSuccessfulLogin) successfulCount++;

      // Track unique IPs
      if (log.ip) {
        uniqueIPs.add(log.ip);
      }

      let attackType = "Unknown";
      
      // Ensure logString is a string before using regex
      if (typeof logString === 'string') {
        // Check for SQL injection patterns
        if (/union\s+select|union\s*all\s*select|union\+\s*select/i.test(logString)) attackType = "Union-Based SQLi";
        else if (/error\s+in\s+your\s+sql|updatexml|extractvalue|mysql_error|pg_error|ORA-|database\s+error/i.test(logString)) attackType = "Error-Based SQLi";
        else if (/or\s+.*=\s+.*|and\s+.*=\s+.*|or\s+\d+=\d+|or\s+'.+'='.+|and\s+'.+'='.+/i.test(logString)) attackType = "Boolean-Based SQLi";
        else if (/sleep\(\d+\)|benchmark\(\d+,|pg_sleep\(\d+\)|waitfor\s+delay\s+'00:00:\d+'/i.test(logString)) attackType = "Time-Based SQLi";
        else if (/load_file|outfile|into\s+dumpfile|xp_cmdshell|openrowset|bulk\s+insert|fetchurl/i.test(logString)) attackType = "Out-of-Band SQLi";
        else if (/\bselect\s*\/\*\*\/\s*\bfrom\b|\bunion\s*\/\*\*\/\s*select\b|concat\(.*char\(\d+\)\)/i.test(logString)) attackType = "Obfuscated SQLi";
        else if (/\bexists\s*\(|\bnot exists\s*\(|case\s+when\s+|if\s*\(.+\)/i.test(logString)) attackType = "Blind SQLi";
        else if (/;.*select|;.*insert|;.*update|;.*delete|;.*drop/i.test(logString)) attackType = "Stacked Queries";
        else if (/0x[0-9A-F]+|unhex\(|char\(\d+\)|ascii\(\w+\)/i.test(logString)) attackType = "Hex/Unicode SQLi";
        else if (/--\s|\#.*\n|\;\s*--/i.test(logString)) attackType = "Comment-Based SQLi";
        else attackType = "Unknown";
      }

      if (isSQLi) {
        attackTypes[attackType] = (attackTypes[attackType] || 0) + 1;
      }

      // Extract timestamp for hourly analysis
      const timestamp = typeof log === 'string' 
        ? (logString.match(/\[(\d{4}-\d{2}-\d{2} \d{2}):\d{2}/) || [])[1]
        : `${log.date || ""} ${log.time || ""}`.substring(0, 13);
      
      if (timestamp && isSQLi) {
        hourlyAttacks[timestamp] = (hourlyAttacks[timestamp] || 0) + 1;
      }
    });

    setTotalSQLi(sqliCount);
    setTotalFailedLogins(failedCount);
    setTotalSuccessfulLogins(successfulCount);
    setUniqueSources(uniqueIPs.size);

    setMostFrequentAttack(
      Object.keys(attackTypes).length > 0
        ? Object.keys(attackTypes).reduce((a, b) => (attackTypes[a] > attackTypes[b] ? a : b), "N/A")
        : "N/A"
    );

    setPeakAttackHour(
      Object.keys(hourlyAttacks).length > 0
        ? Object.keys(hourlyAttacks).reduce((a, b) => (hourlyAttacks[a] > hourlyAttacks[b] ? a : b), "N/A")
        : "N/A"
    );

    // Update last update time when logs change
    if (hasNewLogs) {
      setLastUpdateTime(new Date().toLocaleTimeString());
      setHasNewLogs(false);
    }
  }, [logs, hasNewLogs, setHasNewLogs]);

  // Handle loading state
  if (!socketStatus.connected && !logs.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Connecting to security analytics server...</p>
          {socketStatus.error && (
            <div className="mt-4 text-red-400">
              <p>{socketStatus.error}</p>
              <button 
                onClick={handleManualReconnect}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reconnect
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center space-x-3 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            <h1 className="text-4xl font-bold text-white">
              Advanced SQL Injection Analysis
            </h1>
          </div>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Real-time monitoring and analysis of SQL injection attempts and login activities
          </p>
          <div className="mt-2 text-sm text-gray-400 flex justify-center items-center space-x-4">
            <span>Last updated: {lastUpdateTime}</span>
            <span className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              socketStatus.connected 
                ? "bg-green-900 text-green-300"
                : "bg-red-900 text-red-300"
            }`}>
              <span className={`w-2 h-2 mr-1 rounded-full ${
                socketStatus.connected ? "bg-green-500" : "bg-red-500"
              }`}></span>
              {socketStatus.connected ? "Connected" : "Disconnected"}
            </span>
            <button 
              onClick={clearLogs} 
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-slate-800 rounded-xl shadow-lg p-4 transition-all hover:bg-slate-700 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400 flex items-center">
                <span className="mr-2">🚨</span>SQLi Attempts
              </h3>
              <span className="px-2 py-1 text-xs font-medium bg-red-900 text-red-300 rounded-full">CRITICAL</span>
            </div>
            <p className="text-3xl font-bold text-red-500">{totalSQLi}</p>
          </div>
          
          <div className="bg-slate-800 rounded-xl shadow-lg p-4 transition-all hover:bg-slate-700 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400 flex items-center">
                <span className="mr-2">🔑</span>Failed Logins
              </h3>
              <span className="px-2 py-1 text-xs font-medium bg-amber-900 text-amber-300 rounded-full">WARNING</span>
            </div>
            <p className="text-3xl font-bold text-amber-500">{totalFailedLogins}</p>
          </div>
          
          <div className="bg-slate-800 rounded-xl shadow-lg p-4 transition-all hover:bg-slate-700 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400 flex items-center">
                <span className="mr-2">✅</span>Successful Logins
              </h3>
              <span className="px-2 py-1 text-xs font-medium bg-green-900 text-green-300 rounded-full">NORMAL</span>
            </div>
            <p className="text-3xl font-bold text-green-500">{totalSuccessfulLogins}</p>
          </div>
          
          <div className="bg-slate-800 rounded-xl shadow-lg p-4 transition-all hover:bg-slate-700 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400 flex items-center">
                <span className="mr-2">🎯</span>Frequent Attack
              </h3>
              <span className="px-2 py-1 text-xs font-medium bg-blue-900 text-blue-300 rounded-full">INFO</span>
            </div>
            <p className="text-sm font-bold text-blue-400 truncate" title={mostFrequentAttack}>
              {mostFrequentAttack}
            </p>
          </div>
          
          <div className="bg-slate-800 rounded-xl shadow-lg p-4 transition-all hover:bg-slate-700 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400 flex items-center">
                <span className="mr-2">⏳</span>Peak Attack Hour
              </h3>
              <span className="px-2 py-1 text-xs font-medium bg-purple-900 text-purple-300 rounded-full">INSIGHT</span>
            </div>
            <p className="text-sm font-bold text-purple-400">{peakAttackHour}</p>
          </div>
          
          <div className="bg-slate-800 rounded-xl shadow-lg p-4 transition-all hover:bg-slate-700 border-l-4 border-cyan-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400 flex items-center">
                <span className="mr-2">🌐</span>Unique Sources
              </h3>
              <span className="px-2 py-1 text-xs font-medium bg-cyan-900 text-cyan-300 rounded-full">SOURCES</span>
            </div>
            <p className="text-3xl font-bold text-cyan-500">{uniqueSources}</p>
          </div>
        </div>

        {/* Attack Heatmap */}
        <div className="mb-8 bg-slate-800 rounded-lg shadow-lg overflow-hidden">
          <SQLiHeatmap />
        </div>

        {/* Charts - First Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg shadow-lg p-4 hover:bg-slate-700 transition-all">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
              </svg>
              Attack Type Distribution
            </h2>
            <div className="h-80 overflow-auto">
              <SQLiPieChart />
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg shadow-lg p-4 hover:bg-slate-700 transition-all">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              Attack Type Comparison
            </h2>
            <div className="h-80 overflow-auto">
              <SQLiComparisonGraph />
            </div>
          </div>
        </div>

        {/* Charts - Second Row */}
        <div className="mb-8">
          <div className="bg-slate-800 rounded-lg shadow-lg p-4 hover:bg-slate-700 transition-all">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Attack Trend Analysis
            </h2>
            <div className="h-80 overflow-auto">
              <SQLiTrendGraph />
            </div>
          </div>
        </div>

        {/* Latest Logs */}
        <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden hover:bg-slate-700 transition-all mb-8">
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700 bg-slate-900">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Latest Security Events
            </h2>
            <div className="flex space-x-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-700 text-white">
                {logs.length} events
              </span>
              {logs.length > 0 && (
                <button 
                  onClick={clearLogs}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded-full transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {logs.length > 0 ? (
              <ul className="divide-y divide-gray-700">
                {logs.slice(0, 15).map((log, index) => {
                  // Create a consistent log format regardless of whether it's a string or object
                  const logText = typeof log === 'string' 
                    ? log 
                    : `[${log.date || ""} ${log.time || ""}] [IP: ${log.ip || ""}] [${log.status || ""}] ${log.remarks || ""}`;
                  
                  // Safely check for patterns while ensuring values are strings
                  const isSQLi = (typeof logText === 'string' && logText.includes("SQL Injection")) || 
                                (log.status && typeof log.status === 'string' && log.status.toLowerCase().includes("sqli"));
                  
                  const isFailedLogin = (typeof logText === 'string' && logText.includes("Incorrect password")) || 
                                       (log.status && typeof log.status === 'string' && log.status.toLowerCase().includes("failed login"));
                  
                  const isSuccessfulLogin = (typeof logText === 'string' && logText.includes("logged in")) || 
                                           (log.status && typeof log.status === 'string' && log.status.toLowerCase().includes("successful login"));
                                       
                  return (
                    <li key={index} className={`px-6 py-4 hover:bg-slate-600 transition-colors duration-150 ${
                      isSQLi ? "bg-red-900 bg-opacity-20" : 
                      isFailedLogin ? "bg-amber-900 bg-opacity-10" :
                      isSuccessfulLogin ? "bg-green-900 bg-opacity-10" : ""
                    }`}>
                      <p className={`text-sm font-mono ${
                        isSQLi 
                          ? "text-red-400" 
                          : isFailedLogin
                          ? "text-amber-400"
                          : isSuccessfulLogin
                          ? "text-green-400"
                          : "text-gray-300"
                      }`}>
                        {logText}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>No logs available</p>
              </div>
            )}
          </div>
        </div>

        {/* Status Footer */}
        <div className="bg-slate-800 rounded-lg p-4 text-center">
          <div className="flex justify-center items-center space-x-4">
            <div className="flex items-center">
              <span className={`w-3 h-3 mr-2 rounded-full ${socketStatus.connected ? "bg-green-500" : "bg-red-500"}`}></span>
              <span className="text-gray-300">WebSocket: {socketStatus.connected ? "Connected" : "Disconnected"}</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 mr-2 rounded-full bg-blue-500"></span>
              <span className="text-gray-300">Last Update: {lastUpdateTime}</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 mr-2 rounded-full bg-purple-500"></span>
              <span className="text-gray-300">Total Events: {logs.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapped Analysis component with WebSocketProvider
const Analysis = () => {
  return (
    <WebSocketProvider>
      <AnalysisContent />
    </WebSocketProvider>
  );
};

export default Analysis;