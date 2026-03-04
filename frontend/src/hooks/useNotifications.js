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

  const lastCheckRef    = useRef(null);
  const intervalRef     = useRef(null);
  const mountedRef      = useRef(true);
  const audioUnlocked   = useRef(false);  // ← desbloqueo de autoplay

  // ── Desbloquear AudioContext en el primer click/keydown del usuario ──
  useEffect(() => {
    const unlock = async () => {
      if (audioUnlocked.current) return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
        audioUnlocked.current = true;
        console.log('🔊 Audio desbloqueado');
      } catch (e) { /* silencioso */ }
    };
    document.addEventListener('click',   unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('click',   unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

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

  const audioCtxRef    = useRef(null);
  const audioBufferRef = useRef(null);  // buffer pre-cargado

  // ── Pre-cargar el audio al montar (o cuando cambia la URL del sonido) ──
  const loadAudioBuffer = useCallback(async (src) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      audioBufferRef.current = await audioCtxRef.current.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn('No se pudo pre-cargar el audio:', e);
      audioBufferRef.current = null;
    }
  }, []);

  useEffect(() => {
    const s = settings;
    if (s.sound === 'none') return;
    const src = s.sound === 'custom' && s.customSoundUrl
      ? s.customSoundUrl
      : '/static/notification_sounds/default-sound.mp3';
    loadAudioBuffer(src);
  }, [settings.sound, settings.customSoundUrl, loadAudioBuffer]);

  // ── Sonido — usa AudioContext que funciona en background/minimizado ──
  const playSound = useCallback(async (s = settings) => {
    if (s.sound === 'none') return;
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || !audioBufferRef.current) {
        // Fallback a HTMLAudio si el buffer no está listo
        const src = s.sound === 'custom' && s.customSoundUrl
          ? s.customSoundUrl
          : '/static/notification_sounds/default-sound.mp3';
        const audio = new Audio(src);
        audio.volume = (s.volume ?? 70) / 100;
        audio.play().catch(() => {});
        return;
      }

      // Reanudar contexto si fue suspendido por el navegador
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source     = ctx.createBufferSource();
      const gainNode   = ctx.createGain();
      source.buffer    = audioBufferRef.current;
      gainNode.gain.value = (s.volume ?? 70) / 100;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
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