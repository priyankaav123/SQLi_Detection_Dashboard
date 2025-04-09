import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import Sidebar from "./Sidebar";
import Settings from "./Settings"; 
import AdminLogin from "./AdminLogin";
// Import the new Analysis component
import Analysis from "./Analysis";
// Import the WebSocketProvider
import { WebSocketProvider } from "./context/WebSocketContext";

const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

const PlaceholderPage = ({ title, isDarkMode, isSidebarExpanded }) => (
  <div 
    className={`min-h-screen transition-all duration-300 ease-in-out p-8
      ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}
  >
    <div className="w-full">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <div className="p-6 rounded-lg border shadow-sm bg-opacity-50 
        backdrop-blur-lg backdrop-filter
        dark:bg-gray-800 dark:border-gray-700 bg-white border-gray-200">
        <p>This is a placeholder for the {title} page.</p>
      </div>
    </div>
  </div>
);

// Keep these placeholder components for reference but they won't be used in routes
const SecurityAlerts = (props) => <PlaceholderPage title="Security Alerts" {...props} />;
const ActivityMonitor = (props) => <PlaceholderPage title="Activity Monitor" {...props} />;
const Reports = (props) => <PlaceholderPage title="Reports" {...props} />;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error in component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-800 rounded-lg m-8 border border-red-200">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <pre className="bg-white p-4 rounded overflow-auto max-h-64">
            {this.state.error && this.state.error.toString()}
          </pre>
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Modified Authentication guard for protected routes
const ProtectedRoute = ({ element, isDarkMode, isSidebarExpanded }) => {
  // Always authenticate without checking
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  // Return the protected component directly
  return React.cloneElement(element, { isDarkMode, isSidebarExpanded });
};

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  const handleMouseEnter = () => {
    if (!isSidebarPinned) {
      setIsSidebarExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isSidebarPinned) {
      setIsSidebarExpanded(false);
    }
  };

  const togglePin = () => {
    setIsSidebarPinned(prev => {
      const newPinned = !prev;
      setIsSidebarExpanded(newPinned); // Expand when pinning, collapse when unpinning
      return newPinned;
    });
  };

  window.cn = cn;

  return (
    <ErrorBoundary>
      <WebSocketProvider>
        <Router>
          <div className={`flex min-h-screen ${isDarkMode ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
            <Routes>
              {/* Admin login route - no sidebar on this page */}
              <Route 
                path="/admin/login" 
                element={<AdminLogin isDarkMode={isDarkMode} />} 
              />
              
              {/* Protected admin settings routes */}
              <Route 
                path="/admin/settings" 
                element={
                  <div className="flex w-full">
                    <Sidebar 
                      toggleTheme={toggleTheme}
                      isDarkMode={isDarkMode}
                      isExpanded={isSidebarExpanded}
                      isPinned={isSidebarPinned}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onTogglePin={togglePin}
                    />
                    <main 
                      className="flex-1 transition-all duration-300 ease-in-out"
                      style={{
                        marginLeft: isSidebarExpanded || isSidebarPinned ? '20rem' : '5rem',
                        width: '100vw'
                      }}
                    >
                      <ProtectedRoute 
                        element={<Settings />} 
                        isDarkMode={isDarkMode} 
                        isSidebarExpanded={isSidebarExpanded || isSidebarPinned} 
                      />
                    </main>
                  </div>
                }
              />
              
              {/* Regular app routes with sidebar */}
              <Route 
                path="/*" 
                element={
                  <>
                    <Sidebar 
                      toggleTheme={toggleTheme}
                      isDarkMode={isDarkMode}
                      isExpanded={isSidebarExpanded}
                      isPinned={isSidebarPinned}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onTogglePin={togglePin}
                    />
                    <main 
                      className="flex-1 transition-all duration-300 ease-in-out"
                      style={{
                        marginLeft: isSidebarExpanded || isSidebarPinned ? '20rem' : '5rem',
                        width: '100vw'
                      }}
                    >
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route 
                          path="/dashboard" 
                          element={<Dashboard 
                            isDarkMode={isDarkMode} 
                            isSidebarExpanded={isSidebarExpanded || isSidebarPinned}
                          />} 
                        />
                        {/* Update Analysis route to use the imported component */}
                        <Route path="/analysis" element={<Analysis isDarkMode={isDarkMode} isSidebarExpanded={isSidebarExpanded || isSidebarPinned} />} />
                        {/* Removed the following three routes */}
                        {/* <Route path="/alerts" element={<SecurityAlerts isDarkMode={isDarkMode} isSidebarExpanded={isSidebarExpanded || isSidebarPinned} />} /> */}
                        {/* <Route path="/activity" element={<ActivityMonitor isDarkMode={isDarkMode} isSidebarExpanded={isSidebarExpanded || isSidebarPinned} />} /> */}
                        {/* <Route path="/reports" element={<Reports isDarkMode={isDarkMode} isSidebarExpanded={isSidebarExpanded || isSidebarPinned} />} /> */}
                        <Route path="/settings" element={<Navigate to="/admin/login" replace />} />
                        <Route 
                          path="*" 
                          element={<div className="p-8"><h1 className="text-2xl font-bold">404 - Page Not Found</h1></div>} 
                        />
                      </Routes>
                    </main>
                  </>
                }
              />
            </Routes>
          </div>
        </Router>
      </WebSocketProvider>
    </ErrorBoundary>
  );
};

export default App;