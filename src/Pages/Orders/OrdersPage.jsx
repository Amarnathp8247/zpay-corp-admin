// src/pages/OrdersPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Collapse,
  Switch,
  FormControlLabel,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Cancel as CancelIcon,
  Receipt as ReceiptIcon,
  CreditCard as CreditCardIcon,
  QrCode as QrCodeIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  AttachMoney as MoneyIcon,
  Inventory as InventoryIcon,
  BarChart as ChartIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CalendarToday as CalendarIcon,
  AccountBalanceWallet as WalletIcon,
  LocalOffer as DiscountIcon,
  Language as LanguageIcon,
  VerifiedUser as VerifiedIcon,
  Lock as LockIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, startOfMonth, endOfMonth, isValid as isValidDate } from 'date-fns';
import ResellerOrderService from '../../services/order.service';
import { useSnackbar } from 'notistack';
import './OrdersPage.css';

// CSS file might not exist, create a basic one if needed
// Create OrdersPage.css with minimal styles if it doesn't exist

const isValidUUID = (id) => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Order status colors
const STATUS_COLORS = {
  PENDING: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
  FAILED: 'error'
};

// Order status icons
const STATUS_ICONS = {
  PENDING: <WarningIcon />,
  PROCESSING: <TimelineIcon />,
  COMPLETED: <CheckIcon />,
  CANCELLED: <CancelIcon />,
  FAILED: <ErrorIcon />
};

