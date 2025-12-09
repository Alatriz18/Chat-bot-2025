import React from 'react';

const StatsCards = ({ tickets }) => {
  const assignedTickets = tickets.length;
  const pendingTickets = tickets.filter(t => t.ticket_est_ticket === 'PE').length;
  const finishedTickets = tickets.filter(t => t.ticket_est_ticket === 'FN').length;
  
  const totalFiles = tickets.reduce((total, ticket) => {
    return total + (ticket.files ? ticket.files.length : 0);
  }, 0);

  return (
    <div className="stats-grid">
      <div className="stat-card assigned">
        <div className="stat-header">
          <div className="stat-icon">
            <i className="fas fa-user-check"></i>
          </div>
        </div>
        <div className="stat-value">{assignedTickets}</div>
        <div className="stat-label">Tickets Asignados</div>
      </div>

      <div className="stat-card pending">
        <div className="stat-header">
          <div className="stat-icon">
            <i className="fas fa-hourglass-half"></i>
          </div>
        </div>
        <div className="stat-value">{pendingTickets}</div>
        <div className="stat-label">Pendientes</div>
      </div>

      <div className="stat-card finished">
        <div className="stat-header">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
        </div>
        <div className="stat-value">{finishedTickets}</div>
        <div className="stat-label">Finalizados</div>
      </div>

      <div className="stat-card files">
        <div className="stat-header">
          <div className="stat-icon">
            <i className="fas fa-paperclip"></i>
          </div>
        </div>
        <div className="stat-value">{totalFiles}</div>
        <div className="stat-label">Archivos Totales</div>
      </div>
    </div>
  );
};

export default StatsCards;