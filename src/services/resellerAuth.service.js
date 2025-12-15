// src/services/api/resellerAuth.service.js
import apiClient from "../api/apiClient";
import {
  sessionKeys,
  generateKeyPair,
  exportPublicKey,
  initResellerEncryption,
  decryptServerResponse,
  loadKeyPair
} from "../crypto/crypto.helper.js";

// --- Initialize Encryption Keys ---
export async function initEncryptionKeys() {
  try {
    console.log("[Init] Checking encryption keys...", {
      hasPrivateKey: !!sessionKeys.privateKey,
      hasPublicKey: !!sessionKeys.publicKey
    });
    
    if (!sessionKeys.privateKey || !sessionKeys.publicKey) {
      console.log("[Init] Keys not found, generating new key pair...");
      const keyPair = await generateKeyPair();
      sessionKeys.privateKey = keyPair.privateKey;
      sessionKeys.publicKey = keyPair.publicKey;
      console.log("[Init] RSA keys generated successfully");
    } else {
      console.log("[Init] RSA keys already exist");
    }
    
    return {
      privateKey: sessionKeys.privateKey,
      publicKey: sessionKeys.publicKey
    };
  } catch (err) {
    console.error("[Init] Error initializing encryption keys:", err);
    throw err;
  }
}

// --- Get Client Public Key PEM ---
export async function getClientPublicKeyPem() {
  try {
    await initEncryptionKeys();
    const publicKeyPem = await exportPublicKey(sessionKeys.publicKey);
    console.log("[Key] Client public key PEM generated");
    return publicKeyPem;
  } catch (err) {
    console.error("[Key] Error getting client public key:", err);
    throw err;
  }
}

// --- Helper to handle encrypted responses ---
// src/services/api/resellerAuth.service.js (Updated handleEncryptedResponse function)
export async function handleEncryptedResponse(response) {
  try {
    console.log("[HandleResponse] Processing response:", {
      status: response.status,
      encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv),
      responseKeys: Object.keys(response.data || {})
    });

    // If response already indicates failure, return as-is
    if (response.data?.success === false) {
      console.log("[HandleResponse] Response indicates failure");
      return response.data;
    }

    // Check if response is encrypted
    if (response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv) {
      console.log("🔐 [HandleResponse] Received encrypted response structure");
      
      // CRITICAL: Ensure we have private key for decryption
      if (!sessionKeys.privateKey) {
        console.error("❌ [HandleResponse] NO PRIVATE KEY AVAILABLE!");
        console.log("[HandleResponse] Attempting to load keys from localStorage...");
        
        const keys = await loadKeyPair();
        if (keys) {
          sessionKeys.privateKey = keys.privateKey;
          sessionKeys.publicKey = keys.publicKey;
          console.log("[HandleResponse] Keys loaded from localStorage");
        } else {
          console.error("[HandleResponse] Failed to load keys from localStorage");
          throw new Error("Cannot decrypt response: No private key available");
        }
      }
      
      console.log("[HandleResponse] Private key available, attempting decryption...");
      
      try {
        const decryptedResult = await decryptServerResponse(response.data, sessionKeys.privateKey);
        console.log("[HandleResponse] Decryption result:", {
          type: typeof decryptedResult,
          isString: typeof decryptedResult === 'string',
          isObject: typeof decryptedResult === 'object'
        });
        
        // Handle different return types from decryptServerResponse
        let decryptedData;
        
        if (typeof decryptedResult === 'string') {
          console.log("[HandleResponse] Decrypted result is a string, parsing JSON...");
          try {
            decryptedData = JSON.parse(decryptedResult);
            console.log("[HandleResponse] Successfully parsed JSON from string");
          } catch (parseError) {
            console.error("[HandleResponse] Failed to parse JSON from decrypted string:", parseError);
            throw new Error(`Failed to parse decrypted data: ${parseError.message}`);
          }
        } else if (typeof decryptedResult === 'object') {
          console.log("[HandleResponse] Decrypted result is already an object");
          decryptedData = decryptedResult;
        } else {
          console.error("[HandleResponse] Invalid decrypted result type:", typeof decryptedResult);
          throw new Error(`Invalid decrypted data type: ${typeof decryptedResult}`);
        }
        
        console.log("[HandleResponse] Final decrypted data:", {
          success: decryptedData?.success,
          hasData: !!decryptedData?.data,
          keys: Object.keys(decryptedData || {})
        });
        
        return decryptedData;
      } catch (decryptError) {
        console.error("[HandleResponse] Decryption process failed:", {
          error: decryptError.message,
          stack: decryptError.stack
        });
        
        // Fallback to plain data if available
        if (response.data?.data) {
          console.log("[HandleResponse] Fallback: Using response.data.data");
          const plainData = response.data.data;
          return {
            success: response.data.success !== false,
            ...(typeof plainData === 'object' ? plainData : { data: plainData })
          };
        }
        
        // If we have a plain response inside, try that
        if (typeof response.data === 'object' && !response.data.encryptedKey) {
          console.log("[HandleResponse] Fallback: Using response.data directly");
          return {
            success: response.data.success !== false,
            ...response.data
          };
        }
        
        throw decryptError;
      }
    }

    // Handle plain response
    console.log("[HandleResponse] Plain response received");
    
    if (response.data && typeof response.data === 'object') {
      // Ensure success field exists
      const result = { ...response.data };
      if (result.success === undefined) {
        result.success = true;
      }
      return result;
    }
    
    // If response.data is not an object, wrap it
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error("[HandleResponse] General error:", error);
    return {
      success: false,
      error: "Response handling failed",
      message: error.message,
      originalResponse: response?.data
    };
  }
}

