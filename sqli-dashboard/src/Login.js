import { useState, useEffect } from "react";
import axios from "axios";
import { FaUser, FaLock, FaShieldAlt } from "react-icons/fa";
import "./Login.css";

// Create a base API configuration
const api = axios.create({
  baseURL: "http://127.0.0.1:5000", // Use your login API port as the primary
  withCredentials: true, // Required for session cookies
  headers: {
    "Content-Type": "application/json"
  }
});

function Login() {
  // Form input states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Security feature states
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [require2FA, setRequire2FA] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [securitySettings, setSecuritySettings] = useState(null);

  // Poll security settings from backend on component mount and continuously thereafter
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get("/settings");
        setSecuritySettings(response.data);
      } catch (error) {
        console.error("Error fetching security settings:", error);
        setMessage("Failed to load security settings.");
      }
    };

    // Initial fetch on mount
    fetchSettings();

    // Set an interval to poll settings every 60 seconds
    const intervalId = setInterval(() => {
      fetchSettings();
    }, 60000); // 60,000 milliseconds = 60 seconds

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Generate a simple math CAPTCHA question and return the expected answer
  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10);
    const num2 = Math.floor(Math.random() * 10);
    setCaptchaQuestion(`What is ${num1} + ${num2}?`);
    return (num1 + num2).toString();
  };

  // Reset form state after successful login or error handling
  const resetForm = () => {
    setUsername("");
    setPassword("");
    setRequireCaptcha(false);
    setRequire2FA(false);
    setOtpCode("");
    setCaptchaAnswer("");
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(""); // Clear previous messages

    // Validate required fields
    if (!username.trim() || !password.trim()) {
      setMessage("Both username and password are required.");
      setLoading(false);
      return;
    }

    // Trigger CAPTCHA if enabled and not yet shown
    if (securitySettings?.captcha?.enabled && !requireCaptcha) {
      const expectedAnswer = generateCaptcha();
      setRequireCaptcha(true);
      // Store the expected answer globally for demo purposes.
      window.expectedCaptchaAnswer = expectedAnswer;
      setLoading(false);
      return;
    }

    try {
      // Prepare request data
      const requestData = {
        username,
        password,
      };

      // Include CAPTCHA response and expected answer if required
      if (requireCaptcha) {
        requestData.captcha = captchaAnswer;
        requestData.expected_captcha = window.expectedCaptchaAnswer;
      }

      // Include OTP if in 2FA mode
      if (require2FA) {
        requestData.otp = otpCode;
      }

      // Send login request to backend using the api instance
      const response = await api.post("/login", requestData);

      // Handle 2FA requirement
      if (response.data.require2FA) {
        setRequire2FA(true);
        setMessage("Please enter the verification code sent to your email (check Flask console).");
        setLoading(false);
        return;
      }

      // Handle CAPTCHA requirement (if backend still demands it)
      if (response.data.requireCaptcha) {
        setRequireCaptcha(true);
        const expectedAnswer = generateCaptcha();
        window.expectedCaptchaAnswer = expectedAnswer;
        setLoading(false);
        return;
      }

      // Handle successful login
      if (response.data.success) {
        resetForm();
        setMessage("Login successful!");
      } else {
        setMessage(response.data.message);
      }
    } catch (error) {
      // Handle error responses from backend
      if (error.response) {
        const { status, data } = error.response;

        if (status === 429) {
          // Rate limiting
          setMessage(data.message || "Too many login attempts. Please try again later.");
        } else if (status === 403) {
          // Blocked session
          setMessage(data.message || "Your session has been blocked.");
        } else if (status === 400 && data.message === "SQL Injection detected!") {
          // SQL Injection attempt
          setMessage("Invalid input detected. Please try again.");
        } else if (data.requireCaptcha) {
          // CAPTCHA required
          setRequireCaptcha(true);
          const expectedAnswer = generateCaptcha();
          window.expectedCaptchaAnswer = expectedAnswer;
        } else if (data.require2FA) {
          // 2FA required
          setRequire2FA(true);
          setMessage("Please enter the verification code (check Flask console).");
        } else {
          // Generic error
          setMessage(data.message || "Error logging in.");
        }
      } else {
        setMessage("Server unavailable. Please try again later.");
      }
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Login</h2>

        {/* Display rate limiting status if enabled */}
        {securitySettings?.rate_limiting?.enabled && (
          <div className="security-banner">
            <FaShieldAlt /> Rate limiting active: {securitySettings.rate_limiting.max_attempts} attempts
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username Field */}
          <div className="form-group">
            <label htmlFor="username">
              <FaUser /> Username
            </label>
            <input
              type="text"
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              aria-label="Username"
            />
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">
              <FaLock /> Password
            </label>
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-label="Password"
            />
          </div>

          {/* CAPTCHA Field */}
          {requireCaptcha && (
            <div className="form-group captcha-group">
              <label htmlFor="captcha">{captchaQuestion}</label>
              <input
                type="text"
                id="captcha"
                placeholder="Enter the answer"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                required
                aria-label="CAPTCHA"
              />
            </div>
          )}

          {/* 2FA OTP Field */}
          {require2FA && (
            <div className="form-group">
              <label htmlFor="otp">Verification Code</label>
              <input
                type="text"
                id="otp"
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                aria-label="Verification Code"
                maxLength={6}
              />
              <div className="otp-hint">
                Check the Flask console for the OTP code.
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <span className="loader"></span> : "Login"}
          </button>
        </form>

        {/* Display Messages */}
        {message && (
          <p
            className={`message ${
              message.includes("Error") ||
              message.includes("Invalid") ||
              message.includes("Too many") ||
              message.includes("blocked")
                ? "error"
                : "success"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;