// src/services/product.service.js
import apiClient from '../api/apiClient';
import { 
  sessionKeys, 
  decryptServerResponse,
  initResellerEncryption,
  loadKeyPair
} from '../crypto/crypto.helper';

class ResellerProductService {
  // Initialize encryption if needed
  static async initEncryptionIfNeeded() {
    console.log('🔑 Checking encryption status...', {
      hasPublicKey: !!sessionKeys.publicKey,
      hasPrivateKey: !!sessionKeys.privateKey
    });
    
    if (!sessionKeys.publicKey || !sessionKeys.privateKey) {
      console.log('🔄 Initializing encryption...');
      try {
        await initResellerEncryption();
        
        // Double-check that keys were loaded
        if (!sessionKeys.privateKey) {
          console.warn('⚠️ Private key still missing after init, trying to load from localStorage...');
          const keys = await loadKeyPair();
          if (keys) {
            sessionKeys.privateKey = keys.privateKey;
            sessionKeys.publicKey = keys.publicKey;
            console.log('✅ Keys loaded from localStorage');
          } else {
            console.error('❌ Failed to load keys from localStorage');
            throw new Error('Encryption keys not available');
          }
        }
        
        console.log('✅ Encryption initialized successfully:', {
          hasPublicKey: !!sessionKeys.publicKey,
          hasPrivateKey: !!sessionKeys.privateKey
        });
      } catch (error) {
        console.error('❌ Failed to initialize encryption:', error);
        throw error;
      }
    } else {
      console.log('✅ Encryption already initialized');
    }
  }

