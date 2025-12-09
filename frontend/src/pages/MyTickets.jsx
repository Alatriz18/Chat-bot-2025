import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import StatsCards from '../components/UI/StatsCards';
import TicketTable from '../components/UI/TicketTable';
import TicketModal from '../components/UI/TicketModal';
import NotificationSystem from '../components/UI/NotificationSystem';
import '../styles/Admin.css';
import '../styles/tickets.css';

// Configuración de API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const MyTickets = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [solutionTime, setSolutionTime] = useState('');
  const [observation, setObservation] = useState('');

  // Verificar si el usuario es admin
  useEffect(() => {
    if (user) {
      // En tu AuthContext, los admins tienen rol 'SISTEMAS_ADMIN'
      const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin';
      
      if (!isAdmin) {
        console.log('Usuario no es admin, redirigiendo al chat');
        navigate('/chat');
        return;
      }
      fetchMyTickets();
    } else {
      navigate('/');
    }
  }, [user, navigate]);

  // Cargar tickets asignados al usuario
  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jwt_token');
      
      // Obtener todos los tickets
      const response = await fetch(`${API_BASE_URL}/admin/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar tickets');
      }

      const allTickets = await response.json();
      
      // Filtrar tickets asignados al usuario actual
      const myTickets = allTickets.filter(ticket => 
        ticket.ticket_asignado_a === user.username
      );

      // Cargar archivos para cada ticket
      const ticketsWithFiles = await Promise.all(
        myTickets.map(async (ticket) => {
          try {
            const filesResponse = await fetch(`${API_BASE_URL}/tickets/${ticket.ticket_id_ticket}/files`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (filesResponse.ok) {
              ticket.files = await filesResponse.json();
            } else {
              ticket.files = [];
            }
          } catch (error) {
            ticket.files = [];
          }
          return ticket;
        })
      );

      setTickets(ticketsWithFiles);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      showTempMessage('Error al cargar tickets: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Funciones de utilidad
  const formatDateTimeCorrectly = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    
    try {
      const date = new Date(dateTimeString);
      
      if (isNaN(date.getTime())) {
        return 'Fecha no disponible';
      }
      
      const day = date.getUTCDate().toString().padStart(2, '0');
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const year = date.getUTCFullYear();
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      const seconds = date.getUTCSeconds().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return 'Fecha no disponible';
    }
  };

  const showTempMessage = (message, type = 'info') => {
    // Crear toast temporal
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : type === 'warning' ? '#F59E0B' : '#3B82F6'};
      color: white;
      border-radius: 8px;
      z-index: 10000;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (document.contains(toast)) {
        toast.remove();
      }
    }, 4000);
  };

  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    const icons = {
      'pdf': 'file-pdf', 'doc': 'file-word', 'docx': 'file-word',
      'xls': 'file-excel', 'xlsx': 'file-excel', 'jpg': 'file-image',
      'jpeg': 'file-image', 'png': 'file-image', 'gif': 'file-image',
      'zip': 'file-archive', 'rar': 'file-archive', 'txt': 'file-alt',
      'ppt': 'file-powerpoint', 'pptx': 'file-powerpoint'
    };
    return icons[extension] || 'file';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Manejo de archivos
  const handleFileSelection = (files) => {
    const fileList = Array.from(files);
    
    // Validaciones
    const allowedExtensions = [
      'png', 'jpg', 'jpeg', 'gif', // Imágenes
      'pdf', // PDF
      'doc', 'docx', // Word
      'xls', 'xlsx', // Excel
      'txt', // Texto
      'zip', 'rar' // Comprimidos
    ];
    
    const maxSize = 16 * 1024 * 1024; // 16MB

    const validFiles = fileList.filter(file => {
      const extension = file.name.split('.').pop().toLowerCase();
      const isValidExtension = allowedExtensions.includes(extension);
      const isValidSize = file.size <= maxSize;
      
      if (!isValidExtension) {
        showTempMessage(`❌ "${file.name}" no es un tipo de archivo permitido`, 'error');
        return false;
      }
      if (!isValidSize) {
        showTempMessage(`❌ "${file.name}" es demasiado grande (máximo 16MB)`, 'error');
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTicketClick = (ticket) => {
    setSelectedTicket(ticket);
    setSelectedFiles([]);
    setSolutionTime('');
    setObservation(ticket.ticket_obs_ticket || '');
    setShowModal(true);
  };

  const handleFinishTicket = async () => {
    if (!selectedTicket) return;
    
    const minutes = parseInt(solutionTime);
    const ticketId = selectedTicket.ticket_id_ticket;

    // Validaciones
    if (!minutes || minutes < 1) {
      showTempMessage('Por favor ingrese el tiempo de solución en minutos (mínimo 1 minuto).', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('jwt_token');
      
      // 1. Guardar tiempo de solución
      const updateTimeResponse = await fetch(`${API_BASE_URL}/tickets/${ticketId}/treal`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          ticket_treal: minutes
        })
      });

      if (!updateTimeResponse.ok) {
        throw new Error('Error al guardar el tiempo de solución.');
      }

      // 2. Subir archivos si hay
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('username', user.username);

          await fetch(`${API_BASE_URL}/tickets/${ticketId}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });
        }
      }

      // 3. Finalizar ticket con observación
      const response = await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status: 'FN',
          observation: observation
        })
      });

      if (!response.ok) {
        throw new Error('Error al finalizar el ticket.');
      }

      // 4. Actualizar estado local
      const updatedTickets = tickets.map(ticket => 
        ticket.ticket_id_ticket === ticketId 
          ? { 
              ...ticket, 
              ticket_est_ticket: 'FN',
              ticket_treal_ticket: minutes,
              ticket_obs_ticket: observation,
              files: [...(ticket.files || []), ...selectedFiles.map(f => ({ 
                archivo_nom_archivo: f.name,
                archivo_tam_formateado: formatFileSize(f.size)
              }))]
            }
          : ticket
      );

      setTickets(updatedTickets);
      
      // 5. Cerrar modal y mostrar mensaje
      setShowModal(false);
      setSelectedTicket(null);
      setSelectedFiles([]);
      setSolutionTime('');
      setObservation('');
      
      showTempMessage('Ticket finalizado correctamente', 'success');

    } catch (error) {
      showTempMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  const filteredTickets = tickets.filter(ticket => {
    if (activeFilter === 'all') return true;
    return ticket.ticket_est_ticket === activeFilter;
  });

  // Verificar si el usuario es admin
  const isAdmin = user && (user.rol === 'SISTEMAS_ADMIN' || user.rol === 'admin');

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
        <p>Cargando mis tickets...</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <Sidebar user={user} activePage="tickets" />
      
      <main className="main-content">
        <div className="dashboard-header">
          <div className="dashboard-title">
            <h1>Mis Tickets Asignados</h1>
            <p>Tickets asignados específicamente a ti para revisión y gestión</p>
          </div>
          <div className="header-actions">
            <button 
              className="header-action-btn" 
              onClick={fetchMyTickets}
              disabled={loading}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              <span>Actualizar</span>
            </button>
            <a href="/chat" className="header-action-btn">
              <i className="fas fa-robot"></i>
              <span>Ir al Chatbot</span>
            </a>
          </div>
        </div>

        {/* Usamos el StatsCards que ya tienes */}
        <StatsCards tickets={tickets} />
        
        <div className="ticket-panel">
          <div className="panel-header">
            <h2>Lista de Tickets Asignados a Mí</h2>
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

          {/* Tabla simplificada - no usamos el TicketTable porque es muy básico */}
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
                      className="clickable-row"
                      onClick={() => handleTicketClick(ticket)}
                    >
                      <td className="ticket-id">#{ticket.ticket_id_ticket}</td>
                      <td className="ticket-subject">{ticket.ticket_asu_ticket}</td>
                      <td>{ticket.ticket_tusua_ticket}</td>
                      <td className="ticket-description">
                        {ticket.ticket_des_ticket?.substring(0, 100) || 'Sin descripción'}
                        {ticket.ticket_des_ticket?.length > 100 && '...'}
                      </td>
                      <td>
                        <span className={`ticket-status status-${ticket.ticket_est_ticket}`}>
                          {ticket.ticket_est_ticket === 'PE' ? 'Pendiente' : 'Finalizado'}
                        </span>
                      </td>
                      <td className="ticket-date">
                        {formatDateTimeCorrectly(ticket.ticket_fec_ticket)}
                      </td>
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

      {/* Modal para detalles del ticket - usamos el TicketModal que ya tienes */}
      {showModal && selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          onClose={() => setShowModal(false)}
          onFinishTicket={handleFinishTicket}
        />
      )}
    </div>
  );
};

export default MyTickets;