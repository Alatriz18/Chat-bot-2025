import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import api from '../config/axios';
import '../styles/Admin.css';

// ── Colores por posición en ranking ──
const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c3f', '#6366f1', '#10b981'];
const RANK_ICONS  = ['🥇', '🥈', '🥉', '4°', '5°'];

const ESTADO_COLORES = {
  'PENDIENTE':    { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
  'FACTIBLE':     { bg: '#d1fae5', color: '#065f46', label: 'Factible' },
  'NO_FACTIBLE':  { bg: '#fee2e2', color: '#991b1b', label: 'No factible' },
  'EN_PROCESO':   { bg: '#dbeafe', color: '#1e40af', label: 'En proceso' },
  'IMPLEMENTADO': { bg: '#f0fdf4', color: '#14532d', label: 'Implementado' },
};

const formatDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', timeZone: 'America/Guayaquil' });
  } catch { return d; }
};

// ── Mini barra ──
const Bar = ({ value, max, color = '#6366f1', height = 8 }) => (
  <div style={{ background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', height }}>
    <div style={{ width: `${max > 0 ? Math.min(value / max * 100, 100) : 0}%`, background: color, height: '100%', borderRadius: 99, transition: 'width 0.5s ease' }} />
  </div>
);

// ── Minigráfica de barras (sin librería) ──
const MiniBarChart = ({ data, days }) => {
  if (!data?.length) return <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>Sin datos para este período</div>;
  const maxVal = Math.max(...data.map(d => d.total), 1);
  // Mostrar últimos N puntos (máx 30)
  const slice = data.slice(-Math.min(days, 30));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, padding: '0 4px' }}>
      {slice.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${d.fecha}: ${d.total} tickets`}>
          <div style={{ width: '100%', background: '#6366f1', borderRadius: '3px 3px 0 0', height: `${(d.total / maxVal) * 68}px`, minHeight: d.total > 0 ? 4 : 0, transition: 'height 0.4s ease' }} />
          {slice.length <= 14 && (
            <span style={{ fontSize: 9, color: '#94a3b8', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
              {formatDate(d.fecha)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

const ReportesPage = () => {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [days,    setDays]    = useState(30);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol_nombre === 'SISTEMAS_ADMIN' || user.is_staff;
    if (!isAdmin) { navigate('/chat'); return; }
    fetchReportes();
  }, [user, days]);

  const fetchReportes = async () => {
    try {
      setLoading(true); setError('');
      const res = await api.get(`/admin/reportes/?days=${days}`);
      setData(res.data);
    } catch (e) {
      setError('Error cargando reportes. Verifica que la vista esté implementada en el backend.');
    } finally { setLoading(false); }
  };

  const maxResueltos = data ? Math.max(...data.admins.map(a => a.resueltos), 1) : 1;
  const maxCarga     = data ? Math.max(...data.admins.map(a => a.carga_porcentaje), 1) : 1;

  return (
    <div className="admin-container">
      <Sidebar user={user} activePage="reportes" />
      <main className="main-content">

        {/* HEADER */}
        <div className="dashboard-header">
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              📊 Reportes y Métricas
            </h1>
            <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.9rem' }}>
              Rendimiento del equipo de TI
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Selector de rango */}
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${days === d ? '#6366f1' : '#e2e8f0'}`,
                  background: days === d ? '#f0f4ff' : 'white',
                  color: days === d ? '#6366f1' : '#64748b',
                }}>
                {d}d
              </button>
            ))}
            <button onClick={fetchReportes} disabled={loading}
              style={{ padding: '7px 14px', borderRadius: 8, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13 }}>
              <i className={`fas fa-sync ${loading ? 'fa-spin' : ''}`}></i>
            </button>
          </div>
        </div>

        {error && (
          <div style={{ margin: '0 0 20px', padding: '12px 16px', background: '#fee2e2', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: '#6366f1' }}></i>
          </div>
        ) : data && (
          <>
            {/* ── TARJETAS GLOBALES ── */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              {[
                { label: 'Total tickets',    value: data.totales.total,                      icon: '🎫', color: '#6366f1', bg: '#f0f4ff' },
                { label: 'Pendientes',        value: data.totales.pendientes,                 icon: '⏳', color: '#f59e0b', bg: '#fffbeb' },
                { label: 'Resueltos',         value: data.totales.resueltos,                  icon: '✅', color: '#10b981', bg: '#f0fdf4' },
                { label: `Creados (${days}d)`,value: data.totales.recientes,                  icon: '📥', color: '#3b82f6', bg: '#eff6ff' },
                { label: 'Tiempo prom. (min)',value: data.totales.avg_tiempo,                 icon: '⏱️', color: '#8b5cf6', bg: '#faf5ff' },
                { label: 'Calificación prom.',value: data.totales.avg_calificacion > 0 ? `${data.totales.avg_calificacion} ★` : '—', icon: '⭐', color: '#f59e0b', bg: '#fffbeb' },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, border: `1.5px solid ${s.color}22`, borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── GRÁFICA DE TICKETS POR DÍA ── */}
            <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                📈 Tickets creados por día — últimos {days} días
              </h3>
              <MiniBarChart data={data.por_dia} days={days} />
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, background: '#6366f1', borderRadius: 2, display: 'inline-block' }}></span> Tickets creados
                </span>
              </div>
            </div>

            {/* ── RANKING DE ADMINS ── */}
            <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                🏆 Ranking de Técnicos
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.admins.map((admin, idx) => (
                  <div key={admin.username} style={{
                    border: `1.5px solid ${idx === 0 ? '#f59e0b44' : '#f1f5f9'}`,
                    borderRadius: 12, padding: '14px 18px',
                    background: idx === 0 ? '#fffbeb' : '#fafafa',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{RANK_ICONS[idx] || `${idx + 1}°`}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{admin.nombre || admin.username}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>@{admin.username}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, textAlign: 'right' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{admin.resueltos}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>resueltos</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{admin.pendientes}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>pendientes</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>
                            {admin.avg_calificacion > 0 ? `${admin.avg_calificacion}★` : '—'}
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>calif.</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#64748b' }}>{admin.avg_tiempo_min}m</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>prom. resolución</div>
                        </div>
                      </div>
                    </div>

                    {/* Barra de tickets resueltos */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 3 }}>
                        <span>Tickets resueltos</span>
                        <span>{admin.resueltos} / {admin.total}</span>
                      </div>
                      <Bar value={admin.resueltos} max={maxResueltos} color="#10b981" />
                    </div>

                    {/* Barra de carga de trabajo */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 3 }}>
                        <span>Carga de trabajo estimada</span>
                        <span style={{ color: admin.carga_porcentaje > 80 ? '#ef4444' : admin.carga_porcentaje > 50 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                          {admin.carga_porcentaje}% ({admin.horas_soporte}h de {admin.horas_laborables}h laborables)
                        </span>
                      </div>
                      <Bar value={admin.carga_porcentaje} max={100}
                        color={admin.carga_porcentaje > 80 ? '#ef4444' : admin.carga_porcentaje > 50 ? '#f59e0b' : '#10b981'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── TABLA RESUMEN ── */}
            <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                📋 Resumen por técnico
              </h3>
              <div className="table-responsive">
                <table className="tickets-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Técnico</th>
                      <th style={{ textAlign: 'center' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Pendientes</th>
                      <th style={{ textAlign: 'center' }}>Resueltos</th>
                      <th style={{ textAlign: 'center' }}>Prom. resolución</th>
                      <th style={{ textAlign: 'center' }}>Calificación</th>
                      <th style={{ textAlign: 'center' }}>Carga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.admins.map((admin, idx) => (
                      <tr key={admin.username}>
                        <td><span style={{ fontSize: 16 }}>{RANK_ICONS[idx] || `${idx + 1}°`}</span></td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{admin.nombre || admin.username}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>@{admin.username}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{admin.total}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                            {admin.pendientes}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                            {admin.resueltos}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: '#6366f1', fontWeight: 600 }}>
                          {admin.avg_tiempo_min > 0 ? `${admin.avg_tiempo_min} min` : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {admin.avg_calificacion > 0
                            ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>{admin.avg_calificacion} ★</span>
                            : <span style={{ color: '#94a3b8' }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            background: admin.carga_porcentaje > 80 ? '#fee2e2' : admin.carga_porcentaje > 50 ? '#fef3c7' : '#d1fae5',
                            color: admin.carga_porcentaje > 80 ? '#991b1b' : admin.carga_porcentaje > 50 ? '#92400e' : '#065f46',
                            borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700
                          }}>
                            {admin.carga_porcentaje}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ReportesPage;