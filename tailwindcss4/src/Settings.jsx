import React, { useState, useEffect } from "react";
import { toast, Toaster } from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Shield, 
  Lock, 
  Clock, 
  RefreshCw, 
  UserCheck, 
  Fingerprint,
  ShieldAlert,
  AlertCircle,
  Info,
  LogOut,
  Check,
  RotateCcw,
  X
} from "lucide-react";

const Settings = ({ isDarkMode }) => {
  // Updated initial settings to match backend's structure
  const initialSettings = {
    rate_limiting_enabled: true,
    max_login_attempts: 5,
    window_minutes: 15,
    captcha_enabled: true,
    trigger_threshold: 2,
    two_factor_enabled: true,
    session_timeout: 30,
    remember_me_days: 7
  };

  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [blockedSessions, setBlockedSessions] = useState([
    { id: 'session_123', blockedAt: '2025-02-26T10:15:32Z', reason: 'Multiple failed login attempts' },
    { id: 'session_456', blockedAt: '2025-02-26T11:22:45Z', reason: 'Suspicious activity detected' },
    { id: 'session_789', blockedAt: '2025-02-26T12:37:18Z', reason: 'Potential brute force attack' }
  ]);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  const [activeSection, setActiveSection] = useState(null);

  // Check admin authentication on mount
  useEffect(() => {
    const adminAuth = localStorage.getItem("adminAuth");
    if (adminAuth !== "true") {
      window.location.href = '/admin/login';
    }
  }, []);

  // Load settings from backend on mount (or from localStorage for now)
  useEffect(() => {
    const storedSettings = localStorage.getItem('securitySettings');
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings));
      } catch (error) {
        console.error("Error parsing settings from localStorage", error);
        localStorage.removeItem('securitySettings');
        setSettings(initialSettings);
      }
    }
    setLoading(false);
  }, []);

  // Auto-logout based on inactivity
  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const updateActivity = () => setLastActivity(Date.now());
    activityEvents.forEach(event => window.addEventListener(event, updateActivity));
    const inactivityCheckInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > SESSION_TIMEOUT) {
        handleLogout();
      }
    }, 60000);
    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(inactivityCheckInterval);
    };
  }, [lastActivity]);

  // Handle setting changes
  const handleChange = (name, value) => {
    const updatedSettings = { ...settings, [name]: value };
    setSettings(updatedSettings);
    if (typeof value === 'boolean') {
      toast.success(
        `${name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} ${value ? 'enabled' : 'disabled'}`, {
          icon: value ? <Check className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-yellow-500" />,
          style: {
            borderRadius: '10px',
            background: isDarkMode ? '#1F2937' : '#fff',
            color: isDarkMode ? '#fff' : '#333',
            border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
          },
          duration: 3000,
        }
      );
    }
    setLastActivity(Date.now());
  };

  // Handle numeric input changes
  const handleNumberChange = (name, value) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      handleChange(name, numValue);
    }
    setLastActivity(Date.now());
  };

  // Save settings to the backend
  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("http://127.0.0.1:5000/settings", { // Use full URL
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          rate_limiting: {
            enabled: settings.rate_limiting_enabled,
            max_attempts: settings.max_login_attempts,
            window_minutes: settings.window_minutes
          },
          captcha: {
            enabled: settings.captcha_enabled,
            trigger_threshold: settings.trigger_threshold
          },
          two_factor: {
            enabled: settings.two_factor_enabled,
            method: "email"
          },
          session: {
            timeout_minutes: settings.session_timeout,
            remember_me_days: settings.remember_me_days
          }
        })
      });
  
      // Read the response as text and parse if not empty
      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse JSON:", e);
        }
      }
  
      if (response.ok) {
        setSuccess("Security settings updated successfully!");
        // ... (show success toast)
      } else {
        setError(data.message || "Error saving settings");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      setError("Failed to save settings. Please try again.");
    }
    setSaving(false);
    setLastActivity(Date.now());
  };
  

  // Reset settings to defaults and update backend
  const resetSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/settings", {
        method: "POST", // Changed from PUT to POST
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          rate_limiting: {
            enabled: initialSettings.rate_limiting_enabled,
            max_attempts: initialSettings.max_login_attempts,
            window_minutes: initialSettings.window_minutes
          },
          captcha: {
            enabled: initialSettings.captcha_enabled,
            trigger_threshold: initialSettings.trigger_threshold
          },
          two_factor: {
            enabled: initialSettings.two_factor_enabled,
            method: "email"
          },
          session: {
            timeout_minutes: initialSettings.session_timeout,
            remember_me_days: initialSettings.remember_me_days
          }
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSettings(initialSettings);
        setSuccess("Settings reset to defaults successfully!");
        toast.success("Settings reset to defaults", {
          icon: <RotateCcw className="mr-2 h-4 w-4 text-blue-500" />,
          style: {
            borderRadius: '10px',
            background: isDarkMode ? '#1F2937' : '#fff',
            color: isDarkMode ? '#fff' : '#333',
            border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
          },
          duration: 4000,
        });
      } else {
        setError(data.message || "Error resetting settings");
      }
    } catch (err) {
      console.error("Error resetting settings:", err);
      setError("Failed to reset settings. Please try again.");
    }
    setSaving(false);
    setLastActivity(Date.now());
  };

  // Unblock a session (frontend only; can later tie this to a backend endpoint)
  const unblockSession = async (sessionId) => {
    try {
      setBlockedSessions(blockedSessions.filter(session => session.id !== sessionId));
      toast.success(`Session ${sessionId} unblocked successfully`, {
        icon: <Check className="h-5 w-5 text-green-500" />,
        style: {
          borderRadius: '10px',
          background: isDarkMode ? '#1F2937' : '#fff',
          color: isDarkMode ? '#fff' : '#333',
          border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
        },
      });
      setLastActivity(Date.now());
    } catch (err) {
      toast.error("Failed to unblock session", {
        style: {
          borderRadius: '10px',
          background: isDarkMode ? '#1F2937' : '#fff',
          color: isDarkMode ? '#fff' : '#333',
          border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
        },
      });
      console.error("Error unblocking session:", err);
    }
  };

  // Handle logout and reset settings in state
  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    setSettings(initialSettings);
    toast.success('Logged out successfully');
    window.location.href = '/admin/login';
  };

  // Calculate security score
  const getSecurityScore = () => {
    let score = 0;
    if (settings.rate_limiting_enabled) score += 20;
    if (settings.captcha_enabled) score += 25;
    if (settings.two_factor_enabled) score += 35;
    if (settings.session_timeout) score += 20;
    return score;
  };

  const securityScore = getSecurityScore();
  const getScoreColor = () => securityScore < 40 ? 'text-red-500 dark:text-red-400' : securityScore < 70 ? 'text-yellow-500 dark:text-yellow-400' : 'text-green-500 dark:text-green-400';
  const getScoreBackground = () => securityScore < 40 ? 'bg-red-100 dark:bg-red-950' : securityScore < 70 ? 'bg-yellow-100 dark:bg-yellow-950' : 'bg-green-100 dark:bg-green-950';

  // Section hover effects
  const handleSectionHover = (section) => setActiveSection(section);
  const getSectionStyles = (section) => activeSection === section 
    ? `scale-[1.01] shadow-md ${isDarkMode ? 'bg-gradient-to-b from-gray-750 to-gray-800 border-blue-800' : 'bg-white border-blue-200 shadow-blue-200/50'}`
    : `${isDarkMode ? 'bg-gradient-to-b from-gray-800 to-gray-750 border-gray-700' : 'bg-white border-gray-200'}`;

  const formatTimestamp = (timestamp) => new Date(timestamp).toLocaleString();

  return (
    <div className={`min-h-screen p-4 md:p-8 transition-all duration-300 ease-in-out ${isDarkMode 
      ? 'bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 text-gray-100' 
      : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 text-gray-900'}`}>
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-8">
          <div className="flex items-center">
            <Shield className="h-8 w-8 mr-3 text-blue-500" />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">
              Security Settings
            </h1>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className={`px-4 py-2 rounded-full flex items-center transition-all duration-300 ${getScoreBackground()}`}>
              <ShieldAlert className={`mr-2 h-5 w-5 ${getScoreColor()}`} />
              <span>Security Score:</span>
              <div className="ml-2 font-bold relative">
                <span className={`${getScoreColor()}`}>{securityScore}%</span>
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${securityScore}%` }} />
              </div>
            </div>
            <Button onClick={handleLogout} variant="destructive" className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800 transition-all duration-300 flex items-center shadow-md">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-8 border-red-400 bg-red-50 dark:bg-red-900/30 dark:border-red-800 animate-pulse">
            <AlertTitle className="flex items-center text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5 mr-2" /> Error
            </AlertTitle>
            <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="mb-8 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-100 border-green-200 dark:border-green-800 animate-pulse">
            <AlertTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" /> Success
            </AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Authentication Protection Section */}
        <Card className={`mb-8 shadow-lg transition-all duration-300 ease-in-out ${getSectionStyles('auth')} hover:shadow-xl`} onMouseEnter={() => handleSectionHover('auth')} onMouseLeave={() => handleSectionHover(null)}>
          <CardHeader className="pb-2 pt-6">
            <div className="flex items-center">
              <Shield className="mr-2 h-6 w-6 text-blue-500" />
              <CardTitle className="text-blue-700 dark:text-blue-400">Authentication Protection</CardTitle>
            </div>
            <CardDescription className="dark:text-gray-400">Configure how the system protects against unauthorized access attempts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-4 pb-6">
            <div className="grid gap-8">
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Lock className="mr-2 h-5 w-5 text-indigo-500" />
                    <Label htmlFor="rate_limiting" className="font-medium">Rate Limiting</Label>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Limits the number of login attempts within a time period</p>
                </div>
                <div className="flex items-center">
                  <span className={`mr-4 text-sm font-medium ${settings.rate_limiting_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {settings.rate_limiting_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch id="rate_limiting" checked={settings.rate_limiting_enabled} onCheckedChange={(checked) => handleChange("rate_limiting_enabled", checked)} className={`${settings.rate_limiting_enabled ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                </div>
              </div>
              {settings.rate_limiting_enabled && (
                <div className="ml-8 grid gap-4 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-lg animate-fadeIn transition-all duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="max_attempts" className="text-blue-800 dark:text-blue-300 flex items-center">
                        Maximum Login Attempts
                        <Info className="h-4 w-4 ml-1 text-blue-500 dark:text-blue-400 cursor-help" />
                      </Label>
                      <Input id="max_attempts" type="number" min="1" value={settings.max_login_attempts} onChange={(e) => handleNumberChange("max_login_attempts", e.target.value)} className="mt-2 border-blue-200 dark:border-blue-800 dark:bg-gray-800 dark:text-white focus:ring-blue-500" />
                    </div>
                    <div>
                      <Label htmlFor="window_minutes" className="text-blue-800 dark:text-blue-300 flex items-center">
                        Window (minutes)
                        <Info className="h-4 w-4 ml-1 text-blue-500 dark:text-blue-400 cursor-help" />
                      </Label>
                      <Input id="window_minutes" type="number" min="1" value={settings.window_minutes} onChange={(e) => handleNumberChange("window_minutes", e.target.value)} className="mt-2 border-blue-200 dark:border-blue-800 dark:bg-gray-800 dark:text-white focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              )}
              <Separator className="bg-gray-200 dark:bg-gray-700" />
              {/* Session Section */}
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Clock className="mr-2 h-5 w-5 text-indigo-500" />
                    <Label htmlFor="session_timeout" className="font-medium">Session Timeout</Label>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Set the duration (in minutes) before a session expires</p>
                </div>
                <div className="flex items-center">
                  <span className={`mr-4 text-sm font-medium text-green-600 dark:text-green-400`}>
                    {settings.session_timeout} minutes
                  </span>
                  <Input id="session_timeout" type="number" min="1" value={settings.session_timeout} onChange={(e) => handleNumberChange("session_timeout", e.target.value)} className="w-20 mt-0 border-blue-200 dark:border-blue-800 dark:bg-gray-800 dark:text-white focus:ring-blue-500" />
                </div>
              </div>
              <Separator className="bg-gray-200 dark:bg-gray-700" />
              {/* Additional Verification Section */}
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <RefreshCw className="mr-2 h-5 w-5 text-purple-500" />
                    <Label htmlFor="captcha" className="font-medium">CAPTCHA Verification</Label>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Require users to solve a simple challenge to verify they are human</p>
                </div>
                <div className="flex items-center">
                  <span className={`mr-4 text-sm font-medium ${settings.captcha_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {settings.captcha_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch id="captcha" checked={settings.captcha_enabled} onCheckedChange={(checked) => handleChange("captcha_enabled", checked)} className={`${settings.captcha_enabled ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                </div>
              </div>
              <Separator className="bg-gray-200 dark:bg-gray-700" />
              <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Fingerprint className="mr-2 h-5 w-5 text-purple-500" />
                    <Label htmlFor="two_factor" className="font-medium">Two-Factor Authentication (2FA)</Label>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Require a second verification step after password entry</p>
                </div>
                <div className="flex items-center">
                  <span className={`mr-4 text-sm font-medium ${settings.two_factor_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {settings.two_factor_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch id="two_factor" checked={settings.two_factor_enabled} onCheckedChange={(checked) => handleChange("two_factor_enabled", checked)} className={`${settings.two_factor_enabled ? 'bg-green-600 dark:bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
          <Button variant="outline" onClick={resetSettings} disabled={loading || saving} className="bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700 transition-all duration-300">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset to Defaults
          </Button>
          <Button onClick={saveSettings} disabled={loading || saving} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:translate-y-px active:translate-y-0.5">
            {saving ? (
              <span className="flex items-center">
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span>
                Saving...
              </span>
            ) : (
              <span className="flex items-center">
                <Shield className="mr-2 h-4 w-4" /> Save Settings
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;