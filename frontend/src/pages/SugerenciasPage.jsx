import { useState } from 'react';
import api from '../config/axios';

const TIPOS = [
  { value: 'BUG',    label: '🐛 Bug / Error',     desc: 'Algo no funciona como debería',   color: '#ef4444', bg: '#fef2f2' },
  { value: 'MEJORA', label: '✨ Mejora',            desc: 'Una idea para mejorar el sistema', color: '#6366f1', bg: '#f0f4ff' },
  { value: 'OTRO',   label: '💬 Otro',             desc: 'Cualquier otro comentario',        color: '#64748b', bg: '#f8fafc' },
];

const SugerenciasPage = ({ onClose }) => {
  const [tipo,        setTipo]        = useState('MEJORA');
  const [descripcion, setDescripcion] = useState('');
  const [enviando,    setEnviando]    = useState(false);
  const [enviado,     setEnviado]     = useState(false);
  const [error,       setError]       = useState('');

  const handleSubmit = async () => {
    if (!descripcion.trim()) { setError('Por favor describe tu sugerencia.'); return; }
    if (descripcion.trim().length < 10) { setError('La descripción debe tener al menos 10 caracteres.'); return; }

    setEnviando(true); setError('');
    try {
      await api.post('/sugerencias/', { tipo, descripcion: descripcion.trim() });
      setEnviado(true);
      setTimeout(() => onClose?.(), 3000);
    } catch (e) {
      setError('Error al enviar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const tipoActual = TIPOS.find(t => t.value === tipo);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: 20,
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20,
        width: '100%', maxWidth: 540,
        boxShadow: '0 30px 60px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        animation: 'slideUp 0.25s ease',
      }}>

        {/* HEADER */}
        <div style={{
          padding: '22px 26px 18px',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>💡</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'white' }}>
                Mejoras y Ajustes
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                Tus ideas hacen el sistema mejor
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            width: 34, height: 34, borderRadius: '50%',
            cursor: 'pointer', color: 'white', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* BODY */}
        <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {enviado ? (
            /* ── ESTADO ENVIADO ── */
            <div style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                ¡Gracias por tu aporte!
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                Tu sugerencia fue enviada al equipo de TI.<br />
                La revisaremos y tomaremos en cuenta para mejorar el sistema.
              </p>
              <div style={{
                marginTop: 20, padding: '10px 16px',
                background: '#f0fdf4', borderRadius: 10,
                border: '1px solid #bbf7d0',
                fontSize: 13, color: '#16a34a', fontWeight: 600,
              }}>
                ✅ Cerrando automáticamente...
              </div>
            </div>
          ) : (
            <>
              {/* ── TIPO ── */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 10 }}>
                  Tipo de sugerencia
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTipo(t.value)}
                      style={{
                        flex: 1, padding: '12px 8px', borderRadius: 12,
                        border: `2px solid ${tipo === t.value ? t.color : '#e2e8f0'}`,
                        background: tipo === t.value ? t.bg : '#fafafa',
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{t.label.split(' ')[0]}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: tipo === t.value ? t.color : '#64748b',
                      }}>
                        {t.label.split(' ').slice(1).join(' ')}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', lineHeight: 1.3 }}>
                        {t.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── DESCRIPCIÓN ── */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Descripción
                  <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                    ({descripcion.length}/500 caracteres)
                  </span>
                </label>
                <textarea
                  value={descripcion}
                  onChange={e => { setDescripcion(e.target.value.slice(0, 500)); setError(''); }}
                  placeholder={
                    tipo === 'BUG'
                      ? 'Describe el error: ¿qué pasó?, ¿cuándo ocurre?, ¿qué esperabas que pasara?'
                      : tipo === 'MEJORA'
                      ? 'Describe tu idea: ¿qué mejorarías?, ¿cómo funcionaría?'
                      : 'Escribe tu comentario o sugerencia...'
                  }
                  rows={5}
                  style={{
                    width: '100%', padding: '12px 14px',
                    borderRadius: 10, fontSize: 14, lineHeight: 1.6,
                    border: `1.5px solid ${error ? '#ef4444' : descripcion.length > 0 ? tipoActual.color : '#e2e8f0'}`,
                    outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit', color: '#1e293b',
                    background: '#fafafa',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.background = '#fff'}
                  onBlur={e => e.target.style.background = '#fafafa'}
                />
                {error && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>⚠️ {error}</p>
                )}
              </div>

              {/* ── INFO ── */}
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: '#f8fafc', border: '1px solid #e2e8f0',
                fontSize: 12, color: '#64748b', lineHeight: 1.6,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                <span>
                  Tu sugerencia será visible solo para el equipo de TI.
                  Se registrará con tu nombre de usuario para poder darte seguimiento.
                </span>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        {!enviado && (
          <div style={{
            padding: '14px 26px', borderTop: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            background: '#fafbff',
          }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 9,
              background: 'white', border: '1px solid #e2e8f0',
              color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={enviando || !descripcion.trim()}
              style={{
                padding: '10px 24px', borderRadius: 9,
                background: enviando || !descripcion.trim() ? '#e2e8f0' : tipoActual.color,
                border: 'none', color: enviando || !descripcion.trim() ? '#94a3b8' : 'white',
                cursor: enviando || !descripcion.trim() ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {enviando
                ? <><i className="fas fa-spinner fa-spin"></i> Enviando...</>
                : <><i className="fas fa-paper-plane"></i> Enviar sugerencia</>
              }
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default SugerenciasPage;