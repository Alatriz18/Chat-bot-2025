import React from 'react';

const TicketsPanel = ({ isOpen, onClose, tickets, loadingTickets, onRateTicket }) => {
  if (!isOpen) return null;

  return (
    <div className="tickets-panel active">
      <div className="tickets-header">
        <h3>Mis Tickets</h3>
        <button className="close-tickets" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="tickets-list">
        {loadingTickets ? (
          <div className="loading-tickets">Cargando tus tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="no-tickets">No tienes tickets creados</div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.pk} className="ticket-item">
              <div className="ticket-info">
                <div className="ticket-id">{ticket.ticket_id_ticket || 'N/A'}</div>
                <div className="ticket-subject">{ticket.ticket_asu_ticket || 'Sin asunto'}</div>
                <div className="ticket-date">
                  {ticket.ticket_fec_ticket ? 
                    new Date(ticket.ticket_fec_ticket).toLocaleDateString('es-EC') : 
                    'Fecha no disponible'
                  }
                </div>
                <div className={`ticket-status ${
                  ticket.ticket_est_ticket === 'FN' ? 'status-finished' : 'status-pending'
                }`}>
                  {ticket.ticket_est_ticket === 'FN' ? 'Finalizado' : 'Pendiente'}
                </div>
              </div>
              {ticket.ticket_est_ticket === 'FN' && !ticket.ticket_calificacion && (
                <div className="ticket-rating">
                  {[1, 2, 3, 4, 5].map(star => (
                    <i 
                      key={star}
                      className="fas fa-star rating-star"
                      data-ticket-pk={ticket.pk}
                      data-rating={star}
                      onClick={() => onRateTicket(ticket.pk, star)}
                    ></i>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TicketsPanel;