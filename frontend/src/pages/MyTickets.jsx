import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import NotificationSystem from '../components/UI/NotificationSystem';
import api from '../config/axios';
import '../styles/Admin.css';
import '../styles/tickets.css';

const MyTickets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  // Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [solutionTime, setSolutionTime] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    const isStaff = user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin' || user.is_staff;
    if (!isStaff) { navigate('/chat'); return; }
    fetchMyTickets();
  }, [user, navigate]);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/tickets/');
      const myTickets = response.data
        .filter(t => t.ticket_asignado_a === user.username)
        .map(t => ({
          ...t,
          files: t.archivos || [],
          id: t.ticket_cod_ticket,
          displayId: t.ticket_id_ticket
        }));
      setTickets(myTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      showNotification('Error cargando tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'info') => {
    window.dispatchEvent(new CustomEvent('show-notification', { detail: { message, type } }));
  };

  const openModal = (ticket) => {
    setSelectedTicket(ticket);
    setSolutionTime(ticket.ticket_treal_ticket || '');
    setObservation(ticket.ticket_obs_ticket || '');
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setSelectedTicket(null);
    setSolutionTime('');
    setObservation('');
  };

  const handleFinishTicket = async () => {
    if (!selectedTicket || selectedTicket.ticket_est_ticket === 'FN') return;

    const minutes = parseInt(solutionTime);
    if (!minutes || minutes < 1) {
      showNotification('Ingresa un tiempo válido en minutos', 'error');
      return;
    }

    try {
      setSaving(true);
      await api.patch(`/admin/tickets/${selectedTicket.id}/`, {
        ticket_est_ticket: 'FN',
        ticket_treal_ticket: minutes,
        ticket_obs_ticket: observation
      });

      const updatedTicket = {
        ...selectedTicket,
        ticket_est_ticket: 'FN',
        ticket_treal_ticket: minutes,
        ticket_obs_ticket: observation
      };

      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setSelectedTicket(updatedTicket);

      showNotification('✅ Ticket finalizado correctamente', 'success');
    } catch (error) {
      console.error('Error finalizando:', error);
      showNotification('Error al finalizar ticket', 'error');
    } finally {
      setSaving(false);
    }
  };

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

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop().toLowerCase();
    const icons = {
      pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word',
      xls: 'fa-file-excel', xlsx: 'fa-file-excel',
      jpg: 'fa-file-image', jpeg: 'fa-file-image', png: 'fa-file-image', gif: 'fa-file-image',
      zip: 'fa-file-archive', rar: 'fa-file-archive'
    };
    return icons[ext] || 'fa-file-alt';
  };

  const getFileUrl = (url) => {
    if (!url) return '#';
    if (url.startsWith('http')) return url;
    let base = import.meta.env.VITE_API_URL || '';
    if (base.endsWith('/api')) base = base.slice(0, -4);
    if (base.endsWith('/')) base = base.slice(0, -1);
    return `${base}${url}`;
  };

  const filteredTickets = tickets.filter(t =>
    activeFilter === 'all' || t.ticket_est_ticket === activeFilter
  );

  const counts = {
    all: tickets.length,
    PE: tickets.filter(t => t.ticket_est_ticket === 'PE').length,
    FN: tickets.filter(t => t.ticket_est_ticket === 'FN').length,
  };

  if (!user || (loading && tickets.length === 0)) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <Sidebar user={user} activePage="tickets" />

      <main className="main-content">

        {/* ===== HEADER con campana de notificaciones ===== */}
        <div className="dashboard-header">
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Mis Tickets Asignados
            </h1>
            <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.9rem' }}>
              {counts.all} ticket{counts.all !== 1 ? 's' : ''} en total · {counts.PE} pendiente{counts.PE !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Acciones: campana + actualizar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/*
              NotificationSystem:
              - Campana 🔔 con badge rojo de no leídos
              - Toast en esquina inferior derecha al llegar notificación
              - Sonido de alerta automático
              - Panel desplegable con historial
              - WebSocket conectado a "notifications_<username>"
                → cada admin recibe SOLO sus propios tickets asignados
            */}
            <NotificationSystem />

            <button
              className="mt-refresh-btn"
              onClick={fetchMyTickets}
              disabled={loading}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              Actualizar
            </button>
          </div>
        </div>

        {/* ===== PANEL CON FILTROS Y TABLA ===== */}
        <div className="ticket-panel">
          <div className="panel-header">
            <h2>Lista de Tickets</h2>
            <div className="ticket-filters">
              {[
                { key: 'all', label: 'Todos',       count: counts.all },
                { key: 'PE',  label: 'Pendientes',  count: counts.PE  },
                { key: 'FN',  label: 'Finalizados', count: counts.FN  },
              ].map(f => (
                <button
                  key={f.key}
                  className={`filter-btn ${activeFilter === f.key ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f.key)}
                >
                  {f.label}
                  <span className="filter-count-badge">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="mt-empty">
              <i className="fas fa-inbox"></i>
              <p>No hay tickets {activeFilter !== 'all' ? (activeFilter === 'PE' ? 'pendientes' : 'finalizados') : ''}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Asunto</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Archivos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map(ticket => (
                    <tr
                      key={ticket.id}
                      className={`clickable-row ${ticket.ticket_est_ticket === 'PE' ? 'row-pending' : 'row-finished'}`}
                      onClick={() => openModal(ticket)}
                    >
                      <td>
                        <span className="ticket-id-badge">#{ticket.displayId}</span>
                      </td>
                      <td className="truncate-text" title={ticket.ticket_asu_ticket}>
                        {ticket.ticket_asu_ticket}
                      </td>
                      <td>
                        <span className="user-chip">
                          <i className="fas fa-user"></i>
                          {ticket.ticket_tusua_ticket}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${ticket.ticket_est_ticket}`}>
                          {ticket.ticket_est_ticket === 'PE' ? '● Pendiente' : '✓ Finalizado'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {formatDate(ticket.ticket_fec_ticket)}
                      </td>
                      <td>
                        <span className="file-count-chip">
                          <i className="fas fa-paperclip"></i>
                          {ticket.files?.length || 0}
                        </span>
                      </td>
                      <td>
                        <button
                          className="mt-btn-icon"
                          onClick={e => { e.stopPropagation(); openModal(ticket); }}
                          title="Ver detalles"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ===== MODAL ===== */}
      {showModal && selectedTicket && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content mt-modal" onClick={e => e.stopPropagation()}>

            {/* Header del modal */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={`mt-modal-status-dot ${selectedTicket.ticket_est_ticket === 'PE' ? 'dot-pending' : 'dot-finished'}`}></div>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    {selectedTicket.ticket_est_ticket === 'FN' ? 'Detalle del Ticket' : 'Gestionar Ticket'}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                    #{selectedTicket.displayId}
                  </p>
                </div>
              </div>
              <button className="close-modal-btn" onClick={closeModal} disabled={saving}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              {/* Info básica */}
              <div className="mt-info-block">
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
                  {selectedTicket.ticket_asu_ticket}
                </h3>
                <div className="mt-meta-row">
                  <span><i className="fas fa-user"></i> {selectedTicket.ticket_tusua_ticket}</span>
                  <span><i className="fas fa-calendar"></i> {formatDate(selectedTicket.ticket_fec_ticket)}</span>
                  <span className={`status-badge status-${selectedTicket.ticket_est_ticket}`}>
                    {selectedTicket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
                  </span>
                </div>
              </div>

              {/* Descripción */}
              <div className="modal-row">
                <strong>Descripción</strong>
                <div className="description-box">
                  {selectedTicket.ticket_des_ticket || <em style={{ color: '#94a3b8' }}>Sin descripción.</em>}
                </div>
              </div>

              {/* Archivos */}
              {selectedTicket.files?.length > 0 && (
                <div className="modal-row">
                  <strong><i className="fas fa-paperclip"></i> Archivos adjuntos ({selectedTicket.files.length})</strong>
                  <div className="mt-file-gallery">
                    {selectedTicket.files.map((file, idx) => {
                      const url = getFileUrl(file.archivo_url_firmada);
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-file-card"
                          onClick={e => {
                            e.stopPropagation();
                            if (url === '#') { e.preventDefault(); alert('URL no disponible'); }
                          }}
                          title={file.archivo_nom_archivo}
                        >
                          <i className={`fas ${getFileIcon(file.archivo_nom_archivo)} fa-lg`}></i>
                          <span>
                            {file.archivo_nom_archivo.length > 18
                              ? '...' + file.archivo_nom_archivo.slice(-14)
                              : file.archivo_nom_archivo}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

              {/* Formulario resolver / detalle cerrado */}
              {selectedTicket.ticket_est_ticket === 'PE' ? (
                <div className="modal-row">
                  <strong><i className="fas fa-tools"></i> Resolver ticket</strong>
                  <div className="mt-form-grid">
                    <div className="mt-form-group">
                      <label>Tiempo de resolución (minutos) *</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Ej: 30"
                        value={solutionTime}
                        onChange={e => setSolutionTime(e.target.value)}
                        disabled={saving}
                        className="mt-input"
                      />
                    </div>
                    <div className="mt-form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Observaciones</label>
                      <textarea
                        placeholder="Describe cómo se resolvió el problema..."
                        value={observation}
                        onChange={e => setObservation(e.target.value)}
                        disabled={saving}
                        rows={3}
                        className="mt-textarea"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-closed-info">
                  <div className="mt-closed-header">
                    <i className="fas fa-check-circle"></i>
                    <span>Ticket Cerrado</span>
                  </div>
                  <div className="mt-closed-details">
                    <div>
                      <span className="mt-closed-label">Tiempo empleado</span>
                      <span className="mt-closed-value">{selectedTicket.ticket_treal_ticket} minutos</span>
                    </div>
                    <div>
                      <span className="mt-closed-label">Observación</span>
                      <span className="mt-closed-value">{selectedTicket.ticket_obs_ticket || '—'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button className="mt-btn-cancel" onClick={closeModal} disabled={saving}>
                {selectedTicket.ticket_est_ticket === 'FN' ? 'Cerrar' : 'Cancelar'}
              </button>
              {selectedTicket.ticket_est_ticket === 'PE' && (
                <button
                  className="mt-btn-finish"
                  onClick={handleFinishTicket}
                  disabled={!solutionTime || saving}
                >
                  {saving
                    ? <><i className="fas fa-spinner fa-spin"></i> Guardando...</>
                    : <><i className="fas fa-check"></i> Finalizar Ticket</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTickets;