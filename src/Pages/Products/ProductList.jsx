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

  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await ResellerProductService.getProductList();
      
      if (result.success) {
        const productsData = result.products || [];
        setProducts(productsData);
        setFilteredProducts(productsData);
        
        // Extract unique categories
        const uniqueCategories = ResellerProductService.getUniqueCategories(productsData);
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
      if (result?.success) {
        setWalletBalance(result.balance || 0);
      }
    } catch (err) {
      console.warn("Could not fetch wallet balance:", err);
    }
  };

  // Handle buy button click
  const handleBuyClick = (product) => {
    if (!user) {
      alert("Please login to purchase products");
      navigate("/login");
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
    await fetchProducts();
    
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
    
    filterProducts(value, selectedCategory, sortBy, sortOrder);
  };

  // Handle category filter
  const handleCategoryChange = (e) => {
    const categoryId = e.target.value;
    setSelectedCategory(categoryId);
    
    filterProducts(searchTerm, categoryId, sortBy, sortOrder);
  };

  // Handle sort
  const handleSortChange = (e) => {
    const value = e.target.value;
    let sortBy = "name";
    let sortOrder = "asc";
    
    switch (value) {
      case "price-low":
        sortBy = "price";
        sortOrder = "asc";
        break;
      case "price-high":
        sortBy = "price";
        sortOrder = "desc";
        break;
      case "name-asc":
        sortBy = "name";
        sortOrder = "asc";
        break;
      case "name-desc":
        sortBy = "name";
        sortOrder = "desc";
        break;
      default:
        sortBy = "name";
        sortOrder = "asc";
    }
    
    setSortBy(sortBy);
    setSortOrder(sortOrder);
    
    filterProducts(searchTerm, selectedCategory, sortBy, sortOrder);
  };

  // Filter and sort products
  const filterProducts = (search, category, sortBy, sortOrder) => {
    let filtered = [...products];
    
    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower) ||
        product.brand?.name?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply category filter
    if (category && category !== "all") {
      filtered = filtered.filter(product => 
        product.categories?.some(cat => 
          cat.id === category || cat.categoryId === category
        )
      );
    }
    
    // Apply sorting
    filtered = ResellerProductService.sortProducts(filtered, sortBy, sortOrder);
    
    setFilteredProducts(filtered);
  };

  // Initialize
  useEffect(() => {
    fetchProducts();
    fetchWalletBalance();
  }, []);

  // Format price
  const formatPrice = (amount, currency = "USD") => {
    return ResellerProductService.formatPrice(amount, currency);
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
          <h1>Products</h1>
          <p>Browse and purchase products from our catalog</p>
        </div>
        
        <div className="wallet-section">
          <div className="wallet-info">
            <span className="wallet-label">Available Balance:</span>
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
            <label htmlFor="category">Category:</label>
            <select 
              id="category"
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id || category.categoryId} value={category.id || category.categoryId}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="sort">Sort by:</label>
            <select 
              id="sort"
              onChange={handleSortChange}
              className="filter-select"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-low">Price (Low to High)</option>
              <option value="price-high">Price (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          ⚠️ {error}
          <button onClick={fetchProducts} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="no-products">
          <div className="no-products-icon">📦</div>
          <h3>No products found</h3>
          <p>Try adjusting your search or filter criteria</p>
          <button 
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("all");
              filterProducts("", "all", "name", "asc");
            }}
            className="clear-filters-btn"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => {
            const priceRange = ResellerProductService.getProductPriceRange(product);
            const isInStock = ResellerProductService.isProductInStock(product);
            const availableDenoms = ResellerProductService.getAvailableDenominations(product);
            const minPrice = ResellerProductService.getProductMinPrice(product);
            
            return (
              <div key={product.id} className="product-card">
                <div className="product-image-container">
                  {product.images?.[0]?.url ? (
                    <img 
                      src={product.images[0].url} 
                      alt={product.name}
                      className="product-image"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial, sans-serif' font-size='48' text-anchor='middle' dy='.3em' fill='%23666'%3E${product.name.charAt(0)}%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  ) : (
                    <div className="image-placeholder">
                      <span>{product.name?.charAt(0)?.toUpperCase() || "P"}</span>
                    </div>
                  )}
                  
                  {!isInStock && (
                    <div className="out-of-stock-overlay">
                      <span>Out of Stock</span>
                    </div>
                  )}
                  
                  {product.hasDiscount && (
                    <div className="discount-badge">
                      <span>Sale</span>
                    </div>
                  )}
                </div>
                
                <div className="product-info">
                  <div className="product-header">
                    <h3 className="product-name">{product.name}</h3>
                    <span className="product-sku">#{product.sku}</span>
                  </div>
                  
                  <p className="product-description">
                    {product.description?.substring(0, 100) || "No description available..."}
                    {product.description?.length > 100 ? "..." : ""}
                  </p>
                  
                  <div className="product-meta">
                    <span className="product-brand">
                      <strong>Brand:</strong> {product.brand?.name || "Unknown"}
                    </span>
                    
                    {product.categories && product.categories.length > 0 && (
                      <span className="product-category">
                        <strong>Category:</strong> {product.categories[0].name}
                      </span>
                    )}
                  </div>
                  
                  <div className="product-pricing">
                    {priceRange && (
                      <div className="price-info">
                        <span className="price-label">Price Range:</span>
                        <span className="price-range-display">
                          {formatPrice(priceRange.min, priceRange.currency)}
                          {priceRange.min !== priceRange.max && ` - ${formatPrice(priceRange.max, priceRange.currency)}`}
                        </span>
                      </div>
                    )}
                    
                    <div className="stock-info">
                      <span className={`stock-status ${isInStock ? "in-stock" : "out-of-stock"}`}>
                        {isInStock ? "✅ In Stock" : "❌ Out of Stock"}
                      </span>
                      <span className="denominations-count">
                        {availableDenoms.length} denominations available
                      </span>
                    </div>
                  </div>
                  
                  <div className="product-actions">
                    <button 
                      className={`buy-btn ${!isInStock ? "disabled" : ""}`}
                      onClick={() => handleBuyClick(product)}
                      disabled={!isInStock}
                    >
                      {isInStock ? `Buy from ${formatPrice(minPrice, product.displayCurrency || "USD")}` : "Out of Stock"}
                    </button>
                    
                    <button 
                      className="details-btn"
                      onClick={() => navigate(`/dashboard/products/${product.id}`)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

   
     
    </div>
  );
}