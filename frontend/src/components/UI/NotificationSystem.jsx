import { useState, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';

export default function NotificationSystem() {
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Mostrar toast cuando llega notificación nueva
  useEffect(() => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length > 0) {
      const latest = unread[0];
      // Solo mostrar toast si es reciente (menos de 5 segundos)
      const age = Date.now() - new Date(latest.timestamp).getTime();
      if (age < 5000) {
        showToast(latest);
      }
    }
  }, [notifications]);

  const showToast = (notification) => {
    const toast = { ...notification, toastId: Date.now() };
    setToasts(prev => [toast, ...prev].slice(0, 3)); // Máximo 3 toasts

    // Auto-remove después de 5 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.toastId !== toast.toastId));
    }, 5000);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000; // segundos

    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' });
  };

  const getIcon = (type) => {
    switch (type) {
      case 'ticket_assigned': return '🎫';
      case 'ticket_updated':  return '✏️';
      case 'ticket_closed':   return '✅';
      default: return '🔔';
    }
  };

  return (
    <>
      {/* ===== BOTÓN CAMPANA ===== */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: 'relative',
            background: isOpen ? '#f0f4ff' : 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '50%',
            width: 42, height: 42,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
          }}
          title="Notificaciones"
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -2, right: -2,
              background: '#ef4444',
              color: 'white',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: 11,
              fontWeight: 700,
              minWidth: 18,
              textAlign: 'center',
              lineHeight: '14px',
              border: '2px solid white'
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* ===== PANEL DE NOTIFICACIONES ===== */}
        {isOpen && (
          <>
            {/* Overlay para cerrar al hacer clic afuera */}
            <div
              onClick={() => setIsOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            />

            <div style={{
              position: 'absolute',
              top: 50, right: 0,
              width: 360,
              background: 'white',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
              zIndex: 9999,
              overflow: 'hidden',
              animation: 'slideDownFade 0.2s ease'
            }}>

              {/* Header del panel */}
              <div style={{
                padding: '16px 18px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fafbff'
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                    Notificaciones
                  </span>
                  <span style={{
                    marginLeft: 8,
                    background: isConnected ? '#dcfce7' : '#fee2e2',
                    color: isConnected ? '#16a34a' : '#dc2626',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600
                  }}>
                    {isConnected ? '● En vivo' : '○ Offline'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{
                        background: 'none', border: 'none',
                        color: '#6366f1', fontSize: 12,
                        cursor: 'pointer', fontWeight: 600,
                        padding: '4px 8px', borderRadius: 6
                      }}
                    >
                      Marcar todo leído
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      style={{
                        background: 'none', border: 'none',
                        color: '#94a3b8', fontSize: 12,
                        cursor: 'pointer', padding: '4px 8px', borderRadius: 6
                      }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de notificaciones */}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#94a3b8'
                  }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🔕</div>
                    <p style={{ fontSize: 14, margin: 0 }}>Sin notificaciones</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid #f8fafc',
                        background: notif.read ? 'white' : '#f0f4ff',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        position: 'relative'
                      }}
                    >
                      <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
                        {getIcon(notif.type)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: '0 0 3px 0',
                          fontWeight: notif.read ? 500 : 700,
                          fontSize: 13,
                          color: '#1e293b'
                        }}>
                          {notif.title}
                        </p>
                        <p style={{
                          margin: '0 0 5px 0',
                          fontSize: 12,
                          color: '#64748b',
                          lineHeight: 1.4
                        }}>
                          {notif.message}
                        </p>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {formatTime(notif.timestamp)}
                        </span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); removeNotification(notif.id); }}
                        style={{
                          background: 'none', border: 'none',
                          color: '#cbd5e1', cursor: 'pointer',
                          fontSize: 16, padding: '0 4px',
                          flexShrink: 0,
                          lineHeight: 1
                        }}
                      >
                        ×
                      </button>
                      {!notif.read && (
                        <div style={{
                          position: 'absolute',
                          left: 6, top: '50%',
                          transform: 'translateY(-50%)',
                          width: 6, height: 6,
                          borderRadius: '50%',
                          background: '#6366f1'
                        }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== TOASTS (esquina inferior derecha) ===== */}
      <div style={{
        position: 'fixed',
        bottom: 24, right: 24,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {toasts.map(toast => (
          <div
            key={toast.toastId}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #6366f1',
              borderRadius: 10,
              padding: '14px 16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
              maxWidth: 320,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              animation: 'slideInRight 0.3s ease'
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{getIcon(toast.type)}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 3px 0', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                {toast.title}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.toastId !== toast.toastId))}
              style={{
                background: 'none', border: 'none',
                color: '#94a3b8', cursor: 'pointer',
                fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Animaciones */}
      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}