// --- Initialize encryption if needed ---
async function initEncryptionIfNeeded() {
  console.log("[InitEncryption] Checking encryption status...", {
    hasPublicKey: !!sessionKeys.publicKey,
    hasPrivateKey: !!sessionKeys.privateKey
  });
  
  if (!sessionKeys.publicKey || !sessionKeys.privateKey) {
    console.log("[InitEncryption] Initializing encryption...");
    try {
      await initResellerEncryption();
      
      // Double-check that keys were loaded
      if (!sessionKeys.privateKey) {
        console.warn("[InitEncryption] Private key still missing, loading from localStorage...");
        const keys = await loadKeyPair();
        if (keys) {
          sessionKeys.privateKey = keys.privateKey;
          sessionKeys.publicKey = keys.publicKey;
          console.log("[InitEncryption] Keys loaded from localStorage");
        } else {
          console.error("[InitEncryption] Failed to load keys from localStorage");
          throw new Error("Encryption keys not available");
        }
      }
      
      console.log("[InitEncryption] Encryption initialized successfully");
    } catch (error) {
      console.error("[InitEncryption] Failed to initialize encryption:", error);
      throw error;
    }
  } else {
    console.log("[InitEncryption] Encryption already initialized");
  }
}

// --- Error handling ---
function handleApiError(error) {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return new Error(data?.message || "Bad request. Please check your input.");
      case 401:
        // Clear session data
        if (typeof window !== "undefined") {
          localStorage.removeItem("resellerToken");
          localStorage.removeItem("resellerSessionId");
          localStorage.removeItem("resellerProfile");
          localStorage.removeItem("resellerKeys");
        }
        return new Error("Your session has expired. Please login again.");
      case 403:
        return new Error("You do not have permission to access this resource.");
      case 404:
        return new Error("Resource not found.");
      case 429:
        return new Error("Too many requests. Please try again later.");
      case 500:
        return new Error("Server error. Please try again later.");
      default:
        return new Error(data?.message || `Error ${status}: An error occurred.`);
    }
  } else if (error.request) {
    return new Error("No response from server. Please check your internet connection.");
  } else {
    return error;
  }
}

// --- Reseller Auth Service ---
class ResellerAuthService {
  // Initialize encryption for API responses
  static async initEncryption() {
    try {
      await initEncryptionIfNeeded();
      return {
        success: true,
        hasKeys: !!sessionKeys.privateKey && !!sessionKeys.publicKey
      };
    } catch (error) {
      console.error("[ResellerAuthService] initEncryption error:", error);
      throw error;
    }
  }

