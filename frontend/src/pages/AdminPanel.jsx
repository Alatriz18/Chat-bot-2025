import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/axios';
import '../styles/Admin.css';

// Componente de Estadísticas
const StatsCards = ({ tickets, users }) => {
    const pendingTickets = tickets.filter(t => t.ticket_est_ticket === 'PE').length;
    const finishedTickets = tickets.filter(t => t.ticket_est_ticket === 'FN').length;
    const urgentTickets = tickets.filter(t => t.ticket_prioridad === 'URGENTE').length;

    return (
        <div className="stats-grid">
            <div className="stat-card">
                <div className="stat-icon">
                    <i className="fas fa-ticket-alt"></i>
                </div>
                <div className="stat-content">
                    <h3>{tickets.length}</h3>
                    <p>Total Tickets</p>
                </div>
                <div className="stat-trend">
                    <i className="fas fa-chart-line"></i>
                    <span>+12%</span>
                </div>
            </div>
            
            <div className="stat-card stat-warning">
                <div className="stat-icon">
                    <i className="fas fa-clock"></i>
                </div>
                <div className="stat-content">
                    <h3>{pendingTickets}</h3>
                    <p>Pendientes</p>
                </div>
                <div className="stat-trend trend-down">
                    <i className="fas fa-arrow-down"></i>
                    <span>-5%</span>
                </div>
            </div>
            
            <div className="stat-card stat-success">
                <div className="stat-icon">
                    <i className="fas fa-check-circle"></i>
                </div>
                <div className="stat-content">
                    <h3>{finishedTickets}</h3>
                    <p>Finalizados</p>
                </div>
                <div className="stat-trend trend-up">
                    <i className="fas fa-arrow-up"></i>
                    <span>+18%</span>
                </div>
            </div>
            
            <div className="stat-card stat-info">
                <div className="stat-icon">
                    <i className="fas fa-users"></i>
                </div>
                <div className="stat-content">
                    <h3>{users.length}</h3>
                    <p>Usuarios Activos</p>
                </div>
                <div className="stat-trend trend-up">
                    <i className="fas fa-arrow-up"></i>
                    <span>+8%</span>
                </div>
            </div>
        </div>
    );
};

