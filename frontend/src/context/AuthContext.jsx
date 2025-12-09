// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ FUNCIÓN PARA DECODIFICAR EL TOKEN JWT
 const decodeJWT = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const decodedPayload = JSON.parse(jsonPayload);
      
      // LOGS PARA VERIFICAR QUE LEEMOS BIEN
      console.log("Datos Token:", decodedPayload); 

      return {
        username: decodedPayload.username,
        email: decodedPayload.email,
        nombreCompleto: decodedPayload.nombre_completo,
        rol: decodedPayload.rol_nombre,
        // Asegúrate de que este campo exista en tu token, si no, array vacío
        permisos: decodedPayload.permisos || [], 
        userId: decodedPayload.user_id,
        exp: decodedPayload.exp * 1000,
      };
    } catch (error) {
      console.error('Error decodificando token JWT:', error);
      return null;
    }
  };
  // ✅ VERIFICAR SI EL TOKEN HA EXPIRADO
  const isTokenExpired = (exp) => {
    return Date.now() >= exp;
  };

  // ✅ CARGAR USUARIO DESDE EL TOKEN GUARDADO
  const loadUserFromToken = () => {
    const token = localStorage.getItem('jwt_token');
    
    if (!token) {
      setLoading(false);
      return false;
    }

    const userData = decodeJWT(token);
    
    if (!userData || isTokenExpired(userData.exp)) {
      // Token inválido o expirado
      localStorage.removeItem('jwt_token');
      setLoading(false);
      return false;
    }

    setUser(userData);
    setLoading(false);
    return true;
  };

  // ✅ VERIFICAR SI VIENE CON TOKEN POR URL (redirección desde login)
  const checkURLForToken = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // Guardar token y limpiar URL
      localStorage.setItem('jwt_token', token);
      window.history.replaceState({}, '', window.location.pathname);
      
      const userData = decodeJWT(token);
      if (userData && !isTokenExpired(userData.exp)) {
        setUser(userData);
        setLoading(false);
        return true;
      }
    }
    
    return false;
  };

  // ✅ INICIALIZAR AUTENTICACIÓN
  useEffect(() => {
    const initializeAuth = () => {
      // Primero verificar si viene con token por URL
      if (!checkURLForToken()) {
        // Si no viene por URL, cargar de localStorage
        loadUserFromToken();
      }
    };

    initializeAuth();
  }, []);

  // ✅ LOGIN - Guardar token (para cuando recibas de la app login)
 const login = (token) => {
    try {
        // 1. Guardamos con el nombre ESTÁNDAR
        localStorage.setItem('jwt_token', token); 
        
        // 2. Decodificamos
        const userData = decodeJWT(token);
        
        // 3. Validamos
        if (userData && !isTokenExpired(userData.exp)) {
          console.log("Usuario autenticado en Contexto:", userData.username);
          setUser(userData); // <--- ESTO ACTUALIZA LA PANTALLA ROJA A VERDE
          return true;
        }
        return false;
    } catch (e) {
        console.error("Error en login:", e);
        return false;
    }
  };

  // ✅ LOGOUT
  const logout = () => {
    localStorage.removeItem('jwt_token');
    setUser(null);
    // Redirigir a app de login
    //window.location.href = 'https://tu-app-login.aws.com';
  };

  // ✅ VERIFICAR SI TIENE UN PERMISO ESPECÍFICO
  const hasPermission = (permission) => {
    if (!user) return false;
    return user.permisos.includes(permission);
  };

  // ✅ VERIFICAR SI ES ADMIN
  const isAdmin = () => {
    return user && user.rol === 'SISTEMAS_ADMIN';
  };

  const value = {
    user,
    loading,
    login,
    logout,
    hasPermission,
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};