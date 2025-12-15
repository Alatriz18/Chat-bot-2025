import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../config/axios';

export const useTokenSync = () => {
    const { login, user } = useAuth();
    const [isSynced, setIsSynced] = useState(false);
    // Iniciamos en TRUE para bloquear la pantalla hasta estar 100% seguros
    const [isLoading, setIsLoading] = useState(true); 
    const processedRef = useRef(false);

    useEffect(() => {
        // Si ya hay usuario logueado, dejamos de cargar y salimos
        if (user) {
            setIsLoading(false);
            return;
        }

        // Si ya procesamos una vez, no lo hacemos de nuevo (React StrictMode)
        if (processedRef.current) return;

        const sync = async () => {
            processedRef.current = true;
            
            console.log("🔍 [TokenSync] Iniciando búsqueda de credenciales...");
            
            // 1. ESTRATEGIA DE BÚSQUEDA DEL TOKEN
            let token = null;
            const fullUrl = window.location.href;

            // A) Buscar en Hash (#token=...) - Lo más común en SSO
            if (fullUrl.includes('#token=')) {
                try {
                    token = fullUrl.split('#token=')[1].split('&')[0];
                    console.log("📍 Token encontrado en HASH");
                } catch (e) {}
            }
            
            // B) Buscar en Query Params (?token=...) - Por si el Hub cambia
            if (!token && fullUrl.includes('token=')) {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    token = urlParams.get('token');
                    console.log("📍 Token encontrado en QUERY PARAM");
                } catch (e) {}
            }

            // 2. SI NO HAY TOKEN EN URL -> BUSCAR COOKIE ACTIVA
            if (!token) {
                console.log("⚠️ No hay token en URL. Verificando cookie existente...");
                try {
                    // Hacemos una petición ligera al backend para ver si la cookie HttpOnly vive
                    const res = await api.get('/debug-token/'); // O '/admins/'
                    
                    if (res.status === 200 && res.data.token_found) {
                        console.log("🍪 Cookie válida detectada. Recargando contexto...");
                        // Truco: Forzar recarga para que AuthContext lea la cookie
                        // O si tienes un método checkAuth(), úsalo.
                        window.location.reload(); 
                        return; 
                    }
                } catch (e) {
                    console.log("⚪ No hay sesión activa. Usuario anónimo.");
                }
                setIsLoading(false); // No hay nada, mostramos Login
                return;
            }

            // 3. SI HAY TOKEN -> PROCESARLO
            try {
                console.log("🚀 Token capturado. Sincronizando con Backend...");
                
                // A) Sincronizar Cookie (Backend)
                await api.post('/set-auth-cookie/', { token });
                
                // B) Login en React (AuthContext)
                const success = login(token);
                
                if (success) {
                    console.log("✅ Login exitoso en Frontend");
                    setIsSynced(true);
                    
                    // C) Limpiar URL (Estética y Seguridad)
                    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                } else {
                    console.error("❌ El token capturado no es válido para este sistema.");
                }
            } catch (error) {
                console.error("❌ Error crítico sincronizando token:", error);
            } finally {
                // SIEMPRE terminamos la carga, sea éxito o error
                setIsLoading(false);
            }
        };

        sync();
    }, [user, login]);
    

    return { isSynced, isLoading };
};