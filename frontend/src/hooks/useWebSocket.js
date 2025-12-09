import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (url, onMessage, onOpen, onClose) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef(null);

  const connect = () => {
    try {
      const token = localStorage.getItem('access_token');
      const wsUrl = url.includes('?') ? `${url}&token=${token}` : `${url}?token=${token}`;
      
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('🔌 WebSocket conectado');
        setIsConnected(true);
        onOpen?.();
        
        // Heartbeat
        setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      };
      
      ws.current.onclose = () => {
        console.log('🔌 WebSocket desconectado');
        setIsConnected(false);
        onClose?.();
        
        // Reconexión automática
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, 5000);
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.current?.close();
      };
      
    } catch (error) {
      console.error('Error conectando WebSocket:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    ws.current?.close();
  };

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [url]);

  return { isConnected, send, disconnect, reconnect: connect };
};