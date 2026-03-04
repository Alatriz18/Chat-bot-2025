import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../config/axios';

const POLL_INTERVAL_MS        = 30_000;
const STORAGE_KEY_SETTINGS    = 'notificationSettings';
const STORAGE_KEY_NOTIFS      = 'adminNotifications';
const STORAGE_KEY_LAST_CHECK  = 'notificationsLastCheck';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [isConnected,   setIsConnected]   = useState(false);
  const [settings, setSettings] = useState({
    sound:                'default',
    volume:               70,
    desktopNotifications: true,
    customSoundUrl:       null,
  });

  const lastCheckRef = useRef(null);
  const intervalRef  = useRef(null);
  const mountedRef   = useRef(true);

  // ── Cargar desde localStorage ──
  useEffect(() => {
    const s  = localStorage.getItem(STORAGE_KEY_SETTINGS);
    const n  = localStorage.getItem(STORAGE_KEY_NOTIFS);
    const lc = localStorage.getItem(STORAGE_KEY_LAST_CHECK);
    if (s)  setSettings(JSON.parse(s));
    if (n)  setNotifications(JSON.parse(n));
    if (lc) lastCheckRef.current = lc;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Persistir y calcular badge ──
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
    localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifications));
  }, [notifications]);

  // ── Sonido ──
  const playSound = useCallback((s = settings) => {
    if (s.sound === 'none') return;
    try {
      const src = s.sound === 'custom' && s.customSoundUrl
        ? s.customSoundUrl
        : '/static/notification_sounds/default-sound.mp3';
      const audio = new Audio(src);
      audio.volume = (s.volume ?? 70) / 100;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Error reproduciendo sonido:', e);
    }
  }, [settings]);

  // ── Notificación de escritorio ──
  const showDesktop = useCallback((title, body, tag) => {
    if (!settings.desktopNotifications || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico', tag: String(tag) });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [settings]);

  // ── Procesar tickets recibidos del backend ──
  const processNewTickets = useCallback((tickets) => {
    if (!tickets?.length) return;

    setNotifications(prev => {
      const existingCods = new Set(prev.map(n => n.ticketCod));
      const nuevos = tickets
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

      if (!nuevos.length) return prev;

      // Solo para los genuinamente nuevos
      nuevos.forEach(n => {
        playSound();
        showDesktop(n.title, n.message, n.ticketId);
      });

      return [...nuevos, ...prev];
    });
  }, [playSound, showDesktop]);

  // ── Polling ──
  const poll = useCallback(async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) return;

      const params = lastCheckRef.current ? { since: lastCheckRef.current } : {};
      const { data } = await api.get('/admin/tickets/new/', { params });

      if (data.checked_at) {
        lastCheckRef.current = data.checked_at;
        localStorage.setItem(STORAGE_KEY_LAST_CHECK, data.checked_at);
      }

      if (mountedRef.current) {
        setIsConnected(true);
        processNewTickets(data.tickets);
      }
    } catch {
      if (mountedRef.current) setIsConnected(false);
    }
  }, [processNewTickets]);

  // ── Iniciar polling ──
  useEffect(() => {
    const timer = setTimeout(poll, 3000);           // primer poll a los 3s
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(intervalRef.current);
    };
  }, [poll]);

  // ── API pública ──
  const markAsRead = useCallback((id) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)), []);

  const markAllAsRead = useCallback(() =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);

  const removeNotification = useCallback((id) =>
    setNotifications(prev => prev.filter(n => n.id !== id)), []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY_NOTIFS);
  }, []);

  const updateSettings = useCallback((s) => {
    setSettings(s);
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(s));
  }, []);

  const refreshNow = useCallback(() => poll(), [poll]);

  return {
    notifications, unreadCount, settings, isConnected,
    markAsRead, markAllAsRead, removeNotification,
    clearAll, updateSettings, refreshNow,
  };
};