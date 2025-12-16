// src/services/order.service.js
import apiClient from '../api/apiClient';
import { 
  sessionKeys, 
  decryptServerResponse,
  initResellerEncryption,
  loadKeyPair
} from '../crypto/crypto.helper';

class ResellerOrderService {
  // Initialize encryption if needed
  static async initEncryptionIfNeeded() {
    console.log('🔑 [OrderService] Checking encryption status...', {
      hasPublicKey: !!sessionKeys.publicKey,
      hasPrivateKey: !!sessionKeys.privateKey
    });
    
    if (!sessionKeys.publicKey || !sessionKeys.privateKey) {
      console.log('🔄 [OrderService] Initializing encryption...');
      try {
        await initResellerEncryption();
        
        // Double-check that keys were loaded
        if (!sessionKeys.privateKey) {
          console.warn('⚠️ [OrderService] Private key still missing after init, trying to load from localStorage...');
          const keys = await loadKeyPair();
          if (keys) {
            sessionKeys.privateKey = keys.privateKey;
            sessionKeys.publicKey = keys.publicKey;
            console.log('✅ [OrderService] Keys loaded from localStorage');
          } else {
            console.error('❌ [OrderService] Failed to load keys from localStorage');
            throw new Error('Encryption keys not available');
          }
        }
        
        console.log('✅ [OrderService] Encryption initialized successfully:', {
          hasPublicKey: !!sessionKeys.publicKey,
          hasPrivateKey: !!sessionKeys.privateKey
        });
      } catch (error) {
        console.error('❌ [OrderService] Failed to initialize encryption:', error);
        throw error;
      }
    } else {
      console.log('✅ [OrderService] Encryption already initialized');
    }
  }

  // Simplified and corrected handleResponse method
  static async handleResponse(response) {
    try {
      console.log('📦 [OrderService] API Response received:', {
        status: response.status,
        statusText: response.statusText,
        encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv),
        hasSuccessField: response.data?.success !== undefined,
        responseKeys: Object.keys(response.data || {})
      });
  
      // If response already has success=false, return as-is
      if (response.data?.success === false) {
        console.log('❌ [OrderService] Response indicates failure, returning as-is');
        return response.data;
      }
  
      // Check if response is encrypted
      if (response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv) {
        console.log('🔐 [OrderService] Received encrypted response structure');
        
        // Ensure we have private key for decryption
        if (!sessionKeys.privateKey) {
          console.error('❌ [OrderService] NO PRIVATE KEY AVAILABLE for decryption!');
          
          const keys = await loadKeyPair();
          if (keys) {
            sessionKeys.privateKey = keys.privateKey;
            sessionKeys.publicKey = keys.publicKey;
            console.log('✅ [OrderService] Keys loaded from localStorage');
          } else {
            console.error('❌ [OrderService] Failed to load keys from localStorage');
            throw new Error('Cannot decrypt response: No private key available');
          }
        }
        
        console.log('🔑 [OrderService] Private key available, attempting decryption...');
        
        try {
          const decryptedData = await decryptServerResponse(response.data, sessionKeys.privateKey);
          console.log('✅ [OrderService] Decryption successful:', {
            decryptedType: typeof decryptedData,
            isString: typeof decryptedData === 'string'
          });
          
          let parsedData = decryptedData;
          
          // If decrypted data is a string, try to parse it as JSON
          if (typeof decryptedData === 'string') {
            try {
              console.log('🔄 [OrderService] Parsing decrypted string as JSON...');
              parsedData = JSON.parse(decryptedData);
              console.log('✅ [OrderService] String parsed successfully');
            } catch (parseError) {
              console.warn('⚠️ [OrderService] Failed to parse decrypted string as JSON:', parseError.message);
              // If parsing fails, return the string as data
              return {
                success: true,
                data: decryptedData
              };
            }
          }
          
          // Now handle the parsed object
          if (parsedData && typeof parsedData === 'object') {
            console.log('📊 [OrderService] Parsed data structure:', {
              hasDataField: 'data' in parsedData,
              hasSuccessField: 'success' in parsedData,
              keys: Object.keys(parsedData)
            });
            
            // The backend sends { success: true, data: {...}, message: "..." }
            // So we should spread data properties to top level
            if (parsedData.data !== undefined) {
              console.log('📁 [OrderService] Structure: parsedData.data found');
              return {
                success: parsedData.success !== false,
                message: parsedData.message,
                ...parsedData.data  // Spread data properties to top level
              };
            }
            
            // If no 'data' field, check for success
            if (parsedData.success !== undefined) {
              console.log('📁 [OrderService] Structure: parsedData has success field');
              return parsedData;
            }
            
            // Otherwise, it's the data itself
            console.log('📁 [OrderService] Structure: parsedData is the data');
            return {
              success: true,
              ...parsedData
            };
          }
          
          console.error('❌ [OrderService] Invalid parsed data format:', {
            type: typeof parsedData,
            value: parsedData
          });
          
          return {
            success: true,
            data: parsedData
          };
          
        } catch (decryptError) {
          console.error('❌ [OrderService] Decryption process failed:', {
            error: decryptError.message,
            stack: decryptError.stack
          });
          
          // Check if we have plain data in response
          if (response.data?.data) {
            console.log('🔄 [OrderService] Fallback: Using response.data.data');
            const plainData = response.data.data;
            return {
              success: response.data.success !== false,
              message: response.data.message,
              ...(typeof plainData === 'object' ? plainData : { data: plainData })
            };
          }
          
          // Return error response
          return {
            success: false,
            error: 'Decryption failed',
            message: decryptError.message
          };
        }
      }
  
      // Handle plain response
      console.log('📨 [OrderService] Plain response received');
      
      if (response.data && typeof response.data === 'object') {
        const backendResponse = response.data;
        
        // Check if backend response has the standard structure with 'data' field
        if (backendResponse.data !== undefined) {
          console.log('📊 [OrderService] Plain response has data field');
          return {
            success: backendResponse.success !== false,
            message: backendResponse.message,
            ...backendResponse.data  // Spread data properties to top level
          };
        }
        
        // If no 'data' field, check for success
        if (backendResponse.success !== undefined) {
          console.log('📊 [OrderService] Plain response has success field');
          return backendResponse;
        }
        
        // Otherwise, it's the data itself
        console.log('📊 [OrderService] Plain response is the data itself');
        return {
          success: response.status >= 200 && response.status < 300,
          ...backendResponse
        };
      }
      
      // If response.data is not an object, wrap it
      return {
        success: response.status >= 200 && response.status < 300,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ [OrderService] handleResponse general error:', error);
      return {
        success: false,
        error: 'Response handling failed',
        message: error.message
      };
    }
  }

