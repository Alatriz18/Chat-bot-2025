import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import NotificationSystem from '../components/UI/NotificationSystem';
import api from '../config/axios';
import '../styles/Admin.css';
import '../styles/tickets.css';

// --- ESTILOS INLINE PARA LA GALERÍA DE ARCHIVOS (Puedes moverlos a tu CSS) ---
const fileGalleryStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: '10px',
  marginTop: '10px',
  marginBottom: '20px'
};

const fileCardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '10px',
  textAlign: 'center',
  textDecoration: 'none',
  color: '#4a5568',
  backgroundColor: '#f7fafc',
  transition: 'all 0.2s',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100px'
};

// --- FIN ESTILOS ---

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
  
  // Estados
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Estados del Modal
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
            // Importante: Asegúrate que tu endpoint devuelva la URL completa o relativa
            const filesRes = await api.get(`/files/?ticket=${ticket.ticket_id_ticket}`);
            return { 
              ...ticket, 
              files: filesRes.data,
              id: ticket.id || ticket.ticket_id_ticket
            };
          } catch (e) {
            return { 
              ...ticket, 
              files: [],
              id: ticket.id || ticket.ticket_id_ticket
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

  // --- NUEVA FUNCIÓN: Obtener icono según extensión ---
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
      if (!allowedExtensions.includes(extension)) {
        showNotification(`"${file.name}" - Tipo no permitido`, 'error');
        return false;
      }
      if (file.size > maxSize) {
        showNotification(`"${file.name}" - Máximo 16MB`, 'error');
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      showNotification(`${validFiles.length} archivo(s) listo(s)`, 'success');
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinishTicket = async () => {
    if (!selectedTicket) return;
    
    // Si el estado ya es finalizado, solo cerramos el modal (o permitimos editar observación)
    // Pero asumo que si está aquí quiere finalizarlo.
    if(selectedTicket.ticket_est_ticket === 'FN'){
         alert("Este ticket ya está finalizado");
         setShowModal(false);
         return;
    }

    const minutes = parseInt(solutionTime);
    const ticketId = selectedTicket.id;

    if (!minutes || minutes < 1) {
      showNotification('Tiempo mínimo: 1 minuto', 'error');
      return;
    }

    try {
      setUploading(true);
      
      // 1. Subir nuevos archivos
      if (selectedFiles.length > 0) {
        showNotification('Subiendo archivos...', 'info');
        for (const file of selectedFiles) {
            await uploadFileToS3(ticketId, file, user.username);
        }
      }

      // 2. Actualizar Ticket
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
              // Añadimos visualmente los archivos subidos a la lista existente
              files: [...t.files, ...selectedFiles.map(f => ({
                archivo_nom_archivo: f.name,
                archivo_url: '#' // URL temporal hasta recargar
              }))]
            }
          : t
      ));
      
      setShowModal(false);
      setSelectedTicket(null);
      setSelectedFiles([]);
      setSolutionTime('');
      setObservation('');
      showNotification('✅ Ticket finalizado correctamente', 'success');

    } catch (error) {
      console.error('Error:', error);
      showNotification('Error al finalizar ticket', 'error');
      fetchMyTickets(); // Recargar por seguridad
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

  // ... (StatsCards y handleFilterChange se mantienen igual) ...
  const StatsCards = ({ tickets }) => {
    /* ... código de stats cards ... */
    return <div className="stats-grid">{/* ... contenido ... */}</div>;
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
      <Sidebar user={user} activePage="tickets" />
      
      <main className="main-content">
        {/* ... Header y Stats ... */}
        <div className="dashboard-header">
           <div className="dashboard-title">
             <h1>Mis Tickets Asignados</h1>
           </div>
           <button className="header-action-btn" onClick={fetchMyTickets}>
             <i className="fas fa-sync-alt"></i> Actualizar
           </button>
        </div>

        {/* Listado de Tickets */}
        <div className="ticket-panel">
          <div className="panel-header">
             <h2>Lista de Tickets</h2>
             {/* Filtros... */}
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
                  <th>Acción</th> {/* Columna extra opcional */}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    className={`clickable-row ${ticket.ticket_est_ticket === 'PE' ? 'ticket-pending' : 'ticket-completed'}`}
                    onClick={() => {
                      setSelectedTicket(ticket);
                      // Pre-llenar datos si ya está finalizado para solo ver
                      setSolutionTime(ticket.ticket_treal_ticket || '');
                      setObservation(ticket.ticket_obs_ticket || '');
                      setShowModal(true);
                    }}
                  >
                    <td>#{ticket.ticket_id_ticket}</td>
                    <td>{ticket.ticket_asu_ticket}</td>
                    <td>{ticket.ticket_tusua_ticket}</td>
                    <td>
                      <span className={`ticket-status status-${ticket.ticket_est_ticket}`}>
                        {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
                      </span>
                    </td>
                    <td>{formatDate(ticket.ticket_fec_ticket)}</td>
                    <td><i className="fas fa-paperclip"></i> {ticket.files?.length || 0}</td>
                    <td>
                        {/* Botón explícito dentro de la fila */}
                        <button className="btn-icon" title="Ver detalles y finalizar">
                            <i className="fas fa-edit"></i>
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <NotificationSystem />

      {/* --- MODAL MEJORADO --- */}
      {showModal && selectedTicket && (
        <div className="modal-overlay" onClick={() => !uploading && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedTicket.ticket_est_ticket === 'FN' ? 'Detalles del Ticket #' : 'Gestionar Ticket #'}
                {selectedTicket.ticket_id_ticket}
              </h2>
              <button className="close-btn" onClick={() => setShowModal(false)} disabled={uploading}>×</button>
            </div>
            
            <div className="modal-body">
              {/* 1. INFORMACIÓN DEL TICKET */}
              <div className="ticket-info">
                <h3>{selectedTicket.ticket_asu_ticket}</h3>
                <p><strong>Usuario:</strong> {selectedTicket.ticket_tusua_ticket}</p>
                <p><strong>Fecha:</strong> {formatDate(selectedTicket.ticket_fec_ticket)}</p>
                
                <div className="description-box" style={{background: '#f8f9fa', padding: '10px', borderRadius: '5px', margin: '10px 0'}}>
                    <p><strong>Descripción:</strong></p>
                    <p>{selectedTicket.ticket_des_ticket}</p>
                </div>

                {/* 2. AQUÍ MOSTRAMOS LOS ARCHIVOS ADJUNTOS EXISTENTES */}
                <div className="existing-files-section">
                    <p><strong><i className="fas fa-paperclip"></i> Archivos Adjuntos ({selectedTicket.files?.length || 0}):</strong></p>
                    
                    {selectedTicket.files && selectedTicket.files.length > 0 ? (
                        <div style={fileGalleryStyle}>
                            {selectedTicket.files.map((file, idx) => (
                                <a 
                                    key={idx} 
                                    href={file.archivo_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={fileCardStyle}
                                    title="Clic para descargar/ver"
                                >
                                    <i className={`fas ${getFileIcon(file.archivo_nom_archivo)} fa-2x`} style={{marginBottom:'8px'}}></i>
                                    <span style={{fontSize:'0.8rem', wordBreak:'break-word'}}>
                                        {file.archivo_nom_archivo.length > 15 
                                            ? file.archivo_nom_archivo.substring(0, 12) + '...' 
                                            : file.archivo_nom_archivo}
                                    </span>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p style={{color: '#999', fontStyle: 'italic'}}>No hay archivos adjuntos.</p>
                    )}
                </div>
              </div>

              <hr className="divider" />

              {/* 3. FORMULARIO DE FINALIZACIÓN (Solo si está Pendiente o queremos editar) */}
              {selectedTicket.ticket_est_ticket === 'PE' ? (
                  <>
                    <h3><i className="fas fa-check-circle"></i> Finalizar Solución</h3>
                    
                    <div className="form-group">
                        <label>Tiempo de solución (min):</label>
                        <input
                        type="number"
                        min="1"
                        value={solutionTime}
                        onChange={(e) => setSolutionTime(e.target.value)}
                        placeholder="Ej: 30"
                        className="form-input"
                        disabled={uploading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Observación Técnica:</label>
                        <textarea
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        placeholder="Detalles técnicos de la solución..."
                        className="form-textarea"
                        rows="3"
                        disabled={uploading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Subir Evidencia (Opcional):</label>
                        {/* Componente de subida existente... */}
                        <div 
                        className={`file-upload-area ${uploading ? 'disabled' : ''}`}
                        onClick={() => !uploading && document.getElementById('file-input-modal').click()}
                        style={{padding: '15px'}}
                        >
                            <i className="fas fa-cloud-upload-alt"></i>
                            <p>Adjuntar reporte o captura</p>
                            <input
                                id="file-input-modal"
                                type="file"
                                multiple
                                style={{ display: 'none' }}
                                onChange={(e) => handleFileSelection(e.target.files)}
                                disabled={uploading}
                            />
                        </div>
                        {/* Lista de archivos nuevos seleccionados */}
                        {selectedFiles.length > 0 && (
                            <div className="file-list-mini" style={{marginTop:'10px'}}>
                                {selectedFiles.map((f, i) => (
                                    <span key={i} className="badge badge-info" style={{marginRight:'5px'}}>
                                        {f.name} <i className="fas fa-times" onClick={(e)=>{e.stopPropagation(); removeFile(i)}} style={{cursor:'pointer'}}></i>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                  </>
              ) : (
                  // SI EL TICKET YA ESTÁ FINALIZADO, MOSTRAMOS LOS DATOS DE CIERRE
                  <div className="closed-ticket-info" style={{background: '#e6fffa', padding:'15px', borderRadius:'8px', border:'1px solid #38b2ac'}}>
                      <h4 style={{color: '#2c7a7b'}}>Ticket Finalizado</h4>
                      <p><strong>Tiempo invertido:</strong> {selectedTicket.ticket_treal_ticket} min</p>
                      <p><strong>Solución:</strong> {selectedTicket.ticket_obs_ticket}</p>
                  </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={uploading}>
                Cerrar
              </button>
              
              {selectedTicket.ticket_est_ticket === 'PE' && (
                  <button className="btn-primary" onClick={handleFinishTicket} disabled={!solutionTime || uploading}>
                    {uploading ? <><i className="fas fa-spinner fa-spin"></i> Guardando...</> : 'Confirmar Finalización'}
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