import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Chat from './pages/Chat';
import AdminPanel from './pages/AdminPanel'
import MyTickets from './pages/MyTickets'
import './App.css';

//  1. NUEVO COMPONENTE: Manejador del Login SSO
// Este componente captura el token cuando la URL es /sso-login#token=...
const SSOCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  useEffect(() => {
   const hash = window.location.hash;
  if (hash && hash.includes('token=')) {
      const token = hash.split('token=')[1];
      console.log("Token capturado del SSO:", token);
      
      // PASO CRÍTICO: Usamos la función login() del AuthContext.
      // Esto hace 2 cosas: 
      // 1. Guarda en localStorage.
      // 2. Actualiza el estado 'user' de React INMEDIATAMENTE.
      const success = login(token);

      if (success) {
        console.log("Login exitoso, redirigiendo al chat...");
        // Usamos replace: true para que no puedan volver atrás al login
        navigate('/chat', { replace: true });
      } else {
        console.error("El token es inválido o expiró");
        navigate('/'); 
      }
    } else {
      console.warn("No se encontró token en el hash de la URL");
      navigate('/');
    }
  }, [navigate, login]); // Agregamos login a las dependencias

  return (
    <div className="loading-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
      <div style={{textAlign: 'center'}}>
        <h2>Validando credenciales...</h2>
        <p>Por favor espera un momento.</p>
      </div>
    </div>
  );
};
//  COMPONENTE PARA RUTAS PROTEGIDAS (Sin cambios)
const ProtectedRoute = ({ children, requireAdmin = false, requirePermission = null }) => {
  const { user, loading, isAdmin, hasPermission } = useAuth();

  if (loading) return <div className="loading">Cargando...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (requireAdmin && !isAdmin()) return <div>No tienes permisos de administrador</div>;
  if (requirePermission && !hasPermission(requirePermission)) return <div>No tienes permisos</div>;

  return children;
};

//  REDIRECCIÓN HOME (Sin cambios)
const HomeRedirect = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="loading">Cargando...</div>;
  
  if (user) {
    return <Navigate to="/chat" replace />;
  } else {
    // Si entran a la raíz y no hay usuario, mandamos al login externo
    //window.location.href = 'https://tu-app-login.aws.com';
    return (
        <div style={{color: 'red', padding: 20, textAlign: 'center'}}>
            <h1>Acceso Denegado (Local)</h1>
            <p>No se encontró el usuario en el contexto.</p>
            <p>Verifica Application - Local Storage - jwt_token</p>
            <button onClick={() => window.location.reload()}>Reintentar</button>
        </div>
    );
  }
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
      <Router>
        <Routes>
          {/*  RUTA 1: La Home normal */}
          <Route path="/" element={<HomeRedirect />} />

          {/*  RUTA 2: LA NUEVA RUTA PARA EL SSO */}
          {/* Esto arreglará el error "No routes matched location /sso-login" */}
          <Route path="/sso-login" element={<SSOCallback />} />
          
          {/*  RUTA 3: El Chat */}
          <Route path="/chat" element={
            <ProtectedRoute requirePermission="core.chatbot_acceso">
              <Chat />
            </ProtectedRoute>
          } />
          
          {/*  RUTA 4: Admin */}
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
        </Routes>
      </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;