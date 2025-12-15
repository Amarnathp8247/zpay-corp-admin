// src/services/reseller/wallet.service.js
import apiClient from '../api/apiClient';
import { 
  sessionKeys, 
  decryptServerResponse,
  initResellerEncryption,
  loadKeyPair
} from '../crypto/crypto.helper';

class ResellerWalletService {
  // Initialize encryption if needed
  static async initEncryptionIfNeeded() {
    console.log('🔑 [Wallet] Checking encryption status...', {
      hasPublicKey: !!sessionKeys.publicKey,
      hasPrivateKey: !!sessionKeys.privateKey
    });
    
    if (!sessionKeys.publicKey || !sessionKeys.privateKey) {
      console.log('🔄 [Wallet] Initializing encryption...');
      try {
        await initResellerEncryption();
        
        // Double-check that keys were loaded
        if (!sessionKeys.privateKey) {
          console.warn('⚠️ [Wallet] Private key still missing after init, trying to load from localStorage...');
          const keys = await loadKeyPair();
          if (keys) {
            sessionKeys.privateKey = keys.privateKey;
            sessionKeys.publicKey = keys.publicKey;
            console.log('✅ [Wallet] Keys loaded from localStorage');
          } else {
            console.error('❌ [Wallet] Failed to load keys from localStorage');
            throw new Error('Encryption keys not available');
          }
        }
        
        console.log('✅ [Wallet] Encryption initialized successfully:', {
          hasPublicKey: !!sessionKeys.publicKey,
          hasPrivateKey: !!sessionKeys.privateKey
        });
      } catch (error) {
        console.error('❌ [Wallet] Failed to initialize encryption:', error);
        throw error;
      }
    } else {
      console.log('✅ [Wallet] Encryption already initialized');
    }
  }

