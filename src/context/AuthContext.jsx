// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import ResellerAuthService from '../services/resellerAuth.service';

// Create the context
const AuthContext = createContext({});

// Export the context itself for direct usage
export { AuthContext };

// Custom hook to use auth context
export const useAuth = () => useContext(AuthContext);

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('resellerToken');
        const profile = localStorage.getItem('resellerProfile');
        
        if (token && profile) {
          try {
            const userProfile = JSON.parse(profile);
            setUser(userProfile);
          } catch (parseError) {
            console.error('Failed to parse user profile:', parseError);
            await logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await ResellerAuthService.login(email, password);
      
      if (result.success) {
        return {
          success: true,
          requiresOTP: result.requiresOTP,
          email: result.email
        };
      } else {
        throw new Error(result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = async (email, otp) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await ResellerAuthService.verifyOTP(email, otp);
      
      if (result.success) {
        // Store user data
        setUser(result.user);
        localStorage.setItem('resellerToken', result.token);
        localStorage.setItem('resellerSessionId', result.sessionId);
        localStorage.setItem('resellerProfile', JSON.stringify(result.user));
        
        // Store IDs for product availability checks
        if (result.user?.id) {
          localStorage.setItem('resellerId', result.user.id);
        }
        if (result.user?.companyId) {
          localStorage.setItem('companyId', result.user.companyId);
        }
        
        return { success: true, user: result.user };
      } else {
        throw new Error(result.message || 'OTP verification failed');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError(error.message);
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setLoading(true);
      await ResellerAuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('resellerToken');
      localStorage.removeItem('resellerSessionId');
      localStorage.removeItem('resellerProfile');
      localStorage.removeItem('resellerId');
      localStorage.removeItem('companyId');
      setLoading(false);
    }
  };

  // Get current user
  const getCurrentUser = () => {
    return user;
  };

  // Check if authenticated
  const isAuthenticated = () => {
    return !!user && !!localStorage.getItem('resellerToken');
  };

  // Refresh user profile
  const refreshProfile = async () => {
    try {
      const result = await ResellerAuthService.getProfile();
      if (result) {
        setUser(result);
        localStorage.setItem('resellerProfile', JSON.stringify(result));
        
        // Update IDs
        if (result.id) {
          localStorage.setItem('resellerId', result.id);
        }
        if (result.companyId) {
          localStorage.setItem('companyId', result.companyId);
        }
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      await logout();
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    verifyOTP,
    logout,
    getCurrentUser,
    isAuthenticated,
    refreshProfile,
    setUser,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Export default as the provider
export default AuthContext;