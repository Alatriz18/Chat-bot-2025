import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import NotificationSystem from '../components/UI/NotificationSystem';
import api from '../config/axios';
import '../styles/Admin.css';
import '../styles/tickets.css';

// Función para subir a S3 usando TUS URLs exactas
const uploadFileToS3 = async (ticketId, file, username) => {
  try {
    // 1. Obtener URL firmada - USANDO TU RUTA EXACTA
    const presignedRes = await api.post(`/tickets/${ticketId}/generate-presigned-url/`, {
      filename: file.name,
      filetype: file.type,
      filesize: file.size
    });
    
    const { upload_url, s3_key } = presignedRes.data;

    // 2. Subir directamente a S3
    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`Error subiendo a S3: ${uploadResponse.statusText}`);
    }

    // 3. Confirmar en Backend - USANDO TU RUTA EXACTA
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
    
    fetchMyTickets();
  }, [user, navigate]);

  // 2. Cargar Tickets Asignados
  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      
      // Obtener todos los tickets
      const response = await api.get('/admin/tickets/');
      const allTickets = response.data;

      // Filtrar solo los asignados a mí
      const myTickets = allTickets.filter(ticket => 
        ticket.ticket_asignado_a === user.username
      );

      // Cargar archivos para cada ticket
      const ticketsWithFiles = await Promise.all(
        myTickets.map(async (ticket) => {
          try {
            // Usando el router registrado: /files/?ticket=id
            const filesRes = await api.get(`/files/?ticket=${ticket.ticket_id_ticket}`);
            return { 
              ...ticket, 
              files: filesRes.data,
              // Asegurar que tenemos el ID correcto para las operaciones
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

  // 3. Helper para notificaciones
  const showNotification = (message, type = 'info') => {
    const event = new CustomEvent('show-notification', {
      detail: { message, type }
    });
    window.dispatchEvent(event);
  };

  // 4. Manejo de archivos en el modal
  const handleFileSelection = (files) => {
    const fileList = Array.from(files);
    
    // Validaciones
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'];
    const maxSize = 16 * 1024 * 1024; // 16MB

    const validFiles = fileList.filter(file => {
      const extension = file.name.split('.').pop().toLowerCase();
      const isValidExtension = allowedExtensions.includes(extension);
      const isValidSize = file.size <= maxSize;
      
      if (!isValidExtension) {
        showNotification(`"${file.name}" - Tipo no permitido`, 'error');
        return false;
      }
      if (!isValidSize) {
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

  // 5. Finalizar Ticket - CORREGIDO CON TUS URLs
  const handleFinishTicket = async () => {
    if (!selectedTicket) return;
    
    const minutes = parseInt(solutionTime);
    const ticketId = selectedTicket.id || selectedTicket.ticket_id_ticket;

    // Validaciones
    if (!minutes || minutes < 1) {
      showNotification('Tiempo mínimo: 1 minuto', 'error');
      return;
    }

    if (minutes > 1440) { // 24 horas en minutos
      showNotification('Tiempo máximo: 1440 minutos (24 horas)', 'error');
      return;
    }

    try {
      setUploading(true);
      
      // A. Subir archivos a S3 si hay
      if (selectedFiles.length > 0) {
        showNotification('Subiendo archivos...', 'info');
        
        for (const file of selectedFiles) {
          try {
            await uploadFileToS3(ticketId, file, user.username);
          } catch (fileError) {
            console.error(`Error subiendo ${file.name}:`, fileError);
            showNotification(`Error con ${file.name}`, 'error');
            // Continuar con otros archivos
          }
        }
      }

      // B. Actualizar Ticket - USANDO TU RUTA EXACTA
      // Nota: Tu AdminTicketDetailView usa <int:pk> que es el ID numérico (no ticket_id_ticket)
      await api.put(`/admin/tickets/${ticketId}/`, {
        status: 'FN',
        ticket_treal: minutes,
        observation: observation
      });

      // C. Actualizar estado local (optimista)
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { 
              ...t, 
              ticket_est_ticket: 'FN',
              ticket_treal_ticket: minutes,
              ticket_obs_ticket: observation,
              files: [...t.files, ...selectedFiles.map(f => ({
                archivo_nom_archivo: f.name,
                archivo_tam_archivo: f.size
              }))]
            }
          : t
      ));
      
      // D. Limpiar y cerrar
      setShowModal(false);
      setSelectedTicket(null);
      setSelectedFiles([]);
      setSolutionTime('');
      setObservation('');
      
      showNotification('✅ Ticket finalizado correctamente', 'success');

    } catch (error) {
      console.error('Error finalizando ticket:', error);
      const errorMsg = error.response?.data?.error || error.message;
      showNotification(`❌ Error: ${errorMsg}`, 'error');
      
      // Recargar datos para evitar inconsistencia
      fetchMyTickets();
    } finally {
      setUploading(false);
    }
  };

  // 6. Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  // 7. Componente StatsCards integrado
  const StatsCards = ({ tickets }) => {
    const stats = {
      total: tickets.length,
      pending: tickets.filter(t => t.ticket_est_ticket === 'PE').length,
      completed: tickets.filter(t => t.ticket_est_ticket === 'FN').length,
      avgTime: tickets.length > 0 
        ? Math.round(tickets.reduce((acc, t) => acc + (t.ticket_treal_ticket || 0), 0) / tickets.length)
        : 0
    };

    return (
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
            <i className="fas fa-ticket-alt"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Tickets</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.pending}</h3>
            <p>Pendientes</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'}}>
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.completed}</h3>
            <p>Finalizados</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'}}>
            <i className="fas fa-hourglass-half"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.avgTime}</h3>
            <p>Promedio (min)</p>
          </div>
        </div>
      </div>
    );
  };

  // 8. Filtros
  const handleFilterChange = (filter) => setActiveFilter(filter);
  
  const filteredTickets = tickets.filter(ticket => {
    if (activeFilter === 'all') return true;
    return ticket.ticket_est_ticket === activeFilter;
  });

  // 9. Render condicional
  if (!user || (loading && tickets.length === 0)) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando mis tickets...</p>
      </div>
    );
  }

  // 10. Render principal
  return (
    <div className="admin-container">
      <Sidebar user={user} activePage="tickets" />
      
      <main className="main-content">
        <div className="dashboard-header">
          <div className="dashboard-title">
            <h1>Mis Tickets Asignados</h1>
            <p>Hola, {user.nombreCompleto || user.username}</p>
          </div>
          <div className="header-actions">
            <button 
              className="header-action-btn" 
              onClick={fetchMyTickets}
              disabled={loading}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              Actualizar
            </button>
            <button 
              className="header-action-btn"
              onClick={() => navigate('/chat')}
            >
              <i className="fas fa-robot"></i> Chat
            </button>
          </div>
        </div>

        <StatsCards tickets={tickets} />
        
        <div className="ticket-panel">
          <div className="panel-header">
            <h2>Lista de Tickets Asignados</h2>
            <div className="ticket-filters">
              <button 
                className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                Todos ({tickets.length})
              </button>
              <button 
                className={`filter-btn ${activeFilter === 'PE' ? 'active' : ''}`}
                onClick={() => handleFilterChange('PE')}
              >
                Pendientes ({tickets.filter(t => t.ticket_est_ticket === 'PE').length})
              </button>
              <button 
                className={`filter-btn ${activeFilter === 'FN' ? 'active' : ''}`}
                onClick={() => handleFilterChange('FN')}
              >
                Finalizados ({tickets.filter(t => t.ticket_est_ticket === 'FN').length})
              </button>
            </div>
          </div>

          <div className="table-responsive">
            {loading ? (
              <div className="loading-tickets">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Cargando tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="empty-tickets">
                <i className="fas fa-inbox"></i>
                <p>No hay tickets asignados</p>
                <button className="btn-primary" onClick={fetchMyTickets}>
                  Recargar
                </button>
              </div>
            ) : (
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Asunto</th>
                    <th>Usuario</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Archivos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map(ticket => (
                    <tr 
                      key={ticket.ticket_id_ticket} 
                      className={`clickable-row ${ticket.ticket_est_ticket === 'PE' ? 'ticket-pending' : 'ticket-completed'}`}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setShowModal(true);
                      }}
                    >
                      <td className="ticket-id">#{ticket.ticket_id_ticket}</td>
                      <td className="ticket-subject">{ticket.ticket_asu_ticket}</td>
                      <td>{ticket.ticket_tusua_ticket}</td>
                      <td className="ticket-description">
                        {ticket.ticket_des_ticket?.substring(0, 80) || 'Sin descripción'}
                        {ticket.ticket_des_ticket?.length > 80 && '...'}
                      </td>
                      <td>
                        <span className={`ticket-status status-${ticket.ticket_est_ticket}`}>
                          {ticket.ticket_est_ticket === 'PE' ? '🔄 Pendiente' : '✅ Finalizado'}
                        </span>
                      </td>
                      <td className="ticket-date">{formatDate(ticket.ticket_fec_ticket)}</td>
                      <td>
                        <span className="file-count">
                          <i className="fas fa-paperclip"></i> {ticket.files?.length || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      <NotificationSystem />

      {/* Modal para finalizar ticket */}
      {showModal && selectedTicket && (
        <div className="modal-overlay" onClick={() => !uploading && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Finalizar Ticket #{selectedTicket.ticket_id_ticket}</h2>
              <button 
                className="close-btn" 
                onClick={() => setShowModal(false)}
                disabled={uploading}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="ticket-info">
                <h3>{selectedTicket.ticket_asu_ticket}</h3>
                <p><strong>Usuario:</strong> {selectedTicket.ticket_tusua_ticket}</p>
                <p><strong>Descripción:</strong></p>
                <p className="ticket-description-full">{selectedTicket.ticket_des_ticket}</p>
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-clock"></i> Tiempo de solución (minutos):
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={solutionTime}
                  onChange={(e) => setSolutionTime(e.target.value)}
                  placeholder="Ej: 30, 60, 120..."
                  className="form-input"
                  disabled={uploading}
                />
                <small className="form-help">Entre 1 y 1440 minutos (24 horas)</small>
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-comment"></i> Observación final:
                </label>
                <textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="Describe la solución aplicada..."
                  className="form-textarea"
                  rows="4"
                  disabled={uploading}
                />
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-paperclip"></i> Archivos de solución:
                </label>
                <div 
                  className={`file-upload-area ${uploading ? 'disabled' : ''}`}
                  onClick={() => !uploading && document.getElementById('file-input').click()}
                >
                  <i className="fas fa-cloud-upload-alt"></i>
                  <p>Haz clic o arrastra archivos aquí (máx. 16MB)</p>
                  <small>Permitidos: imágenes, PDF, Word, Excel, ZIP</small>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileSelection(e.target.files)}
                    disabled={uploading}
                  />
                </div>
                
                {selectedFiles.length > 0 && (
                  <div className="file-list">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="file-item">
                        <i className="fas fa-file"></i>
                        <div className="file-info">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                        <button 
                          onClick={() => removeFile(index)} 
                          className="remove-file"
                          disabled={uploading}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowModal(false)}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={handleFinishTicket}
                disabled={!solutionTime || uploading}
              >
                {uploading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Procesando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle"></i> Finalizar Ticket
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTickets;