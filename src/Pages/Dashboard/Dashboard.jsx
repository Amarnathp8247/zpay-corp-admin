// src/pages/reseller/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  LinearProgress,
  Chip,
  IconButton,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tooltip,
  CircularProgress,
  Alert,
  AlertTitle,
  Skeleton
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  ShoppingCart as CartIcon,
  CheckCircle as CheckIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalanceWallet as WalletIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useNavigate } from 'react-router-dom';
import ResellerOrderService from '../../services/order.service';
import ResellerProductService from '../../services/product.service';
import ResellerWalletService from '../../services/wallet.service';
import ResellerAuthService from '../../services/resellerAuth.service';

const Dashboard = () => {
  const navigate = useNavigate();
  
  // State for dashboard data
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // User profile
  const [userProfile, setUserProfile] = useState(null);
  
  // Statistics
  const [statistics, setStatistics] = useState({
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
  });
  
  // Wallet balance
  const [walletBalance, setWalletBalance] = useState({
    totalBalance: 0,
    availableBalance: 0,
    wallets: [],
    currency: 'USD'
  });
  
  // Recent orders
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersPagination, setOrdersPagination] = useState({
    page: 0,
    limit: 5,
    total: 0,
    totalPages: 0
  });
  
  // Products summary
  const [productsSummary, setProductsSummary] = useState({
    totalProducts: 0,
    availableProducts: 0,
    lowStockProducts: 0
  });
  
  // Quick stats
  const [quickStats, setQuickStats] = useState({
    todayOrders: 0,
    weekOrders: 0,
    monthOrders: 0,
    todayRevenue: 0
  });

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);
      setError(null);
      
      console.log('📊 Fetching dashboard data...');
      
      // Check authentication first
      const isAuthenticated = ResellerAuthService.isAuthenticated();
      if (!isAuthenticated) {
        navigate('/reseller/login');
        return;
      }
      
      // Get user profile
      try {
        const user = ResellerAuthService.getCurrentUser();
        setUserProfile(user);
        
        // If no profile in localStorage, fetch from API
        if (!user) {
          const profile = await ResellerAuthService.getProfile();
          setUserProfile(profile);
        }
      } catch (profileError) {
        console.warn('⚠️ Could not fetch profile:', profileError);
      }
      
      // Fetch data concurrently
      const [
        statsResponse,
        walletResponse,
        ordersResponse,
        productsResponse
      ] = await Promise.allSettled([
        ResellerOrderService.getOrderStatistics(),
        ResellerWalletService.listWallets(),
        ResellerOrderService.getOrders({ limit: 5, page: 1, sortBy: 'createdAt', sortOrder: 'desc' }),
        ResellerProductService.getProductList({ limit: 1 })
      ]);
      
      // Process statistics
      if (statsResponse.status === 'fulfilled' && statsResponse.value.success) {
        console.log('📊 Statistics loaded:', statsResponse.value.statistics);
        setStatistics(statsResponse.value.statistics);
        
        // Calculate quick stats from statistics
        if (statsResponse.value.statistics.monthlyStatistics) {
          const today = new Date().toISOString().split('T')[0];
          const todayData = statsResponse.value.statistics.monthlyStatistics.find(m => m.date === today);
          
          setQuickStats(prev => ({
            ...prev,
            todayOrders: todayData?.orders || 0,
            todayRevenue: todayData?.revenue || 0
          }));
        }
      } else {
        console.warn('⚠️ Statistics fetch failed:', statsResponse.reason);
      }
      
      // Process wallet balance
      if (walletResponse.status === 'fulfilled' && walletResponse.value.success) {
        console.log('💰 Wallet balance loaded:', walletResponse.value);
        
        // Calculate total balance from all wallets
        const totalBalance = walletResponse.value.wallets?.reduce((sum, wallet) => {
          return sum + (parseFloat(wallet.balance) || 0);
        }, 0) || 0;
        
        setWalletBalance({
          totalBalance,
          availableBalance: totalBalance, // Assuming all balance is available
          wallets: walletResponse.value.wallets || [],
          currency: walletResponse.value.currency || 'USD'
        });
      } else {
        console.warn('⚠️ Wallet fetch failed:', walletResponse.reason);
        // Use order service as fallback for wallet balance
        try {
          const fallbackWallet = await ResellerOrderService.getWalletBalance();
          if (fallbackWallet.success) {
            setWalletBalance(fallbackWallet);
          }
        } catch (fallbackError) {
          console.warn('⚠️ Fallback wallet fetch failed:', fallbackError);
        }
      }
      
      // Process recent orders
      if (ordersResponse.status === 'fulfilled' && ordersResponse.value.success) {
        console.log('📦 Recent orders loaded:', ordersResponse.value.orders?.length);
        setRecentOrders(ordersResponse.value.orders || []);
        setOrdersPagination(ordersResponse.value.pagination || {
          page: 0,
          limit: 5,
          total: ordersResponse.value.orders?.length || 0,
          totalPages: 1
        });
      } else {
        console.warn('⚠️ Orders fetch failed:', ordersResponse.reason);
      }
      
      // Process products summary
      if (productsResponse.status === 'fulfilled' && productsResponse.value.success) {
        const products = productsResponse.value.products || [];
        const totalProducts = productsResponse.value.count || products.length;
        
        // Calculate available and low stock products
        let availableProducts = 0;
        let lowStockProducts = 0;
        
        products.forEach(product => {
          const stockStatus = ResellerProductService.getProductStockStatus(product);
          if (stockStatus === 'IN_STOCK') availableProducts++;
          if (stockStatus === 'LOW_STOCK') lowStockProducts++;
        });
        
        setProductsSummary({
          totalProducts,
          availableProducts,
          lowStockProducts
        });
      } else {
        console.warn('⚠️ Products fetch failed:', productsResponse.reason);
      }
      
      console.log('✅ Dashboard data loaded successfully');
      
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
    
    // Set up auto-refresh every 2 minutes
    const refreshInterval = setInterval(() => {
      fetchDashboardData(false);
    }, 2 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, [fetchDashboardData]);

  // Handle refresh
  const handleRefresh = () => {
    fetchDashboardData(false);
  };

  // Handle view order
  const handleViewOrder = (orderId) => {
    navigate(`/reseller/orders/${orderId}`);
  };

  // Handle create order
  const handleCreateOrder = () => {
    navigate('/reseller/products');
  };

  // Handle view all orders
  const handleViewAllOrders = () => {
    navigate('/reseller/orders');
  };

  // Handle view wallet
  const handleViewWallet = () => {
    navigate('/reseller/wallet');
  };

  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    return ResellerOrderService.formatPrice(amount, currency);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'success';
      case 'PROCESSING':
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return <CheckIcon fontSize="small" />;
      case 'PROCESSING':
      case 'PENDING':
        return <PendingIcon fontSize="small" />;
      case 'CANCELLED':
        return <CancelIcon fontSize="small" />;
      default:
        return null;
    }
  };

  // Prepare chart data for revenue
  const prepareRevenueChartData = () => {
    if (!statistics.monthlyStatistics || statistics.monthlyStatistics.length === 0) {
      return [
        { date: 'Jan', revenue: 0 },
        { date: 'Feb', revenue: 0 },
        { date: 'Mar', revenue: 0 },
        { date: 'Apr', revenue: 0 },
        { date: 'May', revenue: 0 },
        { date: 'Jun', revenue: 0 }
      ];
    }
    
    return statistics.monthlyStatistics.slice(-6).map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short' }),
      revenue: parseFloat(item.revenue) || 0
    }));
  };

  // Prepare chart data for orders
  const prepareOrdersChartData = () => {
    if (!statistics.monthlyStatistics || statistics.monthlyStatistics.length === 0) {
      return [
        { date: 'Jan', orders: 0 },
        { date: 'Feb', orders: 0 },
        { date: 'Mar', orders: 0 },
        { date: 'Apr', orders: 0 },
        { date: 'May', orders: 0 },
        { date: 'Jun', orders: 0 }
      ];
    }
    
    return statistics.monthlyStatistics.slice(-6).map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short' }),
      orders: item.orders || 0
    }));
  };

  // Stats cards data
  const statsCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(statistics.summary.totalRevenue, statistics.summary.currency),
      icon: <MoneyIcon />,
      color: '#4caf50',
      subtitle: 'All time',
      trend: statistics.monthlyStatistics?.length > 1 ? 
        (statistics.monthlyStatistics[statistics.monthlyStatistics.length - 1]?.revenue || 0) > 
        (statistics.monthlyStatistics[statistics.monthlyStatistics.length - 2]?.revenue || 0) ? 
        'up' : 'down' : 'stable'
    },
    {
      title: 'Available Balance',
      value: formatCurrency(walletBalance.availableBalance, walletBalance.currency),
      icon: <WalletIcon />,
      color: '#2196f3',
      subtitle: 'Ready to use',
      trend: 'stable'
    },
    {
      title: 'Total Orders',
      value: statistics.summary.totalOrders,
      icon: <CartIcon />,
      color: '#ff9800',
      subtitle: `${statistics.summary.completedOrders} completed`,
      trend: statistics.summary.completionRate > 80 ? 'up' : 'stable'
    },
    {
      title: 'Available Products',
      value: productsSummary.availableProducts,
      icon: <InventoryIcon />,
      color: '#9c27b0',
      subtitle: `${productsSummary.lowStockProducts} low stock`,
      trend: productsSummary.lowStockProducts > 0 ? 'warning' : 'stable'
    }
  ];

  // Status breakdown data for chart
  const statusData = statistics.statusBreakdown.length > 0 
    ? statistics.statusBreakdown.map(item => ({
        name: item.status,
        value: item.count
      }))
    : [
        { name: 'Completed', value: statistics.summary.completedOrders },
        { name: 'Pending', value: statistics.summary.pendingOrders },
        { name: 'Cancelled', value: statistics.summary.cancelledOrders }
      ];

  // Loading skeleton
  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header skeleton */}
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width={300} height={40} />
          <Skeleton variant="text" width={400} height={24} />
        </Box>
        
        {/* Stats cards skeleton */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
        
        {/* Charts skeleton */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
        
        {/* Table skeleton */}
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome back, {userProfile?.name || userProfile?.email || 'Reseller'}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's what's happening with your business today.
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="contained"
            startIcon={<CartIcon />}
            onClick={handleCreateOrder}
          >
            Create Order
          </Button>
        </Box>
      </Box>

      {/* Error alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {/* Quick Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ 
              height: '100%',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 3
              }
            }}>
              <CardContent>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  mb: 2
                }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                      {stat.value}
                    </Typography>
                  </Box>
                  <Avatar sx={{ 
                    bgcolor: `${stat.color}20`, 
                    color: stat.color,
                    width: 48,
                    height: 48
                  }}>
                    {stat.icon}
                  </Avatar>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    {stat.subtitle}
                  </Typography>
                  {stat.trend === 'up' && (
                    <ArrowUpIcon sx={{ color: '#4caf50', fontSize: 16 }} />
                  )}
                  {stat.trend === 'down' && (
                    <ArrowDownIcon sx={{ color: '#f44336', fontSize: 16 }} />
                  )}
                  {stat.trend === 'warning' && (
                    <PendingIcon sx={{ color: '#ff9800', fontSize: 16 }} />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Revenue Chart */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Revenue Overview"
              subheader="Last 6 months"
              action={
                <IconButton size="small">
                  <TrendingUpIcon />
                </IconButton>
              }
            />
            <Divider />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepareRevenueChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#666"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#666"
                      fontSize={12}
                      tickFormatter={(value) => formatCurrency(value, statistics.summary.currency).replace('$', '')}
                    />
                    <RechartsTooltip 
                      formatter={(value) => [formatCurrency(value, statistics.summary.currency), 'Revenue']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#4caf50" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Status Distribution */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Order Status"
              subheader="Current distribution"
              action={
                <IconButton size="small">
                  <ReceiptIcon />
                </IconButton>
              }
            />
            <Divider />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#666"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#666"
                      fontSize={12}
                    />
                    <RechartsTooltip />
                    <Bar 
                      dataKey="value" 
                      fill="#2196f3"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              
              {/* Status Summary */}
              <Box sx={{ mt: 3 }}>
                {statusData.map((item, index) => (
                  <Box key={index} sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1
                  }}>
                    <Typography variant="body2">
                      {item.name}
                    </Typography>
                    <Chip 
                      label={item.value}
                      size="small"
                      color={getStatusColor(item.name)}
                      icon={getStatusIcon(item.name)}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Orders */}
      <Card sx={{ mb: 4 }}>
        <CardHeader
          title="Recent Orders"
          subheader="Latest 5 orders"
          action={
            <Button
              size="small"
              endIcon={<ViewIcon />}
              onClick={handleViewAllOrders}
            >
              View All
            </Button>
          }
        />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentOrders.length > 0 ? (
                  recentOrders.map((order) => {
                    const orderSummary = ResellerOrderService.formatOrderSummary(order);
                    return (
                      <TableRow 
                        key={order.id || order.orderId}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleViewOrder(order.id || order.orderId)}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {orderSummary?.invoiceId || order.orderNumber || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(order.createdAt || orderSummary?.createdAt).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(order.createdAt || orderSummary?.createdAt).toLocaleTimeString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {orderSummary?.totalItems || 0} items
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {orderSummary?.formattedTotal || formatCurrency(order.totalPrice, order.currency?.code)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={orderSummary?.status || order.status}
                            size="small"
                            color={getStatusColor(orderSummary?.status || order.status)}
                            icon={getStatusIcon(orderSummary?.status || order.status)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View Order">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewOrder(order.id || order.orderId);
                              }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No recent orders found
                      </Typography>
                      <Button 
                        variant="outlined" 
                        sx={{ mt: 2 }}
                        onClick={handleCreateOrder}
                      >
                        Create Your First Order
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Quick Actions & Info */}
      <Grid container spacing={3}>
        {/* Wallet Summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Wallet Summary"
              action={
                <Button
                  size="small"
                  onClick={handleViewWallet}
                >
                  Manage Wallet
                </Button>
              }
            />
            <Divider />
            <CardContent>
              {walletBalance.wallets.length > 0 ? (
                <>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Total Available Balance
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(walletBalance.totalBalance, walletBalance.currency)}
                    </Typography>
                  </Box>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Wallet Breakdown:
                  </Typography>
                  {walletBalance.wallets.slice(0, 3).map((wallet, index) => (
                    <Box 
                      key={index}
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 1,
                        borderBottom: index < 2 ? '1px solid' : 'none',
                        borderColor: 'divider'
                      }}
                    >
                      <Typography variant="body2">
                        {wallet.currency?.code || 'USD'} Wallet
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {formatCurrency(wallet.balance, wallet.currency?.code)}
                      </Typography>
                    </Box>
                  ))}
                  
                  {walletBalance.wallets.length > 3 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      +{walletBalance.wallets.length - 3} more wallets
                    </Typography>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <WalletIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No wallet information available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Today's Activity"
              subheader="Performance metrics"
            />
            <Divider />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Today's Orders
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {quickStats.todayOrders}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Today's Revenue
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {formatCurrency(quickStats.todayRevenue, statistics.summary.currency)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Completion Rate
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {statistics.summary.completionRate.toFixed(1)}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={statistics.summary.completionRate} 
                      sx={{ mt: 1 }}
                      color={
                        statistics.summary.completionRate > 80 ? 'success' : 
                        statistics.summary.completionRate > 50 ? 'warning' : 'error'
                      }
                    />
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Success Rate
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {statistics.summary.totalOrders > 0 
                        ? ((statistics.summary.completedOrders / statistics.summary.totalOrders) * 100).toFixed(1)
                        : 0}%
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              
              {/* Quick Actions */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Quick Actions:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button 
                    variant="outlined" 
                    size="small"
                    startIcon={<CartIcon />}
                    onClick={handleCreateOrder}
                  >
                    New Order
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small"
                    startIcon={<WalletIcon />}
                    onClick={handleViewWallet}
                  >
                    Add Funds
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small"
                    startIcon={<InventoryIcon />}
                    onClick={() => navigate('/reseller/products')}
                  >
                    Browse Products
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Footer note */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Data auto-refreshes every 2 minutes • Last updated: {new Date().toLocaleTimeString()}
          {refreshing && (
            <CircularProgress size={12} sx={{ ml: 1, verticalAlign: 'middle' }} />
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default Dashboard;