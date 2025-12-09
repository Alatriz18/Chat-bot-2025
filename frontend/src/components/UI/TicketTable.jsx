export default function TicketTable({ tickets, loading }) {
  if (loading) return <div>Cargando tickets...</div>;
  return (
    <div>
      <h3>Tickets: {tickets?.length || 0}</h3>
      {/* Contenido temporal */}
    </div>
  );
}