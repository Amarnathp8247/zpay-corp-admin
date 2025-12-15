// src/api/apiClient.js
import axios from 'axios';

// Get base URL - using Vite environment variable
const baseURL = import.meta.env.VITE_API_BASE_URL || 
               (import.meta.env.PROD ? 'https://api.gzonic.com' : 'http://localhost:3000');

console.log('🌐 API Client Configuration:', {
  baseURL,
  mode: import.meta.env.MODE,
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV,
  viteApiUrl: import.meta.env.VITE_API_BASE_URL,
});

const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Get CSRF token from cookies
function getCsrfToken() {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrfToken') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add Authorization token
    const token = localStorage.getItem('resellerToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add CSRF token for non-GET requests
    if (config.method !== 'get' && config.method !== 'GET') {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`, {
      baseURL: config.baseURL,
      headers: config.headers,
    });
    
    return config;
  },
  (error) => {
    console.error('❌ Request setup error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`📥 ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.error(`❌ ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, {
      status: error.response?.status,
      error: error.message,
      baseURL: originalRequest?.baseURL,
    });
    
    // Handle network/CORS errors
    if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      console.error('🌐 Network error. Check:');
      console.error('1. Server is running:', originalRequest.baseURL);
      console.error('2. CORS is configured on server');
      console.error('3. HTTPS certificate (if using https)');
      
      if (typeof window !== 'undefined') {
        alert(`Cannot connect to server at ${originalRequest.baseURL}\n\nCheck CORS configuration on the backend.`);
      }
    }
    
    // Handle 401 - Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshResponse = await apiClient.post('/api/v1/reseller-user/auth/refresh-token');
        
        if (refreshResponse.data.success) {
          const newToken = refreshResponse.data.data.token;
          localStorage.setItem('resellerToken', newToken);
          
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        localStorage.clear();
        
        if (typeof window !== 'undefined') {
          window.location.href = '/login?session=expired';
        }
      }
    }
    
    // Handle 403 - Forbidden (CORS/CSRF issues)
    if (error.response?.status === 403) {
      console.warn('⚠️ Access forbidden. Check CORS and CSRF configuration on server.');
    }
    
    return Promise.reject(error);
  }
);

// Helper to switch between APIs (for debugging)
apiClient.setBaseURL = (url) => {
  apiClient.defaults.baseURL = url;
  console.log(`🔄 API base URL changed to: ${url}`);
  localStorage.setItem('apiBaseURL', url);
};

// Helper to get current API info
apiClient.getInfo = () => ({
  baseURL: apiClient.defaults.baseURL,
  isLiveServer: apiClient.defaults.baseURL.includes('api.gzonic.com'),
  environment: import.meta.env.MODE,
});

// Restore last used API URL
if (typeof window !== 'undefined') {
  const savedApiUrl = localStorage.getItem('apiBaseURL');
  if (savedApiUrl) {
    apiClient.defaults.baseURL = savedApiUrl;
    console.log(`🔄 Restored API URL: ${savedApiUrl}`);
  }
}

export default apiClient;