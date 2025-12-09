import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import StatsCards from '../components/UI/StatsCards';
import TicketTable from '../components/UI/TicketTable';
import '../styles/Admin.css';

// Configuración de API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [filteredTickets, setFilteredTickets] = useState([]);

  // Verificar acceso - CORREGIDO
  useEffect(() => {
    if (user) {
      // En tu AuthContext, los admins tienen rol 'SISTEMAS_ADMIN'
      const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin';
      
      if (!isAdmin) {
        console.log('Usuario no es admin, redirigiendo al chat');
        navigate('/chat');  // <-- Usa navigate en lugar de window.location.href
        return;
      }
      
      // Cargar datos si es admin
      loadInitialData();
    } else {
      // Si no hay usuario, redirigir a home (que hará SSO)
      console.log('No hay usuario, redirigiendo a home');
      navigate('/');
    }
  }, [user, navigate]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadUsers(), loadAdmins(), loadTickets()]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      alert('Error cargando datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/users/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      } else {
        throw new Error('Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/admins`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const adminsData = await response.json();
        setAdmins(adminsData);
      } else {
        throw new Error('Error al cargar administradores');
      }
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const loadTickets = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/admin/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const ticketsData = await response.json();
        setTickets(ticketsData);
        setFilteredTickets(ticketsData);
        applyFilter('all');
      } else {
        throw new Error('Error al cargar tickets');
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  };

  const handleReassignUser = async (ticketId, newUsername) => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}/reassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newUsername })
      });

      if (response.ok) {
        await loadTickets();
        return { success: true };
      } else {
        const errorData = await response.json();
        alert('Error: ' + (errorData.error || 'Error desconocido'));
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      alert('Error: ' + error.message);
      return { success: false, error: error.message };
    }
  };

  const handleAssignAdmin = async (ticketId, adminUsername) => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ admin_username: adminUsername })
      });

      if (response.ok) {
        await loadTickets();
        return { success: true };
      } else {
        const errorData = await response.json();
        alert('Error: ' + (errorData.error || 'Error desconocido'));
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      alert('Error: ' + error.message);
      return { success: false, error: error.message };
    }
  };

  const applyFilter = (filter) => {
    setActiveFilter(filter);
    
    if (filter === 'all') {
      setFilteredTickets(tickets);
    } else {
      const filtered = tickets.filter(ticket => ticket.ticket_est_ticket === filter);
      setFilteredTickets(filtered);
    }
    setCurrentPage(1);
  };

  // Paginación
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Verificar si el usuario es admin
  const isAdmin = user && (user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin');

  if (!isAdmin) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Redirigiendo al chat...</p>
      </div>
    );
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando panel de administración...</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <Sidebar user={user} onLogout={logout} activePage="dashboard" />
      
      <main className="main-content">
        <div className="dashboard-header">
          <div className="dashboard-title">
            <h1>Panel de Administración de TI</h1>
            <p>Bienvenido, {user?.nombreCompleto || user?.username}</p>
          </div>
          <div className="header-actions">
            <button 
              className="header-action-btn" 
              onClick={loadInitialData}
              disabled={loading}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              <span>Actualizar</span>
            </button>
            <a href="/chat" className="header-action-btn">
              <i className="fas fa-robot"></i>
              <span>Ir al Chatbot</span>
            </a>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
              <i className="fas fa-ticket-alt"></i>
            </div>
            <div className="stat-info">
              <h3>{tickets.length}</h3>
              <p>Total Tickets</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
              <i className="fas fa-clock"></i>
            </div>
            <div className="stat-info">
              <h3>{tickets.filter(t => t.ticket_est_ticket === 'PE').length}</h3>
              <p>Pendientes</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'}}>
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="stat-info">
              <h3>{tickets.filter(t => t.ticket_est_ticket === 'FN').length}</h3>
              <p>Finalizados</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'}}>
              <i className="fas fa-users"></i>
            </div>
            <div className="stat-info">
              <h3>{users.length}</h3>
              <p>Usuarios Activos</p>
            </div>
          </div>
        </div>

        {/* Ticket Panel */}
        <div className="ticket-panel">
          <div className="panel-header">
            <h2>Gestión de Tickets</h2>
            <div className="ticket-filters">
              <button 
                className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => applyFilter('all')}
              >
                Todos ({tickets.length})
              </button>
              <button 
                className={`filter-btn ${activeFilter === 'PE' ? 'active' : ''}`}
                onClick={() => applyFilter('PE')}
              >
                Pendientes ({tickets.filter(t => t.ticket_est_ticket === 'PE').length})
              </button>
              <button 
                className={`filter-btn ${activeFilter === 'FN' ? 'active' : ''}`}
                onClick={() => applyFilter('FN')}
              >
                Finalizados ({tickets.filter(t => t.ticket_est_ticket === 'FN').length})
              </button>
            </div>
          </div>

          {/* Tabla simplificada */}
          <div className="table-responsive">
            {paginatedTickets.length === 0 ? (
              <div className="empty-tickets">
                <i className="fas fa-inbox"></i>
                <p>No hay tickets disponibles</p>
              </div>
            ) : (
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Asunto</th>
                    <th>Usuario</th>
                    <th>Asignado a</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTickets.map(ticket => (
                    <tr key={ticket.ticket_id_ticket}>
                      <td className="ticket-id">#{ticket.ticket_id_ticket}</td>
                      <td className="ticket-subject">{ticket.ticket_asu_ticket}</td>
                      <td>
                        <select 
                          value={ticket.ticket_tusua_ticket || ''}
                          onChange={(e) => handleReassignUser(ticket.ticket_id_ticket, e.target.value)}
                          className="user-select"
                        >
                          <option value="">Seleccionar...</option>
                          {users.map(user => (
                            <option key={user.username} value={user.username}>
                              {user.username}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select 
                          value={ticket.ticket_asignado_a || ''}
                          onChange={(e) => handleAssignAdmin(ticket.ticket_id_ticket, e.target.value)}
                          className="admin-select"
                        >
                          <option value="">Sin asignar</option>
                          {admins.map(admin => (
                            <option key={admin.username} value={admin.username}>
                              {admin.username}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`ticket-status status-${ticket.ticket_est_ticket}`}>
                          {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 
                           ticket.ticket_est_ticket === 'FN' ? 'Finalizado' : 'No Finalizado'}
                        </span>
                      </td>
                      <td className="ticket-date">
                        {new Date(ticket.ticket_fec_ticket).toLocaleDateString('es-ES')}
                      </td>
                      <td className="ticket-actions">
                        <button 
                          className="action-btn btn-info"
                          onClick={() => alert(`Ver detalles del ticket ${ticket.ticket_id_ticket}`)}
                          title="Ver detalles"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación */}
          {filteredTickets.length > itemsPerPage && (
            <div className="pagination">
              <button 
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button 
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;