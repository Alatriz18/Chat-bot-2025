import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import api from '../config/axios';
import '../styles/Admin.css';

// --- UTILIDAD: Obtener CSRF Token ---
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Estados de Datos
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de UI
  const [activeFilter, setActiveFilter] = useState('all');
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estado para el MODAL de detalles
  const [selectedTicket, setSelectedTicket] = useState(null);
    const [closeTicketModal, setCloseTicketModal] = useState(null); // { ticketId }
    const [tiempoReal, setTiempoReal] = useState('');
    const [observacion, setObservacion] = useState('');
  // 1. Verificación de Seguridad
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

  // 2. Carga de Datos
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
    } finally {
      setLoading(false);
    }
  };

  // 3. Filtros
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

  // 4. CAMBIAR USUARIO (Reasignar)
 const handleReassignUser = async (ticketId, newUsername) => {
    try {
        await api.patch(`/admin/tickets/${ticketId}/`, { 
            ticket_tusua_ticket: newUsername 
        });
        setTickets(prevTickets => prevTickets.map(ticket => {
            // Buscamos el ticket por su ID
            if (ticket.ticket_cod_ticket === ticketId) {
                // Devolvemos el ticket copiado con el nuevo usuario
                return { ...ticket, ticket_tusua_ticket: newUsername };
            }
            return ticket; 
        }));
    } catch (error) {
        console.error(error);
    }
};

  // 5. ASIGNAR TÉCNICO
 const handleAssignAdmin = async (ticketId, adminUsername) => {
    const valor = adminUsername === "" ? null : adminUsername;
    try {
        await api.patch(`/admin/tickets/${ticketId}/`, { 
            ticket_asignado_a: valor 
        });
        
        // Actualizar UI localmente
       setTickets(prevTickets => prevTickets.map(ticket => {
            if (ticket.ticket_cod_ticket === ticketId) {
                return { ...ticket, ticket_asignado_a: valor  };
            }
            return ticket;
        }));
    } catch (error) {
        console.error(error);
        alert("Error al asignar técnico");
    }
};

  // 6. CERRAR TICKET (Finalizar)
 // 1. FINALIZAR TICKET
const handleCloseTicket = (ticketId) => {
    setCloseTicketModal({ ticketId });
    setTiempoReal('');
    setObservacion('');
};

const confirmCloseTicket = async () => {
    if (!tiempoReal || isNaN(tiempoReal) || Number(tiempoReal) <= 0) {
        alert("Por favor ingresa un tiempo de resolución válido (en minutos).");
        return;
    }
    const { ticketId } = closeTicketModal;
    try {
        await api.patch(`/admin/tickets/${ticketId}/`, {
            ticket_est_ticket: 'FN',
            ticket_treal_ticket: Number(tiempoReal),
            ticket_obs_ticket: observacion
        });
        setTickets(prevTickets =>
            prevTickets.map(ticket =>
                ticket.ticket_cod_ticket === ticketId
                    ? { ...ticket, ticket_est_ticket: 'FN', ticket_treal_ticket: Number(tiempoReal), ticket_obs_ticket: observacion }
                    : ticket
            )
        );
        setCloseTicketModal(null);
    } catch (error) {
        console.error(error);
        alert("Error al finalizar ticket");
    }
};

  // Helper para actualizar estado local
  // IMPORTANTE: Aquí comparamos IDs numéricos para encontrar el ticket correcto
  const updateLocalTicket = (ticketId, updates) => {
    setTickets(prev => {
        const newTickets = prev.map(t => 
            // Comparamos el ID numérico (t.id) con el ticketId que recibimos
            t.id === ticketId ? { ...t, ...updates } : t
        );
        applyFilter(activeFilter, newTickets);
        return newTickets;
    });
  };