  // ============== ORDER MANAGEMENT ==============

  // Create a new order - CORRECTED
  static async createOrder(orderData) {
    try {
      console.log('🔄 [OrderService] Creating order with data:', orderData);
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      // Validate required fields
      if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
        throw new Error('Order must contain at least one item');
      }
  
      // Validate items structure
      for (const item of orderData.items) {
        if (!item.productId) {
          throw new Error('Each item must have productId');
        }
        
        // Check for nested denominations structure
        if (item.denominations && Array.isArray(item.denominations)) {
          for (const denomItem of item.denominations) {
            if (!denomItem.denominationId || !denomItem.quantity) {
              throw new Error('Each denomination must have denominationId and quantity');
            }
            if (denomItem.quantity <= 0) {
              throw new Error('Quantity must be greater than 0');
            }
          }
        } else {
          // Handle flat structure
          if (!item.denominationId || !item.quantity) {
            throw new Error('Each item must have denominationId and quantity');
          }
          if (item.quantity <= 0) {
            throw new Error('Quantity must be greater than 0');
          }
        }
      }
  
      // Use the correct endpoint
      const response = await apiClient.post('/api/v1/reseller-user/orders/create', orderData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      console.log('📥 [OrderService] Raw API response status:', response.status);
      
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('✅ [OrderService] Processed result:', {
        success: result?.success,
        hasOrder: !!(result?.order || result?.id || result?.orderId),
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to create order');
      }
      
      // Extract order data from response
      let orderResult = {};
      
      // Since handleResponse spreads data to top level, order should be at result level
      if (result && typeof result === 'object') {
        // Check if result is the order itself
        if (result.id || result.orderId) {
          orderResult = result;
          console.log('📊 Order found at result level');
        }
        // Check if result has order field
        else if (result.order && (result.order.id || result.order.orderId)) {
          orderResult = result.order;
          console.log('📊 Order found at result.order');
        }
        // Check if result has data field with order
        else if (result.data && (result.data.id || result.data.orderId)) {
          orderResult = result.data;
          console.log('📊 Order found at result.data');
        }
        // Check if result.data has order field
        else if (result.data?.order && (result.data.order.id || result.data.order.orderId)) {
          orderResult = result.data.order;
          console.log('📊 Order found at result.data.order');
        }
      }
      
      // Cache the order if needed
      if (orderResult.id || orderResult.orderId) {
        ResellerOrderService.cacheOrder(orderResult);
      }
      
      return {
        success: true,
        ...orderResult,
        message: result?.message || 'Order created successfully'
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Create order error:', {
        message: error.message,
        stack: error.stack,
        orderData
      });
      
      // Handle specific error cases
      if (error.response) {
        console.error('[OrderService] Error response details:', {
          status: error.response.status,
          data: error.response.data
        });
        
        if (error.response.status === 401) {
          // Clear storage on 401
          ResellerOrderService.clearSessionData();
          throw new Error('Session expired. Please login again.');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to create orders.');
        } else if (error.response.status === 400 && error.response.data?.error === 'INSUFFICIENT_STOCK') {
          throw new Error('Insufficient stock available. Please adjust your order.');
        } else if (error.response.status === 400 && error.response.data?.error === 'INSUFFICIENT_BALANCE') {
          throw new Error('Insufficient wallet balance. Please top up your wallet.');
        }
      }
      
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // Get orders list - CORRECTED
  static async getOrders(filters = {}) {
    try {
      console.log('🔍 [OrderService] Fetching orders with filters:', filters);
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      // Check cache first
      const cacheKey = ResellerOrderService.getOrdersCacheKey(filters);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          const CACHE_TTL = 1 * 60 * 1000; // 1 minute cache for orders
          if (Date.now() - cacheData.timestamp < CACHE_TTL) {
            console.log('💾 [OrderService] Using cached orders:', cacheData.orders.length);
            return {
              success: true,
              orders: cacheData.orders,
              pagination: cacheData.pagination || {},
              filters,
              count: cacheData.orders.length,
              fromCache: true
            };
          }
        } catch (cacheError) {
          console.warn('[OrderService] Cache read error:', cacheError);
        }
      }
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/list', {
        params: filters,
        withCredentials: true
      });
  
