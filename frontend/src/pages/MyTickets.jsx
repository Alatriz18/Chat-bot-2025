import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import NotificationSystem from '../components/UI/NotificationSystem';
// ✅ IMPORTANTE: Usamos tu instancia configurada
import api from '../config/axios';
import '../styles/Admin.css';
import '../styles/tickets.css';

// --- ESTILOS ---
const customStyles = `
  .form-input, .form-textarea {
    background-color: #ffffff !important;
    color: #333333 !important;
    border: 1px solid #ced4da !important;
    border-radius: 4px;
    padding: 10px;
    width: 100%;
    font-size: 14px;
  }
  
  .form-input:focus, .form-textarea:focus {
    border-color: #4facfe !important;
    box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.2);
    outline: none;
  }

  .file-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
    margin-top: 10px;
    margin-bottom: 20px;
  }

  .file-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
    text-decoration: none;
    color: #4a5568;
    background-color: #f8fafc;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 90px;
    cursor: pointer;
  }

  .file-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    background-color: #fff;
    border-color: #4facfe;
  }
`;

const MyTickets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Estados del Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [solutionTime, setSolutionTime] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    // Verificar si es personal técnico/staff
    const isStaff = user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin' || user.is_staff;
    if (!isStaff) {
      navigate('/chat');
      return;
    }
    fetchMyTickets();
  }, [user, navigate]);
