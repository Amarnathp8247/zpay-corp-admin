// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ResellerAuthService from "../../services/resellerAuth.service";
import "./LoginForm.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Timer for OTP resend
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Initialize encryption on component mount
  useEffect(() => {
    const initializeEncryption = async () => {
      try {
        console.log("🔄 Initializing encryption...");
        await ResellerAuthService.initEncryption();
        console.log("✅ Encryption initialized");
      } catch (error) {
        console.error("❌ Encryption initialization failed:", error);
        setError("Encryption initialization failed. Please refresh the page.");
      }
    };

    initializeEncryption();

    // Check session
    const checkSession = async () => {
      try {
        const session = await ResellerAuthService.checkSession();
        if (session.authenticated) {
          navigate("/");
        }
      } catch (error) {
        console.log("No active session found");
      }
    };

    checkSession();
  }, [navigate]);

  // Format timer display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start OTP timer
  const startTimer = () => {
    setTimer(300); // 5 minutes
    setCanResend(false);
  };

  // Handle login (send OTP)
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      console.log("🔐 Attempting login with encryption...");
      
      const result = await ResellerAuthService.login(email, password);

      if (result.success) {
        if (result.requiresOTP) {
          setMessage("OTP has been sent to your email!");
          setShowOtp(true);
          startTimer();
        } else {
          // Direct login (if OTP not required)
          setMessage("Login successful! Redirecting...");
          setTimeout(() => navigate("/"), 1000);
        }
      } else {
        setError(result.message || "Login failed");
      }
    } catch (err) {
      console.error("❌ Login error:", err);
      
      if (err.response) {
        const { status, data } = err.response;
        
        switch (status) {
          case 401:
            setError(data?.message || "Invalid email or password");
            break;
          case 403:
            setError(data?.message || "Account is not active");
            break;
          case 429:
            setError("Too many attempts. Please try again later.");
            break;
          default:
            setError(data?.message || "Login failed. Please try again.");
        }
      } else if (err.request) {
        setError("Network error. Please check your connection.");
      } else {
        setError(err.message || "An error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      console.log("🔢 Verifying OTP...");
      
      const result = await ResellerAuthService.verifyOTP(email, otp);

      if (result.success) {
        setMessage("Login successful! Redirecting...");
        
        // Store token in apiClient headers
        if (result.token) {
          localStorage.setItem('resellerToken', result.token);
        }
        
        if (result.user) {
          localStorage.setItem('resellerProfile', JSON.stringify(result.user));
        }
        
        // Redirect to home page
        setTimeout(() => {
          navigate("/");
        }, 1000);
      } else {
        setError(result.message || "OTP verification failed");
      }
    } catch (err) {
      console.error("❌ OTP verification error:", err);
      setError(err.message || "OTP verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await ResellerAuthService.resendOTP(email);

      if (result.success) {
        setMessage("New OTP sent to your email!");
        startTimer();
      } else {
        setError(result.message || "Failed to resend OTP");
      }
    } catch (err) {
      console.error("❌ Resend OTP error:", err);
      setError(err.message || "Failed to resend OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (showOtp) {
        handleVerifyOTP(e);
      } else {
        handleLogin(e);
      }
    }
  };

  // Go back to email/password
  const goBack = () => {
    setShowOtp(false);
    setOtp("");
    setError("");
    setMessage("");
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>{showOtp ? "Verify OTP" : "Login"}</h1>
          <p>
            {showOtp 
              ? `Enter the OTP sent to ${email}`
              : "Enter your credentials to continue"
            }
          </p>
        </div>
        
        {message && (
          <div className="message success">
            {message}
          </div>
        )}
        
        {error && (
          <div className="message error">
            {error}
          </div>
        )}
        
        {!showOtp ? (
          // Email/Password Form
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
                onKeyPress={handleKeyPress}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
                onKeyPress={handleKeyPress}
              />
            </div>
            
            <button 
              type="submit" 
              className="login-btn"
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : "Login"}
            </button>
          </form>
        ) : (
          // OTP Form
          <form className="login-form" onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label htmlFor="otp">6-Digit OTP</label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                required
                disabled={isLoading}
                onKeyPress={handleKeyPress}
              />
              
              {timer > 0 && (
                <div className="timer-display">
                  <span className="timer-icon">⏱️</span>
                  Time remaining: {formatTime(timer)}
                </div>
              )}
            </div>
            
            <div className="otp-actions">
              <button 
                type="submit" 
                className="login-btn"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Verifying...
                  </>
                ) : "Verify OTP"}
              </button>
              
              <button 
                type="button" 
                className="resend-btn"
                onClick={handleResendOTP}
                disabled={!canResend || isLoading}
              >
                {canResend ? "Resend OTP" : `Resend in ${formatTime(timer)}`}
              </button>
            </div>
            
            <button 
              type="button" 
              className="back-btn"
              onClick={goBack}
              disabled={isLoading}
            >
              ← Back to Login
            </button>
          </form>
        )}
        
        <div className="login-footer">
          {!showOtp && (
            <>
              <p>
                Forgot your password?{" "}
                <button 
                  type="button" 
                  className="link-btn"
                  onClick={() => setMessage("Please contact support for password reset.")}
                >
                  Reset Password
                </button>
              </p>
              <p>
                Don't have an account?{" "}
                <button 
                  type="button" 
                  className="link-btn"
                  onClick={() => setMessage("Please contact administration to create an account.")}
                >
                  Contact Admin
                </button>
              </p>
            </>
          )}
        </div>
        
       
      </div>
    </div>
  );
}