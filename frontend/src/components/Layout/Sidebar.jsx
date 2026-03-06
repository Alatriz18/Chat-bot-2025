import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import '../../styles/Sidebar.css';

const Sidebar = ({ user }) => {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1><i className="fas fa-headset"></i> Mesa de Servicio</h1>
        <div className="user-info">
          <div className="user-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="user-details">
            <div className="user-name">{user?.nombre_completo || user?.username || 'Administrador'}</div>
            <span className="user-role">Administrador</span>
          </div>
        </div>
      </div>

      <nav className="nav-menu">
        <Link to="/admin" className={`nav-item ${isActive('/admin') ? 'active' : ''}`}>
          <i className="fas fa-tachometer-alt"></i>
          <span>Dashboard</span>
        </Link>

        <Link to="/admin/tickets" className={`nav-item ${isActive('/admin/tickets') ? 'active' : ''}`}>
          <i className="fas fa-ticket-alt"></i>
          <span>Mis Tickets</span>
        </Link>

        <Link to="/admin/reportes" className={`nav-item ${isActive('/admin/reportes') ? 'active' : ''}`}>
          <i className="fas fa-chart-bar"></i>
          <span>Reportes</span>
        </Link>

        <Link to="/admin/sugerencias" className={`nav-item ${isActive('/admin/sugerencias') ? 'active' : ''}`}>
          <i className="fas fa-lightbulb"></i>
          <span>Sugerencias</span>
        </Link>
      </nav>

      <div className="sidebar-footer">
        {/* Botón ir al chat */}
        <button
          className="theme-toggle"
          onClick={() => navigate('/chat')}
          style={{ marginBottom: 8, width: '100%' }}
          title="Ir al chatbot"
        >
          <i className="fas fa-comments"></i>
          <span>Ir al Chat</span>
        </button>

        <button className="theme-toggle" onClick={toggleTheme}>
          <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'}></i>
          <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;