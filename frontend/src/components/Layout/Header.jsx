import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Header = ({ onToggleTickets, onToggleTheme, showAdminButton }) => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();

  return (
    <div className="chat-header">
      <div className="header-left">
        <div className="logo">
          <div className="logo-icon">
            <i className="fas fa-headset"></i>
          </div>
          <div className="title-group">
            <h2>Asistente Virtual de TI</h2>
            <p>En línea</p>
          </div>
        </div>
      </div>
      <div className="header-actions">
        {showAdminButton && (
          <button 
            className="admin-header-btn" 
            onClick={() => window.location.href = '/admin'}
            title="Panel de Administración"
          >
            <i className="fas fa-cog"></i>
            <span>Admin</span>
          </button>
        )}
        <button className="theme-toggle" onClick={onToggleTheme}>
          <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'}></i>
        </button>
        <button className="ticket-toggle" onClick={onToggleTheme} title="Ver mis tickets">
          <i className="fas fa-ticket-alt"></i>
        </button>
      </div>
    </div>
  );
};

export default Header;