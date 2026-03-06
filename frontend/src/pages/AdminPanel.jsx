import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import NotificationSystem from '../components/UI/NotificationSystem';
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

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('es-EC', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Guayaquil'
    });
  } catch { return 'Fecha inválida'; }
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Estados de Datos
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de UI
  const [activeFilter, setActiveFilter] = useState('PE');
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estado para el MODAL de detalles
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [closeTicketModal, setCloseTicketModal] = useState(null);
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
      const sorted = [...ticketsRes.data].sort((a, b) => {
  if (a.ticket_est_ticket === 'PE' && b.ticket_est_ticket !== 'PE') return -1;
  if (a.ticket_est_ticket !== 'PE' && b.ticket_est_ticket === 'PE') return  1;
  return new Date(b.ticket_fec_ticket) - new Date(a.ticket_fec_ticket);
});
setTickets(sorted);
applyFilter('PE', sorted);
      
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
        if (ticket.ticket_cod_ticket === ticketId) {
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
      setTickets(prevTickets => prevTickets.map(ticket => {
        if (ticket.ticket_cod_ticket === ticketId) {
          return { ...ticket, ticket_asignado_a: valor };
        }
        return ticket;
      }));
    } catch (error) {
      console.error(error);
      alert("Error al asignar técnico");
    }
  };

  // 6. FINALIZAR TICKET
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

      const updatedTickets = tickets.map(ticket =>
        ticket.ticket_cod_ticket === ticketId
          ? { ...ticket, ticket_est_ticket: 'FN', ticket_treal_ticket: Number(tiempoReal), ticket_obs_ticket: observacion }
          : ticket
      );

      setTickets(updatedTickets);
      applyFilter(activeFilter, updatedTickets);

      if (selectedTicket?.ticket_cod_ticket === ticketId) {
        setSelectedTicket(prev => ({ 
          ...prev, 
          ticket_est_ticket: 'FN', 
          ticket_treal_ticket: Number(tiempoReal), 
          ticket_obs_ticket: observacion 
        }));
      }

      setCloseTicketModal(null);
    } catch (error) {
      console.error(error);
      alert("Error al finalizar ticket");
    }
  };

  // Helper para actualizar estado local
  const updateLocalTicket = (ticketId, updates) => {
    setTickets(prev => {
      const newTickets = prev.map(t => 
        t.id === ticketId ? { ...t, ...updates } : t
      );
      applyFilter(activeFilter, newTickets);
      return newTickets;
    });
  };

  // --- MODAL FINALIZAR TICKET ---
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

  // --- MODAL DE DETALLES ---
  const TicketModal = ({ ticket, onClose }) => {
    const [tiempoModal,  setTiempoModal]  = React.useState('');
  const [obsModal,     setObsModal]     = React.useState('');
  const [savingModal,  setSavingModal]  = React.useState(false);
    if (!ticket) return null;

    const handleFinish = async () => {
    if (!tiempoModal || isNaN(tiempoModal) || Number(tiempoModal) <= 0) {
      alert("Ingresa un tiempo de resolución válido (en minutos).");
      return;
    }
    setSavingModal(true);
    try {
      await api.patch(`/admin/tickets/${ticket.ticket_cod_ticket}/`, {
        ticket_est_ticket:   'FN',
        ticket_treal_ticket: Number(tiempoModal),
        ticket_obs_ticket:   obsModal
      });
      const updates = { ticket_est_ticket: 'FN', ticket_treal_ticket: Number(tiempoModal), ticket_obs_ticket: obsModal };
      setTickets(prev => {
        const updated = sortTickets(prev.map(t => t.ticket_cod_ticket === ticket.ticket_cod_ticket ? { ...t, ...updates } : t));
        applyFilter(activeFilter, updated);
        return updated;
      });
      onClose();
    } catch (e) {
      alert("Error al finalizar ticket");
    } finally { setSavingModal(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mt-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={`mt-modal-status-dot ${ticket.ticket_est_ticket === 'PE' ? 'dot-pending' : 'dot-finished'}`}></div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                {ticket.ticket_est_ticket === 'FN' ? 'Detalle del Ticket' : 'Gestionar Ticket'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>#{ticket.ticket_id_ticket}</p>
            </div>
          </div>
          <button className="close-modal-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="mt-info-block">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>{ticket.ticket_asu_ticket}</h3>
            <div className="mt-meta-row">
              <span><i className="fas fa-user"></i> {ticket.ticket_tusua_ticket}</span>
              <span><i className="fas fa-calendar"></i> {formatDate(ticket.ticket_fec_ticket)}</span>
              <span className={`status-badge ${ticket.ticket_est_ticket === 'PE' ? 'status-PE' : 'status-FN'}`}>
                {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
              </span>
            </div>
          </div>

          <div className="modal-row">
            <strong>Descripción</strong>
            <div className="description-box">{ticket.ticket_des_ticket || <em style={{ color: '#94a3b8' }}>Sin descripción.</em>}</div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

          {ticket.ticket_est_ticket === 'PE' ? (
            <div className="modal-row">
              <strong><i className="fas fa-tools"></i> Resolver ticket</strong>
              <div className="mt-form-grid">
                <div className="mt-form-group">
                  <label>Tiempo de resolución (minutos) *</label>
                  <input type="number" min="1" placeholder="Ej: 30"
                    value={tiempoModal} onChange={e => setTiempoModal(e.target.value)}
                    disabled={savingModal} className="mt-input" />
                </div>
                <div className="mt-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Observaciones</label>
                  <textarea placeholder="Describe cómo se resolvió el problema..."
                    value={obsModal} onChange={e => setObsModal(e.target.value)}
                    disabled={savingModal} rows={3} className="mt-textarea" />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-closed-info">
              <div className="mt-closed-header"><i className="fas fa-check-circle"></i><span>Ticket Cerrado</span></div>
              <div className="mt-closed-details">
                <div>
                  <span className="mt-closed-label">Tiempo empleado</span>
                  <span className="mt-closed-value">{ticket.ticket_treal_ticket} min</span>
                </div>
                <div>
                  <span className="mt-closed-label">Observación</span>
                  <span className="mt-closed-value">{ticket.ticket_obs_ticket || '—'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="mt-btn-cancel" onClick={onClose} disabled={savingModal}>
            {ticket.ticket_est_ticket === 'FN' ? 'Cerrar' : 'Cancelar'}
          </button>
          {ticket.ticket_est_ticket === 'PE' && (
            <button className="mt-btn-finish" onClick={handleFinish} disabled={!tiempoModal || savingModal}>
              {savingModal ? <><i className="fas fa-spinner fa-spin"></i> Guardando...</> : <><i className="fas fa-check"></i> Finalizar Ticket</>}
            </button>
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

        {/* ===== HEADER con campana de notificaciones ===== */}
        <div className="dashboard-header">
          <div className="title-section">
            <h1>Panel de Control</h1>
            <p>Administración de Tickets</p>
          </div>

          {/* Acciones del header: campana + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 
              NotificationSystem muestra la campana 🔔 con badge de no leídos.
              Internamente usa useNotifications → useWebSocket conectado a
              ws://...?token=<jwt> → grupo "notifications_<username>"
              Solo llegan notificaciones de tickets asignados a este admin.
            */}
            <NotificationSystem />

            <button className="btn-refresh" onClick={loadInitialData} disabled={loading}>
              <i className={`fas fa-sync ${loading ? 'fa-spin' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* ===== STATS ===== */}
        <div className="stats-grid">
          <div className="stat-card blue">
            <h3>{tickets.length}</h3>
            <p>Totales</p>
          </div>
          <div className="stat-card orange">
            <h3>{tickets.filter(t => t.ticket_est_ticket === 'PE').length}</h3>
            <p>Pendientes</p>
          </div>
          <div className="stat-card green">
            <h3>{tickets.filter(t => t.ticket_est_ticket === 'FN').length}</h3>
            <p>Finalizados</p>
          </div>
        </div>

        {/* ===== PANEL DE TICKETS ===== */}
        <div className="ticket-panel">
          <div className="filters-bar">
            <button className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => applyFilter('all')}>Todos</button>
            <button className={`filter-tab ${activeFilter === 'PE'  ? 'active' : ''}`} onClick={() => applyFilter('PE')}>Pendientes</button>
            <button className={`filter-tab ${activeFilter === 'FN'  ? 'active' : ''}`} onClick={() => applyFilter('FN')}>Finalizados</button>
          </div>

          {/* VISTA ESCRITORIO */}
          <div className="table-responsive desktop-only">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th style={{width:'80px'}}>ID</th>
                  <th>Asunto</th>
                  <th style={{width:'160px'}}>Usuario</th>
                  <th style={{width:'160px'}}>Técnico</th>
                  <th style={{width:'110px'}}>Estado</th>
                  <th style={{width:'90px'}}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTickets.map(ticket => (
                  <tr key={ticket.ticket_cod_ticket} style={{ background: ticket.ticket_est_ticket === 'PE' ? '#fffbf0' : 'inherit' }}>
                    <td><span className="ticket-id">#{ticket.ticket_cod_ticket}</span></td>
                    <td className="truncate-text" title={ticket.ticket_asu_ticket}>
                      {ticket.ticket_asu_ticket}
                    </td>
                    <td>
                      <select 
                        value={ticket.ticket_tusua_ticket || ''}
                        onChange={(e) => handleReassignUser(ticket.ticket_cod_ticket, e.target.value)}
                        className="table-select"
                        style={{maxWidth:'140px', fontSize:'0.8rem'}}
                      >
                        <option value="">Sin usuario</option>
                        {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                      </select>
                    </td>
                    <td>
                      <select 
                        value={ticket.ticket_asignado_a || ''}
                        onChange={(e) => handleAssignAdmin(ticket.ticket_cod_ticket, e.target.value)}
                        className="table-select admin-select"
                        style={{maxWidth:'140px', fontSize:'0.8rem'}}
                      >
                        <option value="">Sin técnico</option>
                        {admins.map(a => <option key={a.username} value={a.username}>{a.username}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`status-badge ${ticket.ticket_est_ticket}`}>
                        {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
                      </span>
                    </td>
                   <td className="actions-cell">
  <button className="mt-btn-icon" onClick={() => setSelectedTicket(ticket)} title="Ver detalles">
    <i className="fas fa-eye"></i>
  </button>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* VISTA MÓVIL */}
          <div className="mobile-only tickets-grid-mobile">
            {paginatedTickets.map(ticket => (
              <div key={ticket.ticket_cod_ticket} className="mobile-ticket-card">
                <div className="mobile-card-header">
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
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Anterior</button>
            <span>Página {currentPage} de {totalPages || 1}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>Siguiente</button>
          </div>
        </div>

      </main>

      {selectedTicket && <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
      {closeTicketModal && <CloseTicketModal />}
    </div>
  );
};

export default AdminPanel;