const fetchMyTickets = async () => {
    try {
      setLoading(true);
      
      // 1. Pedimos los tickets (El Backend YA trae los archivos filtrados correctamente gracias a tu cambio anterior)
      const response = await api.get('/admin/tickets/');
      const allTickets = response.data;

      // 2. Filtramos y Mapeamos
      // Ya no hace falta hacer llamadas extra a la API (adiós al Promise.all)
      const myTickets = allTickets
        .filter(ticket => ticket.ticket_asignado_a === user.username)
        .map(ticket => ({
            ...ticket,
            // IMPORTANTE: El backend devuelve 'archivos', pero tu frontend usa 'files'.
            // Aquí hacemos el puente:
            files: ticket.archivos || [], 
            
            // Mapeamos los IDs como lo hacías antes
            id: ticket.ticket_cod_ticket, 
            displayId: ticket.ticket_id_ticket 
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
    const event = new CustomEvent('show-notification', {
      detail: { message, type }
    });
    window.dispatchEvent(event);
  };

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf': return 'fa-file-pdf text-red-500';
      case 'doc': case 'docx': return 'fa-file-word text-blue-500';
      case 'xls': case 'xlsx': return 'fa-file-excel text-green-500';
      case 'jpg': case 'jpeg': case 'png': case 'gif': return 'fa-file-image text-purple-500';
      case 'zip': case 'rar': return 'fa-file-archive text-yellow-500';
      default: return 'fa-file-alt text-gray-500';
    }
  };

  // ✅ CORRECCIÓN CLAVE PARA VER ARCHIVOS
  const getFileUrl = (url) => {
    if (!url) return '#';
    if (url.startsWith('http')) return url;
    
    // Obtenemos la URL base limpia desde la variable de entorno
    // Esto evita problemas si api.defaults.baseURL tiene '/api' duplicado
    let baseUrl = import.meta.env.VITE_API_URL;
    
    // Quitamos '/api' del final si existe en la variable de entorno, 
    // porque usualmente Django devuelve '/media/...' que va en la raíz
    if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
    }
    // Quitamos slash final si tiene
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }

    return `${baseUrl}${url}`;
  };

  const handleFinishTicket = async () => {
    if (!selectedTicket) return;
    
    if(selectedTicket.ticket_est_ticket === 'FN'){
         setShowModal(false);
         return;
    }

    const minutes = parseInt(solutionTime);
    const ticketId = selectedTicket.id; 

    if (!minutes || minutes < 1) {
      showNotification('Ingresa un tiempo válido', 'error');
      return;
    }

    try {
      setSaving(true);
      
      // ✅ CAMBIO A PATCH (Más seguro y consistente con tu Admin Panel)
      await api.patch(`/admin/tickets/${ticketId}/`, {
        ticket_est_ticket: 'FN',      // Estado Finalizado
        ticket_treal_ticket: minutes, // Tiempo real
        ticket_obs_ticket: observation // Observación
      });

      // Actualizar UI localmente
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { 
              ...t, 
              ticket_est_ticket: 'FN',
              ticket_treal_ticket: minutes,
              ticket_obs_ticket: observation
            }
          : t
      ));
      
      setShowModal(false);
      setSelectedTicket(null);
      setSolutionTime('');
      setObservation('');
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
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return 'Fecha inválida'; }
  };

  // --- RENDERIZADO ---
  const filteredTickets = tickets.filter(ticket => {
    if (activeFilter === 'all') return true;
    return ticket.ticket_est_ticket === activeFilter;
  });

  if (!user || (loading && tickets.length === 0)) {
    return <div className="loading-container"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="admin-container">
      <style>{customStyles}</style>
      <Sidebar user={user} activePage="tickets" />
      
      <main className="main-content">
        <div className="dashboard-header">
           <div className="dashboard-title"><h1>Mis Tickets Asignados</h1></div>
           <button className="header-action-btn" onClick={fetchMyTickets}><i className="fas fa-sync-alt"></i> Actualizar</button>
        </div>

        <div className="ticket-panel">
          <div className="panel-header">
             <h2>Lista de Tickets</h2>
             <div className="ticket-filters">
                <button className={`filter-btn ${activeFilter==='all'?'active':''}`} onClick={()=>setActiveFilter('all')}>Todos</button>
                <button className={`filter-btn ${activeFilter==='PE'?'active':''}`} onClick={()=>setActiveFilter('PE')}>Pendientes</button>
                <button className={`filter-btn ${activeFilter==='FN'?'active':''}`} onClick={()=>setActiveFilter('FN')}>Finalizados</button>
             </div>
          </div>

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
                    className={`clickable-row ${ticket.ticket_est_ticket === 'PE' ? 'ticket-pending' : 'ticket-completed'}`}
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setSolutionTime(ticket.ticket_treal_ticket || '');
                      setObservation(ticket.ticket_obs_ticket || '');
                      setShowModal(true);
                    }}
                  >
                    <td>#{ticket.displayId}</td>
                    <td>{ticket.ticket_asu_ticket}</td>
                    <td>{ticket.ticket_tusua_ticket}</td>
                    <td>
                      <span className={`ticket-status status-${ticket.ticket_est_ticket}`}>
                        {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
                      </span>
                    </td>
                    <td>{formatDate(ticket.ticket_fec_ticket)}</td>
                    <td><i className="fas fa-paperclip"></i> {ticket.files?.length || 0}</td>
                    <td><button className="btn-icon"><i className="fas fa-edit"></i></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <NotificationSystem />

      {/* --- MODAL --- */}
      {showModal && selectedTicket && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedTicket.ticket_est_ticket === 'FN' ? 'Detalle Ticket' : 'Gestionar Ticket'} #{selectedTicket.displayId}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)} disabled={saving}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="ticket-info">
                <h3>{selectedTicket.ticket_asu_ticket}</h3>
                <p><strong>Usuario:</strong> {selectedTicket.ticket_tusua_ticket} | <strong>Fecha:</strong> {formatDate(selectedTicket.ticket_fec_ticket)}</p>
                <div style={{background: '#f8f9fa', padding: '10px', borderRadius: '5px', margin: '10px 0'}}>
                    <p>{selectedTicket.ticket_des_ticket}</p>
                </div>

                {/* SECCIÓN DE ARCHIVOS */}
<div className="existing-files-section">
    <p><strong><i className="fas fa-paperclip"></i> Adjuntos ({selectedTicket.files?.length || 0}):</strong></p>
    {selectedTicket.files && selectedTicket.files.length > 0 ? (
        <div className="file-gallery">
            {selectedTicket.files.map((file, idx) => {
                // ✅ CORRECCIÓN AQUÍ: Usamos archivo_rut_archivo
                const finalUrl = getFileUrl(file.archivo_rut_archivo);
                
                return (
                    <a 
                        key={idx} 
                        href={finalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="file-card" 
                        title={`Clic para ver: ${file.archivo_nom_archivo}`}
                        onClick={(e) => {
                            e.stopPropagation(); 
                            // Debug para que veas qué está llegando
                            console.log("Ruta cruda:", file.archivo_rut_archivo);
                            console.log("URL final:", finalUrl);

                            if(finalUrl === '#') {
                                e.preventDefault();
                                alert("URL del archivo no disponible en base de datos");
                            }
                        }}
                    >
                        <i className={`fas ${getFileIcon(file.archivo_nom_archivo)} fa-2x`} style={{marginBottom:'8px'}}></i>
                        <span style={{fontSize:'0.75rem', wordBreak:'break-all', lineHeight:'1.2'}}>
                            {file.archivo_nom_archivo.length > 20 ? '...' + file.archivo_nom_archivo.slice(-15) : file.archivo_nom_archivo}
                        </span>
                    </a>
                );
            })}
        </div>
    ) : (
        <p style={{color: '#999', fontSize: '0.9rem'}}>Sin archivos adjuntos.</p>
    )}
</div>
              </div>

              <hr className="divider" />

              {/* FORMULARIO */}
              {selectedTicket.ticket_est_ticket === 'PE' ? (
                  <>
                    <h3><i className="fas fa-tools"></i> Resolver</h3>
                    <div className="form-group">
                        <label>Tiempo (minutos):</label>
                        <input type="number" min="1" value={solutionTime} onChange={(e) => setSolutionTime(e.target.value)} className="form-input" disabled={saving} placeholder="Ej: 30" />
                    </div>
                    <div className="form-group">
                        <label>Observación:</label>
                        <textarea value={observation} onChange={(e) => setObservation(e.target.value)} className="form-textarea" rows="3" disabled={saving} placeholder="Detalles de la solución..." />
                    </div>
                  </>
              ) : (
                  <div style={{background: '#e6fffa', padding:'15px', borderRadius:'8px', border:'1px solid #38b2ac', marginTop: '15px'}}>
                      <h4 style={{color: '#2c7a7b', margin: '0 0 10px 0'}}>Ticket Cerrado</h4>
                      <p style={{margin:'5px 0'}}><strong>Tiempo:</strong> {selectedTicket.ticket_treal_ticket} min</p>
                      <p style={{margin:'5px 0'}}><strong>Solución:</strong> {selectedTicket.ticket_obs_ticket}</p>
                  </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
              {selectedTicket.ticket_est_ticket === 'PE' && (
                  <button className="btn-primary" onClick={handleFinishTicket} disabled={!solutionTime || saving}>
                    {saving ? 'Guardando...' : 'Finalizar Ticket'}
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