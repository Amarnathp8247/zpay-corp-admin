// src/pages/Products/ProductList.jsx
import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import ResellerProductService from "../../services/product.service";
import AuthContext from "../../context/AuthContext";
import "./Product.css";

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [pagination, setPagination] = useState({
    current: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Helper function to get unique categories
  const getUniqueCategories = (productsList) => {
    const categoriesMap = new Map();
    
    productsList.forEach(product => {
      if (product.categories && Array.isArray(product.categories)) {
        product.categories.forEach(category => {
          if (category && category.id) {
            categoriesMap.set(category.id, {
              id: category.id,
              name: category.name || 'Unnamed Category'
            });
          }
        });
      }
    });
    
    return Array.from(categoriesMap.values());
  };

  // Helper function to sort products locally
  const sortProducts = (productsList, sortByParam, sortOrderParam) => {
    return [...productsList].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortByParam) {
        case "price":
          const priceA = ResellerProductService.getProductMinPrice(a);
          const priceB = ResellerProductService.getProductMinPrice(b);
          valueA = priceA;
          valueB = priceB;
          break;
        case "name":
        default:
          valueA = a.name?.toLowerCase() || "";
          valueB = b.name?.toLowerCase() || "";
          break;
      }
      
      if (valueA < valueB) {
        return sortOrderParam === "asc" ? -1 : 1;
      }
      if (valueA > valueB) {
        return sortOrderParam === "asc" ? 1 : -1;
      }
      return 0;
    });
  };

  // Fetch products
  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {
        page,
        limit: 12,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory !== "all" && { category: selectedCategory }),
        sortBy,
        sortOrder
      };
      
      console.log('📦 Fetching products with filters:', filters);
      
      const result = await ResellerProductService.getProductList(filters);
      
      console.log('📦 Product list result:', {
        success: result.success,
        count: result.count,
        productsCount: result.products?.length,
        pagination: result.pagination,
        fromCache: result.fromCache
      });
      
      if (result.success) {
        const productsData = result.products || [];
        setProducts(productsData);
        setFilteredProducts(productsData);
        setPagination(result.pagination || {
          current: page,
          totalPages: 1,
          totalItems: productsData.length,
          hasNextPage: false,
          hasPrevPage: false
        });
        
        // Extract unique categories using local function
        const uniqueCategories = getUniqueCategories(productsData);
        setCategories(uniqueCategories);
      } else {
        setError(result.message || "Failed to fetch products");
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError(err.message || "Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    try {
      const result = await ResellerProductService.getWalletBalance();
      console.log('💰 Wallet balance result:', {
        success: result?.success,
        totalBalance: result?.totalBalance,
        targetCurrency: result?.targetCurrency,
        wallets: result?.wallets
      });
      
      if (result?.success) {
        setWalletBalance(result.totalBalance || 0);
      } else {
        setWalletBalance(0);
      }
    } catch (err) {
      console.warn("Could not fetch wallet balance:", err);
      setWalletBalance(0);
    }
  };

  // Handle buy button click
  const handleBuyClick = (product) => {
    if (!user) {
      alert("Please login to purchase products");
      navigate("/login");
      return;
    }
    
    // Validate product has available denominations
    const availableDenoms = ResellerProductService.getAvailableDenominations(product);
    if (availableDenoms.length === 0) {
      alert("This product is currently out of stock.");
      return;
    }
    
    setSelectedProduct(product);
    setIsBuyModalOpen(true);
  };

  // Handle order created
  const handleOrderCreated = async (orderResult) => {
    console.log("✅ Order created successfully:", orderResult);
    
    // Show success message
    alert(`Order #${orderResult.orderNumber || orderResult.id} created successfully!`);
    
    // Refresh wallet balance
    await fetchWalletBalance();
    
    // Refresh products (to update stock)
    await fetchProducts(pagination.current);
    
    // Close modal
    setIsBuyModalOpen(false);
    setSelectedProduct(null);
    
    // Navigate to orders page
    navigate("/dashboard/orders");
  };

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Debounce search to avoid too many API calls
    const timer = setTimeout(() => {
      if (value.trim() !== searchTerm.trim()) {
        fetchProducts(1);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  };

  // Handle category filter
  const handleCategoryChange = (e) => {
    const categoryId = e.target.value;
    setSelectedCategory(categoryId);
    
    // Reset to page 1 when changing category
    fetchProducts(1);
  };

  // Handle sort
  const handleSortChange = (e) => {
    const value = e.target.value;
    let newSortBy = "name";
    let newSortOrder = "asc";
    
    switch (value) {
      case "price-low":
        newSortBy = "price";
        newSortOrder = "asc";
        break;
      case "price-high":
        newSortBy = "price";
        newSortOrder = "desc";
        break;
      case "name-asc":
        newSortBy = "name";
        newSortOrder = "asc";
        break;
      case "name-desc":
        newSortBy = "name";
        newSortOrder = "desc";
        break;
      default:
        newSortBy = "name";
        newSortOrder = "asc";
    }
    
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    
    // Reset to page 1 when changing sort
    fetchProducts(1);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("all");
    setSortBy("name");
    setSortOrder("asc");
    
    // Reset to initial state
    fetchProducts(1);
  };

  // Load more products
  const handleLoadMore = () => {
    if (pagination.hasNextPage) {
      fetchProducts(pagination.current + 1);
    }
  };

  // Go to specific page
  const handlePageChange = (page) => {
    fetchProducts(page);
  };

  // Initialize
  useEffect(() => {
    fetchProducts(1);
    fetchWalletBalance();
  }, []);

  // Format price
  const formatPrice = (amount, currency = "USD") => {
    return ResellerProductService.formatPrice(amount, currency);
  };

  // Check if product is in stock
  const isProductInStock = (product) => {
    return ResellerProductService.isProductInStock(product);
  };

  // Get product stock status
  const getProductStockStatus = (product) => {
    return ResellerProductService.getProductStockStatus(product);
  };

  // Get product min price
  const getProductMinPrice = (product) => {
    return ResellerProductService.getProductMinPrice(product);
  };

  // Render loading state
  if (loading && products.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <div className="product-list-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>Product Catalog</h1>
          <p>Browse and purchase from our wide range of products</p>
        </div>
        
        <div className="wallet-section">
          <div className="wallet-info">
            <span className="wallet-label">Your Balance</span>
            <span className="wallet-amount">
              {formatPrice(walletBalance, "USD")}
            </span>
          </div>
          <button 
            className="wallet-btn"
            onClick={() => navigate("/dashboard/wallet")}
          >
            Add Funds
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={handleSearch}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        
        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="category">Category</label>
            <select 
              id="category"
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="sort">Sort by</label>
            <select 
              id="sort"
              value={`${sortBy}-${sortOrder}`}
              onChange={handleSortChange}
              className="filter-select"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-low">Price (Low to High)</option>
              <option value="price-high">Price (High to Low)</option>
            </select>
          </div>
          
          <button 
            onClick={handleClearFilters}
            className="clear-filters-btn"
            disabled={!searchTerm && selectedCategory === "all" && sortBy === "name" && sortOrder === "asc"}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Stats */}
    

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
          </div>
          <button onClick={() => fetchProducts(1)} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Products Grid */}
      {filteredProducts.length === 0 && !loading ? (
        <div className="no-products">
          <div className="no-products-icon">📦</div>
          <h3>No products found</h3>
          <p>Try adjusting your search or filter criteria</p>
          <button 
            onClick={handleClearFilters}
            className="clear-filters-btn"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <>
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const isInStock = isProductInStock(product);
              const stockStatus = getProductStockStatus(product);
              const minPrice = getProductMinPrice(product);
              const currency = product.displayCurrency || product.currency?.code || "USD";
              
              return (
                <div key={product.id} className="product-card">
                  {/* Product Image */}
                  <div className="product-image-container">
                    {product.image?.url || product.images?.[0]?.url ? (
                      <img 
                        src={product.image?.url || product.images?.[0]?.url} 
                        alt={product.name}
                        className="product-image"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f5f5f5'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial, sans-serif' font-size='48' text-anchor='middle' dy='.3em' fill='%23999'%3E${product.name?.charAt(0) || 'P'}%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    ) : (
                      <div className="image-placeholder">
                        <span>{product.name?.charAt(0)?.toUpperCase() || "P"}</span>
                      </div>
                    )}
                    
                    {/* Stock Status Badge */}
                    {stockStatus === 'OUT_OF_STOCK' && (
                      <div className="stock-badge out-of-stock">
                        Out of Stock
                      </div>
                    )}
                    {stockStatus === 'LOW_STOCK' && (
                      <div className="stock-badge low-stock">
                        Low Stock
                      </div>
                    )}
                    {stockStatus === 'IN_STOCK' && (
                      <div className="stock-badge in-stock">
                        In Stock
                      </div>
                    )}
                  </div>
                  
                  {/* Product Info */}
                  <div className="product-info">
                    <div className="product-header">
                      <h3 className="product-name" title={product.name}>
                        {product.name || "Unnamed Product"}
                      </h3>
                      <span className="product-price">
                        {minPrice > 0 ? `From ${formatPrice(minPrice, currency)}` : 'Price Varies'}
                      </span>
                    </div>
                    
                    {/* Product Actions */}
                    <div className="product-actions">
                      <button 
                        className="view-btn"
                        onClick={() => navigate(`/dashboard/products/${product.id}`)}
                        title="View product details"
                      >
                        View Details
                      </button>
                      
                      {!isInStock && (
                        <div className="out-of-stock-message">
                          Currently unavailable
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-btn prev"
                onClick={() => handlePageChange(pagination.current - 1)}
                disabled={!pagination.hasPrevPage || loading}
              >
                ← Previous
              </button>
              
              <div className="page-numbers">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.current <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.current >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.current - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      className={`page-btn ${pagination.current === pageNum ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={loading}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button 
                className="pagination-btn next"
                onClick={() => handlePageChange(pagination.current + 1)}
                disabled={!pagination.hasNextPage || loading}
              >
                Next →
              </button>
            </div>
          )}

          {/* Load More Button (alternative to pagination) */}
          {pagination.hasNextPage && (
            <div className="load-more-container">
              <button 
                className="load-more-btn"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More Products'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Loading overlay for subsequent loads */}
      {loading && products.length > 0 && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner small"></div>
            <p>Loading more products...</p>
          </div>
        </div>
      )}
    </div>
  );
}