import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Chat from './pages/Chat';
import AdminPanel from './pages/AdminPanel'
import MyTickets from './pages/MyTickets'
import './App.css';

const syncTokenWithDjango = async (jwtToken) => {
  try {
    console.log("🔄 Sincronizando token con Django...");
    
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://eipaj4pzfp.us-east-1.awsapprunner.com/api';
    
    const response = await fetch(`${API_BASE_URL}/set-auth-cookie/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // ¡IMPORTANTE! Para recibir cookies
      body: JSON.stringify({ token: jwtToken })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token sincronizado con Django:', data);
      return true;
    } else {
      const errorData = await response.json();
      console.error('❌ Error sincronizando token:', errorData);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error en syncTokenWithDjango:', error);
    return false;
  }
};

// 2. COMPONENTE SSOCallback - ACTUALIZADO
const SSOCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  useEffect(() => {
    const processSSOToken = async () => {
      const hash = window.location.hash;
      
      if (hash && hash.includes('token=')) {
        const token = hash.split('token=')[1];
        console.log("✅ Token capturado del SSO:", token.substring(0, 50) + "...");
        
        try {
          // PASO CRÍTICO 1: Sincronizar token con Django
          console.log("🔄 Paso 1: Sincronizando token con Django...");
          const syncSuccess = await syncTokenWithDjango(token);
          
          if (!syncSuccess) {
            console.error("❌ Falló la sincronización con Django");
            navigate('/');
            return;
          }
          
          // PASO CRÍTICO 2: Login en el contexto de React
          console.log("🔄 Paso 2: Login en contexto React...");
          const loginSuccess = login(token);
          
          if (loginSuccess) {
            console.log("✅ Login exitoso, redirigiendo al chat...");
            
            // Pequeño delay para asegurar que las cookies se establecieron
            setTimeout(() => {
              navigate('/chat', { replace: true });
            }, 500);
            
          } else {
            console.error("❌ El token es inválido o expiró");
            navigate('/');
          }
          
        } catch (error) {
          console.error("❌ Error procesando token SSO:", error);
          navigate('/');
        }
        
      } else {
        console.warn("⚠️ No se encontró token en el hash de la URL");
        navigate('/');
      }
    };
    
    processSSOToken();
  }, [navigate, login]);

  return (
    <div className="loading-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
      <div style={{textAlign: 'center'}}>
        <h2>🔄 Sincronizando con sistema de tickets...</h2>
        <p>Estamos configurando tu sesión. Por favor espera.</p>
        <div className="loading-spinner"></div>
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