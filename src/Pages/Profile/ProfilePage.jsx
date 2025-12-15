// src/pages/Profile/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import  ResellerAuthService  from '../../services/resellerAuth.service';
import {
  User,
  Building2,
  Wallet,
  ShoppingBag,
  Package,
  Mail,
  Phone,
  Shield,
  RefreshCw,
  Edit,
  Save,
  X,
  Key,
  AlertCircle
} from 'lucide-react';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editMode, setEditMode] = useState(false);
  
  // Profile form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch profile on component mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const profileData = await ResellerAuthService.getProfile();
      setProfile(profileData);
      setFormData({
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        phone: profileData.phone || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setError('');
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      if (err.message.includes('Session expired')) {
        setError('Your session has expired. Please login again.');
        setTimeout(() => navigate('/reseller/login'), 2000);
      } else {
        setError('Failed to load profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    // Validate passwords if changing password
    if (changingPassword) {
      if (!formData.currentPassword) {
        setError('Current password is required');
        return;
      }
      if (!formData.newPassword) {
        setError('New password is required');
        return;
      }
      if (formData.newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match');
        return;
      }
    }

    try {
      setSaving(true);
      setError('');
      
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
      };

      if (changingPassword) {
        updateData.password = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      await ResellerAuthService.updateProfile(updateData);
      
      setSuccess('Profile updated successfully');
      setEditMode(false);
      setChangingPassword(false);
      
      // Refresh profile data
      await fetchProfile();
      
      // Reset password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await ResellerAuthService.logout();
      navigate('/reseller/login');
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout');
    }
  };

  const handleRefreshSession = async () => {
    try {
      await ResellerAuthService.refreshToken();
      setSuccess('Session refreshed successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to refresh session');
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (!editMode) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setChangingPassword(false);
    }
  };

  const togglePasswordChange = () => {
    setChangingPassword(!changingPassword);
    if (!changingPassword) {
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Loading profile...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '100px auto',
        textAlign: 'center'
      }}>
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <div>
            {error || 'Failed to load profile. Please try again.'}
          </div>
        </div>
        <button
          onClick={fetchProfile}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw style={{ width: '16px', height: '16px' }} />
          Retry
        </button>
      </div>
    );
  }

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '4px'
          }}>Profile Settings</h1>
          <p style={{
            color: '#6b7280',
            fontSize: '0.875rem'
          }}>
            Manage your account information and settings
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleRefreshSession}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              color: '#374151',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw style={{ width: '16px', height: '16px' }} />
            Refresh Session
          </button>
          <button
            onClick={handleLogout}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}
      
      {success && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: '#dcfce7',
          border: '1px solid #bbf7d0',
          color: '#166534',
          marginBottom: '24px'
        }}>
          {success}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: '24px'
      }}>
        {/* Left Column - Profile Information */}
        <div>
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}>
              <button
                style={{
                  padding: '12px 24px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '2px solid #3b82f6',
                  color: '#3b82f6',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <User style={{ width: '16px', height: '16px' }} />
                Personal
              </button>
            </div>
            
            {/* Personal Info Card */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                padding: '24px 24px 16px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>Personal Information</h3>
                    <p style={{
                      color: '#6b7280',
                      fontSize: '0.875rem',
                      marginTop: '4px'
                    }}>
                      Update your personal details
                    </p>
                  </div>
                  {!editMode ? (
                    <button
                      onClick={toggleEditMode}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'transparent',
                        border: '1px solid #d1d5db',
                        color: '#374151',
                        cursor: 'pointer',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Edit style={{ width: '16px', height: '16px' }} />
                      Edit
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={toggleEditMode}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          border: '1px solid #d1d5db',
                          color: '#374151',
                          cursor: 'pointer',
                          fontWeight: '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <X style={{ width: '16px', height: '16px' }} />
                        Cancel
                      </button>
                      <button
                        onClick={handleProfileUpdate}
                        disabled={saving}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Save style={{ width: '16px', height: '16px' }} />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ padding: '24px' }}>
                <form onSubmit={handleProfileUpdate}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '16px'
                    }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: '#374151',
                          marginBottom: '4px'
                        }} htmlFor="firstName">
                          First Name
                        </label>
                        <input
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          disabled={!editMode}
                          required
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: '#374151',
                          marginBottom: '4px'
                        }} htmlFor="lastName">
                          Last Name
                        </label>
                        <input
                          id="lastName"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          disabled={!editMode}
                          required
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '4px'
                      }} htmlFor="email">
                        Email Address
                      </label>
                      <input
                        id="email"
                        value={profile.email}
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          backgroundColor: '#f9fafb'
                        }}
                      />
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        marginTop: '4px'
                      }}>
                        Email cannot be changed
                      </p>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '4px'
                      }} htmlFor="phone">
                        Phone Number
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        disabled={!editMode}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.875rem'
                        }}
                      />
                    </div>

                    {/* Password Change Section */}
                    {editMode && (
                      <>
                        <div style={{
                          height: '1px',
                          backgroundColor: '#e5e7eb',
                          margin: '16px 0'
                        }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <div>
                              <h4 style={{ fontWeight: '500' }}>Change Password</h4>
                              <p style={{
                                fontSize: '0.875rem',
                                color: '#6b7280'
                              }}>
                                Update your account password
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={togglePasswordChange}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: changingPassword ? '#ef4444' : 'transparent',
                                border: '1px solid #d1d5db',
                                color: changingPassword ? 'white' : '#374151',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '0.875rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <Key style={{ width: '14px', height: '14px' }} />
                              {changingPassword ? 'Cancel' : 'Change Password'}
                            </button>
                          </div>

                          {changingPassword && (
                            <div style={{
                              border: '1px solid #e5e7eb',
                              padding: '16px',
                              borderRadius: '8px',
                              backgroundColor: '#f9fafb'
                            }}>
                              <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                  display: 'block',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  color: '#374151',
                                  marginBottom: '4px'
                                }} htmlFor="currentPassword">
                                  Current Password
                                </label>
                                <input
                                  id="currentPassword"
                                  name="currentPassword"
                                  type="password"
                                  value={formData.currentPassword}
                                  onChange={handleInputChange}
                                  placeholder="Enter current password"
                                  required
                                  style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '0.875rem'
                                  }}
                                />
                              </div>

                              <div style={{ marginBottom: '16px' }}>
                                <label style={{
                                  display: 'block',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  color: '#374151',
                                  marginBottom: '4px'
                                }} htmlFor="newPassword">
                                  New Password
                                </label>
                                <input
                                  id="newPassword"
                                  name="newPassword"
                                  type="password"
                                  value={formData.newPassword}
                                  onChange={handleInputChange}
                                  placeholder="Enter new password (min 6 characters)"
                                  required
                                  style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '0.875rem'
                                  }}
                                />
                              </div>

                              <div>
                                <label style={{
                                  display: 'block',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  color: '#374151',
                                  marginBottom: '4px'
                                }} htmlFor="confirmPassword">
                                  Confirm New Password
                                </label>
                                <input
                                  id="confirmPassword"
                                  name="confirmPassword"
                                  type="password"
                                  value={formData.confirmPassword}
                                  onChange={handleInputChange}
                                  placeholder="Confirm new password"
                                  required
                                  style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '0.875rem'
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stats and Quick Info */}
        <div>
          {/* User Summary Card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px'
          }}>
            <div style={{ padding: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    color: 'white',
                    fontSize: '1.5rem',
                    fontWeight: '700'
                  }}>
                    {profile.firstName?.[0]?.toUpperCase() || 'R'}
                  </span>
                </div>
                <div style={{ flex: '1' }}>
                  <h3 style={{
                    fontWeight: '700',
                    fontSize: '1.125rem',
                    marginBottom: '4px'
                  }}>
                    {profile.firstName} {profile.lastName}
                  </h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '8px'
                  }}>{profile.email}</p>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: 'transparent',
                    color: '#374151',
                    border: '1px solid #d1d5db'
                  }}>
                    Reseller Account
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px'
          }}>
            <div style={{
              padding: '24px 24px 16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1f2937'
              }}>Quick Stats</h3>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Total Balance */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Wallet style={{ width: '20px', height: '20px', color: '#2563eb' }} />
                    </div>
                    <div>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>Total Balance</p>
                      <p style={{
                        fontSize: '1.5rem',
                        fontWeight: '700'
                      }}>
                        {formatCurrency(profile.stats?.totalBalance || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Orders */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ShoppingBag style={{ width: '20px', height: '20px', color: '#16a34a' }} />
                    </div>
                    <div>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>Total Orders</p>
                      <p style={{
                        fontSize: '1.5rem',
                        fontWeight: '700'
                      }}>
                        {profile.stats?.totalOrders || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Products */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#f3e8ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Package style={{ width: '20px', height: '20px', color: '#9333ea' }} />
                    </div>
                    <div>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>Total Products</p>
                      <p style={{
                        fontSize: '1.5rem',
                        fontWeight: '700'
                      }}>
                        {profile.stats?.totalProducts || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#ffedd5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <User style={{ width: '20px', height: '20px', color: '#ea580c' }} />
                    </div>
                    <div>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>Team Members</p>
                      <p style={{
                        fontSize: '1.5rem',
                        fontWeight: '700'
                      }}>
                        {profile.stats?.totalUsers || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              padding: '24px 24px 16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1f2937'
              }}>Account Status</h3>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>Email Verification</span>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: profile.isVerified ? '#dcfce7' : '#fee2e2',
                    color: profile.isVerified ? '#166534' : '#991b1b',
                    border: '1px solid transparent'
                  }}>
                    {profile.isVerified ? 'Verified' : 'Pending'}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>Account Status</span>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: profile.isBlocked ? '#fee2e2' : '#dcfce7',
                    color: profile.isBlocked ? '#991b1b' : '#166534',
                    border: '1px solid transparent'
                  }}>
                    {profile.isBlocked ? 'Blocked' : 'Active'}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>Company Status</span>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: profile.company?.isVerified ? '#dcfce7' : '#f3f4f6',
                    color: profile.company?.isVerified ? '#166534' : '#374151',
                    border: '1px solid transparent'
                  }}>
                    {profile.company?.isVerified ? 'Verified' : 'Pending'}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>Member Since</span>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={{
                height: '1px',
                backgroundColor: '#e5e7eb',
                margin: '24px 0'
              }}></div>

              <div>
                <h4 style={{
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  marginBottom: '8px'
                }}>Need Help?</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{
                    flex: '1',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid #d1d5db',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <Mail style={{ width: '12px', height: '12px' }} />
                    Contact Support
                  </button>
                  <button style={{
                    flex: '1',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid #d1d5db',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <Phone style={{ width: '12px', height: '12px' }} />
                    Call Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;