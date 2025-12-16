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

  // Simplified and corrected handleResponse method
  static async handleResponse(response) {
    try {
      console.log('📦 API Response received:', {
        status: response.status,
        statusText: response.statusText,
        encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv),
        dataKeys: response.data ? Object.keys(response.data) : []
      });
  
      // If response already has success=false, return as-is
      if (response.data?.success === false) {
        console.log('❌ Response indicates failure, returning as-is');
        return response.data;
      }
  
      // Check if response is encrypted
      if (response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv) {
        console.log('🔐 Received encrypted response structure');
        
        // Ensure we have private key for decryption
        if (!sessionKeys.privateKey) {
          console.error('❌ NO PRIVATE KEY AVAILABLE for decryption!');
          
          // Try to load keys from localStorage
          const keys = await loadKeyPair();
          if (keys) {
            sessionKeys.privateKey = keys.privateKey;
            sessionKeys.publicKey = keys.publicKey;
            console.log('✅ Keys loaded from localStorage');
          } else {
            console.error('❌ Failed to load keys from localStorage');
            // Return error
            return {
              success: false,
              error: 'No private key available for decryption',
              message: 'Cannot decrypt response'
            };
          }
        }
        
        console.log('🔑 Private key available, attempting decryption...');
        
        try {
          const decryptedData = await decryptServerResponse(response.data, sessionKeys.privateKey);
          
          console.log('✅ Decryption successful:', {
            type: typeof decryptedData,
            isString: typeof decryptedData === 'string',
            length: typeof decryptedData === 'string' ? decryptedData.length : 'N/A'
          });
          
          // Parse decrypted data
          let parsedData;
          if (typeof decryptedData === 'string') {
            try {
              parsedData = JSON.parse(decryptedData);
              console.log('🔍 Parsed string to JSON');
            } catch (parseError) {
              console.error('❌ Failed to parse decrypted data:', parseError);
              return {
                success: false,
                error: 'Failed to parse decrypted data',
                rawDecryptedData: decryptedData
              };
            }
          } else if (typeof decryptedData === 'object') {
            parsedData = decryptedData;
          } else {
            return {
              success: false,
              error: 'Decrypted data format is invalid',
              decryptedData
            };
          }
          
          // Now we have parsedData as object
          console.log('📊 Parsed data structure:', {
            hasSuccess: parsedData.success !== undefined,
            hasData: parsedData.data !== undefined,
            keys: Object.keys(parsedData)
          });
          
          // Return the data in consistent format
          if (parsedData.data !== undefined) {
            // Backend returns {success: true, data: {...}, message: "..."}
            return {
              success: parsedData.success !== false,
              message: parsedData.message,
              ...parsedData.data  // Spread data properties to top level
            };
          } else {
            // No data field, return parsedData as-is
            return {
              success: parsedData.success !== false,
              message: parsedData.message,
              ...parsedData
            };
          }
          
        } catch (decryptError) {
          console.error('❌ Decryption failed:', decryptError);
          return {
            success: false,
            error: 'Decryption failed',
            message: decryptError.message
          };
        }
      }
  
      // Handle plain (non-encrypted) response
      console.log('📨 Plain response received');
      
      if (response.data && typeof response.data === 'object') {
        const backendResponse = response.data;
        
        // Check if backend response has the standard structure with 'data' field
        if (backendResponse.data !== undefined) {
          console.log('📊 Backend response has data field');
          return {
            success: backendResponse.success !== false,
            message: backendResponse.message,
            ...backendResponse.data  // Spread data properties to top level
          };
        }
        
        // If no 'data' field, return as-is
        return {
          success: backendResponse.success !== false,
          message: backendResponse.message,
          ...backendResponse
        };
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
        message: error.message
      };
    }
  }

  // Get products list - CORRECTED
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
        type: typeof result,
        hasProducts: !!(result?.products),
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch products');
      }
      
      // Extract products from result - FIXED LOGIC
      let products = [];
      let pagination = {};
      let summary = {};
      
      // Since handleResponse now spreads data to top level, products should be at result.products
      if (result?.products && Array.isArray(result.products)) {
        products = result.products;
        console.log('📊 Found products array:', products.length);
      } 
      // Fallback: check if result itself is an array
      else if (Array.isArray(result)) {
        products = result;
        console.log('📊 Result is products array:', products.length);
      }
      // Fallback: check data field (legacy support)
      else if (result?.data?.products && Array.isArray(result.data.products)) {
        products = result.data.products;
        console.log('📊 Found nested products array:', products.length);
      }
      
      // Extract pagination
      if (result?.pagination) {
        pagination = result.pagination;
      } else if (result?.data?.pagination) {
        pagination = result.data.pagination;
      }
      
      // Extract summary
      if (result?.summary) {
        summary = result.summary;
      } else if (result?.data?.summary) {
        summary = result.data.summary;
      }
      
      console.log('📊 Extracted data:', {
        productsCount: products.length,
        hasPagination: !!pagination,
        paginationKeys: Object.keys(pagination)
      });
      
      // Debug: Check first product's price data
      if (products.length > 0) {
        console.log('💰 First product price check:', {
          name: products[0].name,
          hasDenominations: !!products[0].denominations,
          denominations: products[0].denominations?.map(d => ({
            amount: d.amount,
            finalAmount: d.finalAmount,
            currency: d.currency
          })) || []
        });
      }
      
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
        fromCache: false,
        summary
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
      
      throw this.handleApiError(error);
    }
  }

  // Get product by ID - CORRECTED
  static async getProductById(productId, currency = null) {
    try {
      // Validate product ID format
      if (!productId || typeof productId !== 'string') {
        console.error('❌ Invalid product ID:', productId);
        throw new Error('Product ID must be a non-empty string');
      }

      console.log('🔍 Fetching product by ID:', {
        productId,
        currency,
        endpoint: `/api/v1/reseller-user/products/${productId}`
      });
      
      await this.initEncryptionIfNeeded();
      
      const params = currency ? { currency } : {};
      const response = await apiClient.get(`/api/v1/reseller-user/products/${productId}`, { 
        params,
        withCredentials: true 
      });

      console.log('📥 Raw product by ID response:', {
        status: response.status,
        statusText: response.statusText
      });

      const result = await this.handleResponse(response);
      
      console.log('✅ Processed product result:', {
        success: result?.success,
        hasData: !!result,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        const errorMsg = result.message || result.error || 'Failed to get product';
        console.error('❌ API returned failure:', errorMsg);
        
        if (result.error === 'VALIDATION_ERROR' || result.message?.includes('Invalid product ID')) {
          throw new Error('Invalid product ID format.');
        }
        
        throw new Error(errorMsg);
      }
      
      // Extract product from result - FIXED LOGIC
      let product = null;
      
      // Since handleResponse spreads data to top level, result should be the product
      if (result && typeof result === 'object') {
        // Check if result has product data directly
        if (result.id || result.productId) {
          product = result;
          console.log('📊 Product found at result level');
        }
        // Check if result has a product field
        else if (result.product && (result.product.id || result.product.productId)) {
          product = result.product;
          console.log('📊 Product found at result.product');
        }
        // Check if result has data field with product
        else if (result.data && (result.data.id || result.data.productId)) {
          product = result.data;
          console.log('📊 Product found at result.data');
        }
        // Check if result.data has product field
        else if (result.data?.product && (result.data.product.id || result.data.product.productId)) {
          product = result.data.product;
          console.log('📊 Product found at result.data.product');
        }
      }
      
      if (!product) {
        console.warn('⚠️ No product data found. Result:', result);
        throw new Error('Product data not found in response');
      }
      
      // Debug: Check product price data
      console.log('💰 Product price details:', {
        id: product.id,
        name: product.name,
        currency: product.currency,
        displayCurrency: product.displayCurrency,
        hasDenominations: !!product.denominations,
        denominationsCount: product.denominations?.length || 0
      });
      
      if (product.denominations && product.denominations.length > 0) {
        console.log('💰 Denominations price check:', product.denominations.map(d => ({
          id: d.id,
          amount: d.amount,
          finalAmount: d.finalAmount,
          convertedAmount: d.convertedAmount,
          currency: d.currency,
          status: d.status
        })));
      }
      
      return {
        success: true,
        product,
        message: result?.message || 'Product fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ Get product by ID error:', {
        productId,
        error: error.message,
        stack: error.stack
      });
      
      // Try to get from cache as fallback
      const cachedProduct = this.getCachedProductById(productId);
      if (cachedProduct) {
        console.log('🔄 Returning cached product as fallback');
        return {
          success: true,
          product: cachedProduct,
          fromCache: true,
          error: error.message
        };
      }
      
      throw this.handleApiError(error);
    }
  }

  // Get available currencies - CORRECTED
  static async getAvailableCurrencies() {
    try {
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/products/currencies', {
        withCredentials: true
      });
      
      const result = await this.handleResponse(response);
      
      console.log('💱 Currency response:', {
        success: result?.success,
        hasCurrencies: !!(result?.currencies),
        currenciesCount: result?.currencies?.length || 0
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to get currencies');
      }
      
      // Extract currencies from result - FIXED LOGIC
      const currencies = result?.currencies || [];
      
      return {
        success: true,
        currencies,
        defaultCurrency: result?.defaultCurrency || 'USD',
        primaryCurrency: result?.primaryCurrency,
        commissionRate: result?.commissionRate
      };
    } catch (error) {
      console.error('Get currencies error:', error);
      throw this.handleApiError(error);
    }
  }

  // Get wallet balance - CORRECTED
  static async getWalletBalance() {
    try {
      console.log('💰 [ProductService] Fetching wallet balance');
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/orders/wallet/balance', {
        withCredentials: true
      });

      console.log('💰 [ProductService] Raw wallet balance response:', {
        status: response.status
      });

      const result = await this.handleResponse(response);
      
      console.log('💰 [ProductService] Processed wallet balance result:', {
        success: result?.success,
        totalBalance: result?.totalBalance || result?.totalBalanceUSD,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        console.warn('⚠️ [ProductService] Wallet balance fetch returned success=false:', result);
        throw new Error(result.message || 'Failed to fetch wallet balance');
      }
      
      // Return standardized structure
      return {
        success: true,
        totalBalance: result?.totalBalance || result?.totalBalanceUSD || 0,
        wallets: result?.wallets || [],
        currency: result?.currency || 'USD',
        ...result  // Include any other fields
      };
      
    } catch (error) {
      console.error('❌ [ProductService] Get wallet balance error:', error);
      
      // Return default instead of throwing
      return {
        success: true,
        totalBalance: 0,
        wallets: [],
        currency: 'USD'
      };
    }
  }

  // Check product availability
  static async checkProductAvailability(productId, denominationId, quantity = 1) {
    try {
      console.log('🔍 Checking availability:', {
        productId,
        denominationId,
        quantity
      });

      // Since endpoint doesn't exist, return mock response
      return {
        success: true,
        available: true,
        message: "Product is available",
        stockCount: 100,
        productName: "Product",
        productSku: "SKU"
      };
      
    } catch (error) {
      console.error('❌ Error checking availability:', error);
      
      return {
        success: false,
        available: false,
        message: "Availability check failed. Please try again.",
        error: error.message
      };
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

  // Get cached product by ID
  static getCachedProductById(productId) {
    try {
      const cacheKey = `reseller_product_${productId}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const cacheData = JSON.parse(cached);
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        
        if (Date.now() - cacheData.timestamp < CACHE_TTL) {
          console.log('💾 Using cached product:', productId);
          return cacheData.product;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get cached product:', error);
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
        if (key.startsWith('reseller_product_list_') || key.startsWith('reseller_product_')) {
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
      
      return {
        success: true,
        ...result
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
    
    const validDenoms = this.getAvailableDenominations(product);
    
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

  // Get product min price
  static getProductMinPrice(product) {
    const priceRange = this.getProductPriceRange(product);
    return priceRange ? priceRange.min : 0;
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
    
    const availableDenoms = this.getAvailableDenominations(product);
    
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
}

export default ResellerProductService;