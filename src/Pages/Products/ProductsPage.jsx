// src/components/dashboard/ProductPage.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ResellerProductService from "../../services/product.service";
import BuyProductModal from "./BuyProduct";
import "./Product.css";

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [denominations, setDenominations] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);

  const fetchProduct = async () => {
    try {
      setIsLoading(true);
      const result = await ResellerProductService.getProductById(id);

      if (result?.success && result.product) {
        setProduct(result.product);
        const denoms = ResellerProductService.getAvailableDenominations(result.product);
        setDenominations(denoms);
      } else {
        throw new Error(result?.message || "Product not found");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const result = await ResellerProductService.getWalletBalance();
      setWalletBalance(result);
    } catch (err) {
      console.warn("Could not fetch wallet balance:", err);
    }
  };

  const handleQuickBuy = (denomination) => {
    // Open buy modal with pre-selected denomination
    setSelectedDenomination(denomination);
    setShowBuyModal(true);
  };

  const handleOrderCreated = (orderResult) => {
    console.log("✅ Order created successfully:", orderResult);
    
    // Show success message
    alert(`Order #${orderResult.invoiceId || orderResult.orderNumber} created successfully!`);
    
    // Close modal
    setShowBuyModal(false);
    
    // Navigate to orders page
    navigate("/dashboard/orders");
  };

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchWalletBalance();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="product-container">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading product...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-container">
        <div className="container">
          <div className="error">
            <h3>Product Not Found</h3>
            <p>{error || "Product doesn't exist"}</p>
            <button className="btn btn-gray" onClick={() => navigate("/dashboard/products")}>
              ← Back to Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isInStock = ResellerProductService.isProductInStock(product);
  const currency = product.displayCurrency || 'USD';
  const priceRange = ResellerProductService.getProductPriceRange(product);

  return (
    <div className="product-container">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <button onClick={() => navigate("/dashboard/products")}>Products</button>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        {/* Main Layout */}
        <div className="product-layout">
          {/* Left - Image */}
          <div>
            <div className="main-image">
              {product.images?.[0]?.url ? (
                <img src={product.images[0].url} alt={product.name} />
              ) : (
                <div className="image-placeholder-large">
                  {product.name?.charAt(0)}
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
            
            {/* Wallet Info */}
            <div className="wallet-info-card">
              <div className="wallet-label">Available Balance:</div>
              <div className="wallet-amount">
                {ResellerProductService.formatPrice(
                  walletBalance?.balance || walletBalance?.availableBalance || 0,
                  walletBalance?.currency || 'USD'
                )}
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => navigate("/dashboard/wallet")}
              >
                Add Funds
              </button>
            </div>
          </div>

          {/* Right - Info */}
          <div>
            <h1 className="product-title">{product.name}</h1>
            
            <div className="product-meta-info">
              <span className="product-sku">SKU: {product.sku || 'N/A'}</span>
              <span className={`product-status ${product.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                {product.status}
              </span>
            </div>
            
            {product.description && (
              <div className="description-section">
                <h3>Description</h3>
                <p className="description-text">{product.description}</p>
              </div>
            )}

            {/* Price Range */}
            {priceRange && (
              <div className="price-range-section">
                <h3>Price Range</h3>
                <div className="price-range-display">
                  {ResellerProductService.formatPrice(priceRange.min, currency)}
                  {priceRange.min !== priceRange.max && (
                    <>
                      <span className="price-range-separator"> - </span>
                      {ResellerProductService.formatPrice(priceRange.max, currency)}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Denominations */}
            <div className="quick-denominations-section">
              <h3>Available Denominations</h3>
              <div className="denominations-grid">
                {denominations.map((denom) => {
                  const isOutOfStock = denom.stockCount === 0;
                  const price = denom.finalAmount || denom.convertedAmount || denom.amount;
                  
                  return (
                    <button
                      key={denom.id}
                      className="denom-card"
                      onClick={() => !isOutOfStock && handleQuickBuy(denom)}
                      disabled={isOutOfStock}
                    >
                      <div className="denom-amount">
                        {ResellerProductService.formatPrice(price, currency)}
                      </div>
                      <div className="denom-stock">
                        {isOutOfStock ? 'Out of Stock' : `Stock: ${denom.stockCount || 'Available'}`}
                      </div>
                      {denom.hasDiscount && (
                        <div className="denom-discount">
                          Save {ResellerProductService.calculateDiscountPercentage(denom.amount, price)}%
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bulk Purchase Button */}
            <div className="bulk-section">
              <button 
                className="btn btn-success bulk-purchase-btn"
                onClick={() => setShowBuyModal(true)}
                disabled={denominations.length === 0 || !isInStock}
              >
                🛒 Buy Multiple Denominations
              </button>
              <div className="bulk-features">
                <div className="feature">
                  <span className="feature-icon">✓</span>
                  <span>Buy multiple denominations at once</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">✓</span>
                  <span>Custom quantities for each</span>
                </div>
                <div className="feature">
                  <span className="feature-icon">✓</span>
                  <span>Instant voucher delivery</span>
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="product-details-section">
              <h3>Product Details</h3>
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">Brand</div>
                  <div className="info-value">{product.brand?.name || 'Unknown'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Category</div>
                  <div className="info-value">{product.categories?.[0]?.name || 'N/A'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Region</div>
                  <div className="info-value">{product.region || 'Global'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Platform</div>
                  <div className="info-value">
                    <div className="platform-tags">
                      {product.platform?.map((plat, idx) => (
                        <span key={idx} className="platform-tag">{plat}</span>
                      )) || 'All Platforms'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <div className="tab-headers">
            <button 
              className={`tab-header ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Product Details
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
            <button 
              className={`tab-header ${activeTab === 'specifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('specifications')}
            >
              Specifications
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'details' && (
              <div>
                <h3>Product Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Product ID</div>
                    <div className="info-value">{product.id}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">SKU</div>
                    <div className="info-value">{product.sku}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Product Type</div>
                    <div className="info-value">{product.productType || 'Gift Card'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Created Date</div>
                    <div className="info-value">{new Date(product.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Last Updated</div>
                    <div className="info-value">{new Date(product.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">API Type</div>
                    <div className="info-value">{product.apiType || 'Offline'}</div>
                  </div>
                </div>
                
                {product.platform && product.platform.length > 0 && (
                  <div className="platform-section">
                    <h4>Supported Platforms</h4>
                    <div className="platform-tags">
                      {product.platform.map((plat, idx) => (
                        <span key={idx} className="platform-tag">{plat}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'terms' && (
              <div>
                <h3>Terms & Conditions</h3>
                <pre className="terms-content">
                  {product.tnc || 'No terms and conditions specified for this product.'}
                </pre>
              </div>
            )}

            {activeTab === 'redemption' && (
              <div>
                <h3>Redemption Information</h3>
                <pre className="redemption-content">
                  {product.redemptionInfo || 'No redemption information available.'}
                </pre>
              </div>
            )}

            {activeTab === 'specifications' && (
              <div>
                <h3>Product Specifications</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Validity</div>
                    <div className="info-value">{product.validityDays ? `${product.validityDays} days` : 'No expiration'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Min Purchase</div>
                    <div className="info-value">{product.minPurchase || 1}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Max Purchase</div>
                    <div className="info-value">{product.maxPurchase || 'No limit'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Usage Location</div>
                    <div className="info-value">{product.usageLocation || 'BOTH'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Source</div>
                    <div className="info-value">{product.source || 'OFFLINE'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Buy Modal */}
        {showBuyModal && (
          <BuyProductModal
            product={product}
            isOpen={showBuyModal}
            onClose={() => setShowBuyModal(false)}
            onOrderCreated={handleOrderCreated}
          />
        )}
      </div>
    </div>
  );
}