  // Helper to handle encrypted responses
 // In ResellerProductService.js - update handleResponse method
static async handleResponse(response) {
  try {
    console.log('📦 API Response received:', {
      status: response.status,
      statusText: response.statusText,
      encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv),
      hasSuccessField: response.data?.success !== undefined,
      responseKeys: Object.keys(response.data || {})
    });

    // If response already has success=false, return as-is
    if (response.data?.success === false) {
      console.log('❌ Response indicates failure, returning as-is');
      return response.data;
    }

    // Check if response is encrypted
    if (response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv) {
      console.log('🔐 Received encrypted response structure');
      
      // CRITICAL: Ensure we have private key for decryption
      if (!sessionKeys.privateKey) {
        console.error('❌ NO PRIVATE KEY AVAILABLE for decryption!');
        console.log('🔄 Attempting to load keys from localStorage...');
        
        const keys = await loadKeyPair();
        if (keys) {
          sessionKeys.privateKey = keys.privateKey;
          sessionKeys.publicKey = keys.publicKey;
          console.log('✅ Keys loaded from localStorage');
        } else {
          console.error('❌ Failed to load keys from localStorage');
          // Don't throw, return plain data if possible
          if (response.data?.data) {
            return {
              success: response.data.success !== false,
              ...response.data.data
            };
          }
          return {
            success: false,
            error: 'No private key available',
            message: 'Cannot decrypt response'
          };
        }
      }
      
      console.log('🔑 Private key available, attempting decryption...');
      
      try {
        const decryptedData = await decryptServerResponse(response.data, sessionKeys.privateKey);
        console.log('✅ Decryption successful:', {
          decryptedType: typeof decryptedData,
          isObject: typeof decryptedData === 'object',
          isString: typeof decryptedData === 'string',
          value: typeof decryptedData === 'string' ? 
            (decryptedData.length > 100 ? decryptedData.substring(0, 100) + '...' : decryptedData) : 
            'object'
        });
        
        let parsedData = decryptedData;
        
        // If decrypted data is a string, try to parse it as JSON
        if (typeof decryptedData === 'string') {
          try {
            console.log('🔄 Parsing decrypted string as JSON...');
            // Clean the string first (remove extra quotes, etc.)
            let cleanString = decryptedData.trim();
            
            // Remove surrounding quotes if present
            if (cleanString.startsWith('"') && cleanString.endsWith('"')) {
              cleanString = cleanString.substring(1, cleanString.length - 1);
            }
            
            // Unescape JSON string
            cleanString = cleanString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            
            // Try to parse
            parsedData = JSON.parse(cleanString);
            console.log('✅ String parsed successfully as JSON');
          } catch (parseError) {
            console.warn('⚠️ Failed to parse decrypted string as JSON:', parseError.message);
            
            // Try direct JSON parse on original string as fallback
            try {
              parsedData = JSON.parse(decryptedData);
              console.log('✅ Direct JSON parse succeeded');
            } catch (directParseError) {
              console.warn('⚠️ Direct JSON parse also failed:', directParseError.message);
              
              // If it looks like JSON but has issues, try to fix common problems
              if (decryptedData.includes('{') && decryptedData.includes('}')) {
                try {
                  // Try to fix common JSON issues
                  const fixedJson = decryptedData
                    .replace(/\\n/g, '')
                    .replace(/\\r/g, '')
                    .replace(/\\t/g, '')
                    .replace(/\\'/g, "'")
                    .replace(/\\\\/g, "\\")
                    .replace(/(\w+):/g, '"$1":')  // Add quotes to property names
                    .replace(/:\s*'([^']*)'/g, ':"$1"')  // Replace single quotes with double
                    .replace(/,(\s*[}\]])/g, '$1');  // Remove trailing commas
                  
                  parsedData = JSON.parse(fixedJson);
                  console.log('🔄 Fixed and parsed JSON successfully');
                } catch (fixError) {
                  console.error('❌ Failed to fix and parse JSON:', fixError);
                  // Return as plain data wrapped in success object
                  parsedData = {
                    success: true,
                    data: decryptedData
                  };
                }
              } else {
                // Not JSON, return as plain data wrapped in success object
                parsedData = {
                  success: true,
                  data: decryptedData
                };
              }
            }
          }
        }
        
        // At this point, parsedData should be an object
        if (parsedData && typeof parsedData === 'object') {
          console.log('📊 Parsed data structure:', {
            hasSuccessField: 'success' in parsedData,
            hasDataField: 'data' in parsedData,
            keys: Object.keys(parsedData)
          });
          
          // Ensure success field exists
          const result = {
            success: parsedData.success !== false,
            ...parsedData
          };
          
          // If parsedData has a data field, flatten it for easier access
          if (parsedData.data && typeof parsedData.data === 'object') {
            Object.assign(result, parsedData.data);
          }
          
          console.log('🎯 Final processed result:', {
            success: result.success,
            keys: Object.keys(result)
          });
          
          return result;
        } else {
          console.error('❌ Invalid parsed data format after processing:', {
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
        console.error('❌ Decryption process failed:', {
          error: decryptError.message,
          stack: decryptError.stack
        });
        
        // Check if we have plain data in response
        if (response.data?.data) {
          console.log('🔄 Fallback: Using response.data.data');
          const plainData = response.data.data;
          return {
            success: response.data.success !== false,
            ...(typeof plainData === 'object' ? plainData : { data: plainData })
          };
        }
        
        // Try to get any data from response
        if (response.data) {
          return {
            success: false,
            error: 'Decryption failed',
            message: decryptError.message,
            ...response.data
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
    console.log('📨 Plain response received');
    
    if (response.data && typeof response.data === 'object') {
      // Ensure success field exists
      const result = { ...response.data };
      if (result.success === undefined) {
        result.success = true;
      }
      
      // If result has data field, merge it for easier access
      if (result.data && typeof result.data === 'object') {
        Object.assign(result, result.data);
      }
      
      return result;
    }
    
    // If response.data is not an object, wrap it
    return {
      success: response.status >= 200 && response.status < 300,
      data: response.data
    };
    
  } catch (error) {
    console.error('❌ handleResponse general error:', error);
    return {
      success: false,
      error: 'Response handling failed',
      message: error.message,
      originalResponse: response?.data
    };
  }
}

  // Get products list
  static async getProductList(filters = {}) {
    try {
      console.log('🔍 Fetching products with filters:', filters);
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      // Check cache first
      const cacheKey = this.getProductListCacheKey(filters);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache
          if (Date.now() - cacheData.timestamp < CACHE_TTL) {
            console.log('💾 Using cached products:', cacheData.products.length);
            return {
              success: true,
              products: cacheData.products,
              pagination: cacheData.pagination || {},
              filters,
              count: cacheData.products.length,
              fromCache: true
            };
          }
        } catch (cacheError) {
          console.warn('Cache read error:', cacheError);
        }
      }
      
      const response = await apiClient.get('/api/v1/reseller-user/products/list', {
        params: filters,
        withCredentials: true
      });

      console.log('📥 Raw API response status:', response.status);
      
      const result = await this.handleResponse(response);
      
      console.log('✅ Processed result:', {
        success: result?.success,
        hasProducts: !!result?.products,
        productsCount: result?.products?.length || 0,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch products');
      }
      
      // Extract products from the normalized result
      const products = result?.products || result?.data?.products || [];
      const pagination = result?.pagination || result?.data?.pagination || {};
      
      // Cache the results
      if (products.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            products,
            pagination,
            filters,
            timestamp: Date.now()
          }));
          console.log('💾 Cached products:', products.length);
        } catch (cacheError) {
          console.warn('Cache write error:', cacheError);
        }
      }
      
      return {
        success: true,
        products,
        pagination,
        filters,
        count: products.length,
        fromCache: false
      };
      
    } catch (error) {
      console.error('❌ Get product list error:', {
        message: error.message,
        stack: error.stack,
        filters
      });
      
      // Try to return cached data even if stale
      try {
        const cacheKey = this.getProductListCacheKey(filters);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cacheData = JSON.parse(cached);
          console.log('🔄 Returning stale cache due to error');
          return {
            success: true,
            products: cacheData.products,
            pagination: cacheData.pagination || {},
            filters,
            count: cacheData.products.length,
            fromCache: true,
            error: error.message
          };
        }
      } catch (cacheError) {
        console.warn('Stale cache read error:', cacheError);
      }
      