// Componente de Detalles del Ticket (Modal)
const TicketDetailsModal = ({ ticket, onClose, users, admins, onReassignUser, onAssignAdmin }) => {
    if (!ticket) return null;

    const getStatusColor = (status) => {
        return status === 'PE' ? 'var(--warning)' : 'var(--success)';
    };

    const getPriorityColor = (priority) => {
        switch(priority) {
            case 'URGENTE': return 'var(--error)';
            case 'ALTA': return 'var(--warning)';
            case 'MEDIA': return 'var(--primary)';
            case 'BAJA': return 'var(--secondary)';
            default: return 'var(--secondary)';
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <h3>Ticket #{ticket.ticket_id_ticket}</h3>
                        <div className="ticket-status-badge" style={{ backgroundColor: getStatusColor(ticket.ticket_est_ticket) }}>
                            {ticket.ticket_est_ticket === 'PE' ? 'PENDIENTE' : 'FINALIZADO'}
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="ticket-details-grid">
                        <div className="detail-section">
                            <h4><i className="fas fa-heading"></i> Información General</h4>
                            <div className="detail-item">
                                <span className="detail-label">Asunto:</span>
                                <span className="detail-value">{ticket.ticket_asu_ticket}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Categoría:</span>
                                <span className="detail-value">{ticket.ticket_categoria || 'No especificada'}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Prioridad:</span>
                                <span className="detail-value priority-badge" style={{ backgroundColor: getPriorityColor(ticket.ticket_prioridad) }}>
                                    {ticket.ticket_prioridad || 'MEDIA'}
                                </span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Fecha creación:</span>
                                <span className="detail-value">
                                    {new Date(ticket.ticket_fec_ticket).toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>

                        <div className="detail-section">
                            <h4><i className="fas fa-user-friends"></i> Asignaciones</h4>
                            <div className="detail-item">
                                <span className="detail-label">Usuario (Cliente):</span>
                                <select 
                                    value={ticket.ticket_tusua_ticket || ''}
                                    onChange={(e) => onReassignUser(ticket.ticket_id_ticket, e.target.value)}
                                    className="detail-select"
                                >
                                    <option value="">-- Seleccionar Cliente --</option>
                                    {users
                                        .filter(u => !u.is_staff)
                                        .map(u => (
                                            <option key={u.username} value={u.username}>
                                                {u.nombreCompleto || u.username}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Técnico Asignado:</span>
                                <select 
                                    value={ticket.ticket_asignado_a || ''}
                                    onChange={(e) => onAssignAdmin(ticket.ticket_id_ticket, e.target.value)}
                                    className="detail-select"
                                    style={{ 
                                        borderColor: ticket.ticket_asignado_a ? 'var(--success)' : 'var(--border)'
                                    }}
                                >
                                    <option value="">-- Sin Asignar --</option>
                                    {admins.map(a => (
                                        <option key={a.username} value={a.username}>
                                            {a.nombreCompleto || a.username}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {ticket.descripcion && (
                            <div className="detail-section full-width">
                                <h4><i className="fas fa-align-left"></i> Descripción</h4>
                                <div className="description-box">
                                    <p>{ticket.descripcion}</p>
                                </div>
                            </div>
                        )}

                        {ticket.archivos && ticket.archivos.length > 0 && (
                            <div className="detail-section full-width">
                                <h4><i className="fas fa-paperclip"></i> Archivos Adjuntos</h4>
                                <div className="files-list">
                                    {ticket.archivos.map((file, index) => (
                                        <div key={index} className="file-item">
                                            <i className="fas fa-file"></i>
                                            <span>{file.nombre}</span>
                                            <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cerrar
                    </button>
                    <button className="btn btn-primary">
                        <i className="fas fa-edit"></i> Editar Ticket
                    </button>
                </div>
            </div>
        </div>
    );
};

// Componente de Sidebar Mejorado
const Sidebar = ({ user, onLogout, activePage }) => {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <div className="logo-icon">
                        <i className="fas fa-shield-alt"></i>
                    </div>
                    <h2>Admin Panel</h2>
                </div>
                <div className="user-info">
                    <div className="user-avatar">
                        {user?.nombreCompleto?.charAt(0) || user?.username?.charAt(0) || 'A'}
                    </div>
                    <div className="user-details">
                        <h4>{user?.nombreCompleto || user?.username}</h4>
                        <div className="user-role">
                            <i className="fas fa-user-shield"></i> {user?.rol || 'Administrador'}
                        </div>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <a href="#" className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}>
                    <i className="fas fa-tachometer-alt"></i>
                    <span>Dashboard</span>
                </a>
                <a href="#" className="nav-item">
                    <i className="fas fa-ticket-alt"></i>
                    <span>Tickets</span>
                    <span className="nav-badge">12</span>
                </a>
                <a href="#" className="nav-item">
                    <i className="fas fa-users"></i>
                    <span>Usuarios</span>
                </a>
                <a href="#" className="nav-item">
                    <i className="fas fa-chart-bar"></i>
                    <span>Reportes</span>
                </a>
                <a href="#" className="nav-item">
                    <i className="fas fa-cog"></i>
                    <span>Configuración</span>
                </a>
            </nav>

            <div className="sidebar-footer">
                <button className="btn-logout" onClick={onLogout}>
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </div>
    );
};

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
    const [selectedTicket, setSelectedTicket] = useState(null);
    const itemsPerPage = 10;
    const [filteredTickets, setFilteredTickets] = useState([]);

    // Verificación de Seguridad
    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        
        const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin' || user.is_staff;
        if (!isAdmin) {
            navigate('/chat');
            return;
        }
        
        loadInitialData();
    }, [user, navigate]);

    // Carga de Datos
    const loadInitialData = async () => {
        try {
            setLoading(true);
            
            const [usersRes, adminsRes, ticketsRes] = await Promise.all([
                api.get('/users/active'),
                api.get('/admins/'),
                api.get('/admin/tickets/')
            ]);

            setUsers(usersRes.data);
            setAdmins(adminsRes.data);
            setTickets(ticketsRes.data);
            applyFilter('all', ticketsRes.data);
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            alert('Error cargando el panel: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Filtros
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

    // Reasignar Usuario
    const handleReassignUser = async (ticketId, newUsername) => {
        if (!newUsername) return;

        try {
            await api.post(`/admin/tickets/${ticketId}/reassign/`, { username: newUsername });
            
            setTickets(prev => prev.map(ticket => 
                ticket.ticket_id_ticket === ticketId 
                    ? { ...ticket, ticket_tusua_ticket: newUsername }
                    : ticket
            ));
            
            applyFilter(activeFilter);
            
        } catch (error) {
            alert('Error al reasignar: ' + (error.response?.data?.error || error.message));
        }
    };

    // Asignar Admin
    const handleAssignAdmin = async (ticketId, adminUsername) => {
        if (!adminUsername) return;

        try {
            await api.post(`/admin/tickets/${ticketId}/assign/`, { admin_username: adminUsername });
            
            setTickets(prev => prev.map(ticket => 
                ticket.ticket_id_ticket === ticketId 
                    ? { ...ticket, ticket_asignado_a: adminUsername }
                    : ticket
            ));
            
            applyFilter(activeFilter);
            
        } catch (error) {
            alert('Error al asignar técnico: ' + (error.response?.data?.error || error.message));
        }
    };

    // Abrir detalles del ticket
    const openTicketDetails = (ticket) => {
        setSelectedTicket(ticket);
    };

    // Cerrar detalles del ticket
    const closeTicketDetails = () => {
        setSelectedTicket(null);
    };

    // Paginación
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page) => setCurrentPage(page);

    // Renderizado de carga
    if (!user || !(user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin' || user.is_staff)) {
        return null;
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
                    <div className="header-title">
                        <h1>Panel de Administración</h1>
                        <p>Bienvenido, {user?.nombreCompleto || user?.username}</p>
                    </div>
                    <div className="header-actions">
                        <button 
                            className="btn-refresh" 
                            onClick={loadInitialData}
                            disabled={loading}
                            title="Actualizar datos"
                        >
                            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                        </button>
                        <button 
                            className="btn-chat" 
                            onClick={() => navigate('/chat')}
                            title="Ir al chat"
                        >
                            <i className="fas fa-comments"></i>
                        </button>
                    </div>
                </div>

                {/* Estadísticas */}
                <StatsCards tickets={tickets} users={users} />

                {/* Panel de Tickets */}
                <div className="tickets-panel">
                    <div className="panel-header">
                        <h2><i className="fas fa-ticket-alt"></i> Gestión de Tickets</h2>
                        <div className="panel-filters">
                            <div className="filter-group">
                                <button 
                                    className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                                    onClick={() => applyFilter('all')}
                                >
                                    Todos
                                    <span className="filter-count">{tickets.length}</span>
                                </button>
                                <button 
                                    className={`filter-btn ${activeFilter === 'PE' ? 'active' : ''}`}
                                    onClick={() => applyFilter('PE')}
                                >
                                    Pendientes
                                    <span className="filter-count">
                                        {tickets.filter(t => t.ticket_est_ticket === 'PE').length}
                                    </span>
                                </button>
                                <button 
                                    className={`filter-btn ${activeFilter === 'FN' ? 'active' : ''}`}
                                    onClick={() => applyFilter('FN')}
                                >
                                    Finalizados
                                    <span className="filter-count">
                                        {tickets.filter(t => t.ticket_est_ticket === 'FN').length}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="table-container">
                        {paginatedTickets.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <i className="fas fa-inbox"></i>
                                </div>
                                <h3>No hay tickets</h3>
                                <p>No se encontraron tickets con los filtros aplicados</p>
                            </div>
                        ) : (
                            <table className="tickets-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Asunto</th>
                                        <th>Usuario</th>
                                        <th>Técnico</th>
                                        <th>Estado</th>
                                        <th>Fecha</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedTickets.map(ticket => (
                                        <tr key={ticket.ticket_id_ticket} className="ticket-row">
                                            <td className="ticket-id">#{ticket.ticket_id_ticket}</td>
                                            <td className="ticket-subject">
                                                <div className="subject-content">
                                                    <span className="subject-text">{ticket.ticket_asu_ticket}</span>
                                                    {ticket.ticket_prioridad === 'URGENTE' && (
                                                        <span className="priority-badge urgent">URGENTE</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <select 
                                                    value={ticket.ticket_tusua_ticket || ''}
                                                    onChange={(e) => handleReassignUser(ticket.ticket_id_ticket, e.target.value)}
                                                    className="user-select"
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
                                            </td>
                                            <td>
                                                <select 
                                                    value={ticket.ticket_asignado_a || ''}
                                                    onChange={(e) => handleAssignAdmin(ticket.ticket_id_ticket, e.target.value)}
                                                    className="admin-select"
                                                >
                                                    <option value="">-- Sin Asignar --</option>
                                                    {admins.map(a => (
                                                        <option key={a.username} value={a.username}>
                                                            {a.nombreCompleto || a.username}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${ticket.ticket_est_ticket === 'PE' ? 'pending' : 'completed'}`}>
                                                    {ticket.ticket_est_ticket === 'PE' ? 'PENDIENTE' : 'FINALIZADO'}
                                                </span>
                                            </td>
                                            <td>
                                                {new Date(ticket.ticket_fec_ticket).toLocaleDateString('es-ES', {
                                                    day: '2-digit',
                                                    month: '2-digit'
                                                })}
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button 
                                                        className="btn-action btn-view"
                                                        onClick={() => openTicketDetails(ticket)}
                                                        title="Ver detalles"
                                                    >
                                                        <i className="fas fa-eye"></i>
                                                    </button>
                                                    <button 
                                                        className="btn-action btn-edit"
                                                        title="Editar"
                                                    >
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                    <button 
                                                        className="btn-action btn-delete"
                                                        title="Eliminar"
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </div>
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
                    )}
                </div>
            </main>

            {/* Modal de Detalles del Ticket */}
            {selectedTicket && (
                <TicketDetailsModal 
                    ticket={selectedTicket}
                    onClose={closeTicketDetails}
                    users={users}
                    admins={admins}
                    onReassignUser={handleReassignUser}
                    onAssignAdmin={handleAssignAdmin}
                />
            )}
        </div>
    );
};

export default AdminPanel;