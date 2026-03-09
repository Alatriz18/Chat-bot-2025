import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import NotificationSystem from '../components/UI/NotificationSystem';
import api from '../config/axios';
import '../styles/Admin.css';

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

// ── Badge de estado ──
const EstadoBadge = ({ estado }) => {
  const cfg = {
    PE: { label: '⏳ Pendiente',  bg: '#fef3c7', color: '#92400e' },
    PR: { label: '🔧 En Proceso', bg: '#dbeafe', color: '#1e40af' },
    FN: { label: '✅ Finalizado', bg: '#d1fae5', color: '#065f46' },
  }[estado] || { label: estado, bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [tickets,         setTickets]         = useState([]);
  const [users,           setUsers]           = useState([]);
  const [admins,          setAdmins]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [activeFilter,    setActiveFilter]    = useState('PE');
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [currentPage,     setCurrentPage]     = useState(1);
  const itemsPerPage = 10;

  const [selectedTicket,   setSelectedTicket]   = useState(null);
  const [closeTicketModal, setCloseTicketModal] = useState(null);
  const [tiempoReal,       setTiempoReal]       = useState('');
  const [observacion,      setObservacion]      = useState('');

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin' || user.is_staff;
    if (!isAdmin) { navigate('/chat'); return; }
    loadInitialData();
  }, [user, navigate]);

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
      const sorted = sortTickets(ticketsRes.data);
      setTickets(sorted);
      applyFilter('PE', sorted);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortTickets = (list) => [...list].sort((a, b) => {
    const order = { PE: 0, PR: 1, FN: 2 };
    const diff = (order[a.ticket_est_ticket] ?? 3) - (order[b.ticket_est_ticket] ?? 3);
    if (diff !== 0) return diff;
    return new Date(b.ticket_fec_ticket) - new Date(a.ticket_fec_ticket);
  });

  const applyFilter = useCallback((filter, ticketsData = tickets) => {
    setActiveFilter(filter);
    setFilteredTickets(filter === 'all' ? ticketsData : ticketsData.filter(t => t.ticket_est_ticket === filter));
    setCurrentPage(1);
  }, [tickets]);

  const updateTicketLocal = (ticketId, updates) => {
    setTickets(prev => {
      const updated = sortTickets(prev.map(t => t.ticket_cod_ticket === ticketId ? { ...t, ...updates } : t));
      applyFilter(activeFilter, updated);
      return updated;
    });
    if (selectedTicket?.ticket_cod_ticket === ticketId) {
      setSelectedTicket(prev => ({ ...prev, ...updates }));
    }
  };

  const handleReassignUser = async (ticketId, newUsername) => {
    try {
      await api.patch(`/admin/tickets/${ticketId}/`, { ticket_tusua_ticket: newUsername });
      updateTicketLocal(ticketId, { ticket_tusua_ticket: newUsername });
    } catch (error) { console.error(error); }
  };

  const handleAssignAdmin = async (ticketId, adminUsername) => {
    const valor = adminUsername === '' ? null : adminUsername;
    try {
      await api.patch(`/admin/tickets/${ticketId}/`, { ticket_asignado_a: valor });
      updateTicketLocal(ticketId, { ticket_asignado_a: valor });
    } catch (error) { alert('Error al asignar técnico'); }
  };

  const confirmCloseTicket = async () => {
    if (!tiempoReal || isNaN(tiempoReal) || Number(tiempoReal) <= 0) {
      alert('Por favor ingresa un tiempo de resolución válido (en minutos).');
      return;
    }
    const { ticketId } = closeTicketModal;
    try {
      await api.patch(`/admin/tickets/${ticketId}/`, {
        ticket_est_ticket: 'FN',
        ticket_treal_ticket: Number(tiempoReal),
        ticket_obs_ticket: observacion
      });
      updateTicketLocal(ticketId, { ticket_est_ticket: 'FN', ticket_treal_ticket: Number(tiempoReal), ticket_obs_ticket: observacion });
      setCloseTicketModal(null);
    } catch (error) { alert('Error al finalizar ticket'); }
  };

  // ── Modal finalizar (desde tabla) ──
  const CloseTicketModal = () => {
    if (!closeTicketModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setCloseTicketModal(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <h3>Finalizar Ticket</h3>
            <button className="close-modal-btn" onClick={() => setCloseTicketModal(null)}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="modal-row">
              <strong>Tiempo de resolución (minutos) *</strong>
              <input type="number" min="1" placeholder="Ej: 30" value={tiempoReal}
                onChange={e => setTiempoReal(e.target.value)}
                style={{ width: '100%', padding: 8, marginTop: 6, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }} />
            </div>
            <div className="modal-row" style={{ marginTop: 12 }}>
              <strong>Observaciones</strong>
              <textarea placeholder="Describe cómo se resolvió el problema..." value={observacion}
                onChange={e => setObservacion(e.target.value)} rows={3}
                style={{ width: '100%', padding: 8, marginTop: 6, borderRadius: 6, border: '1px solid #ccc', fontSize: 14, resize: 'vertical' }} />
            </div>
            <div className="modal-actions" style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button className="btn-close-ticket" onClick={confirmCloseTicket}>
                <i className="fas fa-check"></i> Confirmar Finalización
              </button>
              <button onClick={() => setCloseTicketModal(null)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Modal de detalles ──
  const TicketModal = ({ ticket, onClose }) => {
    const [tiempoModal, setTiempoModal] = React.useState('');
    const [obsModal,    setObsModal]    = React.useState('');
    const [saving,      setSaving]      = React.useState(false);
    if (!ticket) return null;

    const esPE = ticket.ticket_est_ticket === 'PE';
    const esPR = ticket.ticket_est_ticket === 'PR';
    const esFN = ticket.ticket_est_ticket === 'FN';

    // Poner ticket En Proceso
    const handleTomar = async () => {
      setSaving(true);
      try {
        await api.patch(`/admin/tickets/${ticket.ticket_cod_ticket}/`, { ticket_est_ticket: 'PR' });
        updateTicketLocal(ticket.ticket_cod_ticket, { ticket_est_ticket: 'PR' });
        onClose();
      } catch { alert('Error al actualizar estado'); }
      finally { setSaving(false); }
    };

    // Finalizar ticket
    const handleFinish = async () => {
      if (!tiempoModal || isNaN(tiempoModal) || Number(tiempoModal) <= 0) {
        alert('Ingresa un tiempo de resolución válido (en minutos).');
        return;
      }
      setSaving(true);
      try {
        await api.patch(`/admin/tickets/${ticket.ticket_cod_ticket}/`, {
          ticket_est_ticket: 'FN',
          ticket_treal_ticket: Number(tiempoModal),
          ticket_obs_ticket: obsModal
        });
        updateTicketLocal(ticket.ticket_cod_ticket, {
          ticket_est_ticket: 'FN',
          ticket_treal_ticket: Number(tiempoModal),
          ticket_obs_ticket: obsModal
        });
        onClose();
      } catch { alert('Error al finalizar ticket'); }
      finally { setSaving(false); }
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content mt-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={`mt-modal-status-dot ${esFN ? 'dot-finished' : esPR ? 'dot-inprocess' : 'dot-pending'}`}></div>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                  {esFN ? 'Detalle del Ticket' : 'Gestionar Ticket'}
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
                <EstadoBadge estado={ticket.ticket_est_ticket} />
              </div>
            </div>

            <div className="modal-row">
              <strong>Descripción</strong>
              <div className="description-box">{ticket.ticket_des_ticket || <em style={{ color: '#94a3b8' }}>Sin descripción.</em>}</div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

            {/* ── ACCIONES SEGÚN ESTADO ── */}
            {(esPE || esPR) && (
              <div className="modal-row">
                <strong><i className="fas fa-tools"></i> Resolver ticket</strong>
                <div className="mt-form-grid">
                  <div className="mt-form-group">
                    <label>Tiempo de resolución (minutos) *</label>
                    <input type="number" min="1" placeholder="Ej: 30"
                      value={tiempoModal} onChange={e => setTiempoModal(e.target.value)}
                      disabled={saving} className="mt-input" />
                  </div>
                  <div className="mt-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Observaciones</label>
                    <textarea placeholder="Describe cómo se resolvió el problema..."
                      value={obsModal} onChange={e => setObsModal(e.target.value)}
                      disabled={saving} rows={3} className="mt-textarea" />
                  </div>
                </div>
              </div>
            )}

            {esFN && (
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
            <button className="mt-btn-cancel" onClick={onClose} disabled={saving}>
              {esFN ? 'Cerrar' : 'Cancelar'}
            </button>

            {/* Botón "Tomar" solo si está en PE */}
            {esPE && (
              <button onClick={handleTomar} disabled={saving}
                style={{ padding: '9px 18px', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <><i className="fas fa-spinner fa-spin"></i> Procesando...</> : <><i className="fas fa-play"></i> Tomar ticket</>}
              </button>
            )}

            {/* Botón "Finalizar" si está en PE o PR */}
            {(esPE || esPR) && (
              <button className="mt-btn-finish" onClick={handleFinish} disabled={!tiempoModal || saving}>
                {saving ? <><i className="fas fa-spinner fa-spin"></i> Guardando...</> : <><i className="fas fa-check"></i> Finalizar</>}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  if (!user) return null;

  const counts = {
    all: tickets.length,
    PE:  tickets.filter(t => t.ticket_est_ticket === 'PE').length,
    PR:  tickets.filter(t => t.ticket_est_ticket === 'PR').length,
    FN:  tickets.filter(t => t.ticket_est_ticket === 'FN').length,
  };

  return (
    <div className="admin-container">
      <Sidebar user={user} onLogout={logout} activePage="dashboard" />
      <main className="main-content">

        <div className="dashboard-header">
          <div className="title-section">
            <h1>Panel de Control</h1>
            <p>Administración de Tickets</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationSystem />
            <button className="btn-refresh" onClick={loadInitialData} disabled={loading}>
              <i className={`fas fa-sync ${loading ? 'fa-spin' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card blue">
            <h3>{counts.all}</h3><p>Totales</p>
          </div>
          <div className="stat-card orange">
            <h3>{counts.PE}</h3><p>Pendientes</p>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: 'white', borderRadius: 12, padding: '16px 20px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{counts.PR}</h3>
            <p style={{ margin: 0, opacity: 0.85, fontSize: '0.9rem' }}>En Proceso</p>
          </div>
          <div className="stat-card green">
            <h3>{counts.FN}</h3><p>Finalizados</p>
          </div>
        </div>

        {/* Tabla */}
        <div className="ticket-panel">
          <div className="filters-bar">
            <button className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => applyFilter('all')}>Todos</button>
            <button className={`filter-tab ${activeFilter === 'PE'  ? 'active' : ''}`} onClick={() => applyFilter('PE')}>
              Pendientes {counts.PE > 0 && <span style={{ background: '#f59e0b', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: 11, marginLeft: 4 }}>{counts.PE}</span>}
            </button>
            <button className={`filter-tab ${activeFilter === 'PR'  ? 'active' : ''}`} onClick={() => applyFilter('PR')}>
              En Proceso {counts.PR > 0 && <span style={{ background: '#3b82f6', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: 11, marginLeft: 4 }}>{counts.PR}</span>}
            </button>
            <button className={`filter-tab ${activeFilter === 'FN'  ? 'active' : ''}`} onClick={() => applyFilter('FN')}>Finalizados</button>
          </div>

          <div className="table-responsive desktop-only">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Asunto</th>
                  <th style={{ width: 160 }}>Usuario</th>
                  <th style={{ width: 160 }}>Técnico</th>
                  <th style={{ width: 130 }}>Estado</th>
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTickets.map(ticket => (
                  <tr key={ticket.ticket_cod_ticket}
                    style={{ background: ticket.ticket_est_ticket === 'PE' ? '#fffbf0' : ticket.ticket_est_ticket === 'PR' ? '#f0f7ff' : 'inherit' }}>
                    <td><span className="ticket-id">#{ticket.ticket_cod_ticket}</span></td>
                    <td className="truncate-text" title={ticket.ticket_asu_ticket}>{ticket.ticket_asu_ticket}</td>
                    <td>
                      <select value={ticket.ticket_tusua_ticket || ''} onChange={e => handleReassignUser(ticket.ticket_cod_ticket, e.target.value)}
                        className="table-select" style={{ maxWidth: 140, fontSize: '0.8rem' }}>
                        <option value="">Sin usuario</option>
                        {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={ticket.ticket_asignado_a || ''} onChange={e => handleAssignAdmin(ticket.ticket_cod_ticket, e.target.value)}
                        className="table-select admin-select" style={{ maxWidth: 140, fontSize: '0.8rem' }}>
                        <option value="">Sin técnico</option>
                        {admins.map(a => <option key={a.username} value={a.username}>{a.username}</option>)}
                      </select>
                    </td>
                    <td><EstadoBadge estado={ticket.ticket_est_ticket} /></td>
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

          {/* Vista móvil */}
          <div className="mobile-only tickets-grid-mobile">
            {paginatedTickets.map(ticket => (
              <div key={ticket.ticket_cod_ticket} className="mobile-ticket-card">
                <div className="mobile-card-header">
                  <span className="ticket-id">#{ticket.ticket_id_ticket}</span>
                  <EstadoBadge estado={ticket.ticket_est_ticket} />
                </div>
                <h4 onClick={() => setSelectedTicket(ticket)}>{ticket.ticket_asu_ticket}</h4>
                <div className="mobile-card-footer">
                  <button className="btn-details-mobile" onClick={() => setSelectedTicket(ticket)}>Ver Detalles</button>
                </div>
              </div>
            ))}
          </div>

          <div className="pagination-container">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Anterior</button>
            <span>Página {currentPage} de {totalPages || 1}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(c => c + 1)}>Siguiente</button>
          </div>
        </div>
      </main>

      {selectedTicket  && <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
      {closeTicketModal && <CloseTicketModal />}
    </div>
  );
};

export default AdminPanel;