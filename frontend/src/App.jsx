import React, { useEffect, useState } from 'react'; // Añadimos useState
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Chat from './pages/Chat';
import AdminPanel from './pages/AdminPanel';
import MyTickets from './pages/MyTickets';
import './App.css';

// 1. Función para sincronizar token con Django
const syncTokenWithDjango = async (jwtToken) => {
  try {
    console.log("🔄 Sincronizando token con Django...");
    
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://eipaj4pzfp.us-east-1.awsapprunner.com/api';
    
    const response = await fetch(`${API_BASE_URL}/set-auth-cookie/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ token: jwtToken })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token sincronizado con Django:', data);
      return true;
    } else {
      try {
        const errorData = await response.json();
        console.error('❌ Error sincronizando token:', errorData);
      } catch {
        console.error('❌ Error sincronizando token:', response.statusText);
      }
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error en syncTokenWithDjango:', error);
    return false;
  }
};

// 2. COMPONENTE SSOCallback - CORREGIDO
const SSOCallback = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  
  useEffect(() => {
    // Evitar procesar múltiples veces
    if (processing || hasProcessed || user) {
      return;
    }
    
    const processSSOToken = async () => {
      setProcessing(true);
      setHasProcessed(true);
      const hash = window.location.hash;
      
      console.log("🔍 Procesando SSO callback, hash:", hash ? "presente" : "ausente");
      
      if (hash && hash.includes('token=')) {
        const token = hash.split('token=')[1];
        console.log("✅ Token capturado del SSO");
        
        try {
          // PASO 1: Sincronizar con Django
          console.log("📡 Enviando token a Django...");
          const syncSuccess = await syncTokenWithDjango(token);
          
          if (!syncSuccess) {
            console.error("❌ Falló la sincronización con Django");
            localStorage.removeItem('jwt_token');
            setProcessing(false);
            navigate('/', { replace: true });
            return;
          }
          
          // PASO 2: Login en contexto React
          console.log("🔑 Haciendo login en contexto React...");
          const loginSuccess = login(token);
          
          if (loginSuccess) {
            console.log("✅ Login exitoso, redirigiendo a /chat");
            
            // Limpiar el hash de la URL inmediatamente
            window.history.replaceState({}, '', window.location.pathname);
            
            // Pequeño delay para asegurar que el estado se actualice
            setTimeout(() => {
              navigate('/chat', { replace: true });
            }, 100);
          } else {
            console.error("❌ Token inválido para login en React");
            localStorage.removeItem('jwt_token');
            setProcessing(false);
            navigate('/', { replace: true });
          }
          
        } catch (error) {
          console.error("❌ Error procesando token:", error);
          localStorage.removeItem('jwt_token');
          setProcessing(false);
          navigate('/', { replace: true });
        }
        
      } else {
        console.warn("⚠️ No se encontró token en el hash");
        setProcessing(false);
        navigate('/', { replace: true });
      }
    };
    
    processSSOToken();
    
  }, [navigate, login, user, processing, hasProcessed]);

  return (
    <div className="loading-container" style={{
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{textAlign: 'center', color: 'white'}}>
        <div style={{fontSize: '48px', marginBottom: '20px'}}>🔄</div>
        <h2 style={{marginBottom: '10px'}}>Sincronizando sesión...</h2>
        <p>Configurando tu acceso al sistema.</p>
        <div style={{
          marginTop: '20px',
          width: '50px',
          height: '50px',
          border: '3px solid rgba(255,255,255,0.3)',
          borderTop: '3px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '20px auto'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

// 3. COMPONENTE PARA RUTAS PROTEGIDAS - MEJORADO
const ProtectedRoute = ({ children, requireAdmin = false, requirePermission = null }) => {
  const { user, loading, isAdmin, hasPermission } = useAuth();

  console.log("🔐 ProtectedRoute - Estado:", {
    user: user ? user.username : 'null',
    loading,
    requirePermission,
    hasPermission: requirePermission ? hasPermission(requirePermission) : 'N/A',
    requireAdmin
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando permisos...</p>
      </div>
    );
  }
  
  if (!user) {
    console.log("❌ No hay usuario, redirigiendo a /");
    return <Navigate to="/" replace />;
  }
  
  if (requireAdmin && !isAdmin()) {
    console.log("❌ No es admin, redirigiendo a /chat");
    return <Navigate to="/chat" replace />;
  }
  
  if (requirePermission && !hasPermission(requirePermission)) {
    console.log(`❌ No tiene permiso: ${requirePermission}, redirigiendo a /chat`);
    return <Navigate to="/chat" replace />;
  }

  console.log("✅ Acceso permitido a", children.type.name || 'componente');
  return children;
};

// 4. REDIRECCIÓN HOME - MEJORADA
const HomeRedirect = () => {
  const { user, loading } = useAuth();
  
  console.log("🏠 HomeRedirect - Estado:", {
    user: user ? user.username : 'null',
    loading
  });
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Verificando sesión...</p>
      </div>
    );
  }
  
  if (user) {
    console.log("✅ Usuario autenticado, redirigiendo a /chat");
    return <Navigate to="/chat" replace />;
  } else {
    console.log("❌ No hay usuario, mostrando pantalla de acceso denegado");
    return (
      <div style={{
        color: 'red', 
        padding: 20, 
        textAlign: 'center',
        maxWidth: '600px',
        margin: '50px auto',
        border: '2px solid #f44336',
        borderRadius: '10px',
        background: '#fff5f5'
      }}>
        <h1>🔒 Acceso Denegado</h1>
        <p>No se encontró una sesión activa en el sistema.</p>
        <p>Por favor, inicia sesión a través del portal de autenticación.</p>
        <div style={{marginTop: '20px'}}>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Reintentar
          </button>
        </div>
        <div style={{marginTop: '20px', fontSize: '14px', color: '#666'}}>
          <p>Verifica en DevTools → Application → Local Storage → jwt_token</p>
          <p>Cookie chatbot-auth: {document.cookie.includes('chatbot-auth') ? '✅ Presente' : '❌ Ausente'}</p>
        </div>
      </div>
    );
  }
};

// 5. COMPONENTE PRINCIPAL APP
function App() {
  console.log("🚀 App montada");
  
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            {/* RUTA 1: Home (redirección) */}
            <Route path="/" element={<HomeRedirect />} />

            {/* RUTA 2: Callback SSO */}
            <Route path="/sso-login" element={<SSOCallback />} />
            
            {/* RUTA 3: Chat principal */}
            <Route path="/chat" element={
              <ProtectedRoute requirePermission="core.chatbot_acceso">
                <Chat />
              </ProtectedRoute>
            } />
            
            {/* RUTA 4: Panel de administración */}
            <Route path="/admin" element={
              <ProtectedRoute requirePermission="core.chatbot_admin">
                <AdminPanel />
              </ProtectedRoute>
            } />
            
            {/* RUTA 5: Mis tickets (solo para admins) */}
            <Route path="/admin/tickets" element={
              <ProtectedRoute requirePermission="core.chatbot_admin">
                <MyTickets />
              </ProtectedRoute>
            } />
            
            {/* RUTA 6: Catch-all para SPA */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;