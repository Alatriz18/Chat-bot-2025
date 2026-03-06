import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useTokenSync } from './hooks/useTokenSync';

// Pages
import Chat from './pages/Chat';
import AdminPanel from './pages/AdminPanel';
import MyTickets from './pages/MyTickets';
import ReportesPage from './pages/ReportesPage';
import SugerenciasAdminPage from './pages/SugerenciasAdminPage';
import './App.css';

const LoadingScreen = ({ message }) => (
  <div className="loading-container" style={{
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    height: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'
  }}>
    <div className="loading-spinner" style={{borderTopColor: 'white'}}></div>
    <p style={{marginTop: 20, fontSize: 18}}>{message}</p>
  </div>
);

const AppRoutes = () => {
  const { isSynced, isLoading: isSyncing } = useTokenSync();
  const { user, loading: authLoading, isAdmin, hasPermission } = useAuth();

  if (isSyncing || authLoading) {
    return <LoadingScreen message={isSyncing ? "Sincronizando seguridad..." : "Verificando sesión..."} />;
  }

  const ProtectedRoute = ({ children, requireAdmin, requirePermission }) => {
    if (!user) return <Navigate to="/" replace />;
    if (requireAdmin && !isAdmin()) return <Navigate to="/chat" replace />;
    if (requirePermission && !hasPermission(requirePermission)) return <Navigate to="/chat" replace />;
    return children;
  };

  return (
    <Routes>
      <Route path="/" element={
        user ? <Navigate to="/chat" replace /> : (
          <div style={{textAlign: 'center', marginTop: 100}}>
            <h1>Bienvenido al Chatbot TI</h1>
            <p>Por favor inicia sesión desde el Portal.</p>
          </div>
        )
      } />

      <Route path="/chat" element={
        <ProtectedRoute requirePermission="core.chatbot_acceso">
          <Chat />
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute requirePermission="core.chatbot_admin">
          <AdminPanel />
        </ProtectedRoute>
      } />

      <Route path="/admin/tickets" element={
        <ProtectedRoute requirePermission="core.chatbot_admin">
          <MyTickets />
        </ProtectedRoute>
      } />

      {/* ── NUEVAS RUTAS ── */}
      <Route path="/admin/reportes" element={
        <ProtectedRoute requirePermission="core.chatbot_admin">
          <ReportesPage />
        </ProtectedRoute>
      } />

      <Route path="/admin/sugerencias" element={
        <ProtectedRoute requirePermission="core.chatbot_admin">
          <SugerenciasAdminPage />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;