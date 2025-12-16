import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import NotificationSystem from '../components/UI/NotificationSystem';
import api from '../config/axios';
import '../styles/Admin.css';
import '../styles/tickets.css';

// --- ESTILOS CORREGIDOS PARA MODAL Y GALERÍA ---
const customStyles = `
  /* Estilos para inputs del modal (Corrección de pantalla negra) */
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

  /* Estilos para la galería de archivos */
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
  }

  .file-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    background-color: #fff;
    border-color: #4facfe;
  }
`;

// Función para subir a S3
const uploadFileToS3 = async (ticketId, file, username) => {
  try {
    const presignedRes = await api.post(`/tickets/${ticketId}/generate-presigned-url/`, {
      filename: file.name,
      filetype: file.type,
      filesize: file.size
    });
    
    const { upload_url, s3_key } = presignedRes.data;

    await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });

    await api.post(`/tickets/${ticketId}/confirm-upload/`, {
      s3_key: s3_key,
      filename: file.name,
      filetype: file.type,
      filesize: file.size,
      username: username
    });

    return s3_key;
  } catch (error) {
    console.error('Error en uploadFileToS3:', error);
    throw error;
  }
};

const MyTickets = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [solutionTime, setSolutionTime] = useState('');
  const [observation, setObservation] = useState('');
  const [uploading, setUploading] = useState(false);

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
    fetchMyTickets();
  }, [user, navigate]);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/tickets/');
      const allTickets = response.data;

      const myTickets = allTickets.filter(ticket => 
        ticket.ticket_asignado_a === user.username
      );

      const ticketsWithFiles = await Promise.all(
        myTickets.map(async (ticket) => {
          try {
            // CORRECCIÓN CRÍTICA: Mapeo correcto de IDs
            // ticket_cod_ticket es el ID numérico (PK) para la API
            // ticket_id_ticket es el String visual (TKT-...)
            const pk = ticket.ticket_cod_ticket; 
            const displayId = ticket.ticket_id_ticket;

            const filesRes = await api.get(`/files/?ticket=${displayId}`);
            
            return { 
              ...ticket, 
              files: filesRes.data,
              id: pk, // ESTO ES VITAL: Usamos el PK numérico para las llamadas API
              displayId: displayId // Guardamos el visual para mostrarlo
            };
          } catch (e) {
            return { 
              ...ticket, 
              files: [],
              id: ticket.ticket_cod_ticket,
              displayId: ticket.ticket_id_ticket
            };
          }
        })
      );

      setTickets(ticketsWithFiles);
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

  const handleFileSelection = (files) => {
    const fileList = Array.from(files);
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'];
    const maxSize = 16 * 1024 * 1024; 

    const validFiles = fileList.filter(file => {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(extension)) return false;
      if (file.size > maxSize) return false;
      return true;
    });
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinishTicket = async () => {
    if (!selectedTicket) return;
    
    // Si ya está finalizado, solo cerramos
    if(selectedTicket.ticket_est_ticket === 'FN'){
         setShowModal(false);
         return;
    }

    const minutes = parseInt(solutionTime);
    // AQUÍ USAMOS EL ID NUMÉRICO (PK)
    const ticketId = selectedTicket.id; // Esto ahora es ticket_cod_ticket gracias a fetchMyTickets

    if (!minutes || minutes < 1) {
      showNotification('Ingresa un tiempo válido', 'error');
      return;
    }

    try {
      setUploading(true);
      
      // 1. Subir archivos nuevos
      if (selectedFiles.length > 0) {
        showNotification('Subiendo archivos...', 'info');
        // Usamos displayId para generar carpetas o id normal según tu lógica backend
        // Generalmente para S3 usamos el ID numérico para relacionar
        for (const file of selectedFiles) {
            await uploadFileToS3(ticketId, file, user.username);
        }
      }

      // 2. Actualizar Ticket (PUT con ID Numérico)
      console.log(`Enviando actualización a: /admin/tickets/${ticketId}/`);
      
      await api.put(`/admin/tickets/${ticketId}/`, {
        status: 'FN',
        ticket_treal: minutes,
        observation: observation
      });

      // 3. Actualizar UI
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { 
              ...t, 
              ticket_est_ticket: 'FN',
              ticket_treal_ticket: minutes,
              ticket_obs_ticket: observation,
              files: [...t.files, ...selectedFiles.map(f => ({
                archivo_nom_archivo: f.name,
                archivo_url: '#'
              }))]
            }
          : t
      ));
      
      setShowModal(false);
      setSelectedTicket(null);
      setSelectedFiles([]);
      setSolutionTime('');
      setObservation('');
      showNotification('✅ Ticket finalizado', 'success');

    } catch (error) {
      console.error('Error detallado:', error);
      showNotification('Error al finalizar ticket', 'error');
    } finally {
      setUploading(false);
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

  // Stats y Filtros
  const StatsCards = ({ tickets }) => {
    const stats = {
      total: tickets.length,
      pending: tickets.filter(t => t.ticket_est_ticket === 'PE').length,
      completed: tickets.filter(t => t.ticket_est_ticket === 'FN').length,
      avgTime: tickets.length > 0 ? Math.round(tickets.reduce((acc, t) => acc + (t.ticket_treal_ticket || 0), 0) / tickets.length) : 0
    };

    return (
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}><i className="fas fa-ticket-alt"></i></div>
          <div className="stat-info"><h3>{stats.total}</h3><p>Total</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}><i className="fas fa-clock"></i></div>
          <div className="stat-info"><h3>{stats.pending}</h3><p>Pendientes</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'}}><i className="fas fa-check-circle"></i></div>
          <div className="stat-info"><h3>{stats.completed}</h3><p>Finalizados</p></div>
        </div>
      </div>
    );
  };

  const handleFilterChange = (filter) => setActiveFilter(filter);
  const filteredTickets = tickets.filter(ticket => {
    if (activeFilter === 'all') return true;
    return ticket.ticket_est_ticket === activeFilter;
  });

  if (!user || (loading && tickets.length === 0)) {
    return <div className="loading-container"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="admin-container">
      <style>{customStyles}</style> {/* AQUÍ INYECTAMOS LOS ESTILOS */}
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
                <button className={`filter-btn ${activeFilter==='all'?'active':''}`} onClick={()=>handleFilterChange('all')}>Todos</button>
                <button className={`filter-btn ${activeFilter==='PE'?'active':''}`} onClick={()=>handleFilterChange('PE')}>Pendientes</button>
                <button className={`filter-btn ${activeFilter==='FN'?'active':''}`} onClick={()=>handleFilterChange('FN')}>Finalizados</button>
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
                    <td>#{ticket.displayId}</td> {/* Mostramos el ID bonito */}
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
        <div className="modal-overlay" onClick={() => !uploading && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedTicket.ticket_est_ticket === 'FN' ? 'Detalle Ticket' : 'Gestionar Ticket'} #{selectedTicket.displayId}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)} disabled={uploading}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="ticket-info">
                <h3>{selectedTicket.ticket_asu_ticket}</h3>
                <p><strong>Usuario:</strong> {selectedTicket.ticket_tusua_ticket} | <strong>Fecha:</strong> {formatDate(selectedTicket.ticket_fec_ticket)}</p>
                <div style={{background: '#f8f9fa', padding: '10px', borderRadius: '5px', margin: '10px 0'}}>
                    <p>{selectedTicket.ticket_des_ticket}</p>
                </div>

                <div className="existing-files-section">
                    <p><strong><i className="fas fa-paperclip"></i> Adjuntos ({selectedTicket.files?.length || 0}):</strong></p>
                    {selectedTicket.files && selectedTicket.files.length > 0 ? (
                        <div className="file-gallery">
                            {selectedTicket.files.map((file, idx) => (
                                <a key={idx} href={file.archivo_url} target="_blank" rel="noopener noreferrer" className="file-card" title={file.archivo_nom_archivo}>
                                    <i className={`fas ${getFileIcon(file.archivo_nom_archivo)} fa-2x`} style={{marginBottom:'8px'}}></i>
                                    <span style={{fontSize:'0.75rem', wordBreak:'break-all', lineHeight:'1.2'}}>{file.archivo_nom_archivo.length > 20 ? '...' + file.archivo_nom_archivo.slice(-15) : file.archivo_nom_archivo}</span>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p style={{color: '#999', fontSize: '0.9rem'}}>Sin archivos.</p>
                    )}
                </div>
              </div>

              <hr className="divider" />

              {selectedTicket.ticket_est_ticket === 'PE' ? (
                  <>
                    <h3><i className="fas fa-tools"></i> Resolver</h3>
                    <div className="form-group">
                        <label>Tiempo (minutos):</label>
                        <input type="number" min="1" value={solutionTime} onChange={(e) => setSolutionTime(e.target.value)} className="form-input" disabled={uploading} placeholder="Ej: 30" />
                    </div>
                    <div className="form-group">
                        <label>Observación:</label>
                        <textarea value={observation} onChange={(e) => setObservation(e.target.value)} className="form-textarea" rows="3" disabled={uploading} placeholder="Detalles de la solución..." />
                    </div>
                    <div className="form-group">
                        <label>Evidencia (Opcional):</label>
                        <div className={`file-upload-area ${uploading ? 'disabled' : ''}`} onClick={() => !uploading && document.getElementById('file-input-modal').click()} style={{padding: '10px', minHeight: '80px'}}>
                            <i className="fas fa-cloud-upload-alt"></i> <span style={{fontSize:'0.9rem'}}>Adjuntar archivo</span>
                            <input id="file-input-modal" type="file" multiple style={{ display: 'none' }} onChange={(e) => handleFileSelection(e.target.files)} disabled={uploading} />
                        </div>
                        {selectedFiles.length > 0 && (
                            <div style={{marginTop:'5px'}}>
                                {selectedFiles.map((f, i) => (<span key={i} className="badge badge-info" style={{marginRight:'5px', fontSize:'0.8rem'}}>{f.name}</span>))}
                            </div>
                        )}
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
              <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={uploading}>Cancelar</button>
              {selectedTicket.ticket_est_ticket === 'PE' && (
                  <button className="btn-primary" onClick={handleFinishTicket} disabled={!solutionTime || uploading}>
                    {uploading ? 'Guardando...' : 'Finalizar Ticket'}
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