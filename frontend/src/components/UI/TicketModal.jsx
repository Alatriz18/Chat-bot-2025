import React from 'react';

const TicketModal = ({ ticket, onClose, onFinishTicket }) => {
  const ticketDate = ticket.ticket_fec_ticket 
    ? new Date(ticket.ticket_fec_ticket).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'N/A';

  const isFinished = ticket.ticket_est_ticket === 'FN';

  return (
    <div className="modal" id="ticketModal" style={{ display: 'flex' }}>
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <span id="modalTicketId">{ticket.ticket_id_ticket}</span>
            <span className={`ticket-status status-${ticket.ticket_est_ticket}`}>
              {isFinished ? 'Finalizado' : 'Pendiente'}
            </span>
          </div>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="detail-section">
            <h3 className="section-title">
              <i className="fas fa-info-circle"></i> Información del Ticket
            </h3>
            <div className="details-grid">
              <div className="detail-item">
                <div className="detail-label">Ticket ID</div>
                <div className="detail-value">{ticket.ticket_id_ticket}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Asunto</div>
                <div className="detail-value">{ticket.ticket_asu_ticket || 'No disponible'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Usuario</div>
                <div className="detail-value">{ticket.ticket_tusua_ticket || 'No disponible'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Asignado a</div>
                <div className="detail-value">{ticket.ticket_asignado_a || 'Sin asignar'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Fecha de Creación</div>
                <div className="detail-value">{ticketDate}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Estado</div>
                <div className="detail-value">
                  <span className={`status-badge status-${ticket.ticket_est_ticket}`}>
                    {isFinished ? 'Finalizado' : 'Pendiente'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3 className="section-title">
              <i className="fas fa-align-left"></i> Información Adicional
            </h3>
            <div className="detail-value description-box">
              {ticket.ticket_des_ticket || 'No hay descripción disponible'}
            </div>
          </div>

          <div className="detail-section">
            <h3 className="section-title">
              <i className="fas fa-paperclip"></i> Archivos Adjuntos ({ticket.files?.length || 0})
            </h3>
            <div className="files-grid">
              {ticket.files && ticket.files.length > 0 ? (
                ticket.files.map(file => (
                  <FilePreview key={file.archivo_cod_archivo} file={file} />
                ))
              ) : (
                <p style={{ color: 'var(--on-surface-light)' }}>No hay archivos adjuntos</p>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            <i className="fas fa-times"></i> Cerrar
          </button>
          {!isFinished && (
            <button 
              className="btn btn-success" 
              onClick={() => onFinishTicket(ticket.ticket_id_ticket)}
            >
              <i className="fas fa-check"></i> Finalizar Ticket
            </button>
          )}
          <button 
            className="btn btn-primary"
            onClick={() => window.open(`/api/tickets/${ticket.ticket_id_ticket}/files`, '_blank')}
          >
            <i className="fas fa-external-link-alt"></i> Ver Archivos
          </button>
        </div>
      </div>
    </div>
  );
};

const FilePreview = ({ file }) => {
  const isImage = file.archivo_tip_archivo?.toLowerCase().match(/(jpg|jpeg|png|gif|webp)$/);
  
  const handleFileClick = () => {
    window.open(`/api/files/${file.archivo_cod_archivo}/view`, '_blank');
  };

  return (
    <div className="file-item">
      <div className="file-preview" onClick={handleFileClick}>
        {isImage ? (
          <img 
            src={`/api/files/${file.archivo_cod_archivo}/view`} 
            alt={file.archivo_nom_archivo}
          />
        ) : (
          <i className="fas fa-file" style={{ fontSize: '40px', color: 'var(--primary)' }}></i>
        )}
      </div>
      <div className="file-info">
        <div className="file-name" title={file.archivo_nom_archivo}>
          {file.archivo_nom_archivo}
        </div>
        <div className="file-size">
          {file.archivo_tam_formateado || 'N/D'}
        </div>
      </div>
    </div>
  );
};

export default TicketModal;