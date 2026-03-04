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
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedNotifications) setNotifications(JSON.parse(savedNotifications));
  }, []);

  // Actualizar contador de no leídos y persistir
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
    localStorage.setItem('adminNotifications', JSON.stringify(notifications));
  }, [notifications]);

  // ← FIX: tu AuthContext guarda el token como 'jwt_token', no 'access_token'
  const token = localStorage.getItem('jwt_token') || '';
  const wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
  const wsUrl = `${wsBase}/ws/notifications/?token=${token}`;

  const { isConnected } = useWebSocket(
    wsUrl,
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
  }, [settings]);

  const playNotificationSound = useCallback(async () => {
    if (settings.sound === 'none') return;
    try {
      let audioSrc;
      if (settings.sound === 'custom' && settings.customSoundUrl) {
        audioSrc = settings.customSoundUrl;
      } else {
        audioSrc = '/static/notification_sounds/default-sound.mp3';
      }
      const audio = new Audio(audioSrc);
      audio.volume = settings.volume / 100;
      await audio.play();
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
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
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
          // ← FIX: usar token correcto en el polling también
          const t = localStorage.getItem('jwt_token');
          if (!t) return;
          const response = await fetch('/api/admin/tickets/', {
            headers: { 'Authorization': `Bearer ${t}` }
          });
          if (!response.ok) return;
          // Solo usamos el polling para mantener viva la conexión,
          // las notificaciones reales vienen por WebSocket
        } catch (error) {
          console.error('Error en polling:', error);
        }
      }, 30000);
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