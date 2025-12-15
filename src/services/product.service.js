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
            throw new Error('Cannot decrypt response: No private key available');
          }
        }
        
        console.log('🔑 Private key available, attempting decryption...');
        
        try {
          const decryptedData = await decryptServerResponse(response.data, sessionKeys.privateKey);
          console.log('✅ Decryption successful:', {
            decryptedType: typeof decryptedData,
            isObject: typeof decryptedData === 'object',
            keys: decryptedData ? Object.keys(decryptedData) : 'null'
          });
          
          // Validate and normalize decrypted data
          if (decryptedData && typeof decryptedData === 'object') {
            console.log('📊 Decrypted data structure:', {
              hasDataField: 'data' in decryptedData,
              hasProductsField: 'products' in decryptedData,
              hasSuccessField: 'success' in decryptedData
            });
            
            let finalResult = { success: true };
            
            // Case 1: decryptedData has data.products
            if (decryptedData.data && decryptedData.data.products) {
              console.log('📁 Structure: decryptedData.data.products');
              finalResult = {
                success: true,
                products: decryptedData.data.products,
                pagination: decryptedData.data.pagination,
                ...decryptedData.data
              };
            }
            // Case 2: decryptedData has products directly
            else if (decryptedData.products) {
              console.log('📁 Structure: decryptedData.products');
              finalResult = {
                success: true,
                products: decryptedData.products,
                pagination: decryptedData.pagination,
                ...decryptedData
              };
            }
            // Case 3: decryptedData is the data itself
            else if (decryptedData.success !== undefined) {
              console.log('📁 Structure: decryptedData with success field');
              finalResult = decryptedData;
            }
            // Case 4: It's an array (direct list of products)
            else if (Array.isArray(decryptedData)) {
              console.log('📁 Structure: Array (direct products list)');
              finalResult = {
                success: true,
                products: decryptedData,
                pagination: {}
              };
            }
            // Case 5: Empty or unknown structure
            else {
              console.warn('⚠️ Unknown decrypted structure, returning as-is');
              finalResult = {
                success: true,
                data: decryptedData,
                ...decryptedData
              };
            }
            
            console.log('🎯 Final processed result:', {
              success: finalResult.success,
              hasProducts: !!finalResult.products,
              productsCount: finalResult.products?.length || 0
            });
            
            return finalResult;
          } else {
            console.error('❌ Invalid decrypted data format:', {
              type: typeof decryptedData,
              value: decryptedData
            });
            
            // Try to parse if it's a string
            if (typeof decryptedData === 'string') {
              try {
                const parsed = JSON.parse(decryptedData);
                console.log('🔄 Parsed string data:', parsed);
                return this.handleResponse({ data: parsed });
              } catch (parseError) {
                throw new Error(`Invalid decrypted data: String parse failed - ${parseError.message}`);
              }
            }
            
            throw new Error('Invalid decrypted data format: Expected object');
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
        
        // Normalize structure for plain responses too
        if (result.data && result.data.products) {
          return {
            success: result.success,
            products: result.data.products,
            pagination: result.data.pagination,
            ...result.data
          };
        } else if (result.products) {
          return {
            success: result.success,
            products: result.products,
            pagination: result.pagination,
            ...result
          };
        }
        
        return result;
      }
      
      // If response.data is not an object, wrap it
      return {
        success: true,
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
  static async getWalletBalance() {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/products/wallet/balance', {
        withCredentials: true
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get wallet balance');
      }
      
      const balanceData = result?.data || result;
      
      return {
        success: true,
        ...balanceData
      };
    } catch (error) {
      console.error('Get wallet balance error:', error);
      throw this.handleApiError(error);
    }
  }

  // Check product availability
  static async checkProductAvailability(productId, denominationId) {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.post('/api/v1/reseller-user/products/availability/check', {
        productId,
        denominationId
      }, { withCredentials: true });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to check product availability');
      }
      
      const availabilityResult = result?.data || result;
      
      return {
        success: true,
        ...availabilityResult
      };
    } catch (error) {
      console.error('Check product availability error:', error);
      throw this.handleApiError(error);
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
    if (!product?.denominations) return [];
    
    return product.denominations.filter(denom => 
      denom.status === 'ACTIVE' && 
      (denom.stockCount === undefined || denom.stockCount > 0)
    );
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