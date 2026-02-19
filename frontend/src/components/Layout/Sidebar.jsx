import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import '../../styles/Sidebar.css';

const Sidebar = ({ user }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1><i className="fas fa-headset"></i> Mesa de Servicio</h1>
        <div className="user-info">
          <div className="user-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="user-details">
            <div className="user-name">{user?.username || 'Administrador'}</div>
            <span className="user-role">Administrador</span>
          </div>
        </div>
      </div>

      <nav className="nav-menu">
        <a href="/admin" className="nav-item active">
          <i className="fas fa-tachometer-alt"></i>
          <span>Dashboard</span>
        </a>
        <a href="/admin/tickets" className="nav-item">
          <i className="fas fa-ticket-alt"></i>
          <span>Tickets</span>
        </a>
        <a href="/admin/reportes" className="nav-item">
          <i className="fas fa-chart-bar"></i>
          <span>Chatbot</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={toggleTheme}>
          <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'}></i>
          <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;