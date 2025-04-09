import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Shield, Lock, EyeOff, Eye } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

const AdminLogin = ({ isDarkMode }) => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const adminAuth = localStorage.getItem("adminAuth");
    if (adminAuth === "true") {
      navigate("/admin/settings");
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value.trim() })); // Trim whitespace
  };

  const handleLogin = () => {
    setError(null);
    setLoading(true);

    // Debug values to console (remove in production)
    console.log("Attempting login with:", credentials);

    // Hardcoded credentials check - strictly checking "admin" and "admin123"
    setTimeout(() => {
      // Trim values to ensure no whitespace issues
      const username = credentials.username.trim();
      const password = credentials.password.trim();
      
      if (username === "admin" && password === "admin123") {
        // Set authentication in localStorage
        localStorage.setItem("adminAuth", "true");
        
        // Show success toast
        toast.success("Login successful!", {
          icon: "🔓",
          style: {
            borderRadius: "10px",
            background: isDarkMode ? "#333" : "#fff",
            color: isDarkMode ? "#fff" : "#333",
          },
        });
        
        // Navigate to settings page
        navigate("/admin/settings");
      } else {
        // Show error for invalid credentials
        setError("Authentication failed. Please check your credentials.");
        
        // Show error toast
        toast.error("Login failed!", {
          icon: "🔒",
          style: {
            borderRadius: "10px",
            background: isDarkMode ? "#333" : "#fff",
            color: isDarkMode ? "#fff" : "#333",
          },
        });
      }
      setLoading(false);
    }, 1000);
  };

  // Handle Enter key press for login
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div
      className={`min-h-screen w-screen flex items-center justify-center transition-all duration-300 ease-in-out 
      ${isDarkMode 
        ? "bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100" 
        : "bg-gradient-to-br from-blue-50 to-indigo-50 text-gray-900"}`}
    >
      <Toaster position="top-right" />
      <Card
        className={`w-full max-w-md shadow-xl ${isDarkMode 
          ? "bg-gradient-to-b from-gray-800 to-gray-750 border-gray-700" 
          : "bg-white"} transition-all duration-300`}
      >
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            <Shield className="h-12 w-12 text-blue-500" />
          </div>
          <CardTitle className="text-2xl">Administrator Login</CardTitle>
          <CardDescription>
            Enter your credentials to access security settings
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert
              variant="destructive"
              className="mb-6 border-red-400 bg-red-50 dark:bg-red-900/40 dark:border-red-800 animate-pulse"
            >
              <AlertTitle className="flex items-center text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5 mr-2" /> Access Denied
              </AlertTitle>
              <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-medium">Username</Label>
              <Input
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleChange}
                placeholder="Enter admin username"
                onKeyDown={handleKeyDown}
                required
                className="border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  onKeyDown={handleKeyDown}
                  required
                  className="pr-10 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Hint: Use "admin" / "admin123" for testing
              </p>
            </div>

            <Separator className="bg-gray-200 dark:bg-gray-700" />

            <div className="flex flex-col gap-4">
              <Button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className={`w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700`}
              >
                {loading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-t-white border-b-white border-r-transparent border-l-transparent mr-2"></span>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-[18px]" />
                    Log In as Administrator
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                className={`border-gray hover:bg-gray`}
              >
                Return to Home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;