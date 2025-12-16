// src/components/dashboard/BuyProduct.jsx
import { useState, useEffect, useContext } from "react";
import ResellerProductService from "../../services/product.service";
import ResellerOrderService from "../../services/order.service";
import { AuthContext } from "../../context/AuthContext";
import "./BuyProduct.css";

export default function BuyProductModal({
  product,
  isOpen,
  onClose,
  onOrderCreated,
}) {
  const { user } = useContext(AuthContext) || {};
  const [selectedDenominations, setSelectedDenominations] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [walletBalance, setWalletBalance] = useState(null);
  const [availabilityChecks, setAvailabilityChecks] = useState({});
  const [totalPrice, setTotalPrice] = useState(0);
  const [canProceed, setCanProceed] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    try {
      const result = await ResellerProductService.getWalletBalance();
      if (result?.success) {
        setWalletBalance(result.balance || result);
      }
    } catch (err) {
      console.warn("Could not fetch wallet balance:", err);
      setWalletBalance({
        success: true,
        balance: 0,
        currency: "USD",
        currencySymbol: "$",
        isActive: false,
        lastUpdated: new Date().toISOString(),
        recentTransactions: [],
        summary: { availableBalance: 0, pendingTransactions: 0 }
      });
    }
  };

  // Check availability for denomination
  const checkDenominationAvailability = async (denominationId) => {
    try {
      // Get user info from context or localStorage
      const resellerId = user?.id || localStorage.getItem("resellerId") || localStorage.getItem("userId");
      const companyId = user?.companyId || localStorage.getItem("companyId");

      if (!resellerId || !companyId) {
        console.warn("Missing user information for availability check");
        setAvailabilityChecks((prev) => ({
          ...prev,
          [denominationId]: {
            available: false,
            error: "User information not available",
          },
        }));
        return false;
      }

      const result = await ResellerProductService.checkProductAvailability(
        product.id,
        denominationId,
        resellerId,
        companyId
      );

      setAvailabilityChecks((prev) => ({
        ...prev,
        [denominationId]: result,
      }));

      return result?.available || false;
    } catch (err) {
      console.error("Availability check error:", err);
      setAvailabilityChecks((prev) => ({
        ...prev,
        [denominationId]: {
          available: false,
          error: err.message || "Availability check failed",
        },
      }));
      return false;
    }
  };

  // Handle denomination selection
  const handleDenominationSelect = async (denomination) => {
    const denomId = denomination.id;
    const isSelected = selectedDenominations.some((d) => d.id === denomId);

    if (isSelected) {
      setSelectedDenominations((prev) => prev.filter((d) => d.id !== denomId));
      setQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[denomId];
        return newQuantities;
      });
      setAvailabilityChecks((prev) => {
        const newChecks = { ...prev };
        delete newChecks[denomId];
        return newChecks;
      });
    } else {
      setSelectedDenominations((prev) => [...prev, denomination]);
      setQuantities((prev) => ({
        ...prev,
        [denomId]: 1,
      }));

      const isAvailable = await checkDenominationAvailability(denomId);
      if (!isAvailable) {
        setError("Selected denomination is not available. Please choose another.");
      } else {
        setError(null);
      }
    }
  };

  // Handle quantity change
  const handleQuantityChange = (denominationId, value) => {
    const newQuantity = parseInt(value);
    const denomination = selectedDenominations.find(
      (d) => d.id === denominationId
    );

    if (isNaN(newQuantity) || newQuantity < 1) {
      setQuantities((prev) => ({ ...prev, [denominationId]: 1 }));
    } else if (denomination?.maxQuantity && newQuantity > denomination.maxQuantity) {
      setQuantities((prev) => ({
        ...prev,
        [denominationId]: denomination.maxQuantity,
      }));
      setError(`Maximum quantity is ${denomination.maxQuantity}`);
    } else if (denomination?.stockCount && newQuantity > denomination.stockCount) {
      setQuantities((prev) => ({
        ...prev,
        [denominationId]: denomination.stockCount,
      }));
      setError(`Only ${denomination.stockCount} items available in stock`);
    } else {
      setQuantities((prev) => ({ ...prev, [denominationId]: newQuantity }));
      setError(null);
    }
  };

  // Calculate item total
  const calculateItemTotal = (denomination, quantity) => {
    const basePrice = denomination.finalAmount || denomination.convertedAmount || denomination.amount || 0;
    return basePrice * (quantity || 1);
  };

  // Calculate total price
  const calculateTotalPrice = () => {
    return selectedDenominations.reduce((total, denomination) => {
      const quantity = quantities[denomination.id] || 1;
      const itemTotal = calculateItemTotal(denomination, quantity);
      return total + itemTotal;
    }, 0);
  };

  // Check if all selected denominations are available
  const checkAllAvailable = () => {
    return selectedDenominations.every((denom) => {
      const check = availabilityChecks[denom.id];
      return check?.available === true;
    });
  };

  // Check if user has sufficient balance
  const hasSufficientBalance = () => {
    if (!walletBalance || walletBalance.balance === undefined || walletBalance.balance === null) {
      return false;
    }
    const balance = typeof walletBalance.balance === 'string' ? parseFloat(walletBalance.balance) : walletBalance.balance;
    return balance >= totalPrice;
  };

  // Validate if user can proceed
  const validateProceed = () => {
    if (selectedDenominations.length === 0) {
      setError("Please select at least one denomination");
      return false;
    }
    if (!checkAllAvailable()) {
      setError("Some selected denominations are not available");
      return false;
    }
    if (!hasSufficientBalance()) {
      setError("Insufficient wallet balance");
      return false;
    }
    if (totalPrice <= 0) {
      setError("Invalid total price");
      return false;
    }
    setError(null);
    return true;
  };

  // Handle proceed to checkout - Creates order directly
  const handleProceed = async () => {
    if (!validateProceed()) {
      return;
    }

    setIsCreatingOrder(true);
    setError(null);

    try {
      // Format items for order creation
      const items = selectedDenominations.map((denomination) => {
        const check = availabilityChecks[denomination.id] || {};
        return {
          productId: product.id,
          denominationId: denomination.id,
          quantity: quantities[denomination.id] || 1,
          amount: denomination.finalAmount || denomination.convertedAmount || denomination.amount,
          unitPrice: check.amount || denomination.amount
        };
      });

      console.log("Creating order with items:", items);

      // Create order using OrderService
      const orderData = {
        items: items.map(item => ({
          productId: item.productId,
          denominationId: item.denominationId,
          quantity: item.quantity
        })),
        currency: walletBalance.currency || "USD",
        customerEmail: user?.email || "",
        notes: `Order for ${product.name}`
      };

      console.log("Order data being sent:", orderData);

      const result = await ResellerOrderService.createOrder(orderData);

      if (result?.success) {
        console.log("✅ Order created successfully:", result);

        if (onOrderCreated) {
          onOrderCreated(result);
        }

        onClose();

        // Show success message
        alert(`Order created successfully! Order ID: ${result.data?.invoiceId || result.invoiceId || result.orderNumber || "N/A"}`);

        // Refresh wallet balance
        await fetchWalletBalance();
      } else {
        throw new Error(result?.message || result?.error || "Failed to create order");
      }
    } catch (err) {
      console.error("❌ Order creation error:", err);
      setError(err.message || "Failed to process your order. Please try again.");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Initialize modal
  useEffect(() => {
    if (isOpen && product) {
      console.log("🔄 BuyProductModal initialized with product:", product.name);
      
      fetchWalletBalance();
      setSelectedDenominations([]);
      setQuantities({});
      setError(null);
      setAvailabilityChecks({});

      if (product.denominations?.length === 0) {
        setError("No denominations available for this product");
      }
    }
  }, [isOpen, product]);

  // Update total price
  useEffect(() => {
    const newTotal = calculateTotalPrice();
    setTotalPrice(newTotal);
  }, [selectedDenominations, quantities]);

  // Update canProceed status
  useEffect(() => {
    const canProceedStatus = validateProceed();
    setCanProceed(canProceedStatus);
  }, [selectedDenominations, quantities, availabilityChecks, walletBalance, totalPrice]);

  if (!isOpen || !product) return null;

  const availableDenominations = ResellerProductService.getAvailableDenominations(product);
  const currency = product.displayCurrency || walletBalance?.currency || "USD";

  return (
    <div className="buy-modal-overlay" onClick={onClose}>
      <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h2>Buy {product.name}</h2>
          <button
            className="close-btn"
            onClick={onClose}
            disabled={isCreatingOrder}
          >
            ×
          </button>
        </div>

        {/* Product Info */}
        <div className="product-summary">
          <div className="product-image">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0].url}
                alt={product.name}
                className="product-img"
              />
            ) : (
              <div className="image-placeholder">
                {product.name?.charAt(0)?.toUpperCase() || "P"}
              </div>
            )}
          </div>
          <div className="product-info">
            <h3>{product.name}</h3>
            <p className="product-sku">SKU: {product.sku}</p>
            <p className="product-brand">
              Brand: {product.brand?.name || "Unknown"}
            </p>
            <p className="product-stock">
              Status: {ResellerProductService.getProductStockStatus(product)}
            </p>
          </div>
        </div>

        {/* Wallet Balance */}
        <div className="wallet-section">
          <div className="wallet-label">Your Balance:</div>
          <div className="wallet-amount">
            {ResellerProductService.formatPrice(
              walletBalance?.balance || walletBalance?.availableBalance || 0,
              walletBalance?.currency || currency
            )}
          </div>
          {!hasSufficientBalance() && totalPrice > 0 && (
            <div className="insufficient-funds">
              ⚠️ Insufficient funds for this purchase
            </div>
          )}
        </div>

        {/* Denomination Selection */}
        <div className="denomination-section">
          <h3>Select Denominations</h3>
          <p className="section-subtitle">
            Select one or more denominations to purchase
          </p>
          {availableDenominations.length > 0 ? (
            <div className="denomination-grid">
              {availableDenominations.map((denom, index) => {
                const isSelected = selectedDenominations.some(
                  (d) => d.id === denom.id
                );
                const isOutOfStock = denom.stockCount === 0;
                const availability = availabilityChecks[denom.id];
                const isUnavailable = availability?.available === false && !isOutOfStock;

                return (
                  <div
                    key={`${denom.id}-${index}`}
                    className={`denomination-card ${isSelected ? "selected" : ""} ${isOutOfStock ? "out-of-stock" : ""} ${isUnavailable ? "unavailable" : ""}`}
                    onClick={() => !isOutOfStock && !isUnavailable && handleDenominationSelect(denom)}
                  >
                    <div className="denomination-header">
                      <input
                        type="checkbox"
                        className="denomination-checkbox"
                        checked={isSelected}
                        onChange={() => !isOutOfStock && !isUnavailable && handleDenominationSelect(denom)}
                        disabled={isOutOfStock || isUnavailable}
                      />
                      <div className="denomination-info">
                        <div className="denom-amount">
                          {ResellerProductService.formatPrice(
                            denom.finalAmount || denom.convertedAmount || denom.amount,
                            currency
                          )}
                        </div>
                        {denom.discountAmount > 0 && (
                          <span className="denom-discount-badge">
                            Save {ResellerProductService.formatPrice(denom.discountAmount, currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="quantity-section">
                        <div className="quantity-controls">
                          <button
                            className="qty-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuantityChange(denom.id, (quantities[denom.id] || 1) - 1);
                            }}
                            disabled={(quantities[denom.id] || 1) <= 1}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            className="qty-input"
                            value={quantities[denom.id] || 1}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleQuantityChange(denom.id, e.target.value);
                            }}
                            min="1"
                            max={denom.stockCount || denom.maxQuantity || 100}
                          />
                          <button
                            className="qty-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuantityChange(denom.id, (quantities[denom.id] || 1) + 1);
                            }}
                            disabled={denom.stockCount && (quantities[denom.id] || 1) >= denom.stockCount}
                          >
                            +
                          </button>
                        </div>
                        <div className="item-total">
                          Total: {ResellerProductService.formatPrice(
                            calculateItemTotal(denom, quantities[denom.id] || 1),
                            currency
                          )}
                        </div>
                      </div>
                    )}

                    <div className="denomination-footer">
                      <div className="stock-info">
                        {isOutOfStock ? (
                          <span className="out-of-stock-badge">Out of Stock</span>
                        ) : isUnavailable ? (
                          <span className="unavailable-badge">Unavailable</span>
                        ) : (
                          <span>Stock: {denom.stockCount || "Available"}</span>
                        )}
                      </div>
                      {availability?.message && !isOutOfStock && !isUnavailable && (
                        <span className="availability-message">
                          {availability.message}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-denominations">
              <p>No denominations available for this product.</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && <div className="error-message">⚠️ {error}</div>}

        {/* Total & Actions */}
        <div className="total-section">
          <div className="total-label">Total Amount:</div>
          <div className="total-amount">
            {ResellerProductService.formatPrice(totalPrice, currency)}
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={isCreatingOrder}
          >
            Cancel
          </button>
          <button
            className={`btn-primary ${!canProceed ? "disabled" : ""}`}
            onClick={handleProceed}
            disabled={!canProceed || isCreatingOrder}
          >
            {isCreatingOrder ? (
              <>
                <span className="spinner-small"></span>
                Creating Order...
              </>
            ) : (
              `Create Order (${selectedDenominations.length} items)`
            )}
          </button>
        </div>

        {/* Selection Summary */}
        {selectedDenominations.length > 0 && (
          <div className="selection-summary">
            <h4>Order Summary:</h4>
            <div className="selected-items">
              {selectedDenominations.map((denom) => (
                <div key={denom.id} className="selected-item">
                  <span className="item-name">
                    {ResellerProductService.formatPrice(
                      denom.finalAmount || denom.convertedAmount || denom.amount,
                      currency
                    )}
                  </span>
                  <span className="item-quantity">
                    × {quantities[denom.id] || 1}
                  </span>
                  <span className="item-total-small">
                    ={" "}
                    {ResellerProductService.formatPrice(
                      calculateItemTotal(denom, quantities[denom.id] || 1),
                      currency
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="summary-total">
              <strong>Grand Total:</strong>
              <strong>
                {ResellerProductService.formatPrice(totalPrice, currency)}
              </strong>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isCreatingOrder && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Processing your order...</p>
          </div>
        )}
      </div>
    </div>
  );
}