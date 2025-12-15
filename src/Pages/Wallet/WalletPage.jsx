// src/pages/Wallet/WalletPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ResellerWalletService from '../../services/wallet.service';
import {
  Wallet,
  CreditCard,
  RefreshCw,
  DollarSign,
  Euro,
  PoundSterling,
  TrendingUp,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  Download,
  Plus,
  AlertCircle,
  ChevronRight,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import './WalletPage.css';

const WalletPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [wallets, setWallets] = useState([]);
  const [balanceSummary, setBalanceSummary] = useState(null);
  const [primaryCurrency, setPrimaryCurrency] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionFilters, setTransactionFilters] = useState({
    page: 1,
    limit: 10,
    type: '',
    status: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [converting, setConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState(null);

  // Fetch all wallet data on mount
  useEffect(() => {
    fetchWalletData();
  }, []);

  // Fetch transactions when wallet is selected
  useEffect(() => {
    if (selectedWallet && activeTab === 'transactions') {
      fetchTransactions(selectedWallet.id);
    }
  }, [selectedWallet, activeTab, transactionFilters]);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all wallet data in parallel
      const [walletsData, summaryData, primaryData] = await Promise.all([
        ResellerWalletService.listWallets(),
        ResellerWalletService.getBalanceSummary(),
        ResellerWalletService.getPrimaryCurrency()
      ]);

      if (walletsData.success && walletsData.wallets) {
        setWallets(walletsData.wallets);
        // Select the primary wallet by default
        const primary = walletsData.wallets.find(w => w.isPrimary) || walletsData.wallets[0];
        setSelectedWallet(primary);
      }

      if (summaryData.success && summaryData.data) {
        setBalanceSummary(summaryData.data);
      }

      if (primaryData.success && primaryData.data) {
        setPrimaryCurrency(primaryData.data);
      }

    } catch (err) {
      console.error('Failed to fetch wallet data:', err);
      setError(err.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (walletId) => {
    try {
      const result = await ResellerWalletService.getTransactions(walletId, transactionFilters);
      if (result.success && result.data) {
        setTransactions(result.data.transactions || []);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError('Failed to load transactions');
    }
  };

  const handleWalletSelect = (wallet) => {
    setSelectedWallet(wallet);
    if (activeTab !== 'transactions') {
      setActiveTab('transactions');
    }
  };

  const handleCurrencyConversion = async (amount, fromCurrency, toCurrency) => {
    try {
      setConverting(true);
      setError('');
      setConversionResult(null);

      const result = await ResellerWalletService.convertCurrencyAmount(
        amount,
        fromCurrency,
        toCurrency
      );

      if (result.success && result.data) {
        setConversionResult(result.data);
        setSuccess(`Converted ${amount} ${fromCurrency} to ${result.data.convertedAmount.toFixed(2)} ${toCurrency}`);
      }
    } catch (err) {
      setError(err.message || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const handleRefresh = () => {
    setError('');
    setSuccess('');
    setConversionResult(null);
    fetchWalletData();
    if (selectedWallet) {
      fetchTransactions(selectedWallet.id);
    }
  };

  const handleTransactionFilter = (key, value) => {
    setTransactionFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handleExportTransactions = () => {
    // Implement CSV export functionality
    setSuccess('Export feature coming soon!');
  };

  const formatCurrency = (amount, currencyCode = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrencyIcon = (currencyCode) => {
    switch (currencyCode?.toUpperCase()) {
      case 'USD': return <DollarSign size={16} />;
      case 'EUR': return <Euro size={16} />;
      case 'GBP': return <PoundSterling size={16} />;
      default: return <DollarSign size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="wallet-loading">
        <div className="loading-spinner"></div>
        <p>Loading wallet data...</p>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      {/* Header */}
      <div className="wallet-header">
        <div className="header-left">
          <h1 className="page-title">
            <Wallet className="header-icon" />
            Wallet Management
          </h1>
          <p className="page-description">
            Manage your wallets, view balances, and track transactions
          </p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleRefresh}
            className="btn-refresh"
            disabled={loading}
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          {balanceSummary && (
            <div className="total-balance-badge">
              <Wallet size={16} />
              <span>Total: {formatCurrency(balanceSummary.totalBalanceUSD, 'USD')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="alert-close">×</button>
        </div>
      )}
      
      {success && (
        <div className="alert-success">
          <CheckCircle size={18} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="alert-close">×</button>
        </div>
      )}

      {/* Main Content */}
      <div className="wallet-content">
        {/* Left Column - Wallet Overview */}
        <div className="wallet-left">
          {/* Tabs */}
          <div className="wallet-tabs">
            <button
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Wallet size={18} />
              Overview
            </button>
            <button
              className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              <History size={18} />
              Transactions
            </button>
            <button
              className={`tab-btn ${activeTab === 'convert' ? 'active' : ''}`}
              onClick={() => setActiveTab('convert')}
            >
              <RefreshCw size={18} />
              Convert Currency
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="overview-tab">
                {/* Balance Summary Card */}
                {balanceSummary && (
                  <div className="summary-card">
                    <div className="summary-header">
                      <h3>Total Balance</h3>
                      <TrendingUp className="trend-icon" />
                    </div>
                    <div className="summary-balance">
                      <h2>{formatCurrency(balanceSummary.totalBalanceUSD, 'USD')}</h2>
                      <p className="summary-description">
                        Across {balanceSummary.walletCount} wallets in {balanceSummary.currencyBreakdown?.length || 0} currencies
                      </p>
                    </div>
                    
                    {/* Primary Wallet */}
                    {primaryCurrency && (
                      <div className="primary-wallet-info">
                        <div className="primary-label">
                          <Info size={14} />
                          <span>Primary Wallet Currency:</span>
                        </div>
                        <div className="primary-currency">
                          {getCurrencyIcon(primaryCurrency.primaryCurrency)}
                          <strong>{primaryCurrency.primaryCurrency}</strong>
                          {primaryCurrency.isDefault && (
                            <span className="default-badge">Default</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Currency Breakdown */}
                {balanceSummary?.currencyBreakdown && balanceSummary.currencyBreakdown.length > 0 && (
                  <div className="currency-breakdown">
                    <h3>Currency Breakdown</h3>
                    <div className="breakdown-grid">
                      {balanceSummary.currencyBreakdown.map((currency) => (
                        <div key={currency.currency} className="currency-card">
                          <div className="currency-header">
                            <div className="currency-icon">
                              {getCurrencyIcon(currency.currency)}
                            </div>
                            <div className="currency-info">
                              <span className="currency-code">{currency.currency}</span>
                              <span className="currency-symbol">{currency.symbol}</span>
                            </div>
                            {currency.isPrimary && (
                              <span className="primary-badge">Primary</span>
                            )}
                          </div>
                          <div className="currency-balance">
                            <span className="balance-amount">
                              {formatCurrency(currency.balance, currency.currency)}
                            </span>
                            <span className="balance-usd">
                              ≈ {formatCurrency(currency.balanceUSD, 'USD')}
                            </span>
                          </div>
                          <div className="currency-rate">
                            <span className="rate-label">Rate:</span>
                            <span className="rate-value">1 {currency.currency} = {currency.rate.toFixed(4)} USD</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div className="transactions-tab">
                {/* Transaction Header */}
                <div className="transactions-header">
                  <h3>
                    {selectedWallet ? `Transactions - ${selectedWallet.currency?.code}` : 'Transactions'}
                  </h3>
                  <div className="transaction-actions">
                    <div className="filter-dropdown">
                      <Filter size={16} />
                      <select 
                        value={transactionFilters.type}
                        onChange={(e) => handleTransactionFilter('type', e.target.value)}
                      >
                        <option value="">All Types</option>
                        <option value="CREDIT">Credit</option>
                        <option value="DEBIT">Debit</option>
                      </select>
                    </div>
                    <button 
                      onClick={handleExportTransactions}
                      className="btn-export"
                    >
                      <Download size={16} />
                      Export
                    </button>
                  </div>
                </div>

                {/* Wallet Selector */}
                <div className="wallet-selector">
                  {wallets.map(wallet => (
                    <button
                      key={wallet.id}
                      className={`wallet-select-btn ${selectedWallet?.id === wallet.id ? 'selected' : ''}`}
                      onClick={() => handleWalletSelect(wallet)}
                    >
                      <div className="wallet-select-info">
                        <div className="wallet-currency">
                          {getCurrencyIcon(wallet.currency?.code)}
                          <span>{wallet.currency?.code}</span>
                        </div>
                        <div className="wallet-balance">
                          {formatCurrency(wallet.balance, wallet.currency?.code)}
                        </div>
                      </div>
                      {wallet.isPrimary && (
                        <span className="selector-primary">Primary</span>
                      )}
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>

                {/* Transactions List */}
                <div className="transactions-list">
                  {transactions.length === 0 ? (
                    <div className="empty-transactions">
                      <History size={48} />
                      <p>No transactions found</p>
                    </div>
                  ) : (
                    transactions.map(transaction => (
                      <div key={transaction.id} className="transaction-item">
                        <div className="transaction-icon">
                          {transaction.type === 'CREDIT' ? (
                            <ArrowDownRight className="credit-icon" />
                          ) : (
                            <ArrowUpRight className="debit-icon" />
                          )}
                        </div>
                        <div className="transaction-details">
                          <div className="transaction-main">
                            <span className="transaction-reference">
                              {transaction.reference}
                            </span>
                            <span className="transaction-amount">
                              {transaction.type === 'CREDIT' ? '+' : '-'}
                              {formatCurrency(transaction.amount, transaction.currency)}
                            </span>
                          </div>
                          <div className="transaction-secondary">
                            <span className="transaction-reason">
                              {transaction.reason}
                            </span>
                            <span className="transaction-date">
                              {formatDate(transaction.createdAt)}
                            </span>
                          </div>
                          <div className="transaction-balance">
                            <span className="balance-label">
                              Balance: {formatCurrency(transaction.openingBalance, transaction.currency)} → {formatCurrency(transaction.closingBalance, transaction.currency)}
                            </span>
                            <span className={`transaction-status ${transaction.status.toLowerCase()}`}>
                              {transaction.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {transactions.length > 0 && (
                  <div className="pagination">
                    <button 
                      className="pagination-btn"
                      disabled={transactionFilters.page === 1}
                      onClick={() => handleTransactionFilter('page', transactionFilters.page - 1)}
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Page {transactionFilters.page}
                    </span>
                    <button 
                      className="pagination-btn"
                      onClick={() => handleTransactionFilter('page', transactionFilters.page + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Convert Currency Tab */}
            {activeTab === 'convert' && (
              <div className="convert-tab">
                <div className="convert-card">
                  <h3>Currency Converter</h3>
                  <p className="convert-description">
                    Convert between different currencies using current exchange rates
                  </p>

                  <div className="convert-form">
                    <div className="convert-input-group">
                      <div className="input-field">
                        <label>Amount</label>
                        <input
                          type="number"
                          id="convertAmount"
                          placeholder="Enter amount"
                          min="0"
                          step="0.01"
                          className="convert-input"
                        />
                      </div>
                      
                      <div className="currency-selectors">
                        <div className="input-field">
                          <label>From Currency</label>
                          <select id="fromCurrency" className="currency-select">
                            {wallets.map(wallet => (
                              <option key={wallet.currency?.code} value={wallet.currency?.code}>
                                {wallet.currency?.code} - {wallet.currency?.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="swap-button">
                          <button className="btn-swap">
                            <RefreshCw size={16} />
                          </button>
                        </div>

                        <div className="input-field">
                          <label>To Currency</label>
                          <select id="toCurrency" className="currency-select">
                            <option value="USD">USD - US Dollar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="GBP">GBP - British Pound</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn-convert"
                      disabled={converting}
                      onClick={() => {
                        const amount = document.getElementById('convertAmount').value;
                        const fromCurrency = document.getElementById('fromCurrency').value;
                        const toCurrency = document.getElementById('toCurrency').value;
                        if (amount && fromCurrency && toCurrency) {
                          handleCurrencyConversion(parseFloat(amount), fromCurrency, toCurrency);
                        }
                      }}
                    >
                      {converting ? 'Converting...' : 'Convert'}
                    </button>
                  </div>

                  {/* Conversion Result */}
                  {conversionResult && (
                    <div className="conversion-result">
                      <div className="result-header">
                        <CheckCircle size={20} />
                        <h4>Conversion Result</h4>
                      </div>
                      <div className="result-details">
                        <div className="result-row">
                          <span className="result-label">Original Amount:</span>
                          <span className="result-value">
                            {formatCurrency(conversionResult.originalAmount, conversionResult.originalCurrency)}
                          </span>
                        </div>
                        <div className="result-row">
                          <span className="result-label">Converted Amount:</span>
                          <span className="result-value highlight">
                            {formatCurrency(conversionResult.convertedAmount, conversionResult.convertedCurrency)}
                          </span>
                        </div>
                        <div className="result-row">
                          <span className="result-label">Exchange Rate:</span>
                          <span className="result-value">
                            1 {conversionResult.originalCurrency} = {conversionResult.exchangeRate.toFixed(6)} {conversionResult.convertedCurrency}
                          </span>
                        </div>
                        <div className="result-row">
                          <span className="result-label">Timestamp:</span>
                          <span className="result-value">
                            {new Date(conversionResult.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Available Currencies */}
                  <div className="available-currencies">
                    <h4>Available in Your Wallets</h4>
                    <div className="currency-tags">
                      {wallets.map(wallet => (
                        <span key={wallet.currency?.code} className="currency-tag">
                          {getCurrencyIcon(wallet.currency?.code)}
                          {wallet.currency?.code}
                          <span className="tag-balance">
                            {formatCurrency(wallet.balance, wallet.currency?.code)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions & Stats */}
        <div className="wallet-right">
          {/* Quick Stats */}
          <div className="quick-stats-card">
            <h3>Quick Stats</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-icon wallet">
                  <Wallet size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Wallets</span>
                  <span className="stat-value">{wallets.length}</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon currency">
                  <CreditCard size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Currencies</span>
                  <span className="stat-value">
                    {new Set(wallets.map(w => w.currency?.code)).size}
                  </span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon transaction">
                  <History size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Today's Transactions</span>
                  <span className="stat-value">0</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon conversion">
                  <RefreshCw size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Conversions</span>
                  <span className="stat-value">0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Wallet Card */}
          {selectedWallet && (
            <div className="primary-card">
              <h3>Active Wallet</h3>
              <div className="primary-wallet">
                <div className="primary-header">
                  <div className="primary-currency-icon">
                    {getCurrencyIcon(selectedWallet.currency?.code)}
                  </div>
                  <div className="primary-info">
                    <span className="primary-label">Currently Selected</span>
                    <span className="primary-name">{selectedWallet.currency?.code} Wallet</span>
                  </div>
                  {selectedWallet.isPrimary && (
                    <span className="primary-badge">Primary</span>
                  )}
                </div>
                <div className="primary-balance">
                  <span className="balance-main">
                    {formatCurrency(selectedWallet.balance, selectedWallet.currency?.code)}
                  </span>
                  <span className="balance-secondary">
                    Last updated: {selectedWallet.lastUpdated ? formatDate(selectedWallet.lastUpdated) : 'N/A'}
                  </span>
                </div>
                <div className="primary-actions">
                  <button className="btn-view-details">
                    View Details
                  </button>
                  <button className="btn-view-transactions">
                    Transactions
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="recent-transactions">
            <h3>Recent Activity</h3>
            <div className="recent-list">
              {transactions.slice(0, 5).map(transaction => (
                <div key={transaction.id} className="recent-item">
                  <div className="recent-icon">
                    {transaction.type === 'CREDIT' ? (
                      <ArrowDownRight className="credit-icon" />
                    ) : (
                      <ArrowUpRight className="debit-icon" />
                    )}
                  </div>
                  <div className="recent-details">
                    <span className="recent-amount">
                      {transaction.type === 'CREDIT' ? '+' : '-'}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </span>
                    <span className="recent-reason">{transaction.reason}</span>
                    <span className="recent-time">
                      {new Date(transaction.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="recent-empty">
                  <p>No recent activity</p>
                </div>
              )}
            </div>
            {transactions.length > 0 && (
              <button 
                className="btn-view-all"
                onClick={() => setActiveTab('transactions')}
              >
                View All Transactions
              </button>
            )}
          </div>

          {/* Help & Support */}
          <div className="help-card">
            <h3>Need Help?</h3>
            <p className="help-text">
              Having issues with your wallet or transactions?
            </p>
            <div className="help-actions">
              <button className="btn-help">
                <Info size={16} />
                FAQ
              </button>
              <button className="btn-contact">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;