      console.log('📥 [OrderService] Raw API response status:', response.status);
      
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('✅ [OrderService] Processed result:', {
        success: result?.success,
        hasOrders: !!(result?.orders),
        ordersCount: result?.orders?.length || 0,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch orders');
      }
      
      // Extract orders from result - FIXED LOGIC
      let orders = [];
      let pagination = {};
      
      // Since handleResponse spreads data to top level, orders should be at result.orders
      if (result?.orders && Array.isArray(result.orders)) {
        orders = result.orders;
        console.log('📊 Found orders array:', orders.length);
      }
      // Fallback: result is the orders array
      else if (Array.isArray(result)) {
        orders = result;
        console.log('📊 Result is orders array:', orders.length);
      }
      // Fallback: check data field (legacy support)
      else if (result?.data?.orders && Array.isArray(result.data.orders)) {
        orders = result.data.orders;
        console.log('📊 Found nested orders array:', orders.length);
      }
      
      // Extract pagination
      if (result?.pagination) {
        pagination = result.pagination;
      } else if (result?.data?.pagination) {
        pagination = result.data.pagination;
      } else if (result?.total !== undefined) {
        // Create pagination from total count
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 10;
        pagination = {
          page,
          limit,
          total: result.total || orders.length,
          totalPages: Math.ceil((result.total || orders.length) / limit)
        };
      }
      
      console.log('📊 Extracted orders:', orders.length);
      
      // Cache the results
      if (orders.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            orders,
            pagination,
            filters,
            timestamp: Date.now()
          }));
          console.log('💾 [OrderService] Cached orders:', orders.length);
        } catch (cacheError) {
          console.warn('[OrderService] Cache write error:', cacheError);
        }
      }
      
      return {
        success: true,
        orders,
        pagination,
        filters,
        count: orders.length,
        fromCache: false
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get orders error:', {
        message: error.message,
        stack: error.stack,
        filters
      });
      
      // Try to return cached data even if stale
      try {
        const cacheKey = ResellerOrderService.getOrdersCacheKey(filters);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cacheData = JSON.parse(cached);
          console.log('🔄 [OrderService] Returning stale cache due to error');
          return {
            success: true,
            orders: cacheData.orders,
            pagination: cacheData.pagination || {},
            filters,
            count: cacheData.orders.length,
            fromCache: true,
            error: error.message
          };
        }
      } catch (cacheError) {
        console.warn('[OrderService] Stale cache read error:', cacheError);
      }
      
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // Get order by ID - CORRECTED
  static async getOrderById(orderId) {
    try {
      console.log('🔍 [OrderService] Fetching order by ID:', orderId);
      
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      // Check cache first - try both UUID and order number
      const cacheKey = `reseller_order_${orderId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache
          if (Date.now() - cacheData.timestamp < CACHE_TTL) {
            console.log('💾 [OrderService] Using cached order:', orderId);
            return {
              success: true,
              order: cacheData.order,
              fromCache: true
            };
          }
        } catch (cacheError) {
          console.warn('[OrderService] Cache read error:', cacheError);
        }
      }
      
      let response;
      
      // Check if it looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(orderId)) {
        // Try as UUID
        response = await apiClient.get(`/api/v1/reseller-user/orders/${orderId}`, {
          withCredentials: true
        });
      } else {
        // Try as order number - use search endpoint
        response = await apiClient.get('/api/v1/reseller-user/orders/list', {
          params: { orderNumber: orderId, limit: 1 },
          withCredentials: true
        });
      }

      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('✅ [OrderService] Processed order result:', {
        success: result?.success,
        hasOrder: !!(result?.id || result?.orderId),
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get order');
      }
      
      // Extract order from result - FIXED LOGIC
      let order = null;
      
      // Since handleResponse spreads data to top level, result should be the order
      if (result && typeof result === 'object') {
        // Check if result is the order itself
        if (result.id || result.orderId) {
          order = result;
          console.log('📊 Order found at result level');
        }
        // Check if result has order field
        else if (result.order && (result.order.id || result.order.orderId)) {
          order = result.order;
          console.log('📊 Order found at result.order');
        }
        // Check if result has data field with order
        else if (result.data && (result.data.id || result.data.orderId)) {
          order = result.data;
          console.log('📊 Order found at result.data');
        }
        // Check if result.data has order field
        else if (result.data?.order && (result.data.order.id || result.data.order.orderId)) {
          order = result.data.order;
          console.log('📊 Order found at result.data.order');
        }
        // If we searched by order number and got a list
        else if (Array.isArray(result.orders) && result.orders.length > 0) {
          order = result.orders[0];
          console.log('📊 Order found in orders array');
        }
        else if (Array.isArray(result) && result.length > 0) {
          order = result[0];
          console.log('📊 Order found in array result');
        }
      }
      
      if (!order) {
        console.warn('⚠️ [OrderService] No order data found. Result:', result);
        throw new Error('Order data not found in response');
      }
      
      // Cache the order
      if (order) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            order,
            timestamp: Date.now()
          }));
        } catch (cacheError) {
          console.warn('[OrderService] Cache write error:', cacheError);
        }
      }
      
      return {
        success: true,
        order,
        fromCache: false
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get order by ID error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // Cancel order
  static async cancelOrder(orderId) {
    try {
      console.log('🔄 [OrderService] Cancelling order:', orderId);
      
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      // Check if it looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let endpoint;
      
      if (uuidRegex.test(orderId)) {
        endpoint = `/api/v1/reseller-user/orders/${orderId}/cancel`;
      } else {
        // First get the order ID from order number
        const orderResult = await ResellerOrderService.getOrderById(orderId);
        if (!orderResult.success || !orderResult.order) {
          throw new Error('Order not found');
        }
        endpoint = `/api/v1/reseller-user/orders/${orderResult.order.id}/cancel`;
      }
      
      const response = await apiClient.post(endpoint, {}, {
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to cancel order');
      }
      
      // Clear cache for this order
      ResellerOrderService.clearOrderCache(orderId);
      
      // Also clear orders list cache since order status changed
      ResellerOrderService.clearOrdersCache();
      
      return {
        success: true,
        ...result,
        message: result?.message || 'Order cancelled successfully'
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Cancel order error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // Check order status
  static async checkOrderStatus(orderId) {
    try {
      console.log('🔍 [OrderService] Checking order status:', orderId);
      
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      // Check if it looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let endpoint;
      
      if (uuidRegex.test(orderId)) {
        endpoint = `/api/v1/reseller-user/orders/${orderId}/status`;
      } else {
        // First get the order ID from order number
        const orderResult = await ResellerOrderService.getOrderById(orderId);
        if (!orderResult.success || !orderResult.order) {
          throw new Error('Order not found');
        }
        endpoint = `/api/v1/reseller-user/orders/${orderResult.order.id}/status`;
      }
      
      const response = await apiClient.get(endpoint, {
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to check order status');
      }
      
      return {
        success: true,
        status: result?.status || result
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Check order status error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // ============== WALLET & BALANCE ==============

  // Get wallet balance - CORRECTED
  static async getWalletBalance(currency = null) {
    try {
      console.log('💰 [OrderService] Fetching wallet balance');
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const params = currency ? { currency } : {};
      const response = await apiClient.get('/api/v1/reseller-user/orders/wallet/balance', {
        params,
        withCredentials: true
      });
  
      console.log('💰 [OrderService] Wallet balance response received');
  
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('💰 [OrderService] Processed wallet balance result:', {
        success: result?.success,
        totalBalance: result?.totalBalance || result?.totalBalanceUSD,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        console.warn('⚠️ [OrderService] Wallet balance fetch returned success=false:', result);
        return {
          success: true,
          ...ResellerOrderService.getDefaultWalletBalance()
        };
      }
      
      // Return standardized structure
      return {
        success: true,
        totalBalance: result?.totalBalance || result?.totalBalanceUSD || 0,
        availableBalance: result?.availableBalance || result?.totalBalance || 0,
        wallets: result?.wallets || [],
        currency: result?.currency || currency || 'USD',
        ...result  // Include any other fields
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get wallet balance error:', error);
      
      // Return default instead of throwing
      return {
        success: true,
        ...ResellerOrderService.getDefaultWalletBalance()
      };
    }
  }

  // ============== STATISTICS ==============

  // Get order statistics - CORRECTED

  static async getOrderStatistics(filters = {}) {
    try {
      console.log('📊 [OrderService] Fetching order statistics');
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      // Use the correct endpoint WITHOUT params
      const response = await apiClient.get('/api/v1/reseller-user/orders/statistics', {
        withCredentials: true
        // No params object at all
      });
  
      console.log('📊 [OrderService] Statistics response received');
  
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('📊 [OrderService] Statistics result processed:', {
        success: result?.success,
        hasStatistics: !!result?.statistics || !!result?.summary,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        console.warn('⚠️ [OrderService] Statistics fetch returned success=false:', result);
        return {
          success: true,
          statistics: ResellerOrderService.getDefaultStatistics()
        };
      }
      
      // Extract statistics - backend returns full object
      let statistics = result?.statistics || result;
      
      // If structure doesn't match, fallback to defaults
      if (!statistics || typeof statistics !== 'object') {
        statistics = ResellerOrderService.getDefaultStatistics();
      }
      
      return {
        success: true,
        statistics
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get order statistics error:', error);
      
      // Always return default stats on error (prevents UI crash)
      return {
        success: true,
        statistics: ResellerOrderService.getDefaultStatistics()
      };
    }
  }

  // ============== CACHE METHODS ==============

  // Cache order
  static cacheOrder(order) {
    try {
      if (!order?.id) return;
      
      const cacheKey = `reseller_order_${order.id}`;
      const cacheData = {
        order,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('💾 [OrderService] Cached order:', order.id);
      
      // Also cache by order number if available
      if (order.orderNumber) {
        const orderNumberKey = `reseller_order_${order.orderNumber}`;
        localStorage.setItem(orderNumberKey, JSON.stringify(cacheData));
      }
    } catch (error) {
      console.warn('[OrderService] Failed to cache order:', error);
    }
  }

  // Get cache key for orders list
  static getOrdersCacheKey(filters = {}) {
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((obj, key) => {
        obj[key] = filters[key];
        return obj;
      }, {});
    
    return `reseller_orders_list_${JSON.stringify(sortedFilters)}`;
  }


  // Clear order cache
  static clearOrderCache(orderId) {
    try {
      localStorage.removeItem(`reseller_order_${orderId}`);
      console.log('🗑️ [OrderService] Cleared cache for order:', orderId);
      
      // Also try to clear by order number if it's a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(orderId)) {
        // If it's not a UUID, it might be an order number
        // Try to find the cached order and clear its UUID too
        const cacheKey = `reseller_order_${orderId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const cacheData = JSON.parse(cached);
            if (cacheData.order?.id) {
              localStorage.removeItem(`reseller_order_${cacheData.order.id}`);
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (error) {
      console.warn('[OrderService] Failed to clear order cache:', error);
    }
  }

  // Clear all orders cache
  static clearOrdersCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('reseller_orders_list_') || key.startsWith('reseller_order_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('🗑️ [OrderService] Cleared all orders cache:', keysToRemove.length, 'keys');
    } catch (error) {
      console.warn('[OrderService] Failed to clear orders cache:', error);
    }
  }
  // ============== HELPER METHODS ==============

  // Clear session data
  static clearSessionData() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('resellerToken');
      localStorage.removeItem('resellerSessionId');
      localStorage.removeItem('resellerProfile');
      localStorage.removeItem('resellerKeys');
      // Also clear order caches
      ResellerOrderService.clearOrdersCache();
    }
  }

  // Test encryption endpoint
  static async testEncryption() {
    try {
      console.log('🧪 [OrderService] Testing encryption/decryption flow...');
      
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/health', {
        withCredentials: true
      });
      
      console.log('🧪 [OrderService] Test response:', {
        status: response.status,
        encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv)
      });
      
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('🧪 [OrderService] Test result:', {
        success: result?.success,
        result
      });
      
      return {
        success: true,
        encryptionWorking: !!response.data?.encryptedKey,
        decryptionWorking: result?.success === true,
        message: 'Encryption test completed successfully'
      };
    } catch (error) {
      console.error('❌ [OrderService] Encryption test failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Encryption test failed'
      };
    }
  }

  // Error handling
  static handleApiError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          if (data?.error === 'INSUFFICIENT_STOCK') {
            return new Error('Insufficient stock available for one or more items.');
          } else if (data?.error === 'INSUFFICIENT_BALANCE') {
            return new Error('Insufficient wallet balance to complete the order.');
          } else if (data?.error === 'VALIDATION_ERROR') {
            return new Error(data.message || 'Invalid order data. Please check your input.');
          }
          return new Error(data?.message || 'Bad request. Please check your order data.');
        case 401:
          ResellerOrderService.clearSessionData();
          return new Error('Your session has expired. Please login again.');
        case 403:
          return new Error('You do not have permission to perform this action.');
        case 404:
          return new Error('Order not found.');
        case 409:
          return new Error('Order cannot be cancelled. It may already be processing or completed.');
        case 429:
          return new Error('Too many requests. Please try again later.');
        case 500:
          return new Error('Server error. Please try again later.');
        default:
          return new Error(data?.message || `Error ${status}: An error occurred.`);
      }
    } else if (error.request) {
      return new Error('No response from server. Please check your internet connection.');
    } else {
      return error;
    }
}

  // Format price with currency
  static formatPrice(amount, currencyCode) {
    try {
      if (!amount && amount !== 0) return 'N/A';
      
      const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (isNaN(amountNum)) return 'Invalid amount';
      
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amountNum);
    } catch (error) {
      return `${currencyCode || 'USD'} ${amount}`;
    }
  }

  // Check if order can be cancelled
  static canCancelOrder(order) {
    if (!order) return false;
    
    const cancellableStatuses = ['PENDING', 'PROCESSING'];
    return cancellableStatuses.includes(order.status);
  }

  // Get product price range (for consistency with ProductService)
  static getProductPriceRange(product) {
    if (!product?.denominations || product.denominations.length === 0) {
      return null;
    }
    
    const validDenoms = product.denominations.filter(d => 
      d.status === 'ACTIVE' && 
      (d.stockCount === undefined || d.stockCount > 0)
    );
    
    if (validDenoms.length === 0) return null;
    
    const amounts = validDenoms.map(d => {
      const amount = d.finalAmount || d.convertedAmount || d.amount;
      return typeof amount === 'string' ? parseFloat(amount) : amount;
    }).filter(amount => !isNaN(amount));
    
    if (amounts.length === 0) return null;
    
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const currency = product.displayCurrency || product.currency?.code || 'USD';
    
    return {
      min,
      max,
      currency,
      formattedMin: this.formatPrice(min, currency),
      formattedMax: this.formatPrice(max, currency)
    };
  }

  // Format order summary - FIXED VERSION
  static formatOrderSummary(order) {
    if (!order) return null;
    
    try {
      // Extract items data
      const items = order.items?.map(item => ({
        productName: item.product?.name || 'Unknown Product',
        denominationAmount: item.denomination?.amount || item.unitPrice || 0,
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        totalPrice: item.totalPrice || 0,
        currency: item.currency?.code || 'USD'
      })) || [];

      const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      
      // FIXED: Safely calculate totalAmount
      let totalAmount = order.totalPrice || 
                       items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      
      // Ensure totalAmount is a number
      if (typeof totalAmount === 'string') {
        totalAmount = parseFloat(totalAmount);
      }
      
      if (isNaN(totalAmount)) {
        totalAmount = 0;
      }
      
      const currency = order.currency?.code || 
                      order.currencyCode || 
                      order.currencyId?.code || 
                      'USD';
      
      const summary = {
        orderId: order.id || order.orderId,
        invoiceId: order.invoiceId || order.orderNumber,
        status: order.status || 'UNKNOWN',
        totalAmount: Number(totalAmount.toFixed(2)),
        totalItems,
        items,
        currency,
        createdAt: order.createdAt || new Date().toISOString(),
        updatedAt: order.updatedAt || new Date().toISOString(),
        canCancel: this.canCancelOrder(order),
        formattedTotal: this.formatPrice(totalAmount, currency)
      };

      return summary;
    } catch (error) {
      console.error('❌ Error formatting order summary:', error);
      // Return a safe default summary
      return {
        orderId: order?.id || order?.orderId || 'N/A',
        invoiceId: order?.invoiceId || order?.orderNumber || 'N/A',
        status: order?.status || 'UNKNOWN',
        totalAmount: 0,
        totalItems: 0,
        items: [],
        currency: 'USD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        canCancel: false,
        formattedTotal: '$0.00'
      };
    }
  }
  
  // Format order items
  static formatOrderItems(items) {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => ({
      id: item.id,
      productId: item.productId,
      product: item.product || { name: 'Unknown Product' },
      productName: item.product?.name || 'Unknown Product',
      denominationId: item.denominationId,
      denominationAmount: item.denomination?.amount || item.unitPrice || 0,
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      originalUnitPrice: item.originalUnitPrice || item.unitPrice || 0,
      totalPrice: item.totalPrice || 0,
      discountApplied: item.discountApplied || 0,
      vouchers: item.vouchers || []
    }));
  }
  
  // Calculate discount percentage
  static calculateDiscountPercentage(originalPrice, discountedPrice) {
    if (!originalPrice || originalPrice <= 0 || !discountedPrice) return 0;
    
    const original = typeof originalPrice === 'string' ? parseFloat(originalPrice) : originalPrice;
    const discounted = typeof discountedPrice === 'string' ? parseFloat(discountedPrice) : discountedPrice;
    
    if (isNaN(original) || isNaN(discounted) || original <= 0) return 0;
    
    return Math.round(((original - discounted) / original) * 100);
  }
  
  // Get order timeline
  static getOrderTimeline(order) {
    if (!order) return [];
    
    const timeline = [];
    
    if (order.createdAt) {
      timeline.push({
        event: 'Order Created',
        timestamp: order.createdAt,
        description: 'Order was successfully placed'
      });
    }
    
    if (order.processingAt) {
      timeline.push({
        event: 'Processing Started',
        timestamp: order.processingAt,
        description: 'Order processing began'
      });
    }
    
    if (order.completedAt) {
      timeline.push({
        event: 'Order Completed',
        timestamp: order.completedAt,
        description: 'Order was completed successfully'
      });
    }
    
    if (order.cancelledAt) {
      timeline.push({
        event: 'Order Cancelled',
        timestamp: order.cancelledAt,
        description: 'Order was cancelled'
      });
    }
    
    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
  
  // Get default statistics
  static getDefaultStatistics() {
    return {
      summary: {
        totalOrders: 0,
        totalRevenue: 0,
        completedOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        completionRate: 0,
        currency: 'USD'
      },
      statusBreakdown: [],
      monthlyStatistics: []
    };
  }
  
  // Get default wallet balance
  static getDefaultWalletBalance() {
    return {
      totalBalance: 0,
      availableBalance: 0,
      wallets: [],
      defaultCurrency: 'USD'
    };
  }
}

export default ResellerOrderService;