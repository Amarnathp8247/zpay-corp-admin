// src/components/dashboard/ProductList.jsx
import { useState, useEffect } from "react";
import ResellerProductService from "../../services/product.service";
import "./Product.css";

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 12,
    platform: "",
    search: "",
    status: "ACTIVE"
  });
  const [pagination, setPagination] = useState({
    current: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 12
  });

  const fetchProducts = async (filtersToUse = filters) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log("📡 Fetching products with filters:", filtersToUse);
      
      // Try cached first
      const cached = ResellerProductService.getCachedProductList(filtersToUse);
      if (cached) {
        console.log("📦 Using cached products:", cached.length);
        setProducts(cached);
        setIsLoading(false);
        return;
      }
      
      // Fetch from API
      console.log("🌐 Making API request...");
      const result = await ResellerProductService.getProductList(filtersToUse);
      console.log("✅ API Result:", {
        success: result?.success,
        hasProducts: !!result?.products,
        resultType: typeof result,
        resultKeys: Object.keys(result || {})
      });
      
      if (result?.success) {
        // Handle the new response format from the updated service
        let productList = [];
        let paginationData = {};
        
        if (result.products && Array.isArray(result.products)) {
          productList = result.products;
          paginationData = result.pagination || {};
        } else if (result.data?.products && Array.isArray(result.data.products)) {
          productList = result.data.products;
          paginationData = result.data.pagination || {};
        } else if (Array.isArray(result)) {
          productList = result;
        } else if (Array.isArray(result.data)) {
          productList = result.data;
        } else if (result.data && Array.isArray(result.data)) {
          productList = result.data;
        }
        
        console.log(`📊 Found ${productList?.length || 0} products`, {
          productList: productList?.slice(0, 2), // Show first 2 for debugging
          paginationData
        });
        
        if (productList && productList.length > 0) {
          setProducts(productList);
          
          // Set pagination data
          if (paginationData && Object.keys(paginationData).length > 0) {
            setPagination({
              current: paginationData.currentPage || paginationData.current || filtersToUse.page,
              totalPages: paginationData.totalPages || Math.ceil((paginationData.totalItems || productList.length) / filtersToUse.limit),
              totalItems: paginationData.totalItems || productList.length,
              itemsPerPage: filtersToUse.limit
            });
          } else {
            // Create default pagination
            setPagination({
              current: filtersToUse.page,
              totalPages: Math.ceil(productList.length / filtersToUse.limit),
              totalItems: productList.length,
              itemsPerPage: filtersToUse.limit
            });
          }
          
          // Cache the product list
          ResellerProductService.cacheProductList(productList, filtersToUse);
        } else {
          console.log("📭 No products found");
          setProducts([]);
          setPagination({
            current: 1,
            totalPages: 1,
            totalItems: 0,
            itemsPerPage: filtersToUse.limit
          });
        }
      } else {
        const errorMessage = result?.message || result?.error || "Failed to fetch products";
        console.error("❌ API returned failure:", {
          message: errorMessage,
          result
        });
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("❌ Error fetching products:", {
        message: err.message,
        stack: err.stack,
        filters: filtersToUse
      });
      setError(err.message || "Failed to load products. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("🚀 ProductList component mounted");
    
    // Test encryption if in development
    if (process.env.NODE_ENV === 'development') {
      const testEncryption = async () => {
        try {
          console.log("🧪 Running encryption test...");
          const testResult = await ResellerProductService.testEncryption();
          console.log("🧪 Encryption test result:", testResult);
        } catch (testError) {
          console.error("❌ Encryption test failed:", testError);
        }
      };
      testEncryption();
    }
    
    fetchProducts();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchProducts();
    }, 500);
    
    return () => clearTimeout(debounceTimer);
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }));
  };

  const handleSearch = (searchTerm) => {
    handleFilterChange("search", searchTerm);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setFilters(prev => ({
        ...prev,
        page
      }));
      
      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleItemsPerPageChange = (itemsPerPage) => {
    const newLimit = parseInt(itemsPerPage);
    setFilters(prev => ({
      ...prev,
      limit: newLimit,
      page: 1
    }));
  };

  const handlePlatformFilter = (platform) => {
    handleFilterChange("platform", platform);
  };

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    const pages = [];
    const totalPages = pagination.totalPages;
    const currentPage = pagination.current;
    
    // Always show first page
    pages.push(1);
    
    if (totalPages <= 7) {
      // Show all pages if total pages <= 7
      for (let i = 2; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        // Show first 5 pages, then ellipsis, then last page
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Show first page, ellipsis, then last 5 pages
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first page, ellipsis, current-1, current, current+1, ellipsis, last page
        pages.push('ellipsis');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="product-list-page">
        <div className="container">
          <div className="page-header">
            <h1>Product Catalog</h1>
            <p>Loading your products...</p>
          </div>
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Fetching products...</p>
            <p className="loading-subtext">Initializing encryption...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="product-list-page">
        <div className="container">
          <div className="error-container">
            <h2>⚠️ Unable to Load Products</h2>
            <p className="error-message">{error}</p>
            <div className="error-actions">
              <button 
                className="retry-btn"
                onClick={() => fetchProducts()}
              >
                Retry
              </button>
              <button 
                className="login-btn"
                onClick={() => {
                  // Clear storage and redirect to login
                  localStorage.removeItem('resellerToken');
                  localStorage.removeItem('resellerSessionId');
                  localStorage.removeItem('resellerProfile');
                  window.location.href = '/login';
                }}
              >
                Go to Login
              </button>
              <button 
                className="debug-btn"
                onClick={async () => {
                  try {
                    console.log("🔍 Running debug test...");
                    const testResult = await ResellerProductService.testEncryption();
                    console.log("🔍 Debug test result:", testResult);
                    alert(`Debug Info:\nEncryption: ${testResult.encryptionWorking ? '✓' : '✗'}\nDecryption: ${testResult.decryptionWorking ? '✓' : '✗'}\nMessage: ${testResult.message}`);
                  } catch (debugError) {
                    console.error("❌ Debug test failed:", debugError);
                    alert(`Debug failed: ${debugError.message}`);
                  }
                }}
              >
                Debug
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Extract unique platforms from products for filtering
  const availablePlatforms = [...new Set(products.flatMap(p => p.platform || []))].filter(Boolean);

  return (
    <div className="product-list-page">
      <div className="container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <div>
              <h1>Product Catalog</h1>
            
             
            </div>
            <div className="header-actions">
              <button 
                className="refresh-btn"
                onClick={() => {
                  ResellerProductService.clearProductCache();
                  fetchProducts();
                }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filters-grid">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search products by name or description..."
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
              <button className="search-btn">🔍</button>
            </div>
            
            {availablePlatforms.length > 0 && (
              <div className="platform-filters">
                <label>Platform:</label>
                <select 
                  value={filters.platform} 
                  onChange={(e) => handlePlatformFilter(e.target.value)}
                  className="platform-select"
                >
                  <option value="">All Platforms</option>
                  {availablePlatforms.map(platform => (
                    <option key={platform} value={platform}>{platform}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h2>No Products Found</h2>
            <p>There are no products available in your catalog yet.</p>
            <div className="empty-actions">
              <button 
                className="retry-btn"
                onClick={() => fetchProducts()}
              >
                Try Again
              </button>
              <button 
                className="clear-filters-btn"
                onClick={() => {
                  setFilters({
                    page: 1,
                    limit: 12,
                    platform: "",
                    search: "",
                    status: "ACTIVE"
                  });
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="products-grid">
              {products.map((product) => {
                if (!product || typeof product !== 'object') {
                  console.warn('⚠️ Invalid product data:', product);
                  return null;
                }
                
                const priceRange = ResellerProductService.getProductPriceRange(product);
                const isInStock = ResellerProductService.isProductInStock(product);
                const availableDenominations = ResellerProductService.getAvailableDenominations(product);
                
                return (
                  <div key={product.id || Math.random()} className="product-card">
                    {/* Product Image */}
                    <div className="product-image">
                      {product.image?.url || (product.images && product.images.length > 0 && product.images[0]?.url) ? (
                        <img
                          src={product.image?.url || product.images[0].url}
                          alt={product.image?.altText || product.images[0]?.altText || product.name || 'Product'}
                          className="product-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentNode.querySelector('.image-placeholder').style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div className="image-placeholder">
                          {product.name?.charAt(0)?.toUpperCase() || 'P'}
                        </div>
                      )}
                      
                      <div className="product-badges">
                        {!isInStock && <span className="badge out-of-stock">Out of Stock</span>}
                        {product.status === 'ACTIVE' && <span className="badge active">Active</span>}
                        {product.hasDiscount && <span className="badge discount">Discount</span>}
                        {product.conversionApplied && <span className="badge converted">Converted</span>}
                      </div>
                      
                      {product.brand?.logoUrl && (
                        <div className="brand-logo">
                          <img 
                            src={product.brand.logoUrl} 
                            alt={product.brand.name || 'Brand'} 
                            className="brand-img"
                          />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="product-info">
                      <div className="product-header">
                        <h3 className="product-name">{product.name || 'Unnamed Product'}</h3>
                        {product.sku && (
                          <span className="product-sku">SKU: {product.sku}</span>
                        )}
                      </div>
                      
                      <p className="product-description">
                        {product.description?.substring(0, 120) || 'No description available.'}
                        {product.description?.length > 120 && '...'}
                      </p>

                      {/* Categories */}
                      {product.categories && product.categories.length > 0 && (
                        <div className="categories-section">
                          <span className="categories-label">Categories: </span>
                          <div className="categories-tags">
                            {product.categories.slice(0, 2).map(category => (
                              <span key={category.id || category.name} className="category-tag">
                                {category.name}
                              </span>
                            ))}
                            {product.categories.length > 2 && (
                              <span className="category-tag more">+{product.categories.length - 2}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Price */}
                      <div className="price-section">
                        {priceRange ? (
                          <>
                            <span className="price-label">Price: </span>
                            <span className="price-value">
                              {ResellerProductService.formatPrice(priceRange.min, product.displayCurrency || product.currency?.code || 'USD')}
                              {priceRange.min !== priceRange.max && (
                                <> - {ResellerProductService.formatPrice(priceRange.max, product.displayCurrency || product.currency?.code || 'USD')}</>
                              )}
                            </span>
                            {product.conversionApplied && product.originalCurrency !== product.displayCurrency && (
                              <span className="currency-note">
                                (Converted from {product.originalCurrency})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="price-unavailable">Price not available</span>
                        )}
                      </div>

                      {/* Stock Info */}
                      <div className="stock-section">
                        <span className="stock-label">Stock: </span>
                        <span className={`stock-value ${isInStock ? 'in-stock' : 'out-of-stock'}`}>
                          {isInStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                        {availableDenominations.length > 0 && (
                          <span className="denominations-count">
                            ({availableDenominations.length} denominations available)
                          </span>
                        )}
                      </div>

                      {/* Platform */}
                      {product.platform && product.platform.length > 0 && (
                        <div className="platform-section">
                          <span className="platform-label">Platform: </span>
                          <div className="platform-tags">
                            {product.platform.slice(0, 2).map((platform, index) => (
                              <span key={index} className="platform-tag">
                                {platform}
                              </span>
                            ))}
                            {product.platform.length > 2 && (
                              <span className="platform-tag more">+{product.platform.length - 2}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="product-actions">
                        <button 
                          className="view-btn primary"
                          onClick={() => {
                            if (product.id) {
                              window.location.href = `/dashboard/products/${product.id}`;
                            }
                          }}
                        >
                          View Details
                        </button>
                        <button 
                          className="quick-buy-btn"
                          onClick={() => {
                            console.log('Quick buy:', product.id);
                            // Add to cart or quick purchase logic here
                          }}
                          disabled={!isInStock || !product.companyProduct?.canSell}
                        >
                          Quick Buy
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>

            {/* Enhanced Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <div className="pagination-container">
                  <button 
                    className="pagination-btn"
                    onClick={() => handlePageChange(pagination.current - 1)}
                    disabled={pagination.current === 1}
                  >
                    ← Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="pagination-numbers">
                    {generatePageNumbers().map((page, index) => (
                      page === 'ellipsis' ? (
                        <span key={`ellipsis-${index}`} className="page-number ellipsis">
                          ...
                        </span>
                      ) : (
                        <button
                          key={page}
                          className={`page-number ${pagination.current === page ? 'active' : ''}`}
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </button>
                      )
                    ))}
                  </div>
                  
                  <button 
                    className="pagination-btn"
                    onClick={() => handlePageChange(pagination.current + 1)}
                    disabled={pagination.current === pagination.totalPages}
                  >
                    Next →
                  </button>
                </div>
                
                <div className="pagination-info">
                  Page {pagination.current} of {pagination.totalPages}
                  <span className="total-items"> ({pagination.totalItems} total products)</span>
                </div>
                
                <div className="pagination-options">
                  <span className="pagination-label">Show:</span>
                  <select 
                    value={filters.limit}
                    onChange={(e) => handleItemsPerPageChange(e.target.value)}
                    className="pagination-select"
                  >
                    <option value="12">12 per page</option>
                    <option value="24">24 per page</option>
                    <option value="48">48 per page</option>
                    <option value="96">96 per page</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}

       
      </div>
    </div>
  );
}