const CloseTicketModal = () => {
    if (!closeTicketModal) return null;
    return (
        <div className="modal-overlay" onClick={() => setCloseTicketModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '400px'}}>
                <div className="modal-header">
                    <h3>Finalizar Ticket</h3>
                    <button className="close-modal-btn" onClick={() => setCloseTicketModal(null)}>&times;</button>
                </div>
                <div className="modal-body">
                    <div className="modal-row">
                        <strong>Tiempo de resolución (minutos) *</strong>
                        <input
                            type="number"
                            min="1"
                            placeholder="Ej: 30"
                            value={tiempoReal}
                            onChange={e => setTiempoReal(e.target.value)}
                            style={{
                                width: '100%', padding: '8px', marginTop: '6px',
                                borderRadius: '6px', border: '1px solid #ccc',
                                fontSize: '14px'
                            }}
                        />
                    </div>
                    <div className="modal-row" style={{marginTop: '12px'}}>
                        <strong>Observaciones</strong>
                        <textarea
                            placeholder="Describe cómo se resolvió el problema..."
                            value={observacion}
                            onChange={e => setObservacion(e.target.value)}
                            rows={3}
                            style={{
                                width: '100%', padding: '8px', marginTop: '6px',
                                borderRadius: '6px', border: '1px solid #ccc',
                                fontSize: '14px', resize: 'vertical'
                            }}
                        />
                    </div>
                    <div className="modal-actions" style={{marginTop: '16px', display: 'flex', gap: '10px'}}>
                        <button className="btn-close-ticket" onClick={confirmCloseTicket}>
                            <i className="fas fa-check"></i> Confirmar Finalización
                        </button>
                        <button 
                            onClick={() => setCloseTicketModal(null)}
                            style={{padding: '8px 16px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer'}}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
  // --- COMPONENTE: MODAL DE DETALLES ---
  const TicketModal = ({ ticket, onClose }) => {
    if (!ticket) return null;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            {/* Visual: Mostramos TKT-XXXX */}
            <h3>Ticket #{ticket.ticket_id_ticket}</h3>
            <button className="close-modal-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="modal-row">
                <strong>Asunto:</strong>
                <p>{ticket.ticket_asu_ticket}</p>
            </div>
            <div className="modal-row">
                <strong>Descripción Completa:</strong>
                <div className="description-box">
                    {ticket.ticket_des_ticket || "Sin descripción detallada."}
                </div>
            </div>
            <div className="modal-meta-grid">
                <div>
                    <strong>Estado:</strong> 
                    <span className={`badge badge-${ticket.ticket_est_ticket}`}>
                        {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
                    </span>
                </div>
                <div>
                    <strong>Fecha:</strong>
                    <span>
                        {new Date(ticket.ticket_fec_ticket).toLocaleDateString('es-EC', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            timeZone: 'America/Guayaquil'
                        })}
                    </span>
                </div>
                <div>
                    <strong>Usuario:</strong>
                    <span>{ticket.ticket_tusua_ticket}</span>
                </div>
            </div>

            {/* Acciones dentro del modal */}
            {ticket.ticket_est_ticket !== 'FN' && (
                <div className="modal-actions">
                    <button 
                        className="btn-close-ticket"
                        /* CORRECCIÓN: Usamos ticket.id (número) para la lógica */
                        onClick={() => handleCloseTicket(ticket.ticket_cod_ticket)}
                    >
                        <i className="fas fa-check"></i> Marcar como Finalizado
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- RENDERIZADO ---
  
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginatedTickets = filteredTickets.slice(
      (currentPage - 1) * itemsPerPage, 
      currentPage * itemsPerPage
  );

  if (!user) return null;

  return (
    <div className="admin-container">
      <Sidebar user={user} onLogout={logout} activePage="dashboard" />
      
      <main className="main-content">
        <div className="dashboard-header">
           <div className="title-section">
             <h1>Panel de Control</h1>
             <p>Administración de Tickets</p>
           </div>
           <button className="btn-refresh" onClick={loadInitialData} disabled={loading}>
             <i className={`fas fa-sync ${loading ? 'fa-spin' : ''}`}></i>
           </button>
        </div>

        <div className="stats-grid">
           <div className="stat-card blue">
              <h3>{tickets.length}</h3> <p>Totales</p>
           </div>
           <div className="stat-card orange">
              <h3>{tickets.filter(t => t.ticket_est_ticket === 'PE').length}</h3> <p>Pendientes</p>
           </div>
           <div className="stat-card green">
              <h3>{tickets.filter(t => t.ticket_est_ticket === 'FN').length}</h3> <p>Finalizados</p>
           </div>
        </div>

        <div className="ticket-panel">
            <div className="filters-bar">
                <button className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => applyFilter('all')}>Todos</button>
                <button className={`filter-tab ${activeFilter === 'PE' ? 'active' : ''}`} onClick={() => applyFilter('PE')}>Pendientes</button>
                <button className={`filter-tab ${activeFilter === 'FN' ? 'active' : ''}`} onClick={() => applyFilter('FN')}>Finalizados</button>
            </div>

            {/* VISTA ESCRITORIO (TABLA) */}
            <div className="table-responsive desktop-only">
                <table className="tickets-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Asunto</th>
                            <th>Usuario</th>
                            <th>Técnico</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedTickets.map(ticket => (
                            /* Usamos ticket.id como Key React */
                            <tr key={ticket.ticket_cod_ticket}>
                                {/* VISUAL: Mostramos el texto TKT-... */}
                                <td>#{ticket.ticket_cod_ticket}</td>
                                
                                <td className="truncate-text" title={ticket.ticket_asu_ticket}>
                                    {ticket.ticket_asu_ticket}
                                </td>
                                <td>
                                    <select 
                                        value={ticket.ticket_tusua_ticket || ''}
                                        /* CORRECCIÓN: Enviamos ticket.id (el número) a la función */
                                        onChange={(e) => handleReassignUser(ticket.ticket_cod_ticket, e.target.value)}
                                        className="table-select"
                                    >
                                        <option value="">Asignar User</option>
                                        {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                                    </select>
                                </td>
                                <td>
                                    <select 
                                        value={ticket.ticket_asignado_a || ''}
                                        /* CORRECCIÓN: Enviamos ticket.id (el número) */
                                        onChange={(e) => handleAssignAdmin(ticket.ticket_cod_ticket, e.target.value)}
                                        className="table-select admin-select"
                                    >
                                        <option value="">Sin Técnico</option>
                                        {admins.map(a => <option key={a.username} value={a.username}>{a.username}</option>)}
                                    </select>
                                </td>
                                <td>
                                    <span className={`status-badge ${ticket.ticket_est_ticket}`}>
                                        {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
                                    </span>
                                </td>
                                <td className="actions-cell">
                                    <button className="icon-btn view" onClick={() => setSelectedTicket(ticket)} title="Ver detalles">
                                        <i className="fas fa-eye"></i>
                                    </button>
                                    {ticket.ticket_est_ticket !== 'FN' && (
                                        <button className="icon-btn check" 
                                            /* CORRECCIÓN: Enviamos ticket.id */
                                            onClick={() => handleCloseTicket(ticket.ticket_cod_ticket)} 
                                            title="Finalizar Ticket">
                                            <i className="fas fa-check"></i>
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* VISTA MÓVIL (TARJETAS) */}
            <div className="mobile-only tickets-grid-mobile">
                {paginatedTickets.map(ticket => (
                    <div key={ticket.ticket_cod_ticket} className="mobile-ticket-card">
                        <div className="mobile-card-header">
                            {/* Visual: TKT-... */}
                            <span className="ticket-id">#{ticket.ticket_id_ticket}</span>
                            <span className={`status-badge ${ticket.ticket_est_ticket}`}>
                                {ticket.ticket_est_ticket}
                            </span>
                        </div>
                        <h4 onClick={() => setSelectedTicket(ticket)}>{ticket.ticket_asu_ticket}</h4>
                        <div className="mobile-card-controls">
                             <label>Usuario:</label>
                             <select 
                                value={ticket.ticket_tusua_ticket || ''}
                                /* CORRECCIÓN: Enviamos ticket.id */
                                onChange={(e) => handleReassignUser(ticket.ticket_cod_ticket, e.target.value)}
                             >
                                {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                             </select>
                        </div>
                        <div className="mobile-card-footer">
                             <button className="btn-details-mobile" onClick={() => setSelectedTicket(ticket)}>Ver Detalles</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pagination-container">
                 <button disabled={currentPage===1} onClick={() => setCurrentPage(c => c-1)}>Anterior</button>
                 <span>Página {currentPage} de {totalPages || 1}</span>
                 <button disabled={currentPage===totalPages} onClick={() => setCurrentPage(c => c+1)}>Siguiente</button>
            </div>
        </div>

      </main>

      {selectedTicket && <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
        {closeTicketModal && <CloseTicketModal />}

    </div>
  );
};

export default AdminPanel;