  // Get client public key
  static async getClientPublicKey() {
    try {
      await initEncryptionIfNeeded();
      const publicKeyPem = await exportPublicKey(sessionKeys.publicKey);
      console.log("[ResellerAuthService] Client public key PEM generated");
      return publicKeyPem;
    } catch (err) {
      console.error("[ResellerAuthService] Error getting client public key:", err);
      throw err;
    }
  }

  // 🔓 Reseller Login (Initial request - sends OTP) - PLAIN REQUEST
  static async login(email, password) {
    try {
      console.log("[ResellerAuthService] Starting login for:", email);
      
      // Ensure encryption is initialized
      await initEncryptionIfNeeded();
      
      const publicKeyPem = await exportPublicKey(sessionKeys.publicKey);
      console.log("[ResellerAuthService] Using client public key");

      // Send plain request with clientPublicKey
      const response = await apiClient.post("/api/v1/reseller-user/auth/login", {
        email,
        password,
        clientPublicKey: publicKeyPem
      }, { withCredentials: true });
      
      console.log("[ResellerAuthService] Login response received");

      // Handle response
      const result = await handleEncryptedResponse(response);
      
      if (result.success) {
        return {
          success: true,
          requiresOTP: result.data?.requiresOTP || true,
          email: result.data?.email || email,
          message: result.message,
          nextStep: "verify-otp"
        };
      }

      return result;
    } catch (error) {
      console.error("[ResellerAuthService] Login error:", error);
      throw handleApiError(error);
    }
  }

  // 🔓 Verify OTP (Final login step) - PLAIN REQUEST
  static async verifyOTP(email, otp) {
    try {
      console.log("[ResellerAuthService] Verifying OTP for:", email);
      
      await initEncryptionIfNeeded();

      const publicKeyPem = await exportPublicKey(sessionKeys.publicKey);
      console.log("[ResellerAuthService] Using client public key");

      // Get user agent for security logging
      const userAgent = navigator.userAgent || "unknown";
      
      // Send plain request with clientPublicKey
      const response = await apiClient.post("/api/v1/reseller-user/auth/verify-otp", {
        email,
        otp,
        clientPublicKey: publicKeyPem,
        userAgent
      }, { withCredentials: true });
      
      console.log("[ResellerAuthService] Verify OTP response received");

      // Handle response
      const result = await handleEncryptedResponse(response);
      
      if (result.success && result.data) {
        // Store authentication data
        const { token, sessionId, user } = result.data;
        
        if (token) {
          localStorage.setItem("resellerToken", token);
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          console.log("[ResellerAuthService] Token stored");
        }
        
        if (sessionId) {
          localStorage.setItem("resellerSessionId", sessionId);
        }
        
        if (user) {
          localStorage.setItem("resellerProfile", JSON.stringify(user));
          console.log("[ResellerAuthService] User profile stored");
        }
        
        return {
          success: true,
          user,
          token,
          sessionId,
          message: result.message || "Login successful"
        };
      } else {
        throw new Error(result.message || "OTP verification failed");
      }
    } catch (error) {
      console.error("[ResellerAuthService] Verify OTP error:", error);
      throw handleApiError(error);
    }
  }

  // 🔓 Resend OTP - PLAIN REQUEST
  static async resendOTP(email) {
    try {
      console.log("[ResellerAuthService] Resending OTP for:", email);
      
      await initEncryptionIfNeeded();

      const publicKeyPem = await exportPublicKey(sessionKeys.publicKey);

      const response = await apiClient.post("/api/v1/reseller-user/auth/resend-otp", {
        email,
        clientPublicKey: publicKeyPem
      }, { withCredentials: true });
      
      console.log("[ResellerAuthService] Resend OTP response");

      return await handleEncryptedResponse(response);
    } catch (error) {
      console.error("[ResellerAuthService] Resend OTP error:", error);
      throw handleApiError(error);
    }
  }

