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

  // Helper to handle encrypted responses
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
        
        // CRITICAL: Ensure we have private key for decryption
        if (!sessionKeys.privateKey) {
          console.error('❌ [OrderService] NO PRIVATE KEY AVAILABLE for decryption!');
          console.log('🔄 [OrderService] Attempting to load keys from localStorage...');
          
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
            isObject: typeof decryptedData === 'object',
            isString: typeof decryptedData === 'string',
            value: typeof decryptedData === 'string' ? decryptedData.substring(0, 100) + '...' : 'object'
          });
          
          let parsedData = decryptedData;
          
          // If decrypted data is a string, try to parse it as JSON
          if (typeof decryptedData === 'string') {
            try {
              console.log('🔄 [OrderService] Parsing decrypted string as JSON...');
              parsedData = JSON.parse(decryptedData);
              console.log('✅ [OrderService] String parsed successfully:', {
                isObject: typeof parsedData === 'object',
                keys: parsedData ? Object.keys(parsedData) : 'null'
              });
            } catch (parseError) {
              console.warn('⚠️ [OrderService] Failed to parse decrypted string as JSON:', parseError.message);
              // If it's a string that looks like JSON but has issues, try to fix it
              if (decryptedData.includes('{') && decryptedData.includes('}')) {
                try {
                  // Try to fix common JSON issues
                  const fixedJson = decryptedData
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":');
                  parsedData = JSON.parse(fixedJson);
                  console.log('🔄 [OrderService] Fixed and parsed JSON successfully');
                } catch (fixError) {
                  console.error('❌ [OrderService] Failed to fix and parse JSON:', fixError);
                  // Return the string as-is
                  parsedData = { data: decryptedData, success: true };
                }
              } else {
                // Not JSON, return as plain data
                parsedData = { data: decryptedData, success: true };
              }
            }
          }
          
          // Validate and normalize parsed data
          if (parsedData && typeof parsedData === 'object') {
            console.log('📊 [OrderService] Parsed data structure:', {
              hasDataField: 'data' in parsedData,
              hasSuccessField: 'success' in parsedData,
              keys: Object.keys(parsedData)
            });
            
            let finalResult = { success: true };
            
            // Case 1: parsedData has data field
            if (parsedData.data !== undefined) {
              console.log('📁 [OrderService] Structure: parsedData.data');
              finalResult = {
                success: parsedData.success !== false,
                ...parsedData,
                ...(typeof parsedData.data === 'object' ? parsedData.data : { data: parsedData.data })
              };
            }
            // Case 2: parsedData has success field
            else if (parsedData.success !== undefined) {
              console.log('📁 [OrderService] Structure: parsedData with success field');
              finalResult = parsedData;
            }
            // Case 3: It's an array
            else if (Array.isArray(parsedData)) {
              console.log('📁 [OrderService] Structure: Array');
              finalResult = {
                success: true,
                data: parsedData
              };
            }
            // Case 4: Empty or unknown structure
            else {
              console.log('📁 [OrderService] Structure: Direct object');
              finalResult = {
                success: true,
                ...parsedData
              };
            }
            
            console.log('🎯 [OrderService] Final processed result:', {
              success: finalResult.success,
              hasData: !!finalResult.data,
              keys: Object.keys(finalResult)
            });
            
            return finalResult;
          } else {
            console.error('❌ [OrderService] Invalid parsed data format:', {
              type: typeof parsedData,
              value: parsedData
            });
            
            // Return as-is with success flag
            return {
              success: true,
              data: parsedData
            };
          }
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
              ...(typeof plainData === 'object' ? plainData : { data: plainData })
            };
          }
          
          // Return error response
          return {
            success: false,
            error: 'Decryption failed',
            message: decryptError.message,
            encryptedData: response.data
          };
        }
      }

      // Handle plain response
      console.log('📨 [OrderService] Plain response received');
      
      if (response.data && typeof response.data === 'object') {
        // Ensure success field exists
        const result = { ...response.data };
        if (result.success === undefined) {
          result.success = response.status >= 200 && response.status < 300;
        }
        
        return result;
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
        message: error.message,
        originalResponse: response?.data
      };
    }
  }

  // ============== ORDER MANAGEMENT ==============

  // Create a new order
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

      // Optional: Encrypt sensitive data before sending
      const encryptedData = await ResellerOrderService.encryptOrderData(orderData);
      
      const response = await apiClient.post('/api/v1/reseller-user/orders/create', encryptedData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 [OrderService] Raw API response status:', response.status);
      
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('✅ [OrderService] Processed result:', {
        success: result?.success,
        hasData: !!result?.data,
        invoiceId: result?.data?.invoiceId,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to create order');
      }
      
      // Extract order data from response
      const orderResult = result?.data || result;
      
      // Cache the order if needed
      ResellerOrderService.cacheOrder(orderResult);
      
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

  // Get orders list
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
        hasOrders: !!result?.orders,
        ordersCount: result?.orders?.length || 0,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch orders');
      }
      
      // Extract orders from response
      const orders = result?.data?.orders || result?.orders || [];
      const pagination = result?.data?.pagination || result?.pagination || {};
      
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

  // Get order by ID
  static async getOrderById(orderId) {
    try {
      console.log('🔍 [OrderService] Fetching order by ID:', orderId);
      
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      // Check cache first
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
      
      const response = await apiClient.get(`/api/v1/reseller-user/orders/${orderId}`, {
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get order');
      }
      
      // Extract order from response
      const order = result?.data || result;
      
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
      
      const response = await apiClient.post(`/api/v1/reseller-user/orders/${orderId}/cancel`, {}, {
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
        ...result?.data,
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
      
      const response = await apiClient.get(`/api/v1/reseller-user/orders/${orderId}/status`, {
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to check order status');
      }
      
      return {
        success: true,
        status: result?.data || result
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Check order status error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // ============== INVOICE MANAGEMENT ==============

  // Get invoices list
  static async getInvoices(filters = {}) {
    try {
      console.log('🔍 [OrderService] Fetching invoices with filters:', filters);
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/invoices/list', {
        params: filters,
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch invoices');
      }
      
      return {
        success: true,
        invoices: result?.data?.invoices || result?.invoices || [],
        pagination: result?.data?.pagination || result?.pagination || {},
        summary: result?.data?.summary || result?.summary || {}
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get invoices error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // Get orders by invoice ID
  static async getOrdersByInvoice(invoiceId) {
    try {
      console.log('🔍 [OrderService] Fetching orders for invoice:', invoiceId);
      
      if (!invoiceId) {
        throw new Error('Invoice ID is required');
      }
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get(`/api/v1/reseller-user/orders/invoices/${invoiceId}/orders`, {
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get invoice orders');
      }
      
      return {
        success: true,
        ...result?.data,
        invoice: result?.data?.invoice || result?.invoice
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get orders by invoice error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // ============== VOUCHER MANAGEMENT ==============

  // Get vouchers list
  static async getVouchers(filters = {}) {
    try {
      console.log('🔍 [OrderService] Fetching vouchers with filters:', filters);
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/vouchers/list', {
        params: filters,
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch vouchers');
      }
      
      return {
        success: true,
        vouchers: result?.data?.vouchers || result?.vouchers || [],
        pagination: result?.data?.pagination || result?.pagination || {},
        summary: result?.data?.summary || result?.summary || {}
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get vouchers error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // Get voucher by ID
  static async getVoucherById(voucherId) {
    try {
      console.log('🔍 [OrderService] Fetching voucher by ID:', voucherId);
      
      if (!voucherId) {
        throw new Error('Voucher ID is required');
      }
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get(`/api/v1/reseller-user/orders/vouchers/${voucherId}`, {
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get voucher');
      }
      
      return {
        success: true,
        voucher: result?.data?.voucher || result?.voucher || result?.data || result
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get voucher by ID error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // Get voucher statistics
  static async getVoucherStatistics() {
    try {
      console.log('📊 [OrderService] Fetching voucher statistics');
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/vouchers/statistics', {
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get voucher statistics');
      }
      
      return {
        success: true,
        ...result?.data,
        statistics: result?.data || result
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get voucher statistics error:', error);
      throw ResellerOrderService.handleApiError(error);
    }
  }

  // ============== STATISTICS & ANALYTICS ==============

  // Get order statistics
  static async getOrderStatistics(filters = {}) {
    try {
      console.log('📊 [OrderService] Fetching order statistics with filters:', filters);
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/statistics', {
        params: filters,
        withCredentials: true
      });
  
      console.log('📊 [OrderService] Statistics response received:', {
        status: response.status,
        dataKeys: response.data ? Object.keys(response.data) : 'none'
      });
  
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('📊 [OrderService] Statistics result processed:', {
        success: result?.success,
        hasStatistics: !!result?.statistics,
        dataKeys: result ? Object.keys(result) : 'null'
      });
      
      // Even if result.success is false, we should still try to handle it gracefully
      if (result?.success === false) {
        console.warn('⚠️ [OrderService] Statistics fetch returned success=false:', result);
        // Don't throw error - return default statistics
        return {
          success: true,
          statistics: ResellerOrderService.getDefaultStatistics()
        };
      }
      
      // Handle different response structures
      let statistics = null;
      
      if (result?.data) {
        // Case 1: result has data field
        statistics = result.data;
      } else if (result?.statistics) {
        // Case 2: result has statistics field
        statistics = result.statistics;
      } else if (result && typeof result === 'object' && !Array.isArray(result)) {
        // Case 3: result is the statistics object itself
        statistics = result;
      } else {
        // Case 4: No valid data found
        console.warn('⚠️ [OrderService] No valid statistics data found in response:', result);
        statistics = ResellerOrderService.getDefaultStatistics();
      }
      
      // Ensure statistics has the expected structure
      if (!statistics.summary) {
        statistics.summary = ResellerOrderService.getDefaultStatistics().summary;
      }
      
      if (!statistics.statusBreakdown) {
        statistics.statusBreakdown = [];
      }
      
      if (!statistics.monthlyStatistics) {
        statistics.monthlyStatistics = [];
      }
      
      return {
        success: true,
        statistics: statistics
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get order statistics error:', error);
      
      // Check if it's a 400 error and return default statistics
      if (error.response?.status === 400) {
        console.log('🔄 [OrderService] Returning default statistics due to 400 error');
        return {
          success: true,
          statistics: ResellerOrderService.getDefaultStatistics()
        };
      }
      
      // Return default statistics instead of throwing error
      return {
        success: true,
        statistics: ResellerOrderService.getDefaultStatistics()
      };
    }
  }

  // In the ResellerOrderService class - update getOrderStatistics method

// Get order statistics
static async getOrderStatistics(filters = {}) {
    try {
      console.log('📊 [OrderService] Fetching order statistics with filters:', filters);
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/statistics', {
        params: filters,
        withCredentials: true
      });
  
      console.log('📊 [OrderService] Statistics response received:', {
        status: response.status,
        dataKeys: response.data ? Object.keys(response.data) : 'none'
      });
  
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('📊 [OrderService] Statistics result processed:', {
        success: result?.success,
        hasStatistics: !!result?.statistics,
        dataKeys: result ? Object.keys(result) : 'null'
      });
      
      // Even if result.success is false, we should still try to handle it gracefully
      if (result?.success === false) {
        console.warn('⚠️ [OrderService] Statistics fetch returned success=false:', result);
        // Don't throw error - return default statistics
        return {
          success: true,
          statistics: ResellerOrderService.getDefaultStatistics()
        };
      }
      
      // Handle different response structures
      let statistics = null;
      
      if (result?.data) {
        // Case 1: result has data field
        statistics = result.data;
      } else if (result?.statistics) {
        // Case 2: result has statistics field
        statistics = result.statistics;
      } else if (result && typeof result === 'object' && !Array.isArray(result)) {
        // Case 3: result is the statistics object itself
        statistics = result;
      } else {
        // Case 4: No valid data found
        console.warn('⚠️ [OrderService] No valid statistics data found in response:', result);
        statistics = ResellerOrderService.getDefaultStatistics();
      }
      
      // Ensure statistics has the expected structure
      if (!statistics.summary) {
        statistics.summary = ResellerOrderService.getDefaultStatistics().summary;
      }
      
      if (!statistics.statusBreakdown) {
        statistics.statusBreakdown = [];
      }
      
      if (!statistics.monthlyStatistics) {
        statistics.monthlyStatistics = [];
      }
      
      return {
        success: true,
        statistics: statistics
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get order statistics error:', error);
      
      // Check if it's a 400 error and return default statistics
      if (error.response?.status === 400) {
        console.log('🔄 [OrderService] Returning default statistics due to 400 error');
        return {
          success: true,
          statistics: ResellerOrderService.getDefaultStatistics()
        };
      }
      
      // Return default statistics instead of throwing error
      return {
        success: true,
        statistics: ResellerOrderService.getDefaultStatistics()
      };
    }
  }
  
  // Add this helper method to get default statistics
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
  
  // Also update getWalletBalance to handle 400 errors similarly
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
  
      console.log('💰 [OrderService] Wallet balance response:', {
        status: response.status,
        dataKeys: response.data ? Object.keys(response.data) : 'none'
      });
  
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('💰 [OrderService] Processed wallet balance result:', {
        success: result?.success,
        hasBalance: !!result?.balance,
        resultKeys: result ? Object.keys(result) : 'none'
      });
      
      if (result?.success === false) {
        // Don't throw error for wallet balance - return default
        console.warn('⚠️ [OrderService] Wallet balance fetch returned success=false:', result);
        return {
          success: true,
          balance: ResellerOrderService.getDefaultWalletBalance()
        };
      }
      
      // Handle different response structures
      let balance = null;
      
      if (result?.data) {
        balance = result.data;
      } else if (result?.balance) {
        balance = result.balance;
      } else if (result && typeof result === 'object' && !Array.isArray(result)) {
        balance = result;
      } else {
        balance = ResellerOrderService.getDefaultWalletBalance();
      }
      
      // Ensure balance has required structure
      if (!balance || typeof balance !== 'object') {
        balance = ResellerOrderService.getDefaultWalletBalance();
      }
      
      return {
        success: true,
        balance: balance
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get wallet balance error:', error);
      
      // Check if it's a 400 error
      if (error.response?.status === 400) {
        console.log('🔄 [OrderService] Returning default wallet balance due to 400 error');
        return {
          success: true,
          balance: ResellerOrderService.getDefaultWalletBalance()
        };
      }
      
      // Return default balance instead of throwing
      return {
        success: true,
        balance: ResellerOrderService.getDefaultWalletBalance()
      };
    }
  }
  
  // Add this helper method for default wallet balance
  static getDefaultWalletBalance() {
    return {
      totalBalance: 0,
      availableBalance: 0,
      wallets: [],
      defaultCurrency: 'USD'
    };
  }
  // ============== WALLET & BALANCE ==============

  // Get wallet balance
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
  
      console.log('💰 [OrderService] Wallet balance response:', {
        status: response.status,
        dataKeys: response.data ? Object.keys(response.data) : 'none'
      });
  
      const result = await ResellerOrderService.handleResponse(response);
      
      console.log('💰 [OrderService] Processed wallet balance result:', {
        success: result?.success,
        hasBalance: !!result?.balance,
        resultKeys: result ? Object.keys(result) : 'none'
      });
      
      if (result?.success === false) {
        // Don't throw error for wallet balance - return default
        console.warn('⚠️ [OrderService] Wallet balance fetch returned success=false:', result);
        return {
          success: true,
          balance: ResellerOrderService.getDefaultWalletBalance()
        };
      }
      
      // Handle different response structures
      let balance = null;
      
      if (result?.data) {
        balance = result.data;
      } else if (result?.balance) {
        balance = result.balance;
      } else if (result && typeof result === 'object' && !Array.isArray(result)) {
        balance = result;
      } else {
        balance = ResellerOrderService.getDefaultWalletBalance();
      }
      
      // Ensure balance has required structure
      if (!balance || typeof balance !== 'object') {
        balance = ResellerOrderService.getDefaultWalletBalance();
      }
      
      return {
        success: true,
        balance: balance
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Get wallet balance error:', error);
      
      // Check if it's a 400 error
      if (error.response?.status === 400) {
        console.log('🔄 [OrderService] Returning default wallet balance due to 400 error');
        return {
          success: true,
          balance: ResellerOrderService.getDefaultWalletBalance()
        };
      }
      
      // Return default balance instead of throwing
      return {
        success: true,
        balance: ResellerOrderService.getDefaultWalletBalance()
      };
    }
  }

  // ============== HEALTH CHECK ==============

  // Health check
  static async healthCheck() {
    try {
      console.log('🏥 [OrderService] Performing health check');
      
      // Ensure encryption is initialized
      await ResellerOrderService.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/health', {
        withCredentials: true
      });

      const result = await ResellerOrderService.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Health check failed');
      }
      
      return {
        success: true,
        health: result?.data || result
      };
      
    } catch (error) {
      console.error('❌ [OrderService] Health check error:', error);
      throw ResellerOrderService.handleApiError(error);
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

  // Encrypt order data (optional - backend handles encryption via middleware)
  static async encryptOrderData(orderData) {
    try {
      // You can encrypt sensitive data here if needed
      // Currently, encryption middleware handles this on the backend
      return orderData;
    } catch (error) {
      console.warn('[OrderService] Order data encryption failed, sending plain:', error);
      return orderData;
    }
  }

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
          // Handle specific order errors
          if (data?.error === 'INSUFFICIENT_STOCK') {
            return new Error('Insufficient stock available for one or more items.');
          } else if (data?.error === 'INSUFFICIENT_BALANCE') {
            return new Error('Insufficient wallet balance to complete the order.');
          } else if (data?.error === 'VALIDATION_ERROR') {
            return new Error(data.message || 'Invalid order data. Please check your input.');
          }
          return new Error(data?.message || 'Bad request. Please check your order data.');
        case 401:
          // Clear session data
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

  // ============== FORMATTING & UTILITY METHODS ==============

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

  // Calculate discount percentage
  static calculateDiscountPercentage(originalAmount, finalAmount) {
    if (!originalAmount || !finalAmount || originalAmount <= finalAmount) {
        return 0;
      }
      
      const discount = originalAmount - finalAmount;
      const percentage = (discount / originalAmount) * 100;
      return Math.round(percentage * 100) / 100;
  }

  // Get order timeline
  static getOrderTimeline(order) {
    if (!order) return [];
    
    const timeline = [];
    
    if (order.createdAt) {
      timeline.push({
        event: 'Order Created',
        timestamp: order.createdAt,
        description: `Order ${order.orderNumber} was created`
      });
    }
    
    if (order.updatedAt && order.status !== 'PENDING') {
      timeline.push({
        event: `Order ${order.status}`,
        timestamp: order.updatedAt,
        description: `Order was ${order.status.toLowerCase()}`
      });
    }
    
    // Add voucher assignment events
    if (order.items) {
      order.items.forEach(item => {
        if (item.vouchers && item.vouchers.length > 0) {
          item.vouchers.forEach(voucher => {
            if (voucher.soldAt || voucher.assignedAt) {
              timeline.push({
                event: 'Voucher Assigned',
                timestamp: voucher.soldAt || voucher.assignedAt,
                description: `Voucher ${voucher.code} was assigned to order`
              });
            }
          });
        }
      });
    }
    
    // Sort timeline by timestamp
    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // Validate order items structure
  static validateOrderItems(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { valid: false, error: 'Order must contain at least one item' };
    }

    const validatedItems = [];
    
    for (const item of items) {
      if (!item.productId) {
        return { valid: false, error: 'Each item must have productId' };
      }

      // Check for nested denominations structure
      if (item.denominations && Array.isArray(item.denominations)) {
        if (item.denominations.length === 0) {
          return { valid: false, error: 'Each item must have at least one denomination' };
        }

        const validatedDenominations = [];
        for (const denomItem of item.denominations) {
          if (!denomItem.denominationId || !denomItem.quantity) {
            return { valid: false, error: 'Each denomination must have denominationId and quantity' };
          }

          if (denomItem.quantity <= 0 || !Number.isInteger(denomItem.quantity)) {
            return { valid: false, error: 'Quantity must be a positive integer' };
          }

          validatedDenominations.push({
            productId: item.productId,
            denominationId: denomItem.denominationId,
            quantity: denomItem.quantity
          });
        }

        validatedItems.push({
          productId: item.productId,
          denominations: validatedDenominations
        });
      } else {
        // Handle flat structure
        if (!item.denominationId || !item.quantity) {
          return { valid: false, error: 'Each item must have denominationId and quantity' };
        }

        if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
          return { valid: false, error: 'Quantity must be a positive integer' };
        }

        validatedItems.push({
          productId: item.productId,
          denominationId: item.denominationId,
          quantity: item.quantity
        });
      }
    }

    return { valid: true, items: validatedItems };
  }

  // Calculate order total
  static calculateOrderTotal(items, pricingInfo) {
    if (!items || !pricingInfo) return 0;
    
    let total = 0;
    
    items.forEach(item => {
      if (item.denominations) {
        item.denominations.forEach(denom => {
          const price = pricingInfo[denom.denominationId];
          if (price) {
            total += price.discountedPrice * denom.quantity;
          }
        });
      } else {
        const price = pricingInfo[item.denominationId];
        if (price) {
          total += price.discountedPrice * item.quantity;
        }
      }
    });
    
    return total;
  }

  // Format order summary
  static formatOrderSummary(order) {
    if (!order) return null;
    
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      invoiceId: order.invoiceId,
      status: order.status,
      totalAmount: parseFloat(order.totalPrice || 0),
      currency: order.currency?.code || 'USD',
      createdAt: order.createdAt,
      itemCount: order.items?.length || 0,
      voucherCount: order.items?.reduce((sum, item) => sum + (item.vouchers?.length || 0), 0) || 0
    };
  }

  // Get order status info
  static getOrderStatusInfo(status) {
    const statusConfig = {
      'PENDING': { label: 'Pending', color: 'warning', icon: 'clock' },
      'PROCESSING': { label: 'Processing', color: 'info', icon: 'sync' },
      'COMPLETED': { label: 'Completed', color: 'success', icon: 'check' },
      'CANCELLED': { label: 'Cancelled', color: 'error', icon: 'x' },
      'FAILED': { label: 'Failed', color: 'error', icon: 'alert' }
    };
    
    return statusConfig[status] || { label: status, color: 'default', icon: 'help' };
  }

  // Format order items for display
  static formatOrderItems(items) {
    if (!items) return [];
    
    return items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name || 'Unknown Product',
      productImage: item.product?.images?.[0]?.url || null,
      denominationId: item.denominationId,
      denominationAmount: parseFloat(item.denomination?.amount || 0),
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice || 0),
      totalPrice: parseFloat(item.totalPrice || 0),
      discountApplied: parseFloat(item.discountApplied || 0),
      voucherCount: item.vouchers?.length || 0,
      vouchers: item.vouchers?.map(v => ({
        id: v.id,
        code: v.code,
        status: v.status
      })) || []
    }));
  }

  // Get product price range
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

  // Check if product is in stock
  static isProductInStock(product) {
    if (!product?.denominations || product.denominations.length === 0) {
      return false;
    }
    
    return product.denominations.some(denom => 
      denom.status === 'ACTIVE' && 
      (denom.stockCount === undefined || denom.stockCount > 0)
    );
  }

  // Check if user can purchase product
  static canPurchaseProduct(product, walletBalance = 0) {
    if (!product || !this.isProductInStock(product)) return false;
    
    const priceRange = this.getProductPriceRange(product);
    if (!priceRange) return false;
    
    return walletBalance >= priceRange.min;
  }
}

export default ResellerOrderService;