// src/components/Layout/AdminLayout.jsx
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { 
  FiHome, FiPackage, FiShoppingCart, FiUser, FiSettings,
  FiDollarSign, FiChevronLeft, FiChevronRight, FiMenu, FiX,
  FiLogOut, FiGrid, FiLayers, FiPlusCircle, FiList,
  FiClock, FiCheckCircle, FiChevronDown, FiChevronUp
} from "react-icons/fi";
import apiClient from "../../api/apiClient";
import "./AdminLayout.css";

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [loggingOut, setLoggingOut] = useState(false);

  // Menu items configuration
  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <FiHome />,
      path: "/dashboard",
      exact: true
    },
    {
      id: "products",
      label: "Products",
      icon: <FiPackage />,
      path: "/dashboard/products",
    //   subItems: [
    //     { id: "all-products", label: "All Products", icon: <FiLayers />, path: "/dashboard/products" },
    //     { id: "add-product", label: "Add New", icon: <FiPlusCircle />, path: "/dashboard/products/add" },
    //     { id: "categories", label: "Categories", icon: <FiGrid />, path: "/dashboard/products/categories" },
    //   ],
    },
    {
      id: "orders",
      label: "Orders",
      icon: <FiShoppingCart />,
      path: "/dashboard/orders",
      subItems: [
        { id: "all-orders", label: "All Orders", icon: <FiList />, path: "/dashboard/orders" },
        { id: "pending", label: "Pending", icon: <FiClock />, path: "/dashboard/orders/pending" },
        { id: "completed", label: "Completed", icon: <FiCheckCircle />, path: "/dashboard/orders/completed" },
      ],
    },
    {
      id: "profile",
      label: "Profile",
      icon: <FiUser />,
      path: "/dashboard/profile",
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: <FiDollarSign />,
      path: "/dashboard/wallet",
    },
    {
      id: "settings",
      label: "Settings",
      icon: <FiSettings />,
      path: "/dashboard/settings",
    },
  ];

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true); // Always open on desktop
      } else {
        setSidebarOpen(false); // Closed by default on mobile
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-expand active menu items and set active state
  useEffect(() => {
    const currentPath = location.pathname;
    console.log("Current path:", currentPath);
    
    // Reset expanded items and expand active ones
    const newExpandedItems = {};
    
    for (const item of menuItems) {
      if (item.subItems) {
        // Check if any sub-item matches the current path
        const isSubItemActive = item.subItems.some(subItem => 
          currentPath === subItem.path || currentPath.startsWith(subItem.path + '/')
        );
        
        if (isSubItemActive) {
          newExpandedItems[item.id] = true;
        }
      }
    }
    
    setExpandedItems(newExpandedItems);
  }, [location.pathname]);

  // Navigation handlers
  const handleNavigation = (path) => {
    console.log("Navigating to:", path);
    navigate(path);
    if (isMobile) {
      setSidebarOpen(false); // Close sidebar on mobile after navigation
    }
  };

  const handleMenuToggle = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  };

  const toggleSubmenu = (itemId, e) => {
    if (e) e.stopPropagation();
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleMenuItemClick = (item, e) => {
    console.log("Menu item clicked:", item.id);
    
    // If item has subItems and we're not on mobile, toggle submenu
    if (item.subItems && !isMobile) {
      e.preventDefault();
      e.stopPropagation();
      toggleSubmenu(item.id, e);
    } else if (item.subItems && isMobile) {
      // On mobile, if clicked on parent item with subItems, navigate to first subitem
      e.preventDefault();
      e.stopPropagation();
      if (!expandedItems[item.id]) {
        toggleSubmenu(item.id, e);
      } else {
        // If already expanded, navigate to first subitem
        handleNavigation(item.subItems[0].path);
      }
    } else {
      // If no subItems or on mobile with single click, navigate
      handleNavigation(item.path);
    }
  };

  // Helper functions
  const isItemActive = (item) => {
    const currentPath = location.pathname;
    
    // Check exact match for dashboard
    if (item.exact) {
      return currentPath === item.path;
    }
    
    // Check main item
    if (currentPath === item.path || currentPath.startsWith(item.path + '/')) {
      return true;
    }
    
    // Check sub-items
    if (item.subItems) {
      return item.subItems.some(subItem => 
        currentPath === subItem.path || currentPath.startsWith(subItem.path + '/')
      );
    }
    
    return false;
  };

  const isSubItemActive = (subItem) => {
    const currentPath = location.pathname;
    return currentPath === subItem.path || currentPath.startsWith(subItem.path + '/');
  };

  // Check if we should show submenu
  const shouldShowSubmenu = (item) => {
    return item.subItems && (!sidebarCollapsed || isMobile) && expandedItems[item.id];
  };

  return (
    <div className="admin-layout">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-container">
          {/* Left side: Menu button and Brand */}
          <div className="navbar-left">
            <button 
              className="menu-toggle-btn"
              onClick={handleMenuToggle}
              aria-label="Toggle menu"
            >
              {isMobile ? (sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />) : <FiMenu size={24} />}
            </button>
            <div className="navbar-brand">
              <h1>Corp Pannel</h1>
            </div>
          </div>

          {/* Right side: Logout button */}
          <div className="navbar-right">
            <button
              className="logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <FiLogOut className="logout-icon" />
              <span>{loggingOut ? "Logging out..." : "Logout"}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="layout-content">
        {/* Sidebar Backdrop (Mobile only) */}
        {isMobile && sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarOpen ? 'open' : ''}`}>
          {/* Sidebar Header */}
          <div className="sidebar-header">
            {!sidebarCollapsed && (
              <div className="sidebar-logo" onClick={() => handleNavigation("/dashboard")}>
                <h2>Admin Panel</h2>
              </div>
            )}
            
            {/* Desktop collapse button */}
            {!isMobile && (
              <button 
                className="toggle-btn" 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? "Expand" : "Collapse"}
              >
                {sidebarCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
              </button>
            )}
            
            {/* Mobile close button */}
            {isMobile && (
              <button className="toggle-btn mobile-close" onClick={() => setSidebarOpen(false)} title="Close">
                <FiX />
              </button>
            )}
          </div>

          {/* Menu Items */}
          <div className="sidebar-menu">
            {menuItems.map((item) => (
              <div key={item.id} className="menu-section">
                <div
                  className={`menu-item ${isItemActive(item) ? "active" : ""} ${
                    sidebarCollapsed ? "collapsed" : ""
                  }`}
                  onClick={(e) => handleMenuItemClick(item, e)}
                  title={sidebarCollapsed ? item.label : ""}
                >
                  <span className="menu-icon">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="menu-label">{item.label}</span>
                      {item.subItems && !isMobile && (
                        <span className="menu-arrow">
                          {expandedItems[item.id] ? <FiChevronDown /> : <FiChevronRight />}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Sub-items */}
                {shouldShowSubmenu(item) && (
                  <div className="submenu">
                    {item.subItems.map((subItem) => (
                      <div
                        key={subItem.id}
                        className={`submenu-item ${isSubItemActive(subItem) ? "active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigation(subItem.path);
                        }}
                      >
                        <span className="submenu-icon">{subItem.icon}</span>
                        <span className="submenu-label">{subItem.label}</span>
                        {isSubItemActive(subItem) && <div className="active-indicator"></div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">
                <span>A</span>
              </div>
              {!sidebarCollapsed && (
                <div className="user-details">
                  <span className="user-name">Admin User</span>
                  <span className="user-email">admin@example.com</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;