// Expandable Order Row Component
const ExpandableOrderRow = ({ order, onViewDetails, onCancelOrder }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Format order for display
  const formattedOrder = React.useMemo(() => {
    return ResellerOrderService.formatOrderSummary(order) || order;
  }, [order]);
  
  return (
    <React.Fragment>
      <TableRow hover>
        <TableCell>
          <IconButton 
            size="small" 
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse order details" : "Expand order details"}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box display="flex" alignItems="center">
            <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Box>
              <Typography variant="body2" fontWeight="bold">
                {formattedOrder.orderNumber || 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formattedOrder.invoiceId || 'No invoice'}
              </Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell>
          <Chip
            icon={STATUS_ICONS[formattedOrder.status]}
            label={formattedOrder.status}
            color={STATUS_COLORS[formattedOrder.status]}
            size="small"
            variant="outlined"
          />
        </TableCell>
        <TableCell>
          {formattedOrder.createdAt ? (
            <>
              {new Date(formattedOrder.createdAt).toLocaleDateString()}
              <Typography variant="caption" display="block" color="text.secondary">
                {new Date(formattedOrder.createdAt).toLocaleTimeString()}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              N/A
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight="bold">
            {ResellerOrderService.formatPrice(
              formattedOrder.totalAmount, 
              formattedOrder.currency
            )}
          </Typography>
          {formattedOrder.discountApplied > 0 && (
            <Typography variant="caption" color="success.main">
              Saved {ResellerOrderService.formatPrice(
                formattedOrder.discountApplied, 
                formattedOrder.currency
              )}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Box display="flex" alignItems="center">
            <InventoryIcon sx={{ mr: 0.5, fontSize: 16 }} />
            <Typography variant="body2">
              {formattedOrder.itemCount || 0} item{formattedOrder.itemCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {formattedOrder.voucherCount || 0} voucher{formattedOrder.voucherCount !== 1 ? 's' : ''}
          </Typography>
        </TableCell>
        <TableCell>
          <Box display="flex" gap={1}>
            <Tooltip title="View Details">
              <IconButton
                size="small"
                color="primary"
                onClick={() => onViewDetails(formattedOrder)}
                aria-label={`View order ${formattedOrder.orderNumber}`}
              >
                <ViewIcon />
              </IconButton>
            </Tooltip>
            {ResellerOrderService.canCancelOrder(formattedOrder) && (
              <Tooltip title="Cancel Order">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onCancelOrder(formattedOrder)}
                  aria-label={`Cancel order ${formattedOrder.orderNumber}`}
                >
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Download Invoice">
              <IconButton 
                size="small" 
                color="secondary"
                aria-label={`Download invoice for order ${formattedOrder.orderNumber}`}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="h6" gutterBottom>
                Order Items
              </Typography>
              {formattedOrder.items && formattedOrder.items.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Denomination</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell>Vouchers</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ResellerOrderService.formatOrderItems(formattedOrder.items).map((item) => (
                      <TableRow key={item.id || `${item.productId}-${item.denominationId}`}>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            {item.productImage && (
                              <Avatar
                                src={item.productImage}
                                sx={{ width: 40, height: 40, mr: 2 }}
                                alt={item.productName}
                              />
                            )}
                            <Box>
                              <Typography variant="body2">
                                {item.productName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                SKU: {item.product?.sku || 'N/A'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ResellerOrderService.formatPrice(
                              item.denominationAmount,
                              formattedOrder.currency
                            )}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            {item.quantity}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {ResellerOrderService.formatPrice(item.unitPrice, formattedOrder.currency)}
                        </TableCell>
                        <TableCell align="right" fontWeight="bold">
                          {ResellerOrderService.formatPrice(item.totalPrice, formattedOrder.currency)}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {item.vouchers?.slice(0, 3).map((voucher) => (
                              <Chip
                                key={voucher.id}
                                label={voucher.code?.substring(0, 8) || 'N/A'}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ))}
                            {item.vouchers?.length > 3 && (
                              <Chip
                                label={`+${item.vouchers.length - 3} more`}
                                size="small"
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" py={2}>
                  No items found
                </Typography>
              )}
              <Box mt={2} display="flex" justifyContent="space-between">
                <Box>
                  {formattedOrder.customerEmail && (
                    <Box display="flex" alignItems="center" mb={0.5}>
                      <EmailIcon sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2">{formattedOrder.customerEmail}</Typography>
                    </Box>
                  )}
                  {formattedOrder.customerPhone && (
                    <Box display="flex" alignItems="center">
                      <PhoneIcon sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2">{formattedOrder.customerPhone}</Typography>
                    </Box>
                  )}
                </Box>
                <Button
                  size="small"
                  startIcon={<ReceiptIcon />}
                  onClick={() => onViewDetails(formattedOrder)}
                >
                  View Full Details
                </Button>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

// Order Details Modal
const OrderDetailsModal = ({ open, order, onClose, onCancel }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open && order) {
      fetchOrderDetails();
    } else {
      // Reset state when modal closes
      setOrderDetails(null);
      setVouchers([]);
      setActiveTab(0);
    }
  }, [open, order]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching order details for:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        isUUID: isValidUUID(order.id)
      });
      
      let result;
      try {
        // Try to get order by ID if it's a valid UUID
        if (order.id && isValidUUID(order.id)) {
          result = await ResellerOrderService.getOrderById(order.id);
        } else {
          // Otherwise, fetch by order number
          throw new Error('Invalid order ID format');
        }
      } catch (idError) {
        console.warn('Failed to fetch by ID, trying by order number:', idError.message);
        
        // If ID fails or is invalid, try to fetch by order number
        if (order.orderNumber) {
          const ordersResult = await ResellerOrderService.getOrders({
            orderNumber: order.orderNumber,
            limit: 1
          });
          
          if (ordersResult.success && ordersResult.orders.length > 0) {
            const foundOrder = ordersResult.orders[0];
            result = {
              success: true,
              order: foundOrder
            };
          } else {
            throw new Error('Order not found');
          }
        } else {
          throw idError;
        }
      }
      
      if (result.success) {
        const formattedOrder = result.order;
        setOrderDetails(formattedOrder);
        // Extract vouchers from order items
        const allVouchers = formattedOrder.items?.flatMap(item => 
          item.vouchers?.map(v => ({
            ...v,
            productName: item.productName
          })) || []
        ) || [];
        setVouchers(allVouchers);
      } else {
        throw new Error(result.message || 'Failed to fetch order');
      }
    } catch (error) {
      console.error('❌ Fetch order details error:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    try {
      const confirmed = window.confirm(
        'Are you sure you want to cancel this order? This action cannot be undone.'
      );
      if (!confirmed) return;

      const result = await ResellerOrderService.cancelOrder(order.id);
      if (result.success) {
        enqueueSnackbar('Order cancelled successfully', { variant: 'success' });
        onClose();
        if (onCancel) onCancel();
      }
    } catch (error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  };

  const handleExportVouchers = () => {
    if (vouchers.length === 0) {
      enqueueSnackbar('No vouchers to export', { variant: 'info' });
      return;
    }
    
    const csvContent = vouchers
      .map(v => `${v.code || ''},${v.pin || ''},${v.serial || ''},${v.status || ''},${v.productName || ''}`)
      .join('\n');
    const blob = new Blob([`Code,PIN,Serial,Status,Product\n${csvContent}`], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vouchers_${order.orderNumber}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!order) return null;

  const displayOrder = orderDetails || order;
  const timeline = ResellerOrderService.getOrderTimeline(displayOrder);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      aria-labelledby="order-details-dialog"
    >
      <DialogTitle id="order-details-dialog">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">
              Order {displayOrder.orderNumber || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Invoice: {displayOrder.invoiceId || 'No invoice'}
            </Typography>
          </Box>
          <Chip
            icon={STATUS_ICONS[displayOrder.status]}
            label={displayOrder.status}
            color={STATUS_COLORS[displayOrder.status]}
          />
        </Box>
      </DialogTitle>
      
      <Tabs 
        value={activeTab} 
        onChange={(e, val) => setActiveTab(val)}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Overview" />
        <Tab label="Items" />
        <Tab label="Vouchers" />
        <Tab label="Timeline" />
        <Tab label="Payment" />
      </Tabs>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {activeTab === 0 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Order Summary
                      </Typography>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography color="text.secondary">Subtotal:</Typography>
                        <Typography fontWeight="bold">
                          {ResellerOrderService.formatPrice(
                            displayOrder.pricingSummary?.subtotal || displayOrder.totalAmount,
                            displayOrder.currency
                          )}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography color="text.secondary">Discount:</Typography>
                        <Typography color="success.main" fontWeight="bold">
                          -{ResellerOrderService.formatPrice(
                            displayOrder.pricingSummary?.totalDiscount || displayOrder.discountApplied || 0,
                            displayOrder.currency
                          )}
                        </Typography>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Box display="flex" justifyContent="space-between" mb={2}>
                        <Typography variant="h6">Total:</Typography>
                        <Typography variant="h6" color="primary">
                          {ResellerOrderService.formatPrice(
                            displayOrder.totalAmount, 
                            displayOrder.currency
                          )}
                        </Typography>
                      </Box>
                      
                      <Box display="flex" alignItems="center" mb={2}>
                        <WalletIcon sx={{ mr: 1 }} />
                        <Typography variant="body2">
                          Paid from {displayOrder.currency || 'USD'} Wallet
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Customer Details
                      </Typography>
                      {displayOrder.customerEmail && (
                        <Box display="flex" alignItems="center" mb={1}>
                          <EmailIcon sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2">{displayOrder.customerEmail}</Typography>
                        </Box>
                      )}
                      {displayOrder.customerPhone && (
                        <Box display="flex" alignItems="center" mb={1}>
                          <PhoneIcon sx={{ mr: 1, fontSize: 16 }} />
                          <Typography variant="body2">{displayOrder.customerPhone}</Typography>
                        </Box>
                      )}
                      {displayOrder.notes && (
                        <Box mt={2}>
                          <Typography variant="subtitle2" gutterBottom>
                            Notes:
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {displayOrder.notes}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Quick Actions
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item>
                          <Button
                            variant="outlined"
                            startIcon={<PrintIcon />}
                            onClick={() => window.print()}
                          >
                            Print Invoice
                          </Button>
                        </Grid>
                        <Grid item>
                          <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={handleExportVouchers}
                            disabled={vouchers.length === 0}
                          >
                            Export Vouchers
                          </Button>
                        </Grid>
                        <Grid item>
                          <Button
                            variant="outlined"
                            startIcon={<EmailIcon />}
                            onClick={() => {
                              if (!displayOrder.customerEmail) {
                                enqueueSnackbar('No customer email available', { variant: 'warning' });
                                return;
                              }
                              const subject = `Order ${displayOrder.orderNumber} - Voucher Details`;
                              const body = `Order Number: ${displayOrder.orderNumber}\nInvoice: ${displayOrder.invoiceId}\n\nVoucher Details:\n\n${
                                vouchers.map(v => `Code: ${v.code}\nPIN: ${v.pin || 'N/A'}\nProduct: ${v.productName}\n`).join('\n')
                              }`;
                              window.location.href = `mailto:${displayOrder.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                            }}
                            disabled={!displayOrder.customerEmail || vouchers.length === 0}
                          >
                            Email Vouchers
                          </Button>
                        </Grid>
                        {ResellerOrderService.canCancelOrder(displayOrder) && (
                          <Grid item>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={handleCancelOrder}
                            >
                              Cancel Order
                            </Button>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {activeTab === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Order Items ({displayOrder.itemCount || 0})
                </Typography>
                {displayOrder.items && displayOrder.items.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell>Denomination</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Unit Price</TableCell>
                          <TableCell align="right">Discount</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ResellerOrderService.formatOrderItems(displayOrder.items).map((item) => (
                          <TableRow key={item.id || `${item.productId}-${item.denominationId}`} hover>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                {item.productImage && (
                                  <Avatar
                                    src={item.productImage}
                                    sx={{ width: 40, height: 40, mr: 2 }}
                                    alt={item.productName}
                                  />
                                )}
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {item.productName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    SKU: {item.product?.sku || 'N/A'}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={ResellerOrderService.formatPrice(
                                  item.denominationAmount,
                                  displayOrder.currency
                                )}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold">
                                {item.quantity}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {ResellerOrderService.formatPrice(item.unitPrice, displayOrder.currency)}
                              {item.originalUnitPrice > item.unitPrice && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  <s>{ResellerOrderService.formatPrice(item.originalUnitPrice, displayOrder.currency)}</s>
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {item.discountApplied > 0 && (
                                <>
                                  <Typography variant="body2" color="success.main">
                                    -{ResellerOrderService.formatPrice(item.discountApplied, displayOrder.currency)}
                                  </Typography>
                                  <Typography variant="caption" color="success.main">
                                    {ResellerOrderService.calculateDiscountPercentage(
                                      item.originalUnitPrice || item.unitPrice + item.discountApplied,
                                      item.unitPrice
                                    )}%
                                  </Typography>
                                </>
                              )}
                            </TableCell>
                            <TableCell align="right" fontWeight="bold">
                              {ResellerOrderService.formatPrice(item.totalPrice, displayOrder.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" align="center" py={4}>
                    No items found in this order
                  </Typography>
                )}
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Vouchers ({vouchers.length})
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportVouchers}
                    size="small"
                    disabled={vouchers.length === 0}
                  >
                    Export All
                  </Button>
                </Box>
                {vouchers.length > 0 ? (
                  <Grid container spacing={2}>
                    {vouchers.map((voucher) => (
                      <Grid item xs={12} sm={6} md={4} key={voucher.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                              <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                                {voucher.code || 'N/A'}
                              </Typography>
                              <Chip
                                label={voucher.status}
                                size="small"
                                color={
                                  voucher.status === 'DELIVERED' ? 'success' :
                                  voucher.status === 'USED' ? 'warning' :
                                  voucher.status === 'EXPIRED' ? 'error' : 'default'
                                }
                              />
                            </Box>
                            {voucher.productName && (
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                Product: {voucher.productName}
                              </Typography>
                            )}
                            {voucher.pin && (
                              <Typography variant="body2" fontFamily="monospace" gutterBottom>
                                PIN: {voucher.pin}
                              </Typography>
                            )}
                            {voucher.serial && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Serial: {voucher.serial}
                              </Typography>
                            )}
                            {voucher.expiresAt && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Expires: {new Date(voucher.expiresAt).toLocaleDateString()}
                              </Typography>
                            )}
                            <Box mt={1}>
                              <Button
                                size="small"
                                startIcon={<QrCodeIcon />}
                                onClick={() => {
                                  if (!voucher.code) return;
                                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(voucher.code)}`;
                                  window.open(qrUrl, '_blank', 'noopener,noreferrer');
                                }}
                                disabled={!voucher.code}
                              >
                                QR Code
                              </Button>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary" align="center" py={4}>
                    No vouchers found for this order
                  </Typography>
                )}
              </Box>
            )}

            {activeTab === 3 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Order Timeline
                </Typography>
                {timeline.length > 0 ? (
                  <Stepper orientation="vertical">
                    {timeline.map((event, index) => (
                      <Step key={index} active>
                        <StepLabel>
                          <Typography variant="body1" fontWeight="bold">
                            {event.event}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(event.timestamp).toLocaleString()}
                          </Typography>
                        </StepLabel>
                        <StepContent>
                          <Typography variant="body2">
                            {event.description}
                          </Typography>
                        </StepContent>
                      </Step>
                    ))}
                  </Stepper>
                ) : (
                  <Typography variant="body2" color="text.secondary" align="center" py={4}>
                    No timeline events found
                  </Typography>
                )}
              </Box>
            )}

            {activeTab === 4 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Payment Information
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Payment Method
                          </Typography>
                          <Typography variant="body1">
                            {displayOrder.currency || 'USD'} Wallet
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Transaction ID
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {displayOrder.transactions?.[0]?.reference || displayOrder.transactionId || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Payment Status
                          </Typography>
                          <Chip
                            label={displayOrder.paymentStatus || "COMPLETED"}
                            color="success"
                            size="small"
                            icon={<VerifiedIcon />}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Payment Date
                          </Typography>
                          <Typography variant="body1">
                            {displayOrder.createdAt ? 
                              new Date(displayOrder.createdAt).toLocaleString() : 
                              'N/A'
                            }
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {displayOrder.transactions?.map((transaction) => (
                  <Grid item xs={12} key={transaction.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Transaction Details
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Amount
                            </Typography>
                            <Typography variant="h6" color="primary">
                              {ResellerOrderService.formatPrice(
                                transaction.amount, 
                                displayOrder.currency
                              )}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Type
                            </Typography>
                            <Chip
                              label={transaction.type}
                              color={transaction.type === 'DEBIT' ? 'error' : 'success'}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Status
                            </Typography>
                            <Chip
                              label={transaction.status}
                              color={transaction.status === 'SUCCESS' ? 'success' : 'warning'}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Reason
                            </Typography>
                            <Typography variant="body2">
                              {transaction.reason || 'Order payment'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          onClick={() => {
            enqueueSnackbar('Reorder functionality coming soon!', { variant: 'info' });
          }}
        >
          Reorder
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Filters Component
const OrderFilters = ({ filters, onFilterChange, onReset }) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [showFilters, setShowFilters] = useState(false);

  const handleApply = () => {
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      status: '',
      startDate: null,
      endDate: null,
      search: ''
    };
    setLocalFilters(resetFilters);
    onReset();
  };

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Filters
          </Typography>
          <Box>
            <Button
              size="small"
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleReset}
              sx={{ ml: 1 }}
            >
              Reset
            </Button>
          </Box>
        </Box>

        <Collapse in={showFilters}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={localFilters.status}
                  label="Status"
                  onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="PROCESSING">Processing</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="From Date"
                  value={localFilters.startDate}
                  onChange={(date) => setLocalFilters({ ...localFilters, startDate: date })}
                  slotProps={{ 
                    textField: { 
                      size: 'small', 
                      fullWidth: true,
                      error: localFilters.startDate && localFilters.endDate && 
                             localFilters.startDate > localFilters.endDate 
                    } 
                  }}
                  maxDate={localFilters.endDate || new Date()}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="To Date"
                  value={localFilters.endDate}
                  onChange={(date) => setLocalFilters({ ...localFilters, endDate: date })}
                  slotProps={{ 
                    textField: { 
                      size: 'small', 
                      fullWidth: true,
                      error: localFilters.startDate && localFilters.endDate && 
                             localFilters.startDate > localFilters.endDate 
                    } 
                  }}
                  minDate={localFilters.startDate || null}
                  maxDate={new Date()}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search Order/Invoice"
                value={localFilters.search}
                onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                placeholder="Order #, Invoice, or Customer"
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" gap={1}>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                >
                  Clear
                </Button>
                <Button
                  variant="contained"
                  onClick={handleApply}
                  startIcon={<FilterIcon />}
                  disabled={localFilters.startDate && localFilters.endDate && 
                           localFilters.startDate > localFilters.endDate}
                >
                  Apply Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
};

// Statistics Cards
const StatisticsCards = ({ statistics, walletBalance }) => {
  // Ensure we have valid data
  const safeStatistics = statistics || ResellerOrderService.getDefaultStatistics();
  const safeWalletBalance = walletBalance || ResellerOrderService.getDefaultWalletBalance();
  
  const cards = [
    {
      title: 'Total Orders',
      value: safeStatistics.summary?.totalOrders || 0,
      icon: <ReceiptIcon />,
      color: '#1976d2',
      change: '+12%'
    },
    {
      title: 'Total Revenue',
      value: ResellerOrderService.formatPrice(
        safeStatistics.summary?.totalRevenue || 0,
        safeStatistics.summary?.currency || 'USD'
      ),
      icon: <MoneyIcon />,
      color: '#2e7d32',
      change: '+18%'
    },
    {
      title: 'Wallet Balance',
      value: ResellerOrderService.formatPrice(
        safeWalletBalance.totalBalance || 0,
        safeWalletBalance.defaultCurrency || 'USD'
      ),
      icon: <WalletIcon />,
      color: '#9c27b0',
      change: safeWalletBalance.wallets && safeWalletBalance.wallets.length > 0 
        ? `${safeWalletBalance.wallets.length} currencies`
        : ''
    },
    {
      title: 'Completed Orders',
      value: safeStatistics.summary?.completedOrders || 0,
      icon: <CheckIcon />,
      color: '#2e7d32',
      change: '+8%'
    }
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    {card.title}
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {card.value}
                  </Typography>
                  {card.change && (
                    <Typography variant="caption" color="textSecondary">
                      {card.change}
                    </Typography>
                  )}
                </Box>
                <Box
                  sx={{
                    backgroundColor: `${card.color}15`,
                    borderRadius: '50%',
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {React.cloneElement(card.icon, { sx: { color: card.color, fontSize: 24 } })}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

// Main OrdersPage Component
function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    startDate: null,
    endDate: null,
    search: ''
  });
  const [statistics, setStatistics] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const { enqueueSnackbar } = useSnackbar();

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      // Prepare API filters
      const apiFilters = {
        page: page + 1,
        limit: rowsPerPage
      };

      // Add filters if they exist
      if (filters.status) {
        apiFilters.status = filters.status;
      }
      
      if (filters.startDate && isValidDate(filters.startDate)) {
        apiFilters.startDate = format(filters.startDate, 'yyyy-MM-dd');
      }
      
      if (filters.endDate && isValidDate(filters.endDate)) {
        apiFilters.endDate = format(filters.endDate, 'yyyy-MM-dd');
      }
      
      if (filters.search) {
        apiFilters.search = filters.search;
      }

      if (activeTab !== 'all') {
        apiFilters.status = activeTab;
      }

      const result = await ResellerOrderService.getOrders(apiFilters);
      
      if (result.success) {
        setOrders(result.orders || []);
        setTotalOrders(result.pagination?.total || result.orders?.length || 0);
      } else {
        throw new Error(result.message || 'Failed to fetch orders');
      }
    } catch (error) {
      console.error('❌ Fetch orders error:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
      setOrders([]);
      setTotalOrders(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters, activeTab, enqueueSnackbar]);

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    try {
      console.log('📊 Fetching order statistics...');
      const stats = await ResellerOrderService.getOrderStatistics();
      
      console.log('📊 Statistics result:', stats);
      
      if (stats.success) {
        console.log('📊 Statistics fetched successfully:', stats.statistics);
        setStatistics(stats.statistics);
      } else {
        console.warn('⚠️ Statistics fetch returned success=false:', stats);
        // Set default statistics
        setStatistics(ResellerOrderService.getDefaultStatistics());
      }
    } catch (error) {
      console.error('❌ Failed to fetch statistics:', error);
      // Set default statistics on error
      setStatistics(ResellerOrderService.getDefaultStatistics());
    }
  }, []);
  

  // Fetch wallet balance
  const fetchWalletBalance = useCallback(async () => {
    try {
      console.log('💰 Fetching wallet balance...');
      const balance = await ResellerOrderService.getWalletBalance();
      
      console.log('💰 Wallet balance result:', balance);
      
      if (balance.success) {
        console.log('💰 Wallet balance fetched successfully:', balance.balance);
        setWalletBalance(balance.balance);
      } else {
        console.warn('⚠️ Wallet balance fetch returned success=false:', balance);
        // Set default wallet balance
        setWalletBalance(ResellerOrderService.getDefaultWalletBalance());
      }
    } catch (error) {
      console.error('❌ Failed to fetch wallet balance:', error);
      // Set default wallet balance on error
      setWalletBalance(ResellerOrderService.getDefaultWalletBalance());
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchOrders();
    fetchStatistics();
    fetchWalletBalance();
    
    // Refresh every 30 seconds if page is active
    const interval = setInterval(() => {
      fetchOrders();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchOrders, fetchStatistics, fetchWalletBalance]);

  // Refetch when dependencies change
  useEffect(() => {
    fetchOrders();
  }, [page, rowsPerPage, filters, activeTab, fetchOrders]);

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setModalOpen(true);
  };

  const handleCancelOrder = async (order) => {
    try {
      const confirmed = window.confirm(
        `Are you sure you want to cancel order ${order.orderNumber}? This action cannot be undone.`
      );
      
      if (!confirmed) return;

      const result = await ResellerOrderService.cancelOrder(order.id);
      
      if (result.success) {
        enqueueSnackbar('Order cancelled successfully', { variant: 'success' });
        fetchOrders(); // Refresh orders list
      }
    } catch (error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(0);
  };

  const handleResetFilters = () => {
    setFilters({
      status: '',
      startDate: null,
      endDate: null,
      search: ''
    });
    setPage(0);
  };

  const handleRefresh = () => {
    fetchOrders();
    fetchStatistics();
    fetchWalletBalance();
    enqueueSnackbar('Data refreshed successfully', { variant: 'success' });
  };

  // Tab counts
  const tabCounts = React.useMemo(() => {
    return {
      all: totalOrders,
      PENDING: orders.filter(o => o.status === 'PENDING').length,
      PROCESSING: orders.filter(o => o.status === 'PROCESSING').length,
      COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
      CANCELLED: orders.filter(o => o.status === 'CANCELLED').length
    };
  }, [orders, totalOrders]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box className="orders-page">
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  Orders Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Manage and track your voucher orders
                </Typography>
              </Box>
              <Box display="flex" gap={2}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    // Navigate to create order page
                    window.location.href = '/create-order';
                  }}
                >
                  New Order
                </Button>
              </Box>
            </Box>

            {/* Statistics */}
            <StatisticsCards statistics={statistics} walletBalance={walletBalance} />
          </Box>

          {/* Filters */}
          <OrderFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
          />

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(e, val) => {
                setActiveTab(val);
                setPage(0);
              }}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab
                label={
                  <Box display="flex" alignItems="center">
                    <ReceiptIcon sx={{ mr: 1, fontSize: 20 }} />
                    All Orders
                    <Badge
                      badgeContent={tabCounts.all}
                      color="primary"
                      sx={{ ml: 1 }}
                      showZero
                    />
                  </Box>
                }
                value="all"
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center">
                    <WarningIcon sx={{ mr: 1, fontSize: 20 }} />
                    Pending
                    <Badge
                      badgeContent={tabCounts.PENDING}
                      color="warning"
                      sx={{ ml: 1 }}
                      showZero
                    />
                  </Box>
                }
                value="PENDING"
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center">
                    <TimelineIcon sx={{ mr: 1, fontSize: 20 }} />
                    Processing
                    <Badge
                      badgeContent={tabCounts.PROCESSING}
                      color="info"
                      sx={{ ml: 1 }}
                      showZero
                    />
                  </Box>
                }
                value="PROCESSING"
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center">
                    <CheckIcon sx={{ mr: 1, fontSize: 20 }} />
                    Completed
                    <Badge
                      badgeContent={tabCounts.COMPLETED}
                      color="success"
                      sx={{ ml: 1 }}
                      showZero
                    />
                  </Box>
                }
                value="COMPLETED"
              />
              <Tab
                label={
                  <Box display="flex" alignItems="center">
                    <CancelIcon sx={{ mr: 1, fontSize: 20 }} />
                    Cancelled
                    <Badge
                      badgeContent={tabCounts.CANCELLED}
                      color="error"
                      sx={{ ml: 1 }}
                      showZero
                    />
                  </Box>
                }
                value="CANCELLED"
              />
            </Tabs>
          </Box>

          {/* Orders Table */}
          <Paper variant="outlined">
            {loading ? (
              <Box p={3}>
                <LinearProgress />
                <Typography align="center" sx={{ mt: 2 }}>
                  Loading orders...
                </Typography>
              </Box>
            ) : orders.length === 0 ? (
              <Box p={4} textAlign="center">
                <ReceiptIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No orders found
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {filters.status || filters.search || filters.startDate || filters.endDate
                    ? 'Try changing your filters to see more results'
                    : 'You haven\'t placed any orders yet'}
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => {
                    // Navigate to create order page
                    window.location.href = '/create-order';
                  }}
                >
                  Create Your First Order
                </Button>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell width="50px" />
                        <TableCell>Order Details</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Items</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((order) => (
                        <ExpandableOrderRow
                          key={order.id || order.orderNumber}
                          order={order}
                          onViewDetails={handleViewDetails}
                          onCancelOrder={handleCancelOrder}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  component="div"
                  count={totalOrders}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="Orders per page:"
                  labelDisplayedRows={({ from, to, count }) =>
                    `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`
                  }
                />
              </>
            )}
          </Paper>

          {/* Quick Stats */}
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Average Order Value
                  </Typography>
                  <Typography variant="h4">
                    {statistics?.summary?.totalRevenue && statistics?.summary?.totalOrders
                      ? ResellerOrderService.formatPrice(
                          statistics.summary.totalRevenue / statistics.summary.totalOrders,
                          'USD'
                        )
                      : ResellerOrderService.formatPrice(0, 'USD')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Completion Rate
                  </Typography>
                  <Typography variant="h4">
                    {statistics?.summary?.totalOrders && statistics?.summary?.completedOrders
                      ? Math.round((statistics.summary.completedOrders / statistics.summary.totalOrders) * 100)
                      : 0}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    This Month
                  </Typography>
                  <Typography variant="h4">
                    {statistics?.monthlyStatistics?.[0]?.orders || 0} orders
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {statistics?.monthlyStatistics?.[0]?.revenue
                      ? ResellerOrderService.formatPrice(
                          statistics.monthlyStatistics[0].revenue,
                          'USD'
                        )
                      : ResellerOrderService.formatPrice(0, 'USD')} revenue
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>

        {/* Order Details Modal */}
        <OrderDetailsModal
          open={modalOpen}
          order={selectedOrder}
          onClose={() => setModalOpen(false)}
          onCancel={fetchOrders}
        />

        {/* Footer Alert */}
        {orders.some(order => order.status === 'PENDING') && (
          <Alert
            severity="info"
            sx={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              width: 300,
              zIndex: 1000,
              boxShadow: 3
            }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setActiveTab('PENDING');
                  setPage(0);
                }}
              >
                VIEW
              </Button>
            }
          >
            You have {tabCounts.PENDING} pending order{tabCounts.PENDING !== 1 ? 's' : ''}
          </Alert>
        )}
      </Box>
    </LocalizationProvider>
  );
}

export default OrdersPage;