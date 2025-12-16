// src/pages/OrdersPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Collapse,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Receipt as ReceiptIcon,
  CreditCard as CreditCardIcon,
  QrCode as QrCodeIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  AccountBalanceWallet as WalletIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  VerifiedUser as VerifiedIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isValid as isValidDate } from 'date-fns';
import ResellerOrderService from '../../services/order.service';
import { useSnackbar } from 'notistack';
import './OrdersPage.css';

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

// Expandable Order Row Component - UPDATED
const ExpandableOrderRow = ({ order, onViewDetails, onCancelOrder, expandedOrderId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Safe format function - FIXED VERSION
  const formatOrderSummary = (order) => {
    if (!order) return null;
    
    try {
      // Try to use ResellerOrderService.formatOrderSummary if it exists
      if (ResellerOrderService.formatOrderSummary) {
        const summary = ResellerOrderService.formatOrderSummary(order);
        if (summary) return summary;
      }
    } catch (error) {
      console.warn('Error using ResellerOrderService.formatOrderSummary, using fallback:', error);
    }
    
    // Fallback local implementation with type safety
    try {
      const items = order.items?.map(item => ({
        productName: item.product?.name || 'Unknown Product',
        denominationAmount: item.denomination?.amount || item.unitPrice || 0,
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        totalPrice: item.totalPrice || 0,
        currency: item.currency?.code || 'USD'
      })) || [];

      const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      
      // Safely calculate totalAmount
      let totalAmount = order.totalPrice || 
                       items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      
      // Ensure totalAmount is a number
      if (typeof totalAmount === 'string') {
        totalAmount = parseFloat(totalAmount);
      }
      
      if (isNaN(totalAmount)) {
        totalAmount = 0;
      }
      
      const currency = order.currency?.code || 
                      order.currencyCode || 
                      order.currencyId?.code || 
                      'USD';
      
      return {
        orderId: order.id || order.orderId,
        invoiceId: order.invoiceId || order.orderNumber,
        status: order.status || 'UNKNOWN',
        totalAmount: Number(totalAmount.toFixed(2)),
        totalItems,
        items,
        currency,
        createdAt: order.createdAt || new Date().toISOString(),
        updatedAt: order.updatedAt || new Date().toISOString(),
        canCancel: ['PENDING', 'PROCESSING'].includes(order.status),
        formattedTotal: ResellerOrderService.formatPrice ? 
          ResellerOrderService.formatPrice(totalAmount, currency) :
          `${currency} ${totalAmount.toFixed(2)}`
      };
    } catch (error) {
      console.error('Error formatting order summary:', error);
      // Return a safe default
      return {
        orderId: order?.id || order?.orderId || 'N/A',
        invoiceId: order?.invoiceId || order?.orderNumber || 'N/A',
        status: order?.status || 'UNKNOWN',
        totalAmount: 0,
        totalItems: 0,
        items: [],
        currency: 'USD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        canCancel: false,
        formattedTotal: '$0.00'
      };
    }
  };

  const orderSummary = useMemo(() => {
    return formatOrderSummary(order);
  }, [order]);

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(order);
    }
  };

  const handleCancel = () => {
    if (onCancelOrder) {
      onCancelOrder(order);
    }
  };

  if (!order) return null;

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton
            size="small"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {order.orderNumber || `Order #${order.id?.substring(0, 8) || 'N/A'}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Invoice: {order.invoiceId || 'No invoice'}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Chip
            icon={STATUS_ICONS[order.status] || <WarningIcon />}
            label={order.status || 'UNKNOWN'}
            color={STATUS_COLORS[order.status] || 'default'}
            size="small"
          />
        </TableCell>
        <TableCell>
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
        </TableCell>
        <TableCell>
          {ResellerOrderService.formatPrice ? 
            ResellerOrderService.formatPrice(
              order.totalPrice || 0, 
              order.currency || 
              order.currencyCode || 
              order.currencyId?.code || 
              'USD'
            ) :
            `$${order.totalPrice ? order.totalPrice.toFixed(2) : '0.00'}`
          }
        </TableCell>
        <TableCell>
          {order.itemCount || order.items?.length || 0}
        </TableCell>
        <TableCell>
          <Box display="flex" gap={1}>
            <Tooltip title="View Details">
              <IconButton size="small" onClick={handleViewDetails}>
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {order.status && ['PENDING', 'PROCESSING'].includes(order.status) && (
              <Tooltip title="Cancel Order">
                <IconButton size="small" onClick={handleCancel}>
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} style={{ paddingTop: 0, paddingBottom: 0 }}>
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1 }}>
                <Card variant="outlined">
                  <CardContent>
                    {loading ? (
                      <CircularProgress size={20} />
                    ) : orderSummary ? (
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>
                            Order Summary
                          </Typography>
                          <Typography variant="body2">
                            Items: {orderSummary.totalItems}
                          </Typography>
                          <Typography variant="body2">
                            Total: {orderSummary.formattedTotal}
                          </Typography>
                          <Typography variant="body2">
                            Status: {orderSummary.status}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>
                            Actions
                          </Typography>
                          <Box display="flex" gap={1} mt={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ViewIcon />}
                              onClick={handleViewDetails}
                            >
                              View Full Details
                            </Button>
                            {orderSummary.canCancel && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<CancelIcon />}
                                onClick={handleCancel}
                              >
                                Cancel Order
                              </Button>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No additional information available
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
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
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [vouchers, setVouchers] = useState([]);

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

      console.log('📦 Fetching orders with filters:', apiFilters);
      const result = await ResellerOrderService.getOrders(apiFilters);
      
      console.log('📦 Orders result:', result);
      
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
      const stats = await ResellerOrderService.getOrderStatistics({});
      
      console.log('📊 Statistics result:', stats);
      
      if (stats.success) {
        console.log('📊 Statistics fetched successfully:', stats.statistics);
        setStatistics(stats.statistics);
      } else {
        console.warn('⚠️ Statistics fetch returned success=false:', stats);
        // Set default statistics
        setStatistics(ResellerOrderService.getDefaultStatistics ? 
          ResellerOrderService.getDefaultStatistics() : 
          {
            summary: {
              totalOrders: 0,
              totalRevenue: 0,
              completedOrders: 0,
              pendingOrders: 0,
              cancelledOrders: 0,
              completionRate: 0,
              currency: 'USD'
            },
            statusBreakdown: [],
            monthlyStatistics: []
          }
        );
      }
    } catch (error) {
      console.error('❌ Failed to fetch statistics:', error);
      // Set default statistics on error
      setStatistics(ResellerOrderService.getDefaultStatistics ? 
        ResellerOrderService.getDefaultStatistics() : 
        {
          summary: {
            totalOrders: 0,
            totalRevenue: 0,
            completedOrders: 0,
            pendingOrders: 0,
            cancelledOrders: 0,
            completionRate: 0,
            currency: 'USD'
          },
          statusBreakdown: [],
          monthlyStatistics: []
        }
      );
    }
  }, []);

  // Fetch wallet balance
  const fetchWalletBalance = useCallback(async () => {
    try {
      console.log('💰 Fetching wallet balance...');
      const balance = await ResellerOrderService.getWalletBalance();
      
      console.log('💰 Wallet balance result:', balance);
      
      if (balance.success) {
        console.log('💰 Wallet balance fetched successfully:', balance);
        setWalletBalance(balance);
      } else {
        console.warn('⚠️ Wallet balance fetch returned success=false:', balance);
        // Set default wallet balance
        setWalletBalance(ResellerOrderService.getDefaultWalletBalance ? 
          ResellerOrderService.getDefaultWalletBalance() : 
          {
            totalBalance: 0,
            availableBalance: 0,
            wallets: [],
            defaultCurrency: 'USD'
          }
        );
      }
    } catch (error) {
      console.error('❌ Failed to fetch wallet balance:', error);
      // Set default wallet balance on error
      setWalletBalance(ResellerOrderService.getDefaultWalletBalance ? 
        ResellerOrderService.getDefaultWalletBalance() : 
        {
          totalBalance: 0,
          availableBalance: 0,
          wallets: [],
          defaultCurrency: 'USD'
        }
      );
    }
  }, []);

  // Fetch order details for modal
  const fetchOrderDetails = useCallback(async (order) => {
    try {
      setOrderDetailsLoading(true);
      
      let result;
      if (order.id && isValidUUID(order.id)) {
        result = await ResellerOrderService.getOrderById(order.id);
      } else if (order.orderNumber) {
        const ordersResult = await ResellerOrderService.getOrders({
          orderNumber: order.orderNumber,
          limit: 1
        });
        
        if (ordersResult.success && ordersResult.orders.length > 0) {
          result = {
            success: true,
            order: ordersResult.orders[0]
          };
        } else {
          throw new Error('Order not found');
        }
      } else {
        throw new Error('No valid order identifier');
      }
      
      if (result.success) {
        setOrderDetails(result.order);
        // Extract vouchers
        const allVouchers = result.order.items?.flatMap(item => 
          item.vouchers?.map(v => ({
            ...v,
            productName: item.product?.name || 'Unknown Product'
          })) || []
        ) || [];
        setVouchers(allVouchers);
      } else {
        throw new Error(result.message || 'Failed to fetch order details');
      }
    } catch (error) {
      console.error('❌ Fetch order details error:', error);
      enqueueSnackbar(error.message, { variant: 'error' });
      setOrderDetails(null);
      setVouchers([]);
    } finally {
      setOrderDetailsLoading(false);
    }
  }, [enqueueSnackbar]);

  // Initial data fetch
  useEffect(() => {
    fetchOrders();
    fetchStatistics();
    fetchWalletBalance();
  }, []);

  // Refetch when dependencies change
  useEffect(() => {
    fetchOrders();
  }, [page, rowsPerPage, filters, activeTab]);

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setModalOpen(true);
    fetchOrderDetails(order);
  };

  const handleCancelOrder = async (order) => {
    try {
      const confirmed = window.confirm(
        `Are you sure you want to cancel order ${order.orderNumber || order.id}? This action cannot be undone.`
      );
      
      if (!confirmed) return;

      const result = await ResellerOrderService.cancelOrder(order.id);
      
      if (result.success) {
        enqueueSnackbar('Order cancelled successfully', { variant: 'success' });
        fetchOrders(); // Refresh orders list
        if (modalOpen && selectedOrder?.id === order.id) {
          setModalOpen(false);
        }
      } else {
        throw new Error(result.message || 'Failed to cancel order');
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
  const tabCounts = useMemo(() => {
    return {
      all: totalOrders,
      PENDING: orders.filter(o => o.status === 'PENDING').length,
      PROCESSING: orders.filter(o => o.status === 'PROCESSING').length,
      COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
      CANCELLED: orders.filter(o => o.status === 'CANCELLED').length
    };
  }, [orders, totalOrders]);

  // Simple Statistics Cards Component
  const StatisticsCards = ({ statistics, walletBalance }) => {
    const safeStatistics = statistics || { summary: { totalOrders: 0, totalRevenue: 0, completedOrders: 0 } };
    const safeWalletBalance = walletBalance || { totalBalance: 0, defaultCurrency: 'USD' };
    
    const cards = [
      {
        title: 'Total Orders',
        value: safeStatistics.summary?.totalOrders || 0,
        icon: <ReceiptIcon />,
        color: '#1976d2',
      },
      {
        title: 'Total Revenue',
        value: ResellerOrderService.formatPrice ? 
          ResellerOrderService.formatPrice(
            safeStatistics.summary?.totalRevenue || 0,
            safeStatistics.summary?.currency || 'USD'
          ) : `$${safeStatistics.summary?.totalRevenue || 0}`,
        icon: <CreditCardIcon />,
        color: '#2e7d32',
      },
      {
        title: 'Wallet Balance',
        value: ResellerOrderService.formatPrice ? 
          ResellerOrderService.formatPrice(
            safeWalletBalance.totalBalance || 0,
            safeWalletBalance.defaultCurrency || 'USD'
          ) : `$${safeWalletBalance.totalBalance || 0}`,
        icon: <WalletIcon />,
        color: '#9c27b0',
      },
      {
        title: 'Completed Orders',
        value: safeStatistics.summary?.completedOrders || 0,
        icon: <CheckIcon />,
        color: '#2e7d32',
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

  // Simple Filters Component
  const OrderFilters = ({ filters, onFilterChange, onReset }) => {
    const [showFilters, setShowFilters] = useState(false);
    const [localFilters, setLocalFilters] = useState(filters);

    useEffect(() => {
      setLocalFilters(filters);
    }, [filters]);

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
                        fullWidth: true 
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
                        fullWidth: true 
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
                  label="Search"
                  value={localFilters.search}
                  onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  placeholder="Order #, Invoice"
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

  // Simple Order Details Modal
  const OrderDetailsModal = ({ open, order, orderDetails, vouchers, loading, onClose, onCancel }) => {
    const displayOrder = orderDetails || order;
    
    if (!displayOrder) return null;

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
      a.download = `vouchers_${displayOrder.orderNumber || displayOrder.id}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    };

    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Order {displayOrder.orderNumber || displayOrder.id?.substring(0, 8)}
            </Typography>
            <Chip
              icon={STATUS_ICONS[displayOrder.status]}
              label={displayOrder.status}
              color={STATUS_COLORS[displayOrder.status]}
            />
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Order Summary
                    </Typography>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography color="text.secondary">Date:</Typography>
                      <Typography>
                        {displayOrder.createdAt ? new Date(displayOrder.createdAt).toLocaleString() : 'N/A'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography color="text.secondary">Invoice:</Typography>
                      <Typography>
                        {displayOrder.invoiceId || 'No invoice'}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={2}>
                      <Typography color="text.secondary">Total Amount:</Typography>
                      <Typography variant="h6" color="primary">
                        {ResellerOrderService.formatPrice ? 
                          ResellerOrderService.formatPrice(displayOrder.totalPrice || 0, displayOrder.currency || 'USD') :
                          `$${displayOrder.totalPrice ? displayOrder.totalPrice.toFixed(2) : '0.00'}`
                        }
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Quick Actions
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Button
                          fullWidth
                          variant="outlined"
                          startIcon={<PrintIcon />}
                          onClick={() => window.print()}
                        >
                          Print
                        </Button>
                      </Grid>
                      <Grid item xs={6}>
                        <Button
                          fullWidth
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          onClick={handleExportVouchers}
                          disabled={vouchers.length === 0}
                        >
                          Export
                        </Button>
                      </Grid>
                      {displayOrder.status && ['PENDING', 'PROCESSING'].includes(displayOrder.status) && (
                        <Grid item xs={12}>
                          <Button
                            fullWidth
                            variant="outlined"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={() => onCancel && onCancel(displayOrder)}
                          >
                            Cancel Order
                          </Button>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {vouchers.length > 0 && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Vouchers ({vouchers.length})
                      </Typography>
                      <Grid container spacing={1}>
                        {vouchers.slice(0, 3).map((voucher) => (
                          <Grid item xs={12} key={voucher.id}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" p={1} bgcolor="action.hover" borderRadius={1}>
                              <Typography fontFamily="monospace">
                                {voucher.code}
                              </Typography>
                              <Chip
                                label={voucher.status}
                                size="small"
                                color={voucher.status === 'DELIVERED' ? 'success' : 'default'}
                              />
                            </Box>
                          </Grid>
                        ))}
                        {vouchers.length > 3 && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary" align="center">
                              + {vouchers.length - 3} more vouchers
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

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
        </Container>

        {/* Order Details Modal */}
        <OrderDetailsModal
          open={modalOpen}
          order={selectedOrder}
          orderDetails={orderDetails}
          vouchers={vouchers}
          loading={orderDetailsLoading}
          onClose={() => {
            setModalOpen(false);
            setOrderDetails(null);
            setVouchers([]);
          }}
          onCancel={handleCancelOrder}
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