import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import api from '../config/axios';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import '../styles/Admin.css';

// ── Paleta ──
const COLORS  = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#8b5cf6'];
const RANK_ICONS = ['🥇','🥈','🥉','4°','5°','6°','7°','8°'];

// ── Helpers ──
const fmt = (d, opts = {}) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', ...opts }); }
  catch { return d; }
};
const fmtShort = d => fmt(d, { day: '2-digit', month: '2-digit' });
const hhmm = min => {
  if (!min || min === 0) return '0m';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ── Tooltip personalizado ──
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

// ── Tarjeta KPI ──
const KpiCard = ({ icon, label, value, sub, color, bg, trend }) => (
  <div style={{ background: bg, border: `1.5px solid ${color}22`, borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 60, opacity: 0.06 }}>{icon}</div>
    <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: '-0.5px' }}>{value}</div>
    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, fontWeight: 500 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: color, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    {trend != null && (
      <div style={{ fontSize: 11, marginTop: 4, color: trend >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs período anterior
      </div>
    )}
  </div>
);

// ── Sección de card ──
const Card = ({ title, children, style = {} }) => (
  <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #f1f5f9', ...style }}>
    {title && <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{title}</h3>}
    {children}
  </div>
);

// ── Barra simple ──
const ProgressBar = ({ value, max, color = '#6366f1' }) => (
  <div style={{ background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', height: 8 }}>
    <div style={{ width: `${max > 0 ? Math.min(value / max * 100, 100) : 0}%`, background: color, height: '100%', borderRadius: 99, transition: 'width 0.6s ease' }} />
  </div>
);

// ============================================================
const ReportesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const printRef = useRef();

  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [days,         setDays]         = useState(30);
  const [adminFiltro,  setAdminFiltro]  = useState('all');
  const [activeTab,    setActiveTab]    = useState('general');  // general | horas | admins | tickets

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol_nombre === 'SISTEMAS_ADMIN' || user.is_staff;
    if (!isAdmin) { navigate('/chat'); return; }
    fetchData();
  }, [user, days]);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const res = await api.get(`/admin/reportes/?days=${days}`);
      setData(res.data);
    } catch (e) {
      setError('Error cargando reportes.');
    } finally { setLoading(false); }
  };

  // ── Datos derivados ──
  const admins     = data?.admins || [];
  const porDia     = data?.por_dia || [];
  const totales    = data?.totales || {};
  const admFiltered = adminFiltro === 'all' ? admins : admins.filter(a => a.username === adminFiltro);
  const maxResueltos = Math.max(...admins.map(a => a.resueltos), 1);

  // Datos para gráfica de admins (comparativa)
  const adminsChart = admFiltered.map(a => ({
    name: a.nombre?.split(' ')[0] || a.username,
    resueltos: a.resueltos,
    pendientes: a.pendientes,
    tiempo: a.avg_tiempo_min,
    calificacion: a.avg_calificacion,
    carga: a.carga_porcentaje,
  }));

  // Datos por semana
  const porSemana = React.useMemo(() => {
    if (!porDia.length) return [];
    const weeks = {};
    porDia.forEach(d => {
      const date = new Date(d.fecha);
      // Número de semana simple
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1);
      const key = weekStart.toISOString().slice(0, 10);
      if (!weeks[key]) weeks[key] = { semana: fmtShort(key), total: 0, resueltos: 0 };
      weeks[key].total     += d.total;
      weeks[key].resueltos += d.resueltos || 0;
    });
    return Object.values(weeks);
  }, [porDia]);

  // Datos de horas por admin
  const horasChart = admFiltered.map(a => ({
    name: a.nombre?.split(' ')[0] || a.username,
    horas_soporte:    a.horas_soporte,
    horas_disponibles: a.horas_laborables - a.horas_soporte,
    carga: a.carga_porcentaje,
  }));

  // Distribución por estado (pie)
  const pieData = [
    { name: 'Resueltos',  value: totales.resueltos  || 0, color: '#10b981' },
    { name: 'Pendientes', value: totales.pendientes || 0, color: '#f59e0b' },
  ];

  // Calificación por admin (bar horizontal)
  const califChart = admins
    .filter(a => a.avg_calificacion > 0)
    .sort((a, b) => b.avg_calificacion - a.avg_calificacion)
    .map(a => ({
      name: a.nombre?.split(' ')[0] || a.username,
      calificacion: a.avg_calificacion,
    }));

  // ── Export PDF ──
  const handleExport = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #reportes-print, #reportes-print * { visibility: visible; }
        #reportes-print { position: fixed; top: 0; left: 0; width: 100%; }
        .no-print { display: none !important; }
        .recharts-wrapper { break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  const tabs = [
    { key: 'general',  label: '📊 General' },
    { key: 'admins',   label: '👥 Por Técnico' },
    { key: 'horas',    label: '⏱ Horas y Carga' },
    { key: 'tickets',  label: '📈 Tendencia' },
  ];

  return (
    <div className="admin-container">
      <Sidebar user={user} activePage="reportes" />
      <main className="main-content" id="reportes-print" ref={printRef}>

        {/* ── HEADER ── */}
        <div className="dashboard-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.3px' }}>
              📊 Reportes y Métricas
            </h1>
            <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.85rem' }}>
              Análisis del equipo de soporte TI · últimos <strong>{days} días</strong>
              {adminFiltro !== 'all' && <> · filtrando por <strong>{admins.find(a => a.username === adminFiltro)?.nombre || adminFiltro}</strong></>}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
            {/* Filtro admin */}
            <select value={adminFiltro} onChange={e => setAdminFiltro(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 12, color: '#475569', background: 'white', cursor: 'pointer' }}>
              <option value="all">Todos los técnicos</option>
              {admins.map(a => <option key={a.username} value={a.username}>{a.nombre || a.username}</option>)}
            </select>

            {/* Rango de días */}
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${days === d ? '#6366f1' : '#e2e8f0'}`,
                  background: days === d ? '#6366f1' : 'white',
                  color: days === d ? 'white' : '#64748b',
                  transition: 'all 0.15s',
                }}>{d}d</button>
            ))}

            <button onClick={fetchData} disabled={loading}
              style={{ padding: '7px 12px', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: '1.5px solid #e2e8f0', cursor: 'pointer', fontSize: 13 }}>
              <i className={`fas fa-sync ${loading ? 'fa-spin' : ''}`}></i>
            </button>

            {/* Export */}
            <button onClick={handleExport}
              style={{ padding: '7px 16px', borderRadius: 8, background: '#1e293b', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-file-pdf"></i> Exportar
            </button>
          </div>
        </div>

        {error && (
          <div style={{ margin: '0 0 16px', padding: '12px 16px', background: '#fee2e2', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80, flexDirection: 'column', gap: 16 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 36, color: '#6366f1' }}></i>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Cargando datos...</p>
          </div>
        ) : data && (
          <>
            {/* ── TABS ── */}
            <div className="no-print" style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f8fafc', borderRadius: 12, padding: 4, width: 'fit-content' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{
                    padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: activeTab === t.key ? 'white' : 'transparent',
                    color: activeTab === t.key ? '#6366f1' : '#64748b',
                    boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}>{t.label}</button>
              ))}
            </div>

            {/* ══════════════════════════════════════════════
                TAB: GENERAL
            ══════════════════════════════════════════════ */}
            {(activeTab === 'general') && (
              <>
                {/* KPIs */}
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                  <KpiCard icon="🎫" label="Total tickets" value={totales.total}
                    color="#6366f1" bg="#f0f4ff" />
                  <KpiCard icon="⏳" label="Pendientes" value={totales.pendientes}
                    color="#f59e0b" bg="#fffbeb"
                    sub={totales.total > 0 ? `${Math.round(totales.pendientes / totales.total * 100)}% del total` : null} />
                  <KpiCard icon="✅" label="Resueltos" value={totales.resueltos}
                    color="#10b981" bg="#f0fdf4"
                    sub={totales.total > 0 ? `${Math.round(totales.resueltos / totales.total * 100)}% tasa resolución` : null} />
                  <KpiCard icon="📥" label={`Creados (${days}d)`} value={totales.recientes}
                    color="#3b82f6" bg="#eff6ff"
                    sub={`≈ ${(totales.recientes / days).toFixed(1)} por día`} />
                  <KpiCard icon="⏱️" label="Tiempo prom. resolución" value={hhmm(totales.avg_tiempo)}
                    color="#8b5cf6" bg="#faf5ff" />
                  <KpiCard icon="⭐" label="Calificación promedio" value={totales.avg_calificacion > 0 ? `${totales.avg_calificacion} ★` : '—'}
                    color="#f59e0b" bg="#fffbeb"
                    sub={totales.avg_calificacion >= 4.5 ? '✨ Excelente' : totales.avg_calificacion >= 3 ? '👍 Bueno' : totales.avg_calificacion > 0 ? '⚠️ Mejorable' : null} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginBottom: 0 }}>
                  {/* Tickets por día - Area chart */}
                  <Card title="📈 Tickets creados por día">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={porDia.slice(-days)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmtShort} interval={Math.floor(porDia.length / 6)} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip content={<CustomTooltip />} formatter={(v, n) => [v, n === 'total' ? 'Creados' : 'Resueltos']} />
                        <Area type="monotone" dataKey="total" name="Creados" stroke="#6366f1" fill="url(#gradTotal)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="resueltos" name="Resueltos" stroke="#10b981" fill="none" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Distribución pie */}
                  <Card title="🍩 Estado actual">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pieData.map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, display: 'inline-block' }}></span>
                            <span style={{ color: '#64748b' }}>{d.name}</span>
                          </span>
                          <strong style={{ color: d.color }}>{d.value}</strong>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════
                TAB: POR TÉCNICO
            ══════════════════════════════════════════════ */}
            {activeTab === 'admins' && (
              <>
                {/* Comparativa bar chart */}
                <Card title="📊 Comparativa de tickets por técnico">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={adminsChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="resueltos" name="Resueltos" fill="#10b981" radius={[4,4,0,0]} />
                      <Bar dataKey="pendientes" name="Pendientes" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Tiempo promedio */}
                  <Card title="⏱ Tiempo promedio de resolución (min)">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={adminsChart} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={60} />
                        <Tooltip content={<CustomTooltip />} formatter={v => [hhmm(v), 'Tiempo prom.']} />
                        <Bar dataKey="tiempo" name="Tiempo" fill="#8b5cf6" radius={[0,4,4,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Calificación */}
                  <Card title="⭐ Calificación promedio por técnico">
                    {califChart.length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 30 }}>Sin calificaciones registradas</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={califChart} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis type="number" domain={[0, 5]} ticks={[1,2,3,4,5]} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} width={60} />
                          <Tooltip content={<CustomTooltip />} formatter={v => [`${v} ★`, 'Calificación']} />
                          <Bar dataKey="calificacion" name="Calificación" fill="#f59e0b" radius={[0,4,4,0]}>
                            {califChart.map((_, i) => (
                              <Cell key={i} fill={_ .calificacion >= 4.5 ? '#10b981' : _.calificacion >= 3 ? '#f59e0b' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>
                </div>

                {/* Tabla detallada */}
                <Card title="📋 Detalle completo por técnico">
                  <div className="table-responsive">
                    <table className="tickets-table" style={{ fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Técnico</th>
                          <th style={{ textAlign: 'center' }}>Total</th>
                          <th style={{ textAlign: 'center' }}>Pendientes</th>
                          <th style={{ textAlign: 'center' }}>Resueltos</th>
                          <th style={{ textAlign: 'center' }}>% Resolución</th>
                          <th style={{ textAlign: 'center' }}>Prom. tiempo</th>
                          <th style={{ textAlign: 'center' }}>Calificación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admFiltered.map((a, idx) => {
                          const pct = a.total > 0 ? Math.round(a.resueltos / a.total * 100) : 0;
                          return (
                            <tr key={a.username}>
                              <td style={{ fontSize: 16 }}>{RANK_ICONS[idx] || `${idx+1}°`}</td>
                              <td>
                                <div style={{ fontWeight: 700, color: '#1e293b' }}>{a.nombre || a.username}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>@{a.username}</div>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{a.total}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{a.pendientes}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{a.resueltos}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                  <span style={{ fontWeight: 700, color: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444', minWidth: 35 }}>{pct}%</span>
                                  <div style={{ flex: 1, minWidth: 60 }}><ProgressBar value={pct} max={100} color={pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'} /></div>
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', color: '#6366f1', fontWeight: 600 }}>{hhmm(a.avg_tiempo_min)}</td>
                              <td style={{ textAlign: 'center' }}>
                                {a.avg_calificacion > 0
                                  ? <span style={{ color: a.avg_calificacion >= 4.5 ? '#10b981' : a.avg_calificacion >= 3 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{a.avg_calificacion} ★</span>
                                  : <span style={{ color: '#94a3b8' }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            {/* ══════════════════════════════════════════════
                TAB: HORAS Y CARGA
            ══════════════════════════════════════════════ */}
            {activeTab === 'horas' && (
              <>
                {/* KPIs de horas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                  {admFiltered.map((a, idx) => {
                    const ticketsPorDia = a.total > 0 ? (a.total / days).toFixed(1) : 0;
                    const ticketsPorSemana = a.total > 0 ? ((a.total / days) * 5).toFixed(1) : 0;
                    return (
                      <div key={a.username} style={{ background: 'white', borderRadius: 14, padding: '16px 18px', border: `2px solid ${COLORS[idx % COLORS.length]}22`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{a.nombre?.split(' ')[0] || a.username}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>@{a.username}</div>
                          </div>
                          <span style={{ fontSize: 18 }}>{RANK_ICONS[idx] || `${idx+1}°`}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: '#64748b' }}>Horas soporte</span>
                            <strong style={{ color: '#6366f1' }}>{a.horas_soporte}h</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: '#64748b' }}>Horas laborables</span>
                            <strong style={{ color: '#475569' }}>{a.horas_laborables}h</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: '#64748b' }}>Tickets/día</span>
                            <strong style={{ color: '#3b82f6' }}>~{ticketsPorDia}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: '#64748b' }}>Tickets/semana</span>
                            <strong style={{ color: '#8b5cf6' }}>~{ticketsPorSemana}</strong>
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                              <span style={{ color: '#64748b' }}>Carga de trabajo</span>
                              <span style={{ fontWeight: 700, color: a.carga_porcentaje > 80 ? '#ef4444' : a.carga_porcentaje > 50 ? '#f59e0b' : '#10b981' }}>
                                {a.carga_porcentaje}%
                              </span>
                            </div>
                            <ProgressBar value={a.carga_porcentaje} max={100}
                              color={a.carga_porcentaje > 80 ? '#ef4444' : a.carga_porcentaje > 50 ? '#f59e0b' : '#10b981'} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Gráfica de horas stackeada */}
                <Card title="⏱ Distribución de horas laborables vs horas en soporte">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={horasChart} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="h" />
                      <Tooltip content={<CustomTooltip />} formatter={(v, n) => [`${v}h`, n === 'horas_soporte' ? 'En soporte' : 'Tiempo libre']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => v === 'horas_soporte' ? 'Horas en soporte' : 'Horas libres'} />
                      <Bar dataKey="horas_soporte" name="horas_soporte" stackId="a" fill="#6366f1" radius={[0,0,0,0]} />
                      <Bar dataKey="horas_disponibles" name="horas_disponibles" stackId="a" fill="#e2e8f0" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Carga comparativa */}
                <Card title="🔥 Índice de carga de trabajo (%)">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={horasChart} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} formatter={v => [`${v}%`, 'Carga']} />
                      {/* Línea de referencia al 80% */}
                      <Bar dataKey="carga" name="Carga" radius={[4,4,0,0]}>
                        {horasChart.map((h, i) => (
                          <Cell key={i} fill={h.carga > 80 ? '#ef4444' : h.carga > 50 ? '#f59e0b' : '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0', textAlign: 'right' }}>
                    🟢 &lt;50% normal · 🟡 50-80% alto · 🔴 &gt;80% sobrecarga
                  </p>
                </Card>
              </>
            )}

            {/* ══════════════════════════════════════════════
                TAB: TENDENCIA
            ══════════════════════════════════════════════ */}
            {activeTab === 'tickets' && (
              <>
                {/* Por día */}
                <Card title={`📅 Tickets por día — últimos ${days} días`}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={porDia.slice(-days)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={fmtShort} interval={Math.max(Math.floor(porDia.length / 10), 1)} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip content={<CustomTooltip />} labelFormatter={fmtShort} formatter={(v, n) => [v, n === 'total' ? 'Creados' : 'Resueltos']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="total" name="Creados" fill="#6366f1" radius={[3,3,0,0]} />
                      <Bar dataKey="resueltos" name="Resueltos" fill="#10b981" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Por semana */}
                {porSemana.length > 1 && (
                  <Card title="📆 Tickets por semana">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={porSemana} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <Tooltip content={<CustomTooltip />} formatter={(v, n) => [v, n === 'total' ? 'Creados' : 'Resueltos']} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="total" name="Creados" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
                        <Line type="monotone" dataKey="resueltos" name="Resueltos" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Resumen estadístico */}
                <Card title="📐 Estadísticas del período">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {[
                      { label: 'Día con más tickets', value: (() => { const m = [...porDia].sort((a,b) => b.total - a.total)[0]; return m ? `${fmtShort(m.fecha)} (${m.total})` : '—'; })() },
                      { label: 'Promedio diario', value: porDia.length ? (porDia.reduce((s,d) => s + d.total, 0) / porDia.length).toFixed(1) + ' tickets' : '—' },
                      { label: 'Días con actividad', value: `${porDia.filter(d => d.total > 0).length} de ${porDia.length}` },
                    ].map((s, i) => (
                      <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ReportesPage;