  // 🔐 Get profile - HANDLES ENCRYPTED RESPONSE
  static async getProfile() {
    try {
      const token = localStorage.getItem("resellerToken");
      if (!token) {
        throw new Error("No authentication token found. Please login.");
      }

      // Ensure encryption is initialized
      await initEncryptionIfNeeded();
      
      // Ensure Authorization header is set
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      console.log("[ResellerAuthService] Getting profile with token");

      const response = await apiClient.get("/api/v1/reseller-user/auth/profile", {
        withCredentials: true
      });
      
      console.log("[ResellerAuthService] Profile response received:", {
        status: response.status,
        encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv)
      });
      
      // Handle response (handles both encrypted and plain)
      const result = await handleEncryptedResponse(response);
      
      console.log("[ResellerAuthService] Processed profile result:", {
        success: result?.success,
        hasData: !!result?.data,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || "Failed to get profile");
      }
      
      // Extract profile data from different possible structures
      const profileData = result?.data || result;
      
      if (!profileData) {
        throw new Error("No profile data received");
      }
      
      // Store profile
      localStorage.setItem("resellerProfile", JSON.stringify(profileData));
      
      return profileData;
      
    } catch (error) {
      console.error("[ResellerAuthService] Get profile error:", error);
      
      // If unauthorized, clear local storage
      if (error.message.includes("session expired") || error.response?.status === 401) {
        console.log("[ResellerAuthService] Unauthorized, clearing storage");
        this.clearLocalStorage();
        throw new Error("Session expired. Please login again.");
      }
      
      throw handleApiError(error);
    }
  }

  // 🔐 Update profile - HANDLES ENCRYPTED RESPONSE
  static async updateProfile(profileData) {
    try {
      const token = localStorage.getItem("resellerToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      await initEncryptionIfNeeded();
      
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      
      const response = await apiClient.put("/api/v1/reseller-user/auth/profile", profileData, {
        withCredentials: true
      });
      
      console.log("[ResellerAuthService] Update profile response received");
      
      const result = await handleEncryptedResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || "Failed to update profile");
      }
      
      const updatedProfile = result?.data || result;
      
      if (updatedProfile) {
        // Update stored profile
        const currentProfile = JSON.parse(localStorage.getItem("resellerProfile") || "{}");
        const newProfile = { ...currentProfile, ...updatedProfile };
        localStorage.setItem("resellerProfile", JSON.stringify(newProfile));
        
        return newProfile;
      }

      throw new Error("Failed to update profile: No data returned");
    } catch (error) {
      console.error("[ResellerAuthService] Update profile error:", error);
      throw handleApiError(error);
    }
  }

  // 🔓 Forgot password - PLAIN REQUEST
  static async forgotPassword(email) {
    try {
      await initEncryptionIfNeeded();

      const publicKeyPem = await exportPublicKey(sessionKeys.publicKey);

      const response = await apiClient.post("/api/v1/reseller-user/auth/forgot-password", {
        email,
        clientPublicKey: publicKeyPem
      }, { withCredentials: true });
      
      return await handleEncryptedResponse(response);
    } catch (error) {
      console.error("[ResellerAuthService] Forgot password error:", error);
      throw handleApiError(error);
    }
  }

  // 🔓 Reset password - PLAIN REQUEST
  static async resetPassword(email, otp, newPassword) {
    try {
      await initEncryptionIfNeeded();

      const publicKeyPem = await exportPublicKey(sessionKeys.publicKey);

      const response = await apiClient.post("/api/v1/reseller-user/auth/reset-password", {
        email,
        otp,
        newPassword,
        clientPublicKey: publicKeyPem
      }, { withCredentials: true });
      
      return await handleEncryptedResponse(response);
    } catch (error) {
      console.error("[ResellerAuthService] Reset password error:", error);
      throw handleApiError(error);
    }
  }

  // 🔓 Logout - PLAIN REQUEST
  static async logout() {
    try {
      console.log("[ResellerAuthService] Logging out...");
      
      const response = await apiClient.post("/api/v1/reseller-user/auth/logout", {}, {
        withCredentials: true
      });
      
      console.log("[ResellerAuthService] Logout response");
      
      // Clear local storage
      this.clearLocalStorage();
      
      return await handleEncryptedResponse(response);
    } catch (error) {
      console.error("[ResellerAuthService] Logout error:", error);
      // Still clear local storage even if API call fails
      this.clearLocalStorage();
      throw handleApiError(error);
    }
  }

  // Clear local storage helper
  static clearLocalStorage() {
    console.log("[ResellerAuthService] Clearing authentication data");
    localStorage.removeItem("resellerToken");
    localStorage.removeItem("resellerSessionId");
    localStorage.removeItem("resellerProfile");
    localStorage.removeItem("resellerKeys");
    delete apiClient.defaults.headers.common["Authorization"];
  }

  // 🔓 Check session status - PLAIN REQUEST
  static async checkSession() {
    try {
      const token = localStorage.getItem("resellerToken");
      if (!token) {
        console.log("[ResellerAuthService] No token found");
        return { authenticated: false };
      }

      const response = await apiClient.get("/api/v1/reseller-user/auth/check-session", {
        withCredentials: true
      });
      
      const result = await handleEncryptedResponse(response);
      
      if (result.success && result.authenticated) {
        return {
          authenticated: true,
          user: result.user
        };
      }

      return { authenticated: false };
    } catch (error) {
      console.error("[ResellerAuthService] Check session error:", error);
      return { authenticated: false };
    }
  }

  // 🔓 Refresh token - PLAIN REQUEST
  static async refreshToken() {
    try {
      console.log("[ResellerAuthService] Refreshing token...");
      
      const response = await apiClient.post("/api/v1/reseller-user/auth/refresh-token", {}, {
        withCredentials: true
      });
      
      const result = await handleEncryptedResponse(response);
      
      if (result.success && result.data?.token) {
        const newToken = result.data.token;
        localStorage.setItem("resellerToken", newToken);
        apiClient.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
        
        console.log("[ResellerAuthService] Token refreshed successfully");
        return { success: true, token: newToken };
      }

      return { success: false };
    } catch (error) {
      console.error("[ResellerAuthService] Refresh token error:", error);
      return { success: false };
    }
  }

  // Test encryption endpoint
  static async testEncryption() {
    try {
      console.log("[ResellerAuthService] Testing encryption/decryption flow...");
      
      await initEncryptionIfNeeded();
      
      const response = await apiClient.get("/api/v1/reseller-user/auth/health", {
        withCredentials: true
      });
      
      console.log("[ResellerAuthService] Test response:", {
        status: response.status,
        encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv)
      });
      
      const result = await handleEncryptedResponse(response);
      
      console.log("[ResellerAuthService] Test result:", {
        success: result?.success,
        result
      });
      
      return {
        success: true,
        encryptionWorking: !!response.data?.encryptedKey,
        decryptionWorking: result?.success === true,
        message: "Encryption test completed successfully"
      };
    } catch (error) {
      console.error("[ResellerAuthService] Encryption test failed:", error);
      return {
        success: false,
        error: error.message,
        message: "Encryption test failed"
      };
    }
  }

  // Get current user from localStorage
  static getCurrentUser() {
    try {
      const profile = localStorage.getItem("resellerProfile");
      return profile ? JSON.parse(profile) : null;
    } catch (error) {
      console.error("[ResellerAuthService] Get current user error:", error);
      return null;
    }
  }

  // Check if user is authenticated
  static isAuthenticated() {
    const token = localStorage.getItem("resellerToken");
    return !!token;
  }

  // Get session keys (for debugging)
  static getSessionKeys() {
    return {
      hasPrivateKey: !!sessionKeys.privateKey,
      hasPublicKey: !!sessionKeys.publicKey,
      privateKey: sessionKeys.privateKey,
      publicKey: sessionKeys.publicKey
    };
  }
}

export default ResellerAuthService;