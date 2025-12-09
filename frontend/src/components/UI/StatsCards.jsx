import React from 'react';

const StatsCards = ({ tickets }) => {
  const totalTickets = tickets.length;
  const pendingTickets = tickets.filter(t => t.ticket_est_ticket === 'PE').length;
  const finishedTickets = tickets.filter(t => t.ticket_est_ticket === 'FN').length;

  return (
    <div className="stats-grid">
      <div className="stat-card total">
        <div className="stat-header">
          <div className="stat-icon">
            <i className="fas fa-ticket-alt"></i>
          </div>
          <div className="stat-trend trend-up">
            <i className="fas fa-arrow-up"></i>
            <span>12%</span>
          </div>
        </div>
        <div className="stat-value">{totalTickets}</div>
        <div className="stat-label">Tickets Totales</div>
      </div>

      <div className="stat-card pending">
        <div className="stat-header">
          <div className="stat-icon">
            <i className="fas fa-hourglass-half"></i>
          </div>
          <div className="stat-trend trend-up">
            <i className="fas fa-arrow-up"></i>
            <span>5%</span>
          </div>
        </div>
        <div className="stat-value">{pendingTickets}</div>
        <div className="stat-label">Tickets Pendientes</div>
      </div>

      <div className="stat-card finished">
        <div className="stat-header">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-trend trend-up">
            <i className="fas fa-arrow-up"></i>
            <span>8%</span>
          </div>
        </div>
        <div className="stat-value">{finishedTickets}</div>
        <div className="stat-label">Tickets Finalizados</div>
      </div>
    </div>
  );
};

export default StatsCards;