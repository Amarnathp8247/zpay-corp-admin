// src/components/dashboard/BuyProduct.jsx
import { useState, useEffect, useCallback } from "react";
import ResellerProductService from "../../services/product.service";
import ResellerOrderService from "../../services/order.service";
import "./BuyProduct.css";

export default function BuyProductModal({
  product,
  isOpen,
  onClose,
  onOrderCreated,
  preSelectedDenomination,
  walletBalance,
}) {
  // Early return BEFORE any hooks
  if (!isOpen) {
    return null;
  }

  const [selectedDenominations, setSelectedDenominations] = useState({});
  const [denominations, setDenominations] = useState([]);
  const [availabilityErrors, setAvailabilityErrors] = useState({});
  const [orderError, setOrderError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [loadingDenominations, setLoadingDenominations] = useState(true);
  const [customAmounts, setCustomAmounts] = useState({});

  // Helper functions
  const calculateItemTotal = (denomination, quantity, customAmt = "") => {
    if (!denomination) return 0;

    let price = 0;
    if (denomination.finalAmount !== undefined) {
      price = denomination.finalAmount;
    } else if (denomination.convertedAmount !== undefined) {
      price = denomination.convertedAmount;
    } else if (denomination.amount !== undefined) {
      price = denomination.amount;
    }

    const priceNum = typeof price === "string" ? parseFloat(price) : price;

    if (isNaN(priceNum)) {
      return 0;
    }

    let finalPrice = priceNum;
    if (
      (denomination.denomType === "RANGE" ||
        denomination.denomType === "CUSTOM") &&
      customAmt
    ) {
      const customPrice = parseFloat(customAmt);
      if (!isNaN(customPrice)) {
        finalPrice = customPrice;
      }
    }

    return finalPrice * quantity;
  };

  const calculateOrderSummary = () => {
    let subtotal = 0;
    let baseTotal = 0;
    let totalCommission = 0;
    const items = [];

    Object.keys(selectedDenominations).forEach((denomId) => {
      const denom = denominations.find((d) => d.id === denomId);
      const quantity = selectedDenominations[denomId];

      if (denom && quantity > 0) {
        const customAmt = customAmounts[denomId];
        const itemTotal = calculateItemTotal(denom, quantity, customAmt);
        subtotal += itemTotal;

        // Calculate commission if available
        const commission = denom.commission || 0;
        const baseAmount =
          denom.baseAmount || denom.originalAmount || denom.amount || 0;
        totalCommission += commission * quantity;
        baseTotal += baseAmount * quantity;

        items.push({
          id: denom.id,
          amount: denom.amount,
          finalAmount: denom.finalAmount || denom.convertedAmount,
          originalAmount: denom.originalAmount,
          baseAmount: denom.baseAmount,
          currency: denom.currency,
          convertedCurrency: denom.convertedCurrency,
          commission: denom.commission,
          commissionRate: denom.commissionRate,
          exchangeRate: denom.exchangeRate,
          quantity,
          customAmount: customAmt,
          itemTotal,
          isConverted: denom.isConverted || false,
          hasCommission: denom.hasCommission || false,
        });
      }
    });

    const currency = denominations[0]?.convertedCurrency || "USD";
    const availableBalance = walletBalance?.totalBalance || 0;
    const canProceed = availableBalance >= subtotal;
    const shortfall = canProceed ? 0 : subtotal - availableBalance;

    return {
      subtotal,
      total: subtotal,
      baseTotal,
      totalCommission,
      currency,
      items,
      canProceed,
      availableBalance,
      shortfall,
      itemsCount: items.length,
    };
  };

  // Initialize denominations
  useEffect(() => {
    const initializeDenominations = async () => {
      if (product) {
        setLoadingDenominations(true);
        try {
          const availableDenoms =
            ResellerProductService.getAvailableDenominations(product) || [];
          setDenominations(availableDenoms);

          // Initialize selected denominations
          const initialSelected = {};
          if (
            preSelectedDenomination &&
            availableDenoms.find((d) => d.id === preSelectedDenomination.id)
          ) {
            initialSelected[preSelectedDenomination.id] = 1;
          }
          setSelectedDenominations(initialSelected);

          // Initialize custom amounts for range denominations
          const initialCustomAmounts = {};
          availableDenoms.forEach((denom) => {
            if (denom.denomType === "RANGE" || denom.denomType === "CUSTOM") {
              initialCustomAmounts[denom.id] =
                denom.minAmount || denom.amount || "";
            }
          });
          setCustomAmounts(initialCustomAmounts);
        } catch (error) {
          console.error("Error initializing denominations:", error);
        } finally {
          setLoadingDenominations(false);
        }
      }
    };

    initializeDenominations();
  }, [product, preSelectedDenomination]);

  // Handle quantity change for a denomination
  const handleQuantityChange = (denomId, newQty) => {
    const qty = Math.max(0, newQty);
    setSelectedDenominations((prev) => ({
      ...prev,
      [denomId]: qty,
    }));

    // Clear availability error for this denomination
    if (availabilityErrors[denomId]) {
      setAvailabilityErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[denomId];
        return newErrors;
      });
    }
  };

  // Handle custom amount change
  const handleCustomAmountChange = (denomId, value) => {
    setCustomAmounts((prev) => ({
      ...prev,
      [denomId]: value,
    }));

    const denom = denominations.find((d) => d.id === denomId);
    if (
      denom &&
      (denom.denomType === "RANGE" || denom.denomType === "CUSTOM")
    ) {
      const customPrice = parseFloat(value) || 0;
      const min = denom.minAmount ? parseFloat(denom.minAmount) : 0;
      const max = denom.maxAmount ? parseFloat(denom.maxAmount) : Infinity;

      if (value && customPrice < min) {
        setAvailabilityErrors((prev) => ({
          ...prev,
          [denomId]: `Amount must be at least ${min}`,
        }));
      } else if (value && customPrice > max) {
        setAvailabilityErrors((prev) => ({
          ...prev,
          [denomId]: `Amount cannot exceed ${max}`,
        }));
      } else if (availabilityErrors[denomId]) {
        setAvailabilityErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[denomId];
          return newErrors;
        });
      }
    }
  };

  // Check availability for a denomination
  const checkDenominationAvailability = (denomination, quantity) => {
    try {
      if (!denomination) return;

      if (
        denomination.stockCount !== undefined &&
        denomination.stockCount < quantity
      ) {
        setAvailabilityErrors((prev) => ({
          ...prev,
          [denomination.id]: `Only ${denomination.stockCount} available in stock`,
        }));
        return false;
      }

      return true;
    } catch (error) {
      console.error("Availability check error:", error);
      setAvailabilityErrors((prev) => ({
        ...prev,
        [denomination.id]: "Could not check availability",
      }));
      return false;
    }
  };

  // Format price
  const formatPrice = (amount, currency = "USD") => {
    return ResellerProductService.formatPrice(amount, currency);
  };

  // Format price number without currency symbol
  const formatPriceNumber = (amount) => {
    if (!amount && amount !== 0) return "0.00";
    const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(amountNum)) return "0.00";
    return amountNum.toFixed(4);
  };

  // Get currency symbol
  const getCurrencySymbol = (currencyCode) => {
    const symbols = {
      USD: "$",
      HKD: "HK$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      CNY: "¥",
      INR: "₹",
    };
    return symbols[currencyCode] || currencyCode;
  };

  // Close modal on ESC key
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Handle create order
  const handleCreateOrder = async () => {
    try {
      // Validate at least one denomination selected
      const selectedItems = Object.keys(selectedDenominations).filter(
        (id) => selectedDenominations[id] > 0
      );

      if (selectedItems.length === 0) {
        setOrderError("Please select at least one denomination");
        return;
      }

      const orderSummary = calculateOrderSummary();

      if (!orderSummary.canProceed) {
        setOrderError("Insufficient wallet balance");
        return;
      }

      // Check availability for all selected denominations
      for (const denomId of selectedItems) {
        const denom = denominations.find((d) => d.id === denomId);
        const quantity = selectedDenominations[denomId];

        if (!checkDenominationAvailability(denom, quantity)) {
          setOrderError("Some items are not available in requested quantity");
          return;
        }
      }

      setCreatingOrder(true);
      setOrderError("");

      // Prepare order items
      const orderItems = selectedItems.map((denomId) => {
        const denom = denominations.find((d) => d.id === denomId);
        const quantity = selectedDenominations[denomId];
        const customAmt = customAmounts[denomId];

        return {
          productId: product.id,
          denominationId: denomId,
          quantity: quantity,
          ...((denom.denomType === "RANGE" || denom.denomType === "CUSTOM") &&
            customAmt && {
              customAmount: parseFloat(customAmt),
            }),
        };
      });

      const orderData = {
        items: orderItems,
        targetCurrency: product.displayCurrency || "USD",
      };

      const result = await ResellerOrderService.createOrder(orderData);

      if (result.success) {
        if (onOrderCreated) {
          onOrderCreated(result);
        }
        onClose();
      } else {
        setOrderError(result.message || "Failed to create order");
      }
    } catch (error) {
      console.error("❌ Order creation error:", error);
      setOrderError(
        error.message || "An error occurred while creating the order"
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  // Get brand name
  const getBrandName = () => {
    if (!product?.brand) return "N/A";

    if (typeof product.brand === "object" && product.brand !== null) {
      return product.brand.name || product.brand.id || "N/A";
    }

    if (typeof product.brand === "string") {
      return product.brand;
    }

    return "N/A";
  };

  // Calculate current order summary
  const orderSummary = calculateOrderSummary();

  return (
    <>
      {/* Modal Overlay */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Modal Container */}
      <div className="modal-container">
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="modal-header">
            <div className="modal-header-content">
              <h2 className="modal-title">Buy {product?.name || "Product"}</h2>
              <button
                className="modal-close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Product Info */}
            <div className="modal-product-info">
              <div className="product-info-item">
                <span className="product-info-label">Brand:</span>
                <span className="product-info-value">{getBrandName()}</span>
              </div>
              <div className="product-info-item">
                <span className="product-info-label">Product:</span>
                <span className="product-info-value">
                  {product?.name || "Product Name"}
                </span>
              </div>
              <div className="product-info-item">
                <span className="product-info-label">Wallet Balance:</span>
                <span className="product-info-value wallet-balance-value">
                  {formatPrice(
                    walletBalance?.totalBalance || 0,
                    walletBalance?.currency || "USD"
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Body - Two Column Layout */}
          <div className="modal-body two-column-layout">
            {/* Left Column - Denominations Table */}
            <div className="left-column">
              <div className="section-header">
                <h3 className="section-title">Available Denominations</h3>
                <div className="section-subtitle">
                  Select denominations and quantities
                </div>
              </div>

              {loadingDenominations ? (
                <div className="loading-denominations">
                  <div className="spinner"></div>
                  <p>Loading denominations...</p>
                </div>
              ) : denominations.length === 0 ? (
                <div className="no-denominations">
                  <p>No denominations available for this product.</p>
                </div>
              ) : (
                <div className="denominations-table-container">
                  <table className="denominations-table">
                    <thead>
                      <tr>
                        <th className="denom-column">Denomination</th>
                        <th className="discount-column">Discount</th>
                        <th className="quantity-column">Quantity</th>
                        <th className="total-column">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {denominations.map((denom) => {
                        const isOutOfStock = denom.stockCount === 0;
                        const quantity = selectedDenominations[denom.id] || 0;
                        const customAmount = customAmounts[denom.id] || "";
                        const isRange =
                          denom.denomType === "RANGE" ||
                          denom.denomType === "CUSTOM";

                        // Get display amounts
                        const originalAmount =
                          denom.originalAmount || denom.amount || 0;
                        const convertedAmount =
                          denom.convertedAmount ||
                          denom.finalAmount ||
                          denom.amount ||
                          0;
                        const displayCurrency =
                          denom.convertedCurrency || denom.currency || "USD";
                        const originalCurrency =
                          denom.originalCurrency || "USD";

                        // Calculate discount percentage
                        const discountAmount = denom.discountAmount || 0;
                        const discountPercentage = denom.discount
                          ? (parseFloat(denom.discount) * 100).toFixed(1)
                          : denom.hasDiscount
                          ? "Discount"
                          : "0";

                        const itemTotal = calculateItemTotal(
                          denom,
                          quantity,
                          customAmount
                        );

                        return (
                          <tr
                            key={denom.id}
                            className={`denomination-row ${
                              isOutOfStock ? "out-of-stock" : ""
                            }`}
                          >
                            {/* Denomination Column */}
                            <td className="denom-column">
                              <div className="denomination-info">
                                <div className="denomination-main">
                                  <span className="original-amount">
                                    {getCurrencySymbol(originalCurrency)}
                                    {formatPriceNumber(originalAmount)}
                                  </span>
                                  <span className="original-currency">
                                    {originalCurrency}
                                  </span>
                                </div>
                                {denom.isConverted && (
                                  <div className="conversion-info">
                                    <span className="converted-to">→</span>
                                    <span className="converted-amount">
                                      {getCurrencySymbol(displayCurrency)}
                                      {formatPriceNumber(convertedAmount)}
                                    </span>
                                    <span className="converted-currency">
                                      {displayCurrency}
                                    </span>
                                  </div>
                                )}
                                {isRange && (
                                  <div className="range-info">
                                    <span className="range-label">
                                      Custom Range:
                                    </span>
                                    <span className="range-values">
                                      {denom.minAmount || 0} -{" "}
                                      {denom.maxAmount || "No limit"}{" "}
                                      {displayCurrency}
                                    </span>
                                  </div>
                                )}
                               
                                
                              </div>
                            </td>

                            {/* Discount Column */}
                            <td className="discount-column">
                              {denom.hasDiscount ? (
                                <div className="discount-info">
                                  <div className="discount-badge">
                                    -{discountPercentage}%
                                  </div>
                                  <div className="discount-amount">
                                    Save {getCurrencySymbol(displayCurrency)}
                                    {formatPriceNumber(discountAmount || 0)}
                                  </div>
                                </div>
                              ) : (
                                <span className="no-discount">—</span>
                              )}
                            </td>

                            {/* Quantity Column */}
                            <td className="quantity-column">
                              {!isOutOfStock ? (
                                <div className="quantity-controls">
                                  <button
                                    className="quantity-btn minus"
                                    onClick={() =>
                                      handleQuantityChange(
                                        denom.id,
                                        quantity - 1
                                      )
                                    }
                                    disabled={quantity <= 0}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) =>
                                      handleQuantityChange(
                                        denom.id,
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="quantity-input"
                                    min="0"
                                    max={denom.stockCount || undefined}
                                  />
                                  <button
                                    className="quantity-btn plus"
                                    onClick={() =>
                                      handleQuantityChange(
                                        denom.id,
                                        quantity + 1
                                      )
                                    }
                                    disabled={
                                      denom.stockCount &&
                                      quantity >= denom.stockCount
                                    }
                                  >
                                    +
                                  </button>
                                  {isRange && (
                                    <div className="custom-amount-wrapper">
                                      <input
                                        type="number"
                                        value={customAmount}
                                        onChange={(e) =>
                                          handleCustomAmountChange(
                                            denom.id,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Custom amount"
                                        className="custom-amount-input"
                                        min={denom.minAmount || 0}
                                        max={denom.maxAmount || undefined}
                                        step={denom.stepAmount || 1}
                                      />
                                      <span className="custom-currency">
                                        {displayCurrency}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="unavailable">Unavailable</span>
                              )}
                            </td>

                            {/* Total Column */}
                            <td className="total-column">
                              {quantity > 0 ? (
                                <div className="item-total-info">
                                  <div className="unit-price-info">
                                    <span className="unit-price">
                                      {isRange && customAmount ? (
                                        <>
                                          {getCurrencySymbol(displayCurrency)}
                                          {formatPriceNumber(
                                            parseFloat(customAmount)
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          {getCurrencySymbol(displayCurrency)}
                                          {formatPriceNumber(convertedAmount)}
                                        </>
                                      )}
                                    </span>
                                    <span className="per-unit">each</span>
                                  </div>
                                  <div className="total-amount-display">
                                    <span className="total-label">Total:</span>
                                    <span className="total-amount">
                                      {getCurrencySymbol(displayCurrency)}
                                      {formatPriceNumber(itemTotal)}
                                    </span>
                                  </div>
                                  {quantity > 1 && (
                                    <div className="quantity-summary">
                                      {quantity} ×{" "}
                                      {getCurrencySymbol(displayCurrency)}
                                      {formatPriceNumber(
                                        isRange && customAmount
                                          ? parseFloat(customAmount)
                                          : convertedAmount
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="no-selection">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Availability Errors */}
              {Object.keys(availabilityErrors).length > 0 && (
                <div className="availability-errors">
                  <h4>Availability Issues:</h4>
                  {Object.entries(availabilityErrors).map(
                    ([denomId, error]) => {
                      const denom = denominations.find((d) => d.id === denomId);
                      return (
                        <div key={denomId} className="availability-error">
                          <span className="error-icon">⚠️</span>
                          <span className="error-text">
                            {denom?.originalAmount || "Denomination"}: {error}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            {/* Right Column - Order Summary */}
            <div className="right-column">
              <div className="order-summary-card">
                <div className="summary-header">
                  <h3 className="summary-title">Order Summary</h3>
                  <div className="items-count">
                    {orderSummary.itemsCount} item
                    {orderSummary.itemsCount !== 1 ? "s" : ""} selected
                  </div>
                </div>

                {/* Order Items List */}
                <div className="order-items-list">
                  {orderSummary.items.length > 0 ? (
                    orderSummary.items.map((item, index) => (
                      <div key={item.id} className="order-item">
                        <div className="item-header">
                          <span className="item-amount">
                            {getCurrencySymbol(
                              item.convertedCurrency || item.currency
                            )}
                            {formatPriceNumber(
                              item.customAmount ||
                                item.finalAmount ||
                                item.amount
                            )}
                          </span>
                          <span className="item-quantity">
                            × {item.quantity}
                          </span>
                        </div>

                        <div className="item-details">
                          {item.isConverted && (
                            <div className="conversion-detail">
                              <span className="detail-label">
                                Converted from:
                              </span>
                              <span className="detail-value">
                                {getCurrencySymbol(item.currency)}
                                {formatPriceNumber(item.originalAmount)}
                              </span>
                            </div>
                          )}
                          {item.hasCommission && item.commission > 0 && (
                            <div className="commission-detail">
                              <span className="detail-label">Commission:</span>
                              <span className="detail-value">
                                {getCurrencySymbol(item.convertedCurrency)}
                                {formatPriceNumber(
                                  item.commission * item.quantity
                                )}
                                {item.commissionRate &&
                                  ` (${(item.commissionRate * 100).toFixed(
                                    2
                                  )}%)`}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="item-total">
                          <span className="total-label">Item Total:</span>
                          <span className="total-value">
                            {getCurrencySymbol(
                              item.convertedCurrency || item.currency
                            )}
                            {formatPriceNumber(item.itemTotal)}
                          </span>
                        </div>

                        {index < orderSummary.items.length - 1 && (
                          <div className="item-divider"></div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="no-items-selected">
                      <p>No items selected yet</p>
                      <p className="hint">
                        Select denominations from the table
                      </p>
                    </div>
                  )}
                </div>

                {/* Order Totals */}
                <div className="order-totals">
                  <div className="total-row">
                    <span className="total-label">Subtotal:</span>
                    <span className="total-value">
                      {getCurrencySymbol(orderSummary.currency)}
                      {formatPriceNumber(orderSummary.subtotal)}
                    </span>
                  </div>

                  {orderSummary.totalCommission > 0 && (
                    <div className="total-row commission-row">
                      <span className="total-label">
                        Commission:
                        <span className="commission-rate">
                          (
                          {orderSummary.totalCommission > 0
                            ? (
                                (orderSummary.totalCommission /
                                  orderSummary.baseTotal) *
                                100
                              ).toFixed(2)
                            : "0.00"}
                          %)
                        </span>
                      </span>
                      <span className="total-value">
                        {getCurrencySymbol(orderSummary.currency)}
                        {formatPriceNumber(orderSummary.totalCommission)}
                      </span>
                    </div>
                  )}

                  <div className="total-row grand-total">
                    <span className="total-label">Total Amount:</span>
                    <span className="total-value">
                      {getCurrencySymbol(orderSummary.currency)}
                      {formatPriceNumber(orderSummary.total)}
                    </span>
                  </div>
                </div>

                {/* Wallet Balance Check */}
                <div className="wallet-balance-check">
                  <div className="balance-row">
                    <span className="balance-label">Available Balance:</span>
                    <span className="balance-value">
                      {getCurrencySymbol(walletBalance?.currency || "USD")}
                      {formatPriceNumber(orderSummary.availableBalance)}
                    </span>
                  </div>

                  {!orderSummary.canProceed && orderSummary.shortfall > 0 && (
                    <div className="balance-row insufficient">
                      <span className="balance-label">Shortfall:</span>
                      <span className="balance-value">
                        -{getCurrencySymbol(orderSummary.currency)}
                        {formatPriceNumber(orderSummary.shortfall)}
                      </span>
                    </div>
                  )}

                  <div className="balance-row status">
                    <span className="balance-label">Status:</span>
                    <span
                      className={`balance-value ${
                        orderSummary.canProceed ? "success" : "error"
                      }`}
                    >
                      {orderSummary.canProceed
                        ? "✓ Sufficient Balance"
                        : "✗ Insufficient Balance"}
                    </span>
                  </div>
                </div>

                {/* Error Message */}
                {orderError && (
                  <div className="order-error-message">
                    <span className="error-icon">❌</span>
                    <span className="error-text">{orderError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="summary-actions">
                  <button
                    className="cancel-btn"
                    onClick={onClose}
                    disabled={creatingOrder}
                  >
                    Cancel
                  </button>
                  <button
                    className="checkout-btn"
                    onClick={handleCreateOrder}
                    disabled={
                      creatingOrder ||
                      orderSummary.itemsCount === 0 ||
                      !orderSummary.canProceed ||
                      Object.keys(availabilityErrors).length > 0
                    }
                  >
                    {creatingOrder ? (
                      <>
                        <span className="spinner"></span>
                        Processing...
                      </>
                    ) : (
                      "Checkout Now"
                    )}
                  </button>
                </div>

               
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