      // Handle specific error cases
      if (error.response) {
        console.error('Error response details:', {
          status: error.response.status,
          data: error.response.data
        });
        
        if (error.response.status === 401) {
          // Clear storage on 401
          if (typeof window !== 'undefined') {
            localStorage.removeItem('resellerToken');
            localStorage.removeItem('resellerSessionId');
            localStorage.removeItem('resellerProfile');
            localStorage.removeItem('resellerKeys');
          }
          throw new Error('Session expired. Please login again.');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to view products.');
        }
      }
      
      throw this.handleApiError(error);
    }
  }

  // ============== CACHE METHODS ==============
  
  // Cache product list
  static cacheProductList(products, filters = {}) {
    try {
      const cacheKey = this.getProductListCacheKey(filters);
      const cacheData = {
        products,
        timestamp: Date.now(),
        filters
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('💾 Cached product list:', products.length, 'products');
    } catch (error) {
      console.warn('Failed to cache product list:', error);
    }
  }

  // Get cached product list
  static getCachedProductList(filters = {}) {
    try {
      const cacheKey = this.getProductListCacheKey(filters);
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const cacheData = JSON.parse(cached);
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        
        if (Date.now() - cacheData.timestamp < CACHE_TTL) {
          console.log('💾 Using cached product list:', cacheData.products.length, 'products');
          return cacheData.products;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get cached product list:', error);
      return null;
    }
  }

  // Get cache key
  static getProductListCacheKey(filters = {}) {
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((obj, key) => {
        obj[key] = filters[key];
        return obj;
      }, {});
    
    return `reseller_product_list_${JSON.stringify(sortedFilters)}`;
  }

  // Clear product cache
  static clearProductCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('reseller_product_list_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('🗑️ Cleared product cache:', keysToRemove.length, 'keys');
    } catch (error) {
      console.warn('Failed to clear product cache:', error);
    }
  }

  // Test encryption endpoint
  static async testEncryption() {
    try {
      console.log('🧪 Testing encryption/decryption flow...');
      
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/products/health', {
        withCredentials: true
      });
      
      console.log('🧪 Test response:', {
        status: response.status,
        encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv)
      });
      
      const result = await this.handleResponse(response);
      
      console.log('🧪 Test result:', {
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
      console.error('❌ Encryption test failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Encryption test failed'
      };
    }
  }

  // Get product by ID
  static async getProductById(productId, currency = null) {
    try {
      await this.initEncryptionIfNeeded();
      
      const params = currency ? { currency } : {};
      const response = await apiClient.get(`/api/v1/reseller-user/products/${productId}`, { 
        params,
        withCredentials: true 
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get product');
      }
      
      // Extract product from different possible structures
      const product = result?.data || result?.product || result;
      
      return {
        success: true,
        product,
        ...(result?.pagination ? { pagination: result.pagination } : {})
      };
    } catch (error) {
      console.error('Get product by ID error:', error);
      throw this.handleApiError(error);
    }
  }

  // Get available currencies
  static async getAvailableCurrencies() {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/products/currencies/list', {
        withCredentials: true
      });
      
      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get currencies');
      }
      
      const currencies = result?.data?.currencies || result?.currencies || [];
      
      return {
        success: true,
        currencies
      };
    } catch (error) {
      console.error('Get currencies error:', error);
      throw this.handleApiError(error);
    }
  }

  // Convert currency
  static async convertCurrencyAmount(amount, fromCurrency, toCurrency) {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.post('/api/v1/reseller-user/products/currencies/convert', {
        amount,
        fromCurrency,
        toCurrency
      }, { withCredentials: true });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Currency conversion failed');
      }
      
      const conversionResult = result?.data || result;
      
      return {
        success: true,
        ...conversionResult
      };
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw this.handleApiError(error);
    }
  }

  // Bulk currency conversion
  static async bulkCurrencyConversion(conversions = []) {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.post('/api/v1/reseller-user/products/currencies/bulk-convert', {
        conversions
      }, { withCredentials: true });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Bulk currency conversion failed');
      }
      
      const conversionResults = result?.data || result?.results || [];
      
      return {
        success: true,
        results: conversionResults
      };
    } catch (error) {
      console.error('Bulk currency conversion error:', error);
      throw this.handleApiError(error);
    }
  }

  // Get categories
  static async getCategories(status = 'ACTIVE') {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/products/categories/list', {
        params: { status },
        withCredentials: true
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get categories');
      }
      
      const categories = result?.data?.categories || result?.categories || [];
      
      return {
        success: true,
        categories
      };
    } catch (error) {
      console.error('Get categories error:', error);
      throw this.handleApiError(error);
    }
  }

  // Get brands
  static async getBrands(status = 'ACTIVE') {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/products/brands/list', {
        params: { status },
        withCredentials: true
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get brands');
      }
      
      const brands = result?.data?.brands || result?.brands || [];
      
      return {
        success: true,
        brands
      };
    } catch (error) {
      console.error('Get brands error:', error);
      throw this.handleApiError(error);
    }
  }

  // Get product statistics
  static async getProductStatistics() {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/products/statistics', {
        withCredentials: true
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get product statistics');
      }
      
      const statistics = result?.data || result;
      
      return {
        success: true,
        ...statistics
      };
    } catch (error) {
      console.error('Get product statistics error:', error);
      throw this.handleApiError(error);
    }
  }

  // Validate currency
  static async validateCurrency(currencyCode) {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get(`/api/v1/reseller-user/products/currencies/validate/${currencyCode}`, {
        withCredentials: true
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Currency validation failed');
      }
      
      const validationResult = result?.data || result;
      
      return {
        success: true,
        ...validationResult
      };
    } catch (error) {
      console.error('Validate currency error:', error);
      throw this.handleApiError(error);
    }
  }

  // Get wallet balance
 // In ResellerProductService.js
