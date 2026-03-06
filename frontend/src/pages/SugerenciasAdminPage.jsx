import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Layout/Sidebar';
import api from '../config/axios';
import '../styles/Admin.css';

const ESTADOS = [
  { value: 'PENDIENTE',   label: 'Pendiente',    bg: '#fef3c7', color: '#92400e' },
  { value: 'FACTIBLE',    label: 'Factible',      bg: '#d1fae5', color: '#065f46' },
  { value: 'NO_FACTIBLE', label: 'No factible',   bg: '#fee2e2', color: '#991b1b' },
  { value: 'EN_PROCESO',  label: 'En proceso',    bg: '#dbeafe', color: '#1e40af' },
  { value: 'IMPLEMENTADO',label: 'Implementado',  bg: '#f0fdf4', color: '#14532d' },
];

const TIPOS = {
  BUG:    { icon: '🐛', label: 'Bug / Error',  bg: '#fee2e2', color: '#dc2626' },
  MEJORA: { icon: '✨', label: 'Mejora',        bg: '#f0f4ff', color: '#6366f1' },
  OTRO:   { icon: '💬', label: 'Otro',          bg: '#f8fafc', color: '#64748b' },
};

const formatDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('es-EC', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil'
    });
  } catch { return d; }
};

const SugerenciasAdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sugerencias,    setSugerencias]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filtroEstado,   setFiltroEstado]   = useState('all');
  const [filtroTipo,     setFiltroTipo]     = useState('all');
  const [selected,       setSelected]       = useState(null);
  const [editEstado,     setEditEstado]     = useState('');
  const [editComentario, setEditComentario] = useState('');
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    const isAdmin = user.rol === 'SISTEMAS_ADMIN' || user.rol_nombre === 'SISTEMAS_ADMIN' || user.is_staff;
    if (!isAdmin) { navigate('/chat'); return; }
    fetchSugerencias();
  }, [user]);

  const fetchSugerencias = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/sugerencias/');
      setSugerencias(res.data);
    } catch (e) {
      console.error('Error cargando sugerencias:', e);
    } finally { setLoading(false); }
  };

  const openModal = (sug) => {
    setSelected(sug);
    setEditEstado(sug.estado);
    setEditComentario(sug.comentario_admin || '');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/admin/sugerencias/${selected.id}/`, {
        estado: editEstado,
        comentario_admin: editComentario,
      });
      setSugerencias(prev => prev.map(s =>
        s.id === selected.id ? { ...s, estado: editEstado, comentario_admin: editComentario, leida: true } : s
      ));
      setSelected(null);
    } catch (e) {
      alert('Error guardando cambios');
    } finally { setSaving(false); }
  };

  const filtered = sugerencias.filter(s => {
    if (filtroEstado !== 'all' && s.estado !== filtroEstado) return false;
    if (filtroTipo   !== 'all' && s.tipo   !== filtroTipo)   return false;
    return true;
  });

  const counts = {
    total:      sugerencias.length,
    noleidas:   sugerencias.filter(s => !s.leida).length,
    pendientes: sugerencias.filter(s => s.estado === 'PENDIENTE').length,
  };

  const estadoObj = (v) => ESTADOS.find(e => e.value === v) || ESTADOS[0];

  return (
    <div className="admin-container">
      <Sidebar user={user} activePage="sugerencias" />
      <main className="main-content">

        {/* HEADER */}
        <div className="dashboard-header">
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              💡 Sugerencias y Mejoras
            </h1>
            <p style={{ color: '#64748b', marginTop: 4, fontSize: '0.9rem' }}>
              {counts.total} sugerencias · {counts.noleidas} sin leer · {counts.pendientes} pendientes
            </p>
          </div>
          <button onClick={fetchSugerencias} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <i className={`fas fa-sync ${loading ? 'fa-spin' : ''}`}></i> Actualizar
          </button>
        </div>

        {/* STATS */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {ESTADOS.map(e => {
            const cnt = sugerencias.filter(s => s.estado === e.value).length;
            return (
              <div key={e.value} style={{ background: e.bg, border: `1.5px solid ${e.color}33`, borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}
                onClick={() => setFiltroEstado(filtroEstado === e.value ? 'all' : e.value)}>
                <div style={{ fontSize: 22, fontWeight: 800, color: e.color }}>{cnt}</div>
                <div style={{ fontSize: 12, color: e.color, fontWeight: 600 }}>{e.label}</div>
              </div>
            );
          })}
        </div>

        {/* FILTROS */}
        <div className="ticket-panel">
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            {[{ key: 'all', label: 'Todos los tipos' }, { key: 'BUG', label: '🐛 Bug' }, { key: 'MEJORA', label: '✨ Mejora' }, { key: 'OTRO', label: '💬 Otro' }].map(t => (
              <button key={t.key} onClick={() => setFiltroTipo(t.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${filtroTipo === t.key ? '#6366f1' : '#e2e8f0'}`,
                  background: filtroTipo === t.key ? '#f0f4ff' : 'white',
                  color: filtroTipo === t.key ? '#6366f1' : '#64748b',
                }}>{t.label}</button>
            ))}
            {(filtroEstado !== 'all' || filtroTipo !== 'all') && (
              <button onClick={() => { setFiltroEstado('all'); setFiltroTipo('all'); }}
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                ✕ Limpiar filtros
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: '#6366f1' }}></i></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>💡</div>
              <p>No hay sugerencias con estos filtros</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="tickets-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>ID</th>
                    <th style={{ width: 100 }}>Tipo</th>
                    <th>Descripción</th>
                    <th style={{ width: 130 }}>Usuario</th>
                    <th style={{ width: 130 }}>Fecha</th>
                    <th style={{ width: 120 }}>Estado</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sug => {
                    const tipo  = TIPOS[sug.tipo] || TIPOS.OTRO;
                    const est   = estadoObj(sug.estado);
                    return (
                      <tr key={sug.id}
                        style={{ background: !sug.leida ? '#fafffe' : 'inherit', cursor: 'pointer' }}
                        onClick={() => openModal(sug)}>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {!sug.leida && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }}></span>}
                            #{sug.id}
                          </span>
                        </td>
                        <td>
                          <span style={{ background: tipo.bg, color: tipo.color, padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                            {tipo.icon} {tipo.label}
                          </span>
                        </td>
                        <td className="truncate-text" style={{ maxWidth: 300 }} title={sug.descripcion}>
                          {sug.descripcion}
                        </td>
                        <td style={{ color: '#475569', fontSize: 12 }}>👤 {sug.usuario}</td>
                        <td style={{ color: '#94a3b8', fontSize: 12 }}>{formatDate(sug.fecha)}</td>
                        <td>
                          <span style={{ background: est.bg, color: est.color, padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                            {est.label}
                          </span>
                        </td>
                        <td>
                          <button className="mt-btn-icon" onClick={e => { e.stopPropagation(); openModal(sug); }}>
                            <i className="fas fa-edit"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content mt-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{TIPOS[selected.tipo]?.icon || '💡'}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Sugerencia #{selected.id}</h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    {TIPOS[selected.tipo]?.label} · {selected.usuario} · {formatDate(selected.fecha)}
                  </p>
                </div>
              </div>
              <button className="close-modal-btn" onClick={() => setSelected(null)} disabled={saving}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-row">
                <strong>Descripción del usuario</strong>
                <div className="description-box" style={{ marginTop: 6 }}>{selected.descripcion}</div>
              </div>

              <div className="modal-row" style={{ marginTop: 16 }}>
                <strong>Estado</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {ESTADOS.map(e => (
                    <button key={e.value} onClick={() => setEditEstado(e.value)}
                      style={{
                        padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `2px solid ${editEstado === e.value ? e.color : '#e2e8f0'}`,
                        background: editEstado === e.value ? e.bg : 'white',
                        color: editEstado === e.value ? e.color : '#64748b',
                        transition: 'all 0.15s',
                      }}>{e.label}</button>
                  ))}
                </div>
              </div>

              <div className="modal-row" style={{ marginTop: 16 }}>
                <strong>Comentario para el usuario (opcional)</strong>
                <textarea value={editComentario} onChange={e => setEditComentario(e.target.value)}
                  placeholder="Ej: Esta mejora ya está en el roadmap para Q2..."
                  rows={3} className="mt-textarea" style={{ marginTop: 8 }} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="mt-btn-cancel" onClick={() => setSelected(null)} disabled={saving}>Cancelar</button>
              <button className="mt-btn-finish" onClick={handleSave} disabled={saving}>
                {saving ? <><i className="fas fa-spinner fa-spin"></i> Guardando...</> : <><i className="fas fa-save"></i> Guardar cambios</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SugerenciasAdminPage;