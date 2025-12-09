import React, { useState, useRef } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationModal from './NotificationModal';
import './NotificationSystem.css';

const NotificationSystem = () => {
  const {
    notifications,
    unreadCount,
    settings,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    updateSettings
  } = useNotifications();

  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    // Abrir ticket en modal (implementar según tu necesidad)
    if (notification.ticketId) {
      window.showTicketDetails?.(notification.ticketId);
    }
  };

  const handleIconClick = () => {
    setShowPopup(!showPopup);
    if (settings.autoMarkAsRead && !showPopup) {
      markAllAsRead();
    }
  };

  const handleSettingsClick = (e) => {
    e.stopPropagation();
    setShowSettings(true);
  };

  return (
    <div className="notification-system">
      {/* Icono de notificaciones */}
      <div className="notification-icon" onClick={handleIconClick}>
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        
        {/* Botón de configuración */}
        <div className="notification-settings-btn" onClick={handleSettingsClick}>
          <i className="fas fa-cog"></i>
        </div>
      </div>

      {/* Popup de notificaciones */}
      {showPopup && (
        <div className="notification-popup">
          <div className="notification-header">
            <h4>Notificaciones</h4>
            <button className="clear-all" onClick={clearAll}>
              Limpiar todo
            </button>
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-notifications">
                <i className="fas fa-bell-slash"></i>
                <p>No hay notificaciones</p>
              </div>
            ) : (
              notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={handleNotificationClick}
                  onRemove={removeNotification}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de configuración */}
      {showSettings && (
        <NotificationModal
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
          fileInputRef={fileInputRef}
        />
      )}

      {/* Input oculto para archivos */}
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/mp3,audio/wav,audio/ogg,audio/m4a"
        style={{ display: 'none' }}
        onChange={(e) => {
          // Lógica para subir sonido personalizado
          handleCustomSoundUpload(e.target.files[0]);
        }}
      />
    </div>
  );
};

const NotificationItem = ({ notification, onClick, onRemove }) => {
  const handleClick = () => {
    onClick(notification);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(notification.id);
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours} h`;
    if (days < 7) return `Hace ${days} d`;
    
    return time.toLocaleDateString('es-ES');
  };

  return (
    <div 
      className={`notification-item ${notification.read ? '' : 'unread'}`}
      onClick={handleClick}
    >
      <div className="notification-icon">
        <i className="fas fa-ticket-alt"></i>
      </div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
        <div className="notification-time">
          {formatTime(notification.timestamp)}
        </div>
      </div>
      <button className="notification-close" onClick={handleRemove}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default NotificationSystem;