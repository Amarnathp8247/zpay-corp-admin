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
  const [selectedDenomination, setSelectedDenomination] = useState(null);
  const [denominations, setDenominations] = useState([]);
  const [walletBalance, setWalletBalance] = useState({
    totalBalance: 0,
    currency: "USD",
  });

  const fetchProduct = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("🔍 Fetching product with ID:", id);

      const result = await ResellerProductService.getProductById(id);

      if (result?.success && result.product) {
        const productData = result.product;
        setProduct(productData);

        // Get available denominations
        const denoms =
          ResellerProductService.getAvailableDenominations(productData) || [];
        setDenominations(denoms);

        console.log("✅ Product loaded:", {
          name: productData.name,
          id: productData.id,
          denominationsCount: denoms.length,
        });
      } else {
        throw new Error(
          result?.message || result?.error || "Product not found"
        );
      }
    } catch (err) {
      console.error("❌ Error fetching product:", err);
      setError(err.message || "Failed to load product");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      console.log("💰 Fetching wallet balance...");
      const result = await ResellerProductService.getWalletBalance();

      if (result?.success) {
        setWalletBalance({
          totalBalance: result.totalBalance || result.balance || 0,
          currency: result.targetCurrency || result.currency || "USD",
        });
      } else {
        setWalletBalance({
          totalBalance: 0,
          currency: "USD",
        });
      }
    } catch (err) {
      console.warn("Could not fetch wallet balance:", err);
      setWalletBalance({
        totalBalance: 0,
        currency: "USD",
      });
    }
  };

  const handleQuickBuy = (denomination) => {
    console.log("🛒 Quick buy clicked for denomination:", denomination);

    if (!denomination) {
      console.error("No denomination selected");
      return;
    }

    // Open buy modal with pre-selected denomination
    setSelectedDenomination(denomination);
    setShowBuyModal(true);
  };

  const handleOrderCreated = (orderResult) => {
    console.log("✅ Order created successfully:", orderResult);

    // Show success message
    alert(
      `Order #${
        orderResult.orderNumber || orderResult.id || orderResult.invoiceId
      } created successfully!`
    );

    // Close modal
    setShowBuyModal(false);
    setSelectedDenomination(null);

    // Refresh wallet balance
    fetchWalletBalance();

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
            <button
              className="btn btn-gray"
              onClick={() => navigate("/dashboard/products")}
            >
              ← Back to Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isInStock = ResellerProductService.isProductInStock(product);
  const currency = product.displayCurrency || product.currency?.code || "USD";
  const priceRange = ResellerProductService.getProductPriceRange(product);
  const stockStatus = ResellerProductService.getProductStockStatus(product);

  // Extract image
  const productImage =
    product.image?.url ||
    product.images?.[0]?.url ||
    product.images?.[0]?.imageUrl ||
    product.imageUrl;

  return (
    <div className="product-container">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <button
            className="breadcrumb-btn"
            onClick={() => navigate("/dashboard/products")}
          >
            Products
          </button>
          <span>/</span>
          <span className="breadcrumb-current">
            {product.name || "Product"}
          </span>
        </div>

        {/* Main Layout */}
        <div className="product-layout">
          {/* Left - Image */}
          <div className="product-left">
            <div className="main-image">
              {productImage ? (
                <img
                  src={productImage}
                  alt={product.name}
                  className="product-main-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial, sans-serif' font-size='48' text-anchor='middle' dy='.3em' fill='%23666'%3E${product.name?.charAt(0) || 'P'}%3C/text%3E%3C/svg%3E";
                  }}
                />
              ) : (
                <div className="image-placeholder-large">
                  <span>{product.name?.charAt(0)?.toUpperCase() || "P"}</span>
                </div>
              )}

              {stockStatus === "OUT_OF_STOCK" && (
                <div className="out-of-stock-overlay">
                  <span>Out of Stock</span>
                </div>
              )}

              {stockStatus === "LOW_STOCK" && (
                <div className="low-stock-overlay">
                  <span>Low Stock</span>
                </div>
              )}
            </div>

            {/* Additional Product Images (if available) */}
            {product.images && product.images.length > 1 && (
              <div className="product-image-gallery">
                <h4>Product Gallery</h4>
                <div className="image-thumbnails">
                  {product.images.slice(0, 4).map((img, index) => (
                    <div
                      key={index}
                      className="thumbnail"
                      onClick={() => {
                        // You can implement image switching logic here
                      }}
                    >
                      <img
                        src={img.url || img.imageUrl}
                        alt={`${product.name} - View ${index + 1}`}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='75' viewBox='0 0 100 75'%3E%3Crect width='100' height='75' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial, sans-serif' font-size='20' text-anchor='middle' dy='.3em' fill='%23666'%3E${index + 1}%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right - Info */}
          <div className="product-right">
            <h1 className="product-title">
              {product.name || "Unnamed Product"}
            </h1>

            <div className="product-meta-info">
              <span className="product-sku">
                SKU: {product.sku || product.id || "N/A"}
              </span>
              <span
                className={`product-status ${
                  product.status === "ACTIVE"
                    ? "status-active"
                    : "status-inactive"
                }`}
              >
                {product.status || "UNKNOWN"}
              </span>
            </div>

            {/* Stock Status Badge */}
            <div className="stock-status-badge">
              <span
                className={`stock-indicator ${stockStatus
                  .toLowerCase()
                  .replace("_", "-")}`}
              >
                {stockStatus === "IN_STOCK" && "✅ In Stock"}
                {stockStatus === "LOW_STOCK" && "⚠️ Low Stock"}
                {stockStatus === "OUT_OF_STOCK" && "❌ Out of Stock"}
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
                  <span className="price-range-from">
                    {ResellerProductService.formatPrice(
                      priceRange.min,
                      currency
                    )}
                  </span>
                  {priceRange.min !== priceRange.max && (
                    <>
                      <span className="price-range-separator"> to </span>
                      <span className="price-range-to">
                        {ResellerProductService.formatPrice(
                          priceRange.max,
                          currency
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Denominations */}
            <div className="quick-denominations-section">
              <h3>Available Denominations</h3>
              {denominations.length > 0 ? (
                <div className="denominations-grid">
                  {denominations.map((denom) => {
                    const isOutOfStock = denom.stockCount === 0;

                    // Get price for display
                    let displayPrice = "N/A";
                    if (denom.finalAmount !== undefined) {
                      displayPrice = denom.finalAmount;
                    } else if (denom.convertedAmount !== undefined) {
                      displayPrice = denom.convertedAmount;
                    } else if (denom.amount !== undefined) {
                      displayPrice = denom.amount;
                    }

                    const displayCurrency =
                      denom.convertedCurrency || denom.currency || currency;

                    return (
                      <button
                        key={denom.id}
                        className={`denom-card ${
                          isOutOfStock ? "out-of-stock" : ""
                        }`}
                        onClick={() => !isOutOfStock && handleQuickBuy(denom)}
                        disabled={isOutOfStock}
                      >
                        <div className="denom-amount">
                          {ResellerProductService.formatPrice(
                            displayPrice,
                            displayCurrency
                          )}
                        </div>
                        <div className="denom-stock">
                          {isOutOfStock
                            ? "Out of Stock"
                            : `Stock: ${denom.stockCount || "Available"}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="no-denominations">
                  <p>No denominations available at the moment.</p>
                </div>
              )}
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
                  <div className="info-value">
                    {product.brand?.name || product.brandName || "Unknown"}
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Category</div>
                  <div className="info-value">
                    {product.categories?.[0]?.name ||
                      product.category?.name ||
                      "N/A"}
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Region</div>
                  <div className="info-value">{product.region || "Global"}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Currency</div>
                  <div className="info-value">{currency}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Total Denominations</div>
                  <div className="info-value">{denominations.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <div className="tab-headers">
            <button
              className={`tab-header ${
                activeTab === "details" ? "active" : ""
              }`}
              onClick={() => setActiveTab("details")}
            >
              Product Details
            </button>
            <button
              className={`tab-header ${activeTab === "terms" ? "active" : ""}`}
              onClick={() => setActiveTab("terms")}
            >
              Terms & Conditions
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "details" && (
              <div className="tab-details">
                <h3>Product Details</h3>
                <div className="info-grid detailed">
                  <div className="info-item">
                    <div className="info-label">Product ID</div>
                    <div className="info-value">{product.id}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">SKU</div>
                    <div className="info-value">{product.sku || "N/A"}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Product Type</div>
                    <div className="info-value">
                      {product.productType || product.apiType || "Gift Card"}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Brand</div>
                    <div className="info-value">
                      {product.brand?.name || product.brandName || "Unknown"}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Brand ID</div>
                    <div className="info-value">
                      {product.brand?.id || product.brandId || "N/A"}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Provider</div>
                    <div className="info-value">
                      {product.provider || "N/A"}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">API Type</div>
                    <div className="info-value">{product.apiType || "N/A"}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Country</div>
                    <div className="info-value">
                      {product.country || product.region || "Global"}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Created Date</div>
                    <div className="info-value">
                      {product.createdAt
                        ? new Date(product.createdAt).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Last Updated</div>
                    <div className="info-value">
                      {product.updatedAt
                        ? new Date(product.updatedAt).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "terms" && (
              <div className="tab-terms">
                <h3>Terms & Conditions</h3>
                <pre className="terms-content">
                  {product.tnc ||
                    product.terms ||
                    "No terms and conditions specified for this product."}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Buy Modal */}
        {showBuyModal && (
          <BuyProductModal
            product={product}
            isOpen={showBuyModal}
            onClose={() => {
              setShowBuyModal(false);
              setSelectedDenomination(null);
            }}
            onOrderCreated={handleOrderCreated}
            preSelectedDenomination={selectedDenomination}
            walletBalance={walletBalance}
          />
        )}
      </div>
    </div>
  );
}
