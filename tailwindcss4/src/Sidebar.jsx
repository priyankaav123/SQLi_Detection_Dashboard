import { useLocation, Link } from "react-router-dom";
import React, { useState, useEffect } from 'react';
import { 
  Home, 
  BarChart2, 
  Settings, 
  FileText, 
  Shield, 
  Sun,
  Moon,
  ChevronRight,
  Activity,
  AlertTriangle,
  Terminal,
  Network,
  Clock,
  Filter,
  Pin,
  PinOff
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Sidebar = ({ 
  toggleTheme, 
  isDarkMode, 
  isExpanded, 
  isPinned, 
  onMouseEnter, 
  onMouseLeave, 
  onTogglePin,
  logs // Keep this prop to receive logs from Dashboard
}) => {
  const location = useLocation();
  const [currentPath, setCurrentPath] = useState(location.pathname);
  const [alerts, setAlerts] = useState({
    sqlInjection: 0,
    failedLogins: 0
  });

  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname]);

  // Keep the alert logic
  useEffect(() => {
    if (logs && logs.length > 0) {
      const sqlInjectionCount = logs.filter(log => 
        log.status.toLowerCase().includes("sqli attempt")
      ).length;
      const failedLoginsCount = logs.filter(log => 
        log.status.toLowerCase().includes("failed login")
      ).length;
      
      setAlerts({
        sqlInjection: sqlInjectionCount,
        failedLogins: failedLoginsCount
      });
    }
  }, [logs]); // Recompute when logs change

  const NavItem = ({ path, icon: Icon, children, alerts }) => {
    const isActive = currentPath === path;
    const totalAlerts = alerts?.sqlInjection + alerts?.failedLogins;
    const hasSQLI = alerts?.sqlInjection > 0;
    const hasFailedLogins = alerts?.failedLogins > 0;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to={path} className="w-full">
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 px-4 py-6 relative group transition-all duration-200 my-1",
                  isActive && "bg-primary/10 dark:bg-primary/20 border-r-4 border-primary",
                  !isExpanded && "glass-effect"
                )}
              >
                <div className="flex items-center gap-4 min-w-max relative">
                  <Icon 
                    size={20} 
                    className={cn(
                      "transition-all duration-200",
                      isActive ? (isDarkMode ? "text-black" : "text-black") : isDarkMode ? "text-gray-400" : "text-gray-600",
                      !isExpanded && "group-hover:scale-110"
                    )}
                  />
                  {totalAlerts > 0 && (
                    <Badge 
                      variant="destructive"
                      className={cn(
                        "absolute -top-2 -right-2 h-5 min-w-[20px] px-1",
                        hasSQLI && !hasFailedLogins ? "bg-red-600" : 
                        !hasSQLI && hasFailedLogins ? "bg-orange-600" : 
                        "bg-gradient-to-r from-orange-600 to-red-600"
                      )}
                    >
                      {totalAlerts}
                    </Badge>
                  )}
                  <span className={cn(
                    "transition-all duration-300 font-medium",
                    isActive ? (isDarkMode ? "text-black" : "text-black") : isDarkMode ? "text-gray-400" : "text-gray-600",
                    isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                  )}>
                    {children}
                  </span>
                </div>
                {isExpanded && isActive && (
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-primary" size={16} />
                )}
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            {children}
            {alerts && (isExpanded || isPinned) && (
              <div className="mt-1 text-xs flex flex-col gap-1">
                {alerts.sqlInjection > 0 && (
                  <div className="text-red-500 flex items-center gap-1">
                    <AlertTriangle size={12} /> {alerts.sqlInjection} SQL Injection Alerts
                  </div>
                )}
                {alerts.failedLogins > 0 && (
                  <div className="text-orange-400 flex items-center gap-1">
                    <AlertTriangle size={12} /> {alerts.failedLogins} Failed Login Attempts
                  </div>
                )}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const activityFeatures = [
    { icon: Terminal, label: 'Query Monitoring' },
    { icon: Network, label: 'Traffic Analysis' },
    { icon: Clock, label: 'Access Patterns' },
    { icon: Filter, label: 'Pattern Detection' }
  ];

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "flex flex-col h-screen bg-background border-r shadow-sm transition-all duration-300 ease-in-out relative z-50",
        isExpanded || isPinned ? "w-80" : "w-20",
        "fixed left-0 top-0"
      )}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />

      <div className={cn(
        "flex items-center p-4 h-16",
        !isExpanded && "glass-effect"
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          <Shield 
            className={cn(
              "transition-all duration-200 animate-pulse",
              currentPath === "/dashboard" ? (isDarkMode ? "text-black" : "text-black") : isDarkMode ? "text-white" : "text-gray-600",
              "hover:text-primary"
            )} 
            size={28} 
          />
          <h1 className={cn(
            "font-bold text-xl",
            currentPath === "/dashboard" ? (isDarkMode ? "text-black" : "text-black") : isDarkMode ? "text-white" : "text-gray-600",
            isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4",
            "transition-all duration-300 whitespace-nowrap hover:text-primary"
          )}>
            SQL Guard
          </h1>
        </div>
      </div>

      <Separator className="opacity-50" />

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavItem path="/dashboard" icon={Home}>Dashboard</NavItem>
        <NavItem path="/analysis" icon={BarChart2}>Analysis & Metrics</NavItem>
        <NavItem path="/settings" icon={Settings}>Settings</NavItem>

        {isExpanded && currentPath === '/activity' && (
          <div className="mt-4 space-y-2 pl-8 border-l-2 border-primary/20">
            {activityFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-200 py-2">
                <feature.icon size={14} />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      <Separator className="opacity-50" />

      <div className={cn(
        "p-4",
        !isExpanded && "glass-effect"
      )}>
        <div className="flex flex-col gap-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="justify-start gap-4 hover:bg-primary/5 hover:text-primary py-5 w-full text-muted-foreground"
                  onClick={toggleTheme}
                >
                  {isDarkMode ? 
                    <Sun size={20} className="text-muted-foreground group-hover:text-primary" /> : 
                    <Moon size={20} className="text-muted-foreground group-hover:text-primary" />
                  }
                  <span className={cn(
                    "transition-all duration-300 font-medium",
                    isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                  )}>
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Switch to {isDarkMode ? 'Light' : 'Dark'} Mode
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {isExpanded && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onTogglePin}
                    className="p-1 h-8 w-8 rounded-full hover:bg-primary/10"
                  >
                    {isPinned ? 
                      <PinOff size={16} className="text-primary" /> : 
                      <Pin size={16} className="text-muted-foreground" />
                    }
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {isExpanded && (
          <div className="mt-2 text-xs text-center text-muted-foreground">
            <p>SQL Guard v1.2.5</p>
            <p className="mt-1">© 2025 Security Systems Inc.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;