// In product.service.js - update getWalletBalance method
static async getWalletBalance() {
  try {
    console.log('💰 [ProductService] Fetching wallet balance');
    
    // Ensure encryption is initialized
    await this.initEncryptionIfNeeded();
    
    const response = await apiClient.get('/api/v1/reseller-user/products/wallet/balance', {
      withCredentials: true
    });

    console.log('💰 [ProductService] Raw wallet balance response:', {
      status: response.status,
      data: response.data
    });

    const result = await this.handleResponse(response);
    
    console.log('💰 [ProductService] Processed wallet balance result:', {
      success: result?.success,
      hasBalance: result?.balance !== undefined,
      hasData: !!result?.data,
      result: result
    });
    
    // Handle both old and new structures
    if (result?.success === false) {
      console.warn('⚠️ [ProductService] Wallet balance fetch returned success=false:', result);
      // Return default balance structure
      return {
        success: true,
        walletId: null,
        balance: 0,
        currency: 'USD',
        currencySymbol: '$',
        isActive: false,
        lastUpdated: new Date().toISOString(),
        recentTransactions: [],
        summary: {
          availableBalance: 0,
          pendingTransactions: 0
        }
      };
    }
    
    // Extract balance from different response structures
    let balanceData;
    
    // Case 1: result has data field with balance
    if (result?.data?.balance !== undefined) {
      console.log('💰 [ProductService] Structure: result.data with balance');
      balanceData = result.data;
    }
    // Case 2: result has balance at root
    else if (result?.balance !== undefined) {
      console.log('💰 [ProductService] Structure: result with balance at root');
      balanceData = result;
    }
    // Case 3: result has data field
    else if (result?.data) {
      console.log('💰 [ProductService] Structure: result.data');
      balanceData = result.data;
    }
    // Case 4: result is the balance object
    else if (result && typeof result === 'object') {
      console.log('💰 [ProductService] Structure: result is balance object');
      balanceData = result;
    }
    // Case 5: No valid data found
    else {
      console.warn('⚠️ [ProductService] No valid balance data found, using defaults');
      balanceData = {
        walletId: null,
        balance: 0,
        currency: 'USD',
        currencySymbol: '$',
        isActive: false,
        lastUpdated: new Date().toISOString(),
        recentTransactions: [],
        summary: {
          availableBalance: 0,
          pendingTransactions: 0
        }
      };
    }
    
    // Ensure all required fields exist
    const finalBalance = {
      success: true,
      walletId: balanceData.walletId || null,
      balance: Number(balanceData.balance) || 0,
      currency: balanceData.currency || 'USD',
      currencySymbol: balanceData.currencySymbol || '$',
      isActive: balanceData.isActive !== false,
      lastUpdated: balanceData.lastUpdated || new Date().toISOString(),
      recentTransactions: balanceData.recentTransactions || [],
      summary: {
        availableBalance: Number(balanceData.balance) || 0,
        pendingTransactions: balanceData.summary?.pendingTransactions || 
                            balanceData.recentTransactions?.filter(t => t.status === 'PENDING').length || 0
      }
    };
    
    console.log('💰 [ProductService] Final wallet balance:', finalBalance);
    
    return finalBalance;
    
  } catch (error) {
    console.error('❌ [ProductService] Get wallet balance error:', error);
    
    // Always return a valid structure even on error
    return {
      success: true,
      walletId: null,
      balance: 0,
      currency: 'USD',
      currencySymbol: '$',
      isActive: false,
      lastUpdated: new Date().toISOString(),
      recentTransactions: [],
      summary: {
        availableBalance: 0,
        pendingTransactions: 0
      }
    };
  }
}

  // Check product availability
  // In product.service.js - update the checkProductAvailability method
