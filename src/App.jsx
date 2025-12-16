// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./components/LoginPage/LoginForm";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/Layout/AdminLayout";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProductList from "./pages/Products/ProductList";
import ProductPage from "./Pages/Products/ProductsPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import WalletPage from "./pages/Wallet/WalletPage";
import OrdersPage from "./Pages/Orders/OrdersPage";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected Admin Routes with Layout */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="" element={<Dashboard />} />
              <Route path="products" element={<ProductList />} />
              <Route path="products/:id" element={<ProductPage />} />
              <Route path="products/add" element={<div>Add Product Page</div>} />
              <Route path="products/categories" element={<div>Categories Page</div>} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/pending" element={<div>Pending Orders</div>} />
              <Route path="orders/completed" element={<div>Completed Orders</div>} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="settings" element={<div>Settings Page</div>} />
            </Route>
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Redirect all other routes to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;