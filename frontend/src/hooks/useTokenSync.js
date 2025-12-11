import { useEffect, useState } from 'react';
import api from '../config/axios';

export const useTokenSync = () => {
    const [isSynced, setIsSynced] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const syncToken = async () => {
            // 1. Buscar token en la URL (viene del SSO)
            // Ejemplo: tusitio.com/#access_token=eyJ...
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const tokenFromUrl = params.get('access_token'); // O 'id_token' según tu SSO

            if (tokenFromUrl) {
                console.log("🔄 Sincronizando token con Django...");
                try {
                    // 2. Enviarlo al backend para que nos devuelva la Cookie
                    await api.post('/set-auth-cookie/', { token: tokenFromUrl });
                    
                    console.log("✅ Cookie establecida. Login exitoso.");
                    setIsSynced(true);
                    
                    // 3. Limpiar la URL para seguridad
                    window.history.replaceState(null, '', ' ');
                } catch (error) {
                    console.error("❌ Falló la sincronización con Django", error);
                }
            } else {
                // Si no hay token en URL, asumimos que ya existe una cookie antigua
                setIsSynced(true); 
            }
            setIsLoading(false);
        };

        syncToken();
    }, []);

    return { isSynced, isLoading };
};