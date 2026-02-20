import { useState, useEffect, useRef } from 'react';
import api from '../../config/axios';

const NotificationSettings = ({ onClose }) => {
  const [volume, setVolume] = useState(70);
  const [soundType, setSoundType] = useState('default'); // 'default' | 'custom' | 'none'
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [desktopPermission, setDesktopPermission] = useState('default');
  const [customSoundUrl, setCustomSoundUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Cargar configuración guardada y verificar sonido en S3
  useEffect(() => {
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      const s = JSON.parse(saved);
      setVolume(s.volume ?? 70);
      setSoundType(s.sound ?? 'default');
      setDesktopNotifications(s.desktopNotifications ?? true);
      setCustomSoundUrl(s.customSoundUrl ?? null);
    }

    // Verificar si existe sonido personalizado en S3
    checkCustomSound();

    // Estado actual del permiso de notificaciones del navegador
    if ('Notification' in window) {
      setDesktopPermission(Notification.permission);
    }
  }, []);

  const checkCustomSound = async () => {
    try {
      const res = await api.get('/notifications/sounds/check/');
      if (res.data.hasCustomSound) {
        setCustomSoundUrl(res.data.soundPath);
        setSoundType('custom');
      }
    } catch {
      // No hay sonido personalizado, está bien
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
    if (!allowed.includes(file.type)) {
      setUploadError('Solo se permiten archivos MP3, WAV, OGG o M4A');
      return;
    }

    // Validar tamaño (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('El archivo debe ser menor a 2MB');
      return;
    }

    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('sound', file);

      const res = await api.post('/notifications/sounds/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCustomSoundUrl(res.data.filePath);
      setSoundType('custom');
    } catch (err) {
      setUploadError('Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteCustomSound = async () => {
    setDeleting(true);
    try {
      await api.post('/notifications/sounds/delete/');
      setCustomSoundUrl(null);
      setSoundType('default');
    } catch {
      // silencioso
    } finally {
      setDeleting(false);
    }
  };

  const handleTestSound = async () => {
    if (soundType === 'none') return;
    setTesting(true);

    try {
      let src;
      if (soundType === 'custom' && customSoundUrl) {
        src = customSoundUrl;
      } else {
        src = '/static/notification_sounds/default-sound.mp3';
      }

      const audio = new Audio(src);
      audio.volume = volume / 100;
      await audio.play();
      setTimeout(() => setTesting(false), 1500);
    } catch {
      setTesting(false);
    }
  };

  const requestDesktopPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setDesktopPermission(result);
    if (result === 'granted') setDesktopNotifications(true);
  };

  const handleSave = () => {
    const settings = {
      sound: soundType,
      volume,
      desktopNotifications,
      customSoundUrl: soundType === 'custom' ? customSoundUrl : null,
      autoMarkAsRead: true
    };
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose?.();
    }, 1200);
  };

  const permissionColor = {
    granted: '#10b981',
    denied: '#ef4444',
    default: '#f59e0b'
  }[desktopPermission] || '#94a3b8';

  const permissionLabel = {
    granted: 'Permitido',
    denied: 'Bloqueado',
    default: 'Sin configurar'
  }[desktopPermission] || 'Desconocido';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: 20,
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 500,
        boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        animation: 'slideUp 0.25s ease'
      }}>

        {/* ── HEADER ── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20
            }}>🔔</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'white' }}>
                Configuración de Notificaciones
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                Personaliza cómo recibes alertas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none',
              width: 32, height: 32, borderRadius: '50%',
              cursor: 'pointer', color: 'white', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >×</button>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* SECCIÓN: Sonido */}
          <Section icon="🔊" title="Sonido de alerta">

            {/* Tipo de sonido */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { value: 'default', label: 'Sonido predeterminado', desc: 'Sonido incluido del sistema' },
                { value: 'custom',  label: 'Sonido personalizado',  desc: customSoundUrl ? 'Archivo subido a tu cuenta' : 'Sube un archivo MP3/WAV' },
                { value: 'none',    label: 'Sin sonido',            desc: 'Solo notificaciones visuales' },
              ].map(opt => (
                <label key={opt.value} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 10,
                  border: `2px solid ${soundType === opt.value ? '#6366f1' : '#e2e8f0'}`,
                  background: soundType === opt.value ? '#f0f4ff' : '#fafafa',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}>
                  <input
                    type="radio"
                    name="soundType"
                    value={opt.value}
                    checked={soundType === opt.value}
                    onChange={() => setSoundType(opt.value)}
                    style={{ accentColor: '#6366f1', width: 16, height: 16 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{opt.desc}</div>
                  </div>
                  {opt.value === 'custom' && soundType === 'custom' && customSoundUrl && (
                    <span style={{
                      fontSize: 11, background: '#dcfce7', color: '#16a34a',
                      padding: '2px 8px', borderRadius: 10, fontWeight: 600
                    }}>✓ Subido</span>
                  )}
                </label>
              ))}
            </div>

            {/* Upload de sonido personalizado */}
            {soundType === 'custom' && (
              <div style={{
                marginTop: 12, padding: 14,
                background: '#f8fafc', borderRadius: 10,
                border: '1px dashed #cbd5e1'
              }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                {customSoundUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🎵</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                        Sonido personalizado activo
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
                        Guardado en tu cuenta · S3
                      </p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: '#6366f1', color: 'white',
                        border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600
                      }}
                    >
                      Cambiar
                    </button>
                    <button
                      onClick={handleDeleteCustomSound}
                      disabled={deleting}
                      style={{
                        padding: '6px 10px', borderRadius: 8,
                        background: '#fee2e2', color: '#dc2626',
                        border: 'none', cursor: 'pointer', fontSize: 12
                      }}
                    >
                      {deleting ? '...' : '🗑'}
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>
                      Sube un archivo de audio (MP3, WAV, OGG · máx. 2MB)
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      style={{
                        padding: '9px 20px', borderRadius: 8,
                        background: uploading ? '#e2e8f0' : '#6366f1',
                        color: uploading ? '#94a3b8' : 'white',
                        border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                        fontSize: 13, fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 8
                      }}
                    >
                      {uploading
                        ? <><i className="fas fa-spinner fa-spin"></i> Subiendo a S3...</>
                        : <><i className="fas fa-upload"></i> Seleccionar archivo</>
                      }
                    </button>
                  </div>
                )}

                {uploadError && (
                  <p style={{
                    margin: '10px 0 0', fontSize: 12,
                    color: '#dc2626', textAlign: 'center'
                  }}>⚠️ {uploadError}</p>
                )}
              </div>
            )}

            {/* Volumen */}
            {soundType !== 'none' && (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginBottom: 8
                }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                    Volumen
                  </label>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#6366f1',
                    background: '#f0f4ff', padding: '2px 8px', borderRadius: 8
                  }}>
                    {volume}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0" max="100" value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  style={{
                    width: '100%', accentColor: '#6366f1',
                    height: 6, cursor: 'pointer'
                  }}
                />
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginTop: 4, fontSize: 10, color: '#cbd5e1'
                }}>
                  <span>🔇 Silencio</span>
                  <span>🔊 Máximo</span>
                </div>
              </div>
            )}

            {/* Botón probar */}
            {soundType !== 'none' && (
              <button
                onClick={handleTestSound}
                disabled={testing || (soundType === 'custom' && !customSoundUrl)}
                style={{
                  marginTop: 12, width: '100%',
                  padding: '10px', borderRadius: 8,
                  background: testing ? '#dcfce7' : '#f8fafc',
                  border: `1px solid ${testing ? '#86efac' : '#e2e8f0'}`,
                  color: testing ? '#16a34a' : '#475569',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8
                }}
              >
                {testing
                  ? <><i className="fas fa-volume-up"></i> Reproduciendo...</>
                  : <><i className="fas fa-play"></i> Probar sonido</>
                }
              </button>
            )}
          </Section>

          {/* SECCIÓN: Notificaciones del escritorio */}
          <Section icon="🖥️" title="Notificaciones del escritorio">
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '12px 14px',
              background: '#f8fafc', borderRadius: 10,
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  Notificaciones del sistema
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94a3b8' }}>
                  Alertas nativas del sistema operativo
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: permissionColor,
                  background: `${permissionColor}18`,
                  padding: '3px 9px', borderRadius: 10
                }}>
                  ● {permissionLabel}
                </span>
                {/* Toggle */}
                <div
                  onClick={() => {
                    if (desktopPermission === 'denied') return;
                    if (desktopPermission === 'default') {
                      requestDesktopPermission();
                    } else {
                      setDesktopNotifications(!desktopNotifications);
                    }
                  }}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: desktopNotifications && desktopPermission === 'granted'
                      ? '#6366f1' : '#e2e8f0',
                    cursor: desktopPermission === 'denied' ? 'not-allowed' : 'pointer',
                    position: 'relative', transition: 'background 0.2s',
                    opacity: desktopPermission === 'denied' ? 0.5 : 1
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 3,
                    left: desktopNotifications && desktopPermission === 'granted' ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s'
                  }} />
                </div>
              </div>
            </div>

            {desktopPermission === 'denied' && (
              <p style={{
                margin: '8px 0 0', fontSize: 11, color: '#dc2626',
                padding: '8px 12px', background: '#fee2e2',
                borderRadius: 8, lineHeight: 1.5
              }}>
                ⚠️ Las notificaciones están bloqueadas en tu navegador.
                Para habilitarlas ve a <strong>Configuración del sitio</strong> en tu navegador.
              </p>
            )}

            {desktopPermission === 'default' && (
              <button
                onClick={requestDesktopPermission}
                style={{
                  marginTop: 8, width: '100%', padding: '9px',
                  borderRadius: 8, background: '#fffbeb',
                  border: '1px solid #fde68a', color: '#92400e',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600
                }}
              >
                <i className="fas fa-bell"></i> Habilitar notificaciones del navegador
              </button>
            )}
          </Section>

        </div>

        {/* ── FOOTER ── */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          background: '#fafbff'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'white', border: '1px solid #e2e8f0',
              color: '#64748b', cursor: 'pointer',
              fontSize: 13, fontWeight: 600
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '9px 22px', borderRadius: 8,
              background: saved ? '#10b981' : '#6366f1',
              border: 'none', color: 'white',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            {saved
              ? <><i className="fas fa-check"></i> Guardado!</>
              : <><i className="fas fa-save"></i> Guardar cambios</>
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// Sub-componente de sección
const Section = ({ icon, title, children }) => (
  <div>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 12
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <h3 style={{
        margin: 0, fontSize: 14, fontWeight: 700,
        color: '#1e293b'
      }}>{title}</h3>
    </div>
    {children}
  </div>
);

export default NotificationSettings;