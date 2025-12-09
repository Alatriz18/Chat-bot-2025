import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({
    sound: 'default',
    volume: 70,
    autoMarkAsRead: true,
    desktopNotifications: true,
    customSoundUrl: null
  });
  const [unreadCount, setUnreadCount] = useState(0);

  // Cargar configuración y notificaciones guardadas
  useEffect(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    const savedNotifications = localStorage.getItem('adminNotifications');
    
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
    }
  }, []);

  // Actualizar contador de no leídos
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
    
    // Guardar en localStorage
    localStorage.setItem('adminNotifications', JSON.stringify(notifications));
  }, [notifications]);

  // WebSocket para notificaciones en tiempo real
  const { isConnected } = useWebSocket(
    `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/ws/notifications/`,
    (data) => {
      if (data.type === 'notification' || data.type === 'ticket_assigned') {
        addNotification(data.data);
      }
    }
  );

  const addNotification = useCallback((notificationData) => {
    const newNotification = {
      id: `${notificationData.ticket_id || Date.now()}-${Math.random()}`,
      type: notificationData.type || 'info',
      title: notificationData.title,
      message: notificationData.message,
      ticketId: notificationData.ticket_id,
      timestamp: new Date().toISOString(),
      read: false,
      data: notificationData
    };

    setNotifications(prev => [newNotification, ...prev]);
    playNotificationSound();
    showDesktopNotification(newNotification);
  }, []);

  const playNotificationSound = useCallback(async () => {
    try {
      let audioSrc;
      
      if (settings.sound === 'custom' && settings.customSoundUrl) {
        audioSrc = settings.customSoundUrl;
      } else {
        audioSrc = `/static/notification_sounds/${settings.sound}-sound.mp3`;
      }

      const audio = new Audio(audioSrc);
      audio.volume = settings.volume / 100;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (error) {
      console.warn('Error reproduciendo sonido:', error);
    }
  }, [settings]);

  const showDesktopNotification = useCallback((notification) => {
    if (!settings.desktopNotifications || !('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.ticketId
      });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [settings]);

  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.filter(notif => notif.id !== notificationId)
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
  }, []);

  // Polling como fallback si WebSocket falla
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch('/api/admin/tickets');
          const tickets = await response.json();
          
          // Lógica para detectar nuevos tickets asignados
          // (similar a tu JavaScript original)
        } catch (error) {
          console.error('Error en polling:', error);
        }
      }, 30000); // Cada 30 segundos

      return () => clearInterval(interval);
    }
  }, [isConnected]);

  return {
    notifications,
    unreadCount,
    settings,
    isConnected,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    updateSettings
  };
};