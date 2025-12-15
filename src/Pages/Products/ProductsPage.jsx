// src/components/dashboard/ProductPage.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ResellerProductService from "../../services/product.service";
import "./Product.css";

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDenomination, setSelectedDenomination] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [walletBalance, setWalletBalance] = useState(null);
  const [availabilityCheck, setAvailabilityCheck] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Fetch product details
  const fetchProductDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log("🔍 Fetching product details for ID:", id);
      
      const result = await ResellerProductService.getProductById(id);
      
      if (result?.success && result.product) {
        console.log("✅ Product details loaded:", result.product);
        setProduct(result.product);
        
        // Select first available denomination by default
        if (result.product.denominations && result.product.denominations.length > 0) {
          const availableDenoms = result.product.denominations.filter(d => 
            d.status === 'ACTIVE' && 
            (d.stockCount === undefined || d.stockCount > 0)
          );
          
          if (availableDenoms.length > 0) {
            setSelectedDenomination(availableDenoms[0]);
            
            // Check availability for selected denomination
            checkProductAvailability(availableDenoms[0].id);
          }
        }
        
        // Fetch wallet balance
        fetchWalletBalance();
      } else {
        throw new Error(result?.message || "Failed to load product details");
      }
    } catch (err) {
      console.error("❌ Error fetching product:", err);
      setError(err.message || "Failed to load product. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    try {
      const result = await ResellerProductService.getWalletBalance();
      if (result?.success) {
        setWalletBalance(result);
      }
    } catch (err) {
      console.warn("Could not fetch wallet balance:", err);
    }
  };

  // Check product availability
  const checkProductAvailability = async (denominationId) => {
    try {
      const result = await ResellerProductService.checkProductAvailability(id, denominationId);
      if (result?.success) {
        setAvailabilityCheck(result);
      } else {
        setAvailabilityCheck({
          available: false,
          error: result?.message || "Availability check failed"
        });
      }
    } catch (err) {
      console.error("Availability check error:", err);
      setAvailabilityCheck({
        available: false,
        error: err.message
      });
    }
  };

  // Handle denomination selection
  const handleDenominationSelect = (denomination) => {
    setSelectedDenomination(denomination);
    setQuantity(1);
    checkProductAvailability(denomination.id);
  };

  // Handle quantity change
  const handleQuantityChange = (value) => {
    const newQuantity = parseInt(value);
    if (isNaN(newQuantity) || newQuantity < 1) {
      setQuantity(1);
    } else if (selectedDenomination?.maxQuantity && newQuantity > selectedDenomination.maxQuantity) {
      setQuantity(selectedDenomination.maxQuantity);
    } else {
      setQuantity(newQuantity);
    }
  };

  // Calculate total price
  const calculateTotalPrice = () => {
    if (!selectedDenomination) return 0;
    
    const basePrice = selectedDenomination.finalAmount || selectedDenomination.convertedAmount || selectedDenomination.amount;
    const total = basePrice * quantity;
    
    return {
      basePrice: Number(basePrice),
      total: Number(total),
      formattedTotal: ResellerProductService.formatPrice(total, product?.displayCurrency || 'USD'),
      formattedBase: ResellerProductService.formatPrice(basePrice, product?.displayCurrency || 'USD')
    };
  };

  // Check if purchase is possible
  const canPurchase = () => {
    if (!product || !selectedDenomination || !availabilityCheck?.available) return false;
    
    const totalPrice = calculateTotalPrice().total;
    const hasSufficientBalance = !walletBalance || walletBalance.balance >= totalPrice;
    
    return hasSufficientBalance && quantity > 0;
  };

  // Handle add to cart
  const handleAddToCart = async () => {
    try {
      setIsAddingToCart(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Save to localStorage cart
      const cartItem = {
        productId: product.id,
        productName: product.name,
        denominationId: selectedDenomination.id,
        denominationName: selectedDenomination.name || `${product.displayCurrency} ${selectedDenomination.amount}`,
        quantity,
        unitPrice: selectedDenomination.finalAmount || selectedDenomination.convertedAmount || selectedDenomination.amount,
        totalPrice: calculateTotalPrice().total,
        currency: product.displayCurrency,
        productImage: product.images?.[0]?.url,
        timestamp: new Date().toISOString()
      };
      
      // Get existing cart
      const existingCart = JSON.parse(localStorage.getItem('reseller_cart') || '[]');
      
      // Check if item already exists
      const existingIndex = existingCart.findIndex(item => 
        item.productId === cartItem.productId && 
        item.denominationId === cartItem.denominationId
      );
      
      if (existingIndex >= 0) {
        // Update quantity
        existingCart[existingIndex].quantity += cartItem.quantity;
        existingCart[existingIndex].totalPrice = existingCart[existingIndex].unitPrice * existingCart[existingIndex].quantity;
      } else {
        // Add new item
        existingCart.push(cartItem);
      }
      
      // Save to localStorage
      localStorage.setItem('reseller_cart', JSON.stringify(existingCart));
      
      // Show success modal
      setShowSuccessModal(true);
      
      // Hide modal after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
      
    } catch (err) {
      console.error("Error adding to cart:", err);
      alert("Failed to add to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Handle quick purchase
  const handleQuickPurchase = () => {
    if (canPurchase()) {
      navigate('/dashboard/checkout', {
        state: {
          items: [{
            productId: product.id,
            denominationId: selectedDenomination.id,
            quantity,
            unitPrice: selectedDenomination.finalAmount || selectedDenomination.convertedAmount || selectedDenomination.amount
          }],
          fromProductPage: true
        }
      });
    }
  };

  // Handle buy now
  const handleBuyNow = () => {
    handleAddToCart();
    setTimeout(() => {
      navigate('/dashboard/cart');
    }, 1000);
  };

  // Load product on mount
  useEffect(() => {
    if (id) {
      fetchProductDetails();
    }
  }, [id]);

  // Loading state
  if (isLoading) {
    return (
      <div className="product-page">
        <div className="container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading product details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <div className="product-page">
        <div className="container">
          <div className="error-container">
            <h2>⚠️ Product Not Found</h2>
            <p className="error-message">{error || "The product you're looking for doesn't exist or you don't have permission to view it."}</p>
            <div className="error-actions">
              <button 
                className="back-btn"
                onClick={() => navigate('/dashboard/products')}
              >
                ← Back to Products
              </button>
              <button 
                className="retry-btn"
                onClick={fetchProductDetails}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate price info
  const priceInfo = calculateTotalPrice();
  const canBuy = canPurchase();
  const isInStock = ResellerProductService.isProductInStock(product);
  const availableDenominations = ResellerProductService.getAvailableDenominations(product);

  return (
    <div className="product-page">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <button 
            className="breadcrumb-item"
            onClick={() => navigate('/dashboard/products')}
          >
            Products
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-item active">{product.name}</span>
        </div>

        {/* Product Header */}
        <div className="product-header">
          <div className="header-left">
            <h1 className="product-title">{product.name}</h1>
            <div className="product-meta">
              <span className="sku">SKU: {product.sku}</span>
              <span className="brand">
                Brand: {product.brand?.name || 'Unknown'}
              </span>
              <span className={`status ${product.status?.toLowerCase()}`}>
                {product.status}
              </span>
            </div>
          </div>
          <div className="header-right">
            <button 
              className="back-to-list"
              onClick={() => navigate('/dashboard/products')}
            >
              ← Back to List
            </button>
          </div>
        </div>

        {/* Main Product Content */}
        <div className="product-content">
          {/* Left Column - Images */}
          <div className="product-images">
            <div className="main-image">
              {product.images && product.images.length > 0 ? (
                <img 
                  src={product.images[0].url} 
                  alt={product.images[0].altText || product.name}
                  className="main-img"
                />
              ) : (
                <div className="image-placeholder">
                  <span className="placeholder-text">{product.name?.charAt(0)?.toUpperCase() || 'P'}</span>
                </div>
              )}
            </div>
            
            {/* Thumbnails */}
            {product.images && product.images.length > 1 && (
              <div className="image-thumbnails">
                {product.images.slice(0, 4).map((image, index) => (
                  <div key={index} className="thumbnail">
                    <img 
                      src={image.url} 
                      alt={`${product.name} - ${index + 1}`}
                      className="thumbnail-img"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Details & Actions */}
          <div className="product-details">
            {/* Price Display */}
            <div className="price-display">
              <div className="price-section">
                <span className="price-label">Your Price:</span>
                <span className="price-amount">
                  {priceInfo.formattedBase}
                  {product.hasDiscount && selectedDenomination?.hasDiscount && (
                    <span className="original-price">
                      {ResellerProductService.formatPrice(
                        selectedDenomination.originalAmount || selectedDenomination.convertedAmount || selectedDenomination.amount,
                        product.displayCurrency
                      )}
                    </span>
                  )}
                </span>
                {product.hasDiscount && selectedDenomination?.hasDiscount && (
                  <span className="discount-badge">
                    Save {ResellerProductService.calculateDiscountPercentage(
                      selectedDenomination.originalAmount || selectedDenomination.convertedAmount || selectedDenomination.amount,
                      selectedDenomination.finalAmount || selectedDenomination.convertedAmount || selectedDenomination.amount
                    )}%
                  </span>
                )}
              </div>
              
              {product.conversionApplied && (
                <div className="conversion-info">
                  <span className="conversion-icon">🔄</span>
                  Converted from {product.originalCurrency} to {product.displayCurrency}
                </div>
              )}
            </div>

            {/* Wallet Balance */}
            {walletBalance && (
              <div className="wallet-balance">
                <span className="balance-label">Your Balance:</span>
                <span className="balance-amount">
                  {ResellerProductService.formatPrice(walletBalance.balance, walletBalance.currency)}
                </span>
                {!canBuy && walletBalance.balance < priceInfo.total && (
                  <span className="insufficient-balance">
                    Insufficient balance
                  </span>
                )}
              </div>
            )}

            {/* Denomination Selection */}
            <div className="denomination-section">
              <h3 className="section-title">Select Denomination</h3>
              {availableDenominations.length > 0 ? (
                <div className="denomination-grid">
                  {availableDenominations.map((denom) => {
                    const isSelected = selectedDenomination?.id === denom.id;
                    const isOutOfStock = denom.stockCount === 0;
                    
                    return (
                      <button
                        key={denom.id}
                        className={`denomination-card ${isSelected ? 'selected' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}
                        onClick={() => !isOutOfStock && handleDenominationSelect(denom)}
                        disabled={isOutOfStock}
                      >
                        <div className="denom-amount">
                          {ResellerProductService.formatPrice(
                            denom.finalAmount || denom.convertedAmount || denom.amount,
                            product.displayCurrency
                          )}
                        </div>
                        {denom.hasDiscount && (
                          <div className="denom-discount">
                            Save {ResellerProductService.calculateDiscountPercentage(
                              denom.originalAmount || denom.convertedAmount || denom.amount,
                              denom.finalAmount || denom.convertedAmount || denom.amount
                            )}%
                          </div>
                        )}
                        {denom.stockCount !== undefined && (
                          <div className="denom-stock">
                            Stock: {denom.stockCount}
                          </div>
                        )}
                        {isOutOfStock && (
                          <div className="denom-out-of-stock">Out of Stock</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="no-denominations">
                  <p>No denominations available for this product.</p>
                </div>
              )}
            </div>

            {/* Quantity Selection */}
            <div className="quantity-section">
              <h3 className="section-title">Quantity</h3>
              <div className="quantity-controls">
                <button 
                  className="quantity-btn"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={selectedDenomination?.maxQuantity || 100}
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="quantity-input"
                />
                <button 
                  className="quantity-btn"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={selectedDenomination?.maxQuantity && quantity >= selectedDenomination.maxQuantity}
                >
                  +
                </button>
              </div>
              {selectedDenomination?.maxQuantity && (
                <div className="quantity-limit">
                  Maximum: {selectedDenomination.maxQuantity} per order
                </div>
              )}
            </div>

            {/* Availability Check */}
            {availabilityCheck && (
              <div className={`availability-check ${availabilityCheck.available ? 'available' : 'unavailable'}`}>
                <div className="availability-status">
                  <span className="status-icon">
                    {availabilityCheck.available ? '✓' : '✗'}
                  </span>
                  <span className="status-text">
                    {availabilityCheck.available 
                      ? 'Product available for purchase' 
                      : availabilityCheck.error || 'Product unavailable'}
                  </span>
                </div>
                {availabilityCheck.available && availabilityCheck.stockCount && (
                  <div className="availability-details">
                    <span>Stock: {availabilityCheck.stockCount}</span>
                    <span>Quota: {availabilityCheck.resellerQuota}</span>
                  </div>
                )}
              </div>
            )}

            {/* Total Price */}
            <div className="total-price-section">
              <div className="total-label">Total:</div>
              <div className="total-amount">{priceInfo.formattedTotal}</div>
              {quantity > 1 && (
                <div className="total-breakdown">
                  {quantity} × {priceInfo.formattedBase}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className={`action-btn add-to-cart ${!canBuy ? 'disabled' : ''}`}
                onClick={handleAddToCart}
                disabled={!canBuy || isAddingToCart}
              >
                {isAddingToCart ? (
                  <>
                    <span className="spinner-small"></span>
                    Adding...
                  </>
                ) : (
                  'Add to Cart'
                )}
              </button>
              
              <button
                className={`action-btn buy-now ${!canBuy ? 'disabled' : ''}`}
                onClick={handleBuyNow}
                disabled={!canBuy}
              >
                Buy Now
              </button>
              
              <button
                className="action-btn quick-purchase"
                onClick={handleQuickPurchase}
                disabled={!canBuy}
              >
                Quick Purchase
              </button>
            </div>

            {/* Product Badges */}
            <div className="product-badges">
              {!isInStock && <span className="badge out-of-stock">Out of Stock</span>}
              {product.hasDiscount && <span className="badge discount">Discounted</span>}
              {product.conversionApplied && <span className="badge converted">Currency Converted</span>}
              {product.platform && product.platform.length > 0 && (
                <span className="badge platform">
                  {product.platform[0]}
                  {product.platform.length > 1 && ` +${product.platform.length - 1}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Product Tabs */}
        <div className="product-tabs">
          <div className="tab-headers">
            <button 
              className={`tab-header ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button 
              className={`tab-header ${activeTab === 'description' ? 'active' : ''}`}
              onClick={() => setActiveTab('description')}
            >
              Description
            </button>
            <button 
              className={`tab-header ${activeTab === 'terms' ? 'active' : ''}`}
              onClick={() => setActiveTab('terms')}
            >
              Terms & Conditions
            </button>
            <button 
              className={`tab-header ${activeTab === 'redemption' ? 'active' : ''}`}
              onClick={() => setActiveTab('redemption')}
            >
              Redemption Info
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'details' && (
              <div className="details-tab">
                <h3>Product Details</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Product ID:</span>
                    <span className="detail-value">{product.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">SKU:</span>
                    <span className="detail-value">{product.sku}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Brand:</span>
                    <span className="detail-value">{product.brand?.name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Region:</span>
                    <span className="detail-value">{product.region || 'Global'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Platform:</span>
                    <div className="platform-list">
                      {product.platform?.map((platform, index) => (
                        <span key={index} className="platform-tag">{platform}</span>
                      ))}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Categories:</span>
                    <div className="category-list">
                      {product.categories?.map((category) => (
                        <span key={category.id} className="category-tag">
                          {category.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Currency:</span>
                    <span className="detail-value">
                      {product.displayCurrency} 
                      {product.conversionApplied && ` (Converted from ${product.originalCurrency})`}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Stock Status:</span>
                    <span className={`detail-value ${ResellerProductService.getProductStockStatus(product).toLowerCase()}`}>
                      {ResellerProductService.getProductStockStatus(product)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Available Denominations:</span>
                    <span className="detail-value">
                      {availableDenominations.length} of {product.denominations?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'description' && (
              <div className="description-tab">
                <h3>Product Description</h3>
                <div className="description-content">
                  {product.description ? (
                    <p>{product.description}</p>
                  ) : (
                    <p className="no-description">No description available for this product.</p>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'terms' && (
              <div className="terms-tab">
                <h3>Terms & Conditions</h3>
                <div className="terms-content">
                  {product.tnc ? (
                    <div className="terms-text">
                      {product.tnc}
                    </div>
                  ) : (
                    <p className="no-terms">No terms and conditions specified for this product.</p>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'redemption' && (
              <div className="redemption-tab">
                <h3>Redemption Information</h3>
                <div className="redemption-content">
                  {product.redemptionInfo ? (
                    <div className="redemption-text">
                      {product.redemptionInfo}
                    </div>
                  ) : (
                    <p className="no-redemption">No redemption information available for this product.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="success-modal-overlay">
            <div className="success-modal">
              <div className="success-icon">✓</div>
              <h3>Added to Cart!</h3>
              <p>
                {quantity} × {selectedDenomination?.name || 'Item'} added to your cart.
              </p>
              <div className="modal-actions">
                <button 
                  className="modal-btn continue"
                  onClick={() => setShowSuccessModal(false)}
                >
                  Continue Shopping
                </button>
                <button 
                  className="modal-btn checkout"
                  onClick={() => navigate('/dashboard/cart')}
                >
                  Go to Cart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="debug-info">
            <h4>🔧 Debug Information</h4>
            <div className="debug-grid">
              <div className="debug-item">
                <strong>Product ID:</strong> {id}
              </div>
              <div className="debug-item">
                <strong>Selected Denomination:</strong> {selectedDenomination?.id || 'None'}
              </div>
              <div className="debug-item">
                <strong>Quantity:</strong> {quantity}
              </div>
              <div className="debug-item">
                <strong>Total Price:</strong> {priceInfo.total}
              </div>
              <div className="debug-item">
                <strong>Can Purchase:</strong> {canBuy ? 'Yes' : 'No'}
              </div>
              <div className="debug-item">
                <strong>Wallet Balance:</strong> {walletBalance?.balance || 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}