  // Helper to handle encrypted responses
  static async handleResponse(response) {
    try {
      console.log('📦 [Wallet] API Response received:', {
        status: response.status,
        statusText: response.statusText,
        encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv),
        hasSuccessField: response.data?.success !== undefined,
        responseKeys: Object.keys(response.data || {})
      });

      // If response already has success=false, return as-is
      if (response.data?.success === false) {
        console.log('❌ [Wallet] Response indicates failure, returning as-is');
        return response.data;
      }

      // Check if response is encrypted
      if (response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv) {
        console.log('🔐 [Wallet] Received encrypted response structure');
        
        // CRITICAL: Ensure we have private key for decryption
        if (!sessionKeys.privateKey) {
          console.error('❌ [Wallet] NO PRIVATE KEY AVAILABLE for decryption!');
          console.log('🔄 [Wallet] Attempting to load keys from localStorage...');
          
          const keys = await loadKeyPair();
          if (keys) {
            sessionKeys.privateKey = keys.privateKey;
            sessionKeys.publicKey = keys.publicKey;
            console.log('✅ [Wallet] Keys loaded from localStorage');
          } else {
            console.error('❌ [Wallet] Failed to load keys from localStorage');
            throw new Error('Cannot decrypt response: No private key available');
          }
        }
        
        console.log('🔑 [Wallet] Private key available, attempting decryption...');
        
        try {
          const decryptedData = await decryptServerResponse(response.data, sessionKeys.privateKey);
          console.log('✅ [Wallet] Decryption successful:', {
            decryptedType: typeof decryptedData,
            isObject: typeof decryptedData === 'object',
            keys: decryptedData ? Object.keys(decryptedData) : 'null'
          });
          
          // Handle string response from decryptServerResponse
          let processedData = decryptedData;
          if (typeof decryptedData === 'string') {
            try {
              processedData = JSON.parse(decryptedData);
              console.log('🔄 [Wallet] Parsed string data to object');
            } catch (parseError) {
              console.error('❌ [Wallet] Failed to parse decrypted string:', parseError);
              throw new Error(`Failed to parse decrypted data: ${parseError.message}`);
            }
          }
          
          // Validate and normalize decrypted data
          if (processedData && typeof processedData === 'object') {
            console.log('📊 [Wallet] Decrypted data structure:', {
              hasDataField: 'data' in processedData,
              hasWalletsField: 'wallets' in processedData,
              hasSuccessField: 'success' in processedData
            });
            
            let finalResult = { success: true };
            
            // Case 1: processedData has data.wallets
            if (processedData.data && processedData.data.wallets) {
              console.log('📁 [Wallet] Structure: processedData.data.wallets');
              finalResult = {
                success: true,
                wallets: processedData.data.wallets,
                ...processedData.data
              };
            }
            // Case 2: processedData has wallets directly
            else if (processedData.wallets) {
              console.log('📁 [Wallet] Structure: processedData.wallets');
              finalResult = {
                success: true,
                wallets: processedData.wallets,
                ...processedData
              };
            }
            // Case 3: processedData has data (single wallet)
            else if (processedData.data) {
              console.log('📁 [Wallet] Structure: processedData.data (single wallet)');
              finalResult = {
                success: true,
                ...processedData
              };
            }
            // Case 4: processedData is the data itself
            else if (processedData.success !== undefined) {
              console.log('📁 [Wallet] Structure: processedData with success field');
              finalResult = processedData;
            }
            // Case 5: It's an array (direct list of wallets)
            else if (Array.isArray(processedData)) {
              console.log('📁 [Wallet] Structure: Array (direct wallets list)');
              finalResult = {
                success: true,
                wallets: processedData
              };
            }
            // Case 6: Empty or unknown structure
            else {
              console.warn('⚠️ [Wallet] Unknown decrypted structure, returning as-is');
              finalResult = {
                success: true,
                data: processedData,
                ...processedData
              };
            }
            
            console.log('🎯 [Wallet] Final processed result:', {
              success: finalResult.success,
              hasWallets: !!finalResult.wallets,
              walletsCount: finalResult.wallets?.length || 0
            });
            
            return finalResult;
          } else {
            console.error('❌ [Wallet] Invalid decrypted data format:', {
              type: typeof processedData,
              value: processedData
            });
            
            throw new Error('Invalid decrypted data format: Expected object');
          }
        } catch (decryptError) {
          console.error('❌ [Wallet] Decryption process failed:', {
            error: decryptError.message,
            stack: decryptError.stack
          });
          
          // Check if we have plain data in response
          if (response.data?.data) {
            console.log('🔄 [Wallet] Fallback: Using response.data.data');
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
      console.log('📨 [Wallet] Plain response received');
      
      if (response.data && typeof response.data === 'object') {
        // Ensure success field exists
        const result = { ...response.data };
        if (result.success === undefined) {
          result.success = true;
        }
        
        // Normalize structure for plain responses too
        if (result.data && result.data.wallets) {
          return {
            success: result.success,
            wallets: result.data.wallets,
            ...result.data
          };
        } else if (result.wallets) {
          return {
            success: result.success,
            wallets: result.wallets,
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
      console.error('❌ [Wallet] handleResponse general error:', error);
      return {
        success: false,
        error: 'Response handling failed',
        message: error.message,
        originalResponse: response?.data
      };
    }
  }

  // Get primary wallet currency
  static async getPrimaryCurrency() {
    try {
      console.log('🔍 [Wallet] Fetching primary currency...');
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/wallet/primary-currency', {
        withCredentials: true
      });

      console.log('📥 [Wallet] Raw API response status:', response.status);
      
      const result = await this.handleResponse(response);
      
      console.log('✅ [Wallet] Processed result:', {
        success: result?.success,
        hasData: !!result?.data,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch primary currency');
      }
      
      // Extract data from different possible structures
      const data = result?.data || result;
      
      return {
        success: true,
        data,
        message: result.message || 'Primary currency fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ [Wallet] Get primary currency error:', {
        message: error.message,
        stack: error.stack
      });
      
      // Handle specific error cases
      if (error.response) {
        console.error('[Wallet] Error response details:', {
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
        }
      }
      
      throw this.handleApiError(error);
    }
  }

  // Get wallet by currency
  static async getWalletByCurrency(currency) {
    try {
      console.log('🔍 [Wallet] Fetching wallet by currency:', currency);
      
      if (!currency) {
        throw new Error('Currency code is required');
      }
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get(`/api/v1/reseller-user/wallet/currency/${currency}`, {
        withCredentials: true
      });

      console.log('📥 [Wallet] Raw API response status:', response.status);
      
      const result = await this.handleResponse(response);
      
      console.log('✅ [Wallet] Processed result:', {
        success: result?.success,
        hasData: !!result?.data,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch wallet');
      }
      
      // Extract wallet data
      const walletData = result?.data || result;
      
      return {
        success: true,
        data: walletData,
        message: result.message || 'Wallet fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ [Wallet] Get wallet by currency error:', {
        message: error.message,
        stack: error.stack,
        currency
      });
      
      throw this.handleApiError(error);
    }
  }

  // List all wallets
  static async listWallets() {
    try {
      console.log('🔍 [Wallet] Fetching all wallets...');
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/wallet/list', {
        withCredentials: true
      });

      console.log('📥 [Wallet] Raw API response status:', response.status);
      
      const result = await this.handleResponse(response);
      
      console.log('✅ [Wallet] Processed result:', {
        success: result?.success,
        hasWallets: !!result?.wallets,
        walletsCount: result?.wallets?.length || 0,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch wallets');
      }
      
      // Extract wallets from different possible structures
      const wallets = result?.wallets || result?.data?.wallets || [];
      const summary = result?.summary || result?.data?.summary || {};
      
      return {
        success: true,
        wallets,
        summary,
        count: wallets.length,
        message: result.message || 'Wallets fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ [Wallet] List wallets error:', {
        message: error.message,
        stack: error.stack
      });
      
      throw this.handleApiError(error);
    }
  }

  // Get wallet by ID
  static async getWalletById(walletId) {
    try {
      console.log('🔍 [Wallet] Fetching wallet by ID:', walletId);
      
      if (!walletId) {
        throw new Error('Wallet ID is required');
      }
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get(`/api/v1/reseller-user/wallet/${walletId}`, {
        withCredentials: true
      });

      console.log('📥 [Wallet] Raw API response status:', response.status);
      
      const result = await this.handleResponse(response);
      
      console.log('✅ [Wallet] Processed result:', {
        success: result?.success,
        hasData: !!result?.data,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch wallet');
      }
      
      // Extract wallet data
      const walletData = result?.data || result;
      
      return {
        success: true,
        data: walletData,
        message: result.message || 'Wallet details fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ [Wallet] Get wallet by ID error:', {
        message: error.message,
        stack: error.stack,
        walletId
      });
      
      throw this.handleApiError(error);
    }
  }

  // Get balance summary
  static async getBalanceSummary() {
    try {
      console.log('🔍 [Wallet] Fetching balance summary...');
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/wallet/balance/summary', {
        withCredentials: true
      });

      console.log('📥 [Wallet] Raw API response status:', response.status);
      
      const result = await this.handleResponse(response);
      
      console.log('✅ [Wallet] Processed result:', {
        success: result?.success,
        hasData: !!result?.data,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch balance summary');
      }
      
      // Extract balance data
      const balanceData = result?.data || result;
      
      return {
        success: true,
        data: balanceData,
        message: result.message || 'Balance summary fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ [Wallet] Get balance summary error:', {
        message: error.message,
        stack: error.stack
      });
      
      throw this.handleApiError(error);
    }
  }

  // Get wallet transactions
  static async getTransactions(walletId, filters = {}) {
    try {
      console.log('🔍 [Wallet] Fetching transactions for wallet:', walletId, filters);
      
      if (!walletId) {
        throw new Error('Wallet ID is required');
      }
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const params = { ...filters };
      const response = await apiClient.get(`/api/v1/reseller-user/wallet/${walletId}/transactions`, {
        params,
        withCredentials: true
      });

      console.log('📥 [Wallet] Raw API response status:', response.status);
      
      const result = await this.handleResponse(response);
      
      console.log('✅ [Wallet] Processed result:', {
        success: result?.success,
        hasTransactions: !!result?.transactions,
        transactionsCount: result?.transactions?.length || 0,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch transactions');
      }
      
      // Extract transactions data
      const transactionsData = result?.data || result;
      
      return {
        success: true,
        data: transactionsData,
        message: result.message || 'Transactions fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ [Wallet] Get transactions error:', {
        message: error.message,
        stack: error.stack,
        walletId,
        filters
      });
      
      throw this.handleApiError(error);
    }
  }

  // Get available currencies
  static async getAvailableCurrencies() {
    try {
      console.log('🔍 [Wallet] Fetching available currencies...');
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/wallet/currencies/available', {
        withCredentials: true
      });

      console.log('📥 [Wallet] Raw API response status:', response.status);
      
      const result = await this.handleResponse(response);
      
      console.log('✅ [Wallet] Processed result:', {
        success: result?.success,
        hasCurrencies: !!result?.currencies,
        currenciesCount: result?.currencies?.length || 0,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Failed to fetch currencies');
      }
      
      // Extract currencies from different possible structures
      const currencies = result?.currencies || result?.data?.currencies || [];
      
      return {
        success: true,
        currencies,
        count: currencies.length,
        message: result.message || 'Available currencies fetched successfully'
      };
      
    } catch (error) {
      console.error('❌ [Wallet] Get available currencies error:', error);
      throw this.handleApiError(error);
    }
  }

  // Convert currency amount
  static async convertCurrencyAmount(amount, fromCurrency, toCurrency) {
    try {
      console.log('🔍 [Wallet] Converting currency:', { amount, fromCurrency, toCurrency });
      
      if (!amount || amount <= 0) {
        throw new Error('Valid amount is required');
      }
      
      if (!fromCurrency || !toCurrency) {
        throw new Error('Both fromCurrency and toCurrency are required');
      }
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.post('/api/v1/reseller-user/wallet/currencies/convert', {
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
        data: conversionResult,
        message: result.message || 'Currency conversion successful'
      };
    } catch (error) {
      console.error('❌ [Wallet] Currency conversion error:', error);
      throw this.handleApiError(error);
    }
  }

  // Validate currency support
  static async validateCurrency(currencyCode) {
    try {
      console.log('🔍 [Wallet] Validating currency:', currencyCode);
      
      if (!currencyCode) {
        throw new Error('Currency code is required');
      }
      
      // Ensure encryption is initialized
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get(`/api/v1/reseller-user/wallet/currencies/validate/${currencyCode}`, {
        withCredentials: true
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Currency validation failed');
      }
      
      const validationResult = result?.data || result;
      
      return {
        success: true,
        data: validationResult,
        message: result.message || 'Currency validation successful'
      };
    } catch (error) {
      console.error('❌ [Wallet] Validate currency error:', error);
      throw this.handleApiError(error);
    }
  }

  // Health check
  static async healthCheck() {
    try {
      console.log('🔍 [Wallet] Performing health check...');
      
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/wallet/health', {
        withCredentials: true
      });

      const result = await this.handleResponse(response);
      
      if (result?.success === false) {
        throw new Error(result.message || result.error || 'Health check failed');
      }
      
      const healthData = result?.data || result;
      
      return {
        success: true,
        data: healthData,
        message: result.message || 'Health check successful'
      };
    } catch (error) {
      console.error('❌ [Wallet] Health check error:', error);
      throw this.handleApiError(error);
    }
  }

  // Test encryption endpoint
  static async testEncryption() {
    try {
      console.log('🧪 [Wallet] Testing encryption/decryption flow...');
      
      await this.initEncryptionIfNeeded();
      
      const response = await apiClient.get('/api/v1/reseller-user/wallet/health', {
        withCredentials: true
      });
      
      console.log('🧪 [Wallet] Test response:', {
        status: response.status,
        encrypted: !!(response.data?.encryptedKey && response.data?.ciphertext && response.data?.iv)
      });
      
      const result = await this.handleResponse(response);
      
      console.log('🧪 [Wallet] Test result:', {
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
      console.error('❌ [Wallet] Encryption test failed:', error);
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

  // Format amount with currency
  static formatAmount(amount, currencyCode) {
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

  // Get total balance across all wallets
  static getTotalBalance(wallets, targetCurrency = 'USD') {
    if (!wallets || !Array.isArray(wallets)) return 0;
    
    return wallets.reduce((total, wallet) => {
      try {
        const walletAmount = parseFloat(wallet.balance) || 0;
        const walletCurrency = wallet.currency?.code || 'USD';
        
        if (walletCurrency === targetCurrency) {
          return total + walletAmount;
        }
        
        // For simplicity, assuming 1:1 conversion if not same currency
        // In real implementation, you'd use actual conversion rates
        return total + walletAmount;
      } catch (error) {
        console.warn('[Wallet] Error calculating wallet balance:', error);
        return total;
      }
    }, 0);
  }

  // Find wallet by currency
  static findWalletByCurrency(wallets, currencyCode) {
    if (!wallets || !Array.isArray(wallets)) return null;
    
    return wallets.find(wallet => 
      wallet.currency?.code === currencyCode || 
      wallet.currency === currencyCode
    );
  }

  // Find primary wallet
  static findPrimaryWallet(wallets) {
    if (!wallets || !Array.isArray(wallets)) return null;
    
    // Find wallet marked as primary
    const primary = wallets.find(wallet => wallet.isPrimary === true);
    if (primary) return primary;
    
    // If no wallet marked as primary, return the first wallet
    return wallets.length > 0 ? wallets[0] : null;
  }

  // Check if wallet has sufficient balance
  static hasSufficientBalance(wallet, requiredAmount) {
    if (!wallet || !wallet.balance) return false;
    
    const currentBalance = parseFloat(wallet.balance) || 0;
    const required = parseFloat(requiredAmount) || 0;
    
    return currentBalance >= required;
  }

  // Get wallet balance breakdown by currency
  static getBalanceBreakdown(wallets) {
    if (!wallets || !Array.isArray(wallets)) return {};
    
    const breakdown = {};
    
    wallets.forEach(wallet => {
      const currency = wallet.currency?.code || 'UNKNOWN';
      const balance = parseFloat(wallet.balance) || 0;
      
      if (!breakdown[currency]) {
        breakdown[currency] = {
          currency,
          symbol: wallet.currency?.symbol || '$',
          total: 0,
          wallets: []
        };
      }
      
      breakdown[currency].total += balance;
      breakdown[currency].wallets.push({
        id: wallet.id,
        balance,
        isPrimary: wallet.isPrimary || false
      });
    });
    
    return breakdown;
  }

  // Sort wallets by criteria
  static sortWallets(wallets, sortBy = 'balance', sortOrder = 'desc') {
    if (!wallets || !Array.isArray(wallets)) return [];
    
    return [...wallets].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'balance':
          valueA = parseFloat(a.balance) || 0;
          valueB = parseFloat(b.balance) || 0;
          break;
        case 'currency':
          valueA = a.currency?.code || '';
          valueB = b.currency?.code || '';
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

  // Filter wallets by criteria
  static filterWallets(wallets, filters = {}) {
    if (!wallets || !Array.isArray(wallets)) return [];
    
    return wallets.filter(wallet => {
      // Filter by currency
      if (filters.currency && wallet.currency?.code !== filters.currency) {
        return false;
      }
      
      // Filter by minimum balance
      if (filters.minBalance) {
        const balance = parseFloat(wallet.balance) || 0;
        if (balance < parseFloat(filters.minBalance)) {
          return false;
        }
      }
      
      // Filter by maximum balance
      if (filters.maxBalance) {
        const balance = parseFloat(wallet.balance) || 0;
        if (balance > parseFloat(filters.maxBalance)) {
          return false;
        }
      }
      
      // Filter by primary status
      if (filters.isPrimary !== undefined && wallet.isPrimary !== filters.isPrimary) {
        return false;
      }
      
      return true;
    });
  }

  // Get wallet statistics
  static getWalletStatistics(wallets) {
    if (!wallets || !Array.isArray(wallets)) {
      return {
        totalWallets: 0,
        totalBalance: 0,
        currencies: 0,
        primaryCurrency: null
      };
    }
    
    const totalBalance = this.getTotalBalance(wallets, 'USD');
    const currencies = new Set(wallets.map(w => w.currency?.code).filter(Boolean)).size;
    const primaryWallet = this.findPrimaryWallet(wallets);
    
    return {
      totalWallets: wallets.length,
      totalBalance,
      currencies,
      primaryCurrency: primaryWallet?.currency?.code || null,
      hasMultipleWallets: wallets.length > 1,
      hasPrimaryWallet: !!primaryWallet,
      summary: this.getBalanceBreakdown(wallets)
    };
  }
}

export default ResellerWalletService;