static async checkProductAvailability(productId, denominationId, resellerId = null, companyId = null) {
  try {
    console.log('🔍 Checking availability:', {
      productId,
      denominationId,
      resellerId,
      companyId
    });

    // Get IDs from localStorage if not provided
    let finalResellerId = resellerId;
    let finalCompanyId = companyId;
    
    if (!finalResellerId && typeof window !== 'undefined') {
      finalResellerId = localStorage.getItem('resellerId') || 
                       localStorage.getItem('userId') || 
                       localStorage.getItem('resellerUserId');
    }
    
    if (!finalCompanyId && typeof window !== 'undefined') {
      finalCompanyId = localStorage.getItem('companyId') || 
                      localStorage.getItem('userCompanyId');
    }

    // If still no IDs, we can't check availability properly
    if (!finalResellerId || !finalCompanyId) {
      console.warn('⚠️ Missing resellerId or companyId for availability check');
      return {
        available: false,
        productId,
        denominationId,
        stockCount: 0,
        amount: 0,
        currency: 'USD',
        validation: {
          hasStock: false,
          hasQuota: false,
          withinRange: false,
          canSell: false
        },
        message: "User information not available for availability check"
      };
    }

    // Prepare request payload
    const payload = {
      productId,
      denominationId,
      resellerId: finalResellerId,
      companyId: finalCompanyId
    };

    console.log('📤 Sending availability check request:', payload);

    // CORRECTED ENDPOINT: /availability/check instead of /check-availability
    const response = await apiClient.post('/api/v1/reseller-user/products/availability/check', payload, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('📥 Availability check response:', {
      status: response.status,
      data: response.data
    });

    const result = await this.handleResponse(response);
    
    console.log('✅ Availability check result:', result);

    if (result?.success === false) {
      console.warn('⚠️ Availability check returned false:', result);
      return {
        available: false,
        productId,
        denominationId,
        stockCount: 0,
        amount: 0,
        currency: 'USD',
        resellerQuota: 0,
        canSell: false,
        validation: {
          hasStock: false,
          hasQuota: false,
          withinRange: false,
          canSell: false
        },
        message: result.message || result.error || "Product not available"
      };
    }

    // Handle different response structures
    let availabilityData = result?.data || result;
    
    if (!availabilityData) {
      availabilityData = result;
    }

    // Ensure the response has the expected structure
    const finalResult = {
      available: availabilityData.available === true,
      productId: availabilityData.productId || productId,
      denominationId: availabilityData.denominationId || denominationId,
      stockCount: availabilityData.stockCount || 0,
      amount: availabilityData.amount || 0,
      currency: availabilityData.currency || 'USD',
      resellerQuota: availabilityData.resellerQuota || 0,
      canSell: availabilityData.canSell !== false,
      priceMarkup: availabilityData.priceMarkup || 0,
      minQuantity: availabilityData.minQuantity,
      maxQuantity: availabilityData.maxQuantity,
      validation: availabilityData.validation || {
        hasStock: availabilityData.stockCount > 0,
        hasQuota: (availabilityData.resellerQuota || 0) > 0,
        withinRange: true,
        canSell: availabilityData.canSell !== false
      },
      message: availabilityData.message || "Availability checked"
    };

    console.log('🎯 Final availability result:', finalResult);
    
    return finalResult;

  } catch (error) {
    console.error('❌ Error checking availability:', error);
    
    // Return a default unavailable response instead of throwing
    return {
      available: false,
      productId,
      denominationId,
      stockCount: 0,
      amount: 0,
      currency: 'USD',
      resellerQuota: 0,
      canSell: false,
      validation: {
        hasStock: false,
        hasQuota: false,
        withinRange: false,
        canSell: false
      },
      message: error.response?.data?.message || error.message || "Unable to check product availability"
    };
  }
}

  // Health check
  static async healthCheck() {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/products/health', {
        withCredentials: true
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Health check failed');
      }
      
      const healthData = result?.data || result;
      
      return {
        success: true,
        ...healthData
      };
    } catch (error) {
      console.error('Health check error:', error);
      throw this.handleApiError(error);
    }
  }

  // Error handling
  static handleApiError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return new Error(data?.message || 'Bad request. Please check your input.');
        case 401:
          // Clear session data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('resellerToken');
            localStorage.removeItem('resellerSessionId');
            localStorage.removeItem('resellerProfile');
          }
          return new Error('Your session has expired. Please login again.');
        case 403:
          return new Error('You do not have permission to access this resource.');
        case 404:
          return new Error('Resource not found.');
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

  // ============== HELPER METHODS ==============

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

  // Add this method to the ResellerProductService class
static getProductMinPrice(product) {
  if (!product || !product.denominations || product.denominations.length === 0) {
    return 0;
  }
  
  // Get available denominations first
  const availableDenominations = this.getAvailableDenominations(product);
  
  if (availableDenominations.length === 0) {
    return 0;
  }
  
  // Find the minimum price from finalAmount, convertedAmount, or amount
  const minPrice = availableDenominations.reduce((min, denom) => {
    const price = denom.finalAmount || denom.convertedAmount || denom.amount || 0;
    const priceNum = typeof price === 'string' ? parseFloat(price) : price;
    return priceNum < min ? priceNum : min;
  }, Infinity);
  
  return isFinite(minPrice) ? minPrice : 0;
}

  // Check if product is in stock
  static isProductInStock(product) {
    if (!product?.denominations || product.denominations.length === 0) {
      return false;
    }
    
    return product.denominations.some(denom => {
      const isActive = denom.status === 'ACTIVE' || denom.status === undefined;
      const hasStock = denom.stockCount === undefined || 
                       denom.stockCount === null || 
                       denom.stockCount > 0;
      return isActive && hasStock;
    });
  }

  // Get product stock status
  static getProductStockStatus(product) {
    if (!product?.denominations) return 'OUT_OF_STOCK';
    
    const availableDenoms = product.denominations.filter(denom => 
      denom.status === 'ACTIVE' && 
      (denom.stockCount === undefined || denom.stockCount > 0)
    );
    
    if (availableDenoms.length === 0) return 'OUT_OF_STOCK';
    
    const totalStock = availableDenoms.reduce((sum, denom) => sum + (denom.stockCount || 0), 0);
    
    if (totalStock <= 0) return 'OUT_OF_STOCK';
    if (totalStock <= 10) return 'LOW_STOCK';
    return 'IN_STOCK';
  }

  // Get available denominations
  static getAvailableDenominations(product) {
    if (!product?.denominations) {
      return [];
    }
    
    return product.denominations.filter(denom => {
      const isActive = denom.status === 'ACTIVE' || denom.status === undefined;
      const hasStock = denom.stockCount === undefined || 
                       denom.stockCount === null || 
                       denom.stockCount > 0;
      const hasAmount = denom.amount || denom.finalAmount || denom.convertedAmount;
      
      return isActive && hasStock && hasAmount;
    });
  }
  

  // Get product by SKU
  static findProductBySku(products, sku) {
    return products.find(product => product.sku === sku);
  }

  // Filter products by multiple criteria
  static filterProducts(products, filters = {}) {
    if (!products || !Array.isArray(products)) return [];
    
    return products.filter(product => {
      // Filter by category
      if (filters.categoryId && product.categories) {
        const hasCategory = product.categories.some(
          cat => cat.id === filters.categoryId || cat.categoryId === filters.categoryId
        );
        if (!hasCategory) return false;
      }
      
      // Filter by brand
      if (filters.brandId && product.brand?.id !== filters.brandId) {
        return false;
      }
      
      // Filter by status
      if (filters.status && product.status !== filters.status) {
        return false;
      }
      
      // Filter by price range
      const priceRange = this.getProductPriceRange(product);
      if (filters.minPrice && priceRange && priceRange.min < filters.minPrice) {
        return false;
      }
      if (filters.maxPrice && priceRange && priceRange.max > filters.maxPrice) {
        return false;
      }
      
      // Filter by in stock
      if (filters.inStockOnly && !this.isProductInStock(product)) {
        return false;
      }
      
      // Filter by search term
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(searchLower);
        const matchesDescription = product.description?.toLowerCase().includes(searchLower);
        const matchesBrand = product.brand?.name?.toLowerCase().includes(searchLower);
        const matchesSku = product.sku?.toLowerCase().includes(searchLower);
        
        if (!(matchesName || matchesDescription || matchesBrand || matchesSku)) {
          return false;
        }
      }
      
      return true;
    });
  }

  // Sort products
  static sortProducts(products, sortBy = 'name', sortOrder = 'asc') {
    if (!products || !Array.isArray(products)) return [];
    
    return [...products].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'name':
          valueA = a.name?.toLowerCase() || '';
          valueB = b.name?.toLowerCase() || '';
          break;
        case 'price':
          const priceA = this.getProductPriceRange(a)?.min || 0;
          const priceB = this.getProductPriceRange(b)?.min || 0;
          valueA = priceA;
          valueB = priceB;
          break;
        case 'stock':
          const stockA = a.denominations?.reduce((sum, d) => sum + (d.stockCount || 0), 0) || 0;
          const stockB = b.denominations?.reduce((sum, d) => sum + (d.stockCount || 0), 0) || 0;
          valueA = stockA;
          valueB = stockB;
          break;
        case 'createdAt':
          valueA = new Date(a.createdAt || 0).getTime();
          valueB = new Date(b.createdAt || 0).getTime();
          break;
        default:
          valueA = a[sortBy] || '';
          valueB = b[sortBy] || '';
      }
      
      if (sortOrder === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });
  }

  // Calculate discount percentage
  static calculateDiscountPercentage(originalAmount, finalAmount) {
    if (!originalAmount || !finalAmount || originalAmount <= finalAmount) {
      return 0;
    }
    
    const discount = originalAmount - finalAmount;
    const percentage = (discount / originalAmount) * 100;
    return Math.round(percentage * 100) / 100; // Round to 2 decimal places
  }

  // Check if user can purchase product
  static canPurchaseProduct(product, walletBalance = 0) {
    if (!product || !this.isProductInStock(product)) return false;
    
    const priceRange = this.getProductPriceRange(product);
    if (!priceRange) return false;
    
    return walletBalance >= priceRange.min;
  }

  // Group products by category
  static groupProductsByCategory(products) {
    const groups = {};
    
    products.forEach(product => {
      if (product.categories) {
        product.categories.forEach(category => {
          const categoryId = category.id || category.categoryId;
          if (categoryId) {
            if (!groups[categoryId]) {
              groups[categoryId] = {
                category: category,
                products: []
              };
            }
            groups[categoryId].products.push(product);
          }
        });
      }
    });
    
    return groups;
  }

  // Get unique brands from products
  static getUniqueBrands(products) {
    const brandsMap = {};
    const brands = [];
    
    products.forEach(product => {
      if (product.brand && product.brand.id && !brandsMap[product.brand.id]) {
        brandsMap[product.brand.id] = true;
        brands.push(product.brand);
      }
    });
    
    return brands;
  }

  // Get unique categories from products
  static getUniqueCategories(products) {
    const categoriesMap = {};
    const categories = [];
    
    products.forEach(product => {
      if (product.categories) {
        product.categories.forEach(category => {
          const categoryId = category.id || category.categoryId;
          if (categoryId && !categoriesMap[categoryId]) {
            categoriesMap[categoryId] = true;
            categories.push(category);
          }
        });
      }
    });
    
    return categories;
  }
}

export default ResellerProductService;