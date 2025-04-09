// src/hooks/usePersistentLogs.js
import { useState, useEffect, useCallback } from 'react';

const LOGS_STORAGE_KEY = 'security_dashboard_logs';

export const usePersistentLogs = (initialLogs = []) => {
  // Initialize state with logs from localStorage or the provided initial value
  const [logs, setLogsState] = useState(() => {
    try {
      const storedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
      return storedLogs ? JSON.parse(storedLogs) : initialLogs;
    } catch (error) {
      console.error('Failed to retrieve logs from localStorage:', error);
      return initialLogs;
    }
  });

  // Custom setter that updates both state and localStorage
  const setLogs = useCallback((logsOrUpdater) => {
    setLogsState(prevLogs => {
      // Handle both direct value and function updater
      const newLogs = typeof logsOrUpdater === 'function' 
        ? logsOrUpdater(prevLogs) 
        : logsOrUpdater;
      
      // Save to localStorage
      try {
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(newLogs));
      } catch (error) {
        console.error('Failed to save logs to localStorage:', error);
      }
      
      return newLogs;
    });
  }, []);

  // Optional: Clear all logs
  const clearLogs = useCallback(() => {
    setLogsState([]);
    localStorage.removeItem(LOGS_STORAGE_KEY);
  }, []);

  return [logs, setLogs, clearLogs];
};