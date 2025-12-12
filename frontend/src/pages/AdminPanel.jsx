import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import api from '../config/axios';
import '../styles/Admin.css';

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Estados
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros y Paginación
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [filteredTickets, setFilteredTickets] = useState([]);

  // 1. Verificación de Seguridad - CORREGIDO
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    // Verificar si es admin
    const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin' || user.is_staff;
    if (!isAdmin) {
      navigate('/chat');
      return;
    }
    
    // Solo cargar datos si es admin
    loadInitialData();
  }, [user, navigate]);

  // 2. Carga de Datos (Usando API Axios)
  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Ejecutamos las 3 peticiones en paralelo
      const [usersRes, adminsRes, ticketsRes] = await Promise.all([
        api.get('/users/active'),
        api.get('/admins/'),
        api.get('/admin/tickets/')
      ]);

      setUsers(usersRes.data);
      setAdmins(adminsRes.data);
      setTickets(ticketsRes.data);
      
      // Aplicar filtro inicial
      applyFilter('all', ticketsRes.data);
      
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error cargando el panel: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 3. Filtros con useCallback
  const applyFilter = useCallback((filter, ticketsData = tickets) => {
    setActiveFilter(filter);
    
    if (filter === 'all') {
      setFilteredTickets(ticketsData);
    } else {
      const filtered = ticketsData.filter(t => t.ticket_est_ticket === filter);
      setFilteredTickets(filtered);
    }
    
    setCurrentPage(1);
  }, [tickets]);

  // 4. Reasignar Usuario (Cliente)
  const handleReassignUser = async (ticketId, newUsername) => {
    if (!newUsername) {
      alert('Por favor selecciona un usuario');
      return;
    }

    try {
      await api.post(`/admin/tickets/${ticketId}/reassign/`, { 
        username: newUsername 
      });
      
      // Actualizar estado local
      setTickets(prev => prev.map(ticket => 
        ticket.ticket_id_ticket === ticketId 
          ? { ...ticket, ticket_tusua_ticket: newUsername }
          : ticket
      ));
      
      // Reaplicar filtro
      applyFilter(activeFilter);
      
    } catch (error) {
      alert('Error al reasignar: ' + (error.response?.data?.error || error.message));
    }
  };

  // 5. Asignar Admin (Técnico)
  const handleAssignAdmin = async (ticketId, adminUsername) => {
    if (!adminUsername) {
      alert('Por favor selecciona un técnico');
      return;
    }

    try {
      await api.post(`/admin/tickets/${ticketId}/assign/`, { 
        admin_username: adminUsername 
      });
      
      // Actualizar estado local
      setTickets(prev => prev.map(ticket => 
        ticket.ticket_id_ticket === ticketId 
          ? { ...ticket, ticket_asignado_a: adminUsername }
          : ticket
      ));
      
      // Reaplicar filtro
      applyFilter(activeFilter);
      
    } catch (error) {
      alert('Error al asignar técnico: ' + (error.response?.data?.error || error.message));
    }
  };

  // 6. Paginación
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  // 7. Componente de estadísticas - MEJORADO VISUALMENTE
  const StatsCards = () => {
    const pendingTickets = tickets.filter(t => t.ticket_est_ticket === 'PE').length;
    const finishedTickets = tickets.filter(t => t.ticket_est_ticket === 'FN').length;

    return (
      <div className="stats-grid">
        <div className="stat-card card-gradient-1">
          <div className="stat-icon">
            <i className="fas fa-ticket-alt"></i>
          </div>
          <div className="stat-info">
            <h3>{tickets.length}</h3>
            <p>Total Tickets</p>
          </div>
          <div className="stat-trend">
            <i className="fas fa-chart-line"></i>
          </div>
        </div>
        
        <div className="stat-card card-gradient-2">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-info">
            <h3>{pendingTickets}</h3>
            <p>Pendientes</p>
          </div>
          <div className="stat-badge badge-warning">
            {pendingTickets > 0 ? 'Requiere atención' : 'Al día'}
          </div>
        </div>
        
        <div className="stat-card card-gradient-3">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-info">
            <h3>{finishedTickets}</h3>
            <p>Finalizados</p>
          </div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${tickets.length > 0 ? (finishedTickets / tickets.length * 100) : 0}%` }}
              ></div>
            </div>
            <span>{tickets.length > 0 ? Math.round((finishedTickets / tickets.length) * 100) : 0}%</span>
          </div>
        </div>
        
        <div className="stat-card card-gradient-4">
          <div className="stat-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <h3>{users.length}</h3>
            <p>Usuarios Activos</p>
          </div>
          <div className="stat-trend">
            <i className="fas fa-user-plus"></i>
          </div>
        </div>
      </div>
    );
  };

  // Renderizado de carga
  if (!user) {
    return null;
  }

  const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin' || user.is_staff;
  
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
        <p>Cargando panel...</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <Sidebar user={user} onLogout={logout} activePage="dashboard" />
      
      <main className="main-content">
        <div className="dashboard-header">
          <div className="dashboard-title">
            <h1><i className="fas fa-shield-alt"></i> Panel de Administración</h1>
            <p className="user-greeting">Hola, <strong>{user?.nombreCompleto || user?.username}</strong></p>
          </div>
          <div className="header-actions">
            <button 
              className="header-action-btn btn-refresh" 
              onClick={loadInitialData}
              disabled={loading}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              Actualizar
            </button>
            <button 
              className="header-action-btn btn-chat" 
              onClick={() => navigate('/chat')}
            >
              <i className="fas fa-robot"></i> Ir al Chat
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        <StatsCards />

        {/* Tabla de tickets */}
        <div className="ticket-panel card-shadow">
          <div className="panel-header">
            <h2><i className="fas fa-list-alt"></i> Gestión de Tickets</h2>
            <div className="ticket-filters">
              <button 
                className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => applyFilter('all')}
              >
                <i className="fas fa-layer-group"></i> Todos ({tickets.length})
              </button>
              <button 
                className={`filter-btn ${activeFilter === 'PE' ? 'active' : ''}`}
                onClick={() => applyFilter('PE')}
              >
                <i className="fas fa-clock"></i> Pendientes ({tickets.filter(t => t.ticket_est_ticket === 'PE').length})
              </button>
              <button 
                className={`filter-btn ${activeFilter === 'FN' ? 'active' : ''}`}
                onClick={() => applyFilter('FN')}
              >
                <i className="fas fa-check-circle"></i> Finalizados ({tickets.filter(t => t.ticket_est_ticket === 'FN').length})
              </button>
            </div>
          </div>

          <div className="table-responsive">
            {paginatedTickets.length === 0 ? (
              <div className="empty-tickets">
                <i className="fas fa-inbox fa-3x"></i>
                <p>No hay tickets disponibles</p>
                <button className="btn-primary" onClick={loadInitialData}>
                  <i className="fas fa-sync"></i> Recargar
                </button>
              </div>
            ) : (
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th><i className="fas fa-hashtag"></i> ID</th>
                    <th><i className="fas fa-comment-alt"></i> Asunto</th>
                    <th><i className="fas fa-user"></i> Usuario</th>
                    <th><i className="fas fa-user-cog"></i> Técnico</th>
                    <th><i className="fas fa-info-circle"></i> Estado</th>
                    <th><i className="fas fa-calendar"></i> Fecha</th>
                    <th><i className="fas fa-cog"></i> Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTickets.map(ticket => (
                    <tr key={ticket.ticket_id_ticket} className="ticket-row">
                      <td className="ticket-id">
                        <span className="badge-id">#{ticket.ticket_id_ticket}</span>
                      </td>
                      <td className="ticket-subject">
                        <div className="subject-text">
                          {ticket.ticket_asu_ticket}
                        </div>
                      </td>
                      
                      {/* SELECTOR DE USUARIO */}
                      <td>
                        <div className="select-wrapper">
                          <select 
                            value={ticket.ticket_tusua_ticket || ''}
                            onChange={(e) => handleReassignUser(ticket.ticket_id_ticket, e.target.value)}
                            className="user-select select-style"
                          >
                            <option value="">-- Cliente --</option>
                            {users
                              .filter(u => !u.is_staff)
                              .map(u => (
                                <option key={u.username} value={u.username}>
                                  {u.nombreCompleto || u.username}
                                </option>
                              ))
                            }
                          </select>
                          <i className="fas fa-user-edit select-icon"></i>
                        </div>
                      </td>

                      {/* SELECTOR DE ADMIN (Técnico) */}
                      <td>
                        <div className="select-wrapper">
                          <select 
                            value={ticket.ticket_asignado_a || ''}
                            onChange={(e) => handleAssignAdmin(ticket.ticket_id_ticket, e.target.value)}
                            className="admin-select select-style"
                            style={{ 
                              borderColor: ticket.ticket_asignado_a ? '#10B981' : '#E2E8F0',
                              backgroundColor: ticket.ticket_asignado_a ? '#F0FDF4' : '#FFFFFF'
                            }}
                          >
                            <option value="">-- Sin Asignar --</option>
                            {admins.map(a => (
                              <option key={a.username} value={a.username}>
                                {a.nombreCompleto || a.username}
                              </option>
                            ))}
                          </select>
                          <i className="fas fa-user-cog select-icon"></i>
                        </div>
                      </td>

                      <td>
                        <span className={`ticket-status status-${ticket.ticket_est_ticket}`}>
                          <i className={`fas ${ticket.ticket_est_ticket === 'PE' ? 'fa-clock' : 'fa-check-circle'}`}></i>
                          {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
                        </span>
                      </td>
                      <td className="ticket-date">
                        <i className="far fa-calendar"></i>
                        {new Date(ticket.ticket_fec_ticket).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-btn btn-view"
                            onClick={() => alert(`Ver detalles del ticket ${ticket.ticket_id_ticket}`)}
                            title="Ver detalles"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button 
                            className="action-btn btn-edit"
                            title="Editar ticket"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginación - MEJORADA */}
          {filteredTickets.length > itemsPerPage && (
            <div className="pagination-container">
              <div className="pagination-info">
                Mostrando {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredTickets.length)} de {filteredTickets.length} tickets
              </div>
              <div className="pagination">
                <button 
                  className="pagination-btn prev"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <i className="fas fa-chevron-left"></i> Anterior
                </button>
                
                <div className="page-numbers">
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
                </div>
                
                <button 
                  className="pagination-btn next"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Siguiente <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;