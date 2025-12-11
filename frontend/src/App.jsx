import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useTokenSync } from './hooks/useTokenSync'; // <--- Usamos el Hook Maestro

// Pages
import Chat from './pages/Chat';
import AdminPanel from './pages/AdminPanel';
import MyTickets from './pages/MyTickets';
import './App.css';

// --- COMPONENTE DE CARGA ---
const LoadingScreen = ({ message }) => (
  <div className="loading-container" style={{
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', 
    height: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'
  }}>
    <div className="loading-spinner" style={{borderTopColor: 'white'}}></div>
    <p style={{marginTop: 20, fontSize: 18}}>{message}</p>
  </div>
);

// --- COMPONENTE GESTOR DE RUTAS Y SYNC ---
const AppRoutes = () => {
  // 1. Ejecutar sincronización de token AQUI, al nivel más alto posible
  const { isSynced, isLoading: isSyncing } = useTokenSync();
  const { user, loading: authLoading, isAdmin, hasPermission } = useAuth();

  // 2. Si estamos sincronizando el token o cargando usuario, BLOQUEAR TODO
  if (isSyncing || authLoading) {
    return <LoadingScreen message={isSyncing ? "Sincronizando seguridad..." : "Verificando sesión..."} />;
  }

  // 3. Componente interno para protección
  const ProtectedRoute = ({ children, requireAdmin, requirePermission }) => {
    if (!user) return <Navigate to="/" replace />;
    if (requireAdmin && !isAdmin()) return <Navigate to="/chat" replace />;
    if (requirePermission && !hasPermission(requirePermission)) return <Navigate to="/chat" replace />;
    return children;
  };

  return (
    <Routes>
      {/* RUTA HOME: Si hay usuario -> Chat, si no -> Login/Mensaje */}
      <Route path="/" element={
        user ? <Navigate to="/chat" replace /> : (
          <div style={{textAlign: 'center', marginTop: 100}}>
            <h1>Bienvenido al Chatbot TI</h1>
            <p>Por favor inicia sesión desde el Portal.</p>
          </div>
        )
      } />

      {/* RUTAS PROTEGIDAS */}
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

      {/* Redirección para rutas desconocidas */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// --- APP PRINCIPAL ---
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