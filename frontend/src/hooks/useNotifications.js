import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../config/axios';

const POLL_INTERVAL_MS = 30_000; // cada 30 segundos
const STORAGE_KEY_SETTINGS      = 'notificationSettings';
const STORAGE_KEY_NOTIFICATIONS = 'adminNotifications';
const STORAGE_KEY_LAST_CHECK    = 'notificationsLastCheck';

export const useNotifications = () => {
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount,   setUnreadCount]     = useState(0);
  const [isConnected,   setIsConnected]     = useState(false);
  const [settings, setSettings] = useState({
    sound:               'default',
    volume:              70,
    desktopNotifications: true,
    customSoundUrl:      null,
  });

  const lastCheckRef  = useRef(null);
  const intervalRef   = useRef(null);
  const isMountedRef  = useRef(true);

  // ── Cargar estado inicial desde localStorage ──
  useEffect(() => {
    const savedSettings  = localStorage.getItem(STORAGE_KEY_SETTINGS);
    const savedNotifs    = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    const savedLastCheck = localStorage.getItem(STORAGE_KEY_LAST_CHECK);

    if (savedSettings)   setSettings(JSON.parse(savedSettings));
    if (savedNotifs)     setNotifications(JSON.parse(savedNotifs));
    if (savedLastCheck)  lastCheckRef.current = savedLastCheck;

    return () => { isMountedRef.current = false; };
  }, []);

  // ── Persistir notificaciones y actualizar badge ──
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  // ── Reproducir sonido ──
  const playSound = useCallback(async (currentSettings) => {
    const s = currentSettings || settings;
    if (s.sound === 'none') return;
    try {
      const src = s.sound === 'custom' && s.customSoundUrl
        ? s.customSoundUrl
        : '/static/notification_sounds/default-sound.mp3';
      const audio = new Audio(src);
      audio.volume = (s.volume ?? 70) / 100;
      await audio.play();
    } catch (e) {
      console.warn('Error reproduciendo sonido:', e);
    }
  }, [settings]);

  // ── Notificación nativa del navegador ──
  const showDesktopNotification = useCallback((title, body, ticketId) => {
    if (!settings.desktopNotifications || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico', tag: String(ticketId) });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [settings]);

  // ── Procesar tickets nuevos ──
  const processNewTickets = useCallback((tickets) => {
    if (!tickets || tickets.length === 0) return;

    setNotifications(prev => {
      const existingCods = new Set(prev.map(n => n.ticketCod));
      const genuinelyNew = tickets
        .filter(t => !existingCods.has(t.ticket_cod))
        .map(t => ({
          id:        `${t.ticket_cod}-${Date.now()}-${Math.random()}`,
          type:      'ticket_assigned',
          title:     '🎫 Nuevo ticket asignado',
          message:   t.titulo || 'Sin asunto',
          subtitle:  t.creado_por ? `Creado por ${t.creado_por}` : '',
          ticketId:  t.ticket_id,
          ticketCod: t.ticket_cod,
          timestamp: t.fecha || new Date().toISOString(),
          read:      false,
          data:      t,
        }));

      if (genuinelyNew.length === 0) return prev;

      // Sonido y notificación de escritorio
      genuinelyNew.forEach(n => {
        playSound();
        showDesktopNotification(n.title, n.message, n.ticketId);
      });

      return [...genuinelyNew, ...prev];
    });
  }, [playSound, showDesktopNotification]);

  // ── Función de polling ──
  const poll = useCallback(async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) return;

      const params = lastCheckRef.current ? { since: lastCheckRef.current } : {};
      const response = await api.get('/admin/tickets/new/', { params });
      const { tickets, checked_at } = response.data;

      if (checked_at) {
        lastCheckRef.current = checked_at;
        localStorage.setItem(STORAGE_KEY_LAST_CHECK, checked_at);
      }

      if (isMountedRef.current) {
        setIsConnected(true);
        processNewTickets(tickets);
      }
    } catch (error) {
      // Si es 403/404 probablemente no es admin — silencioso
      if (isMountedRef.current) setIsConnected(false);
    }
  }, [processNewTickets]);

  // ── Iniciar polling ──
  useEffect(() => {
    const initialTimer = setTimeout(poll, 3000);
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalRef.current);
    };
  }, [poll]);

  // ── API pública ──
  const markAsRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY_NOTIFICATIONS);
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(newSettings));
  }, []);

  const refreshNow = useCallback(() => poll(), [poll]);

  return {
    notifications,
    unreadCount,
    settings,
    isConnected,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    updateSettings,
    refreshNow,
  };
};