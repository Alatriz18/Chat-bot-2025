import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';
import '../styles/Chat.css';

const HUB_LOGIN_URL = 'https://main.d2n6dprtfytcex.amplifyapp.com/login';

// ============================================================
// STAR RATING
// ============================================================
const StarRating = ({ initialRating, ticketId, onRate }) => {
    const [hover, setHover] = React.useState(0);
    const [rating, setRating] = React.useState(initialRating || 0);
    React.useEffect(() => { setRating(initialRating || 0); }, [initialRating]);
    return (
        <div className="star-rating-container">
            {[1, 2, 3, 4, 5].map((star) => {
                const isSelected = star <= (hover || rating);
                return (
                    <span key={star}
                        className={`star-icon ${isSelected ? 'selected' : ''}`}
                        onClick={() => { setRating(star); onRate(ticketId, star); }}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                    >★</span>
                );
            })}
        </div>
    );
};

// ============================================================
// HELPERS
// ============================================================
const parseMarkdown = (text) => {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
};

const getBtnClass = (btn) => {
    const t = btn.text || '';
    const a = btn.action || '';
    if (a === 'report_problem' || a === 'consult_policies' || a === 'sugerencias') return 'message-btn btn-main';
    if (t.startsWith('✅') || a.includes('solved'))                                 return 'message-btn btn-success';
    if (t.startsWith('❌') || a.includes('escalate') || a.includes('failed'))       return 'message-btn btn-danger';
    if (t.startsWith('🔙') || t.startsWith('🏠'))                                   return 'message-btn btn-nav';
    if (t.startsWith('👤') || a.startsWith('set_preference'))                       return 'message-btn btn-user';
    if (t.startsWith('🎲'))                                                         return 'message-btn btn-random';
    if (a.startsWith('sug_tipo'))                                                   return 'message-btn btn-option';
    return 'message-btn btn-option';
};

const getButtonsLayout = (buttons) => {
    if (!buttons || buttons.length === 0) return '';
    const hasMain = buttons.some(b => b.action === 'report_problem' || b.action === 'consult_policies' || b.action === 'sugerencias');
    if (hasMain) return 'layout-main';
    const hasConfirm = buttons.some(b =>
        b.text?.startsWith('✅') || b.text?.startsWith('❌') ||
        b.action?.includes('solved') || b.action?.includes('escalate')
    );
    if (hasConfirm) return 'layout-confirm';
    const hasUsers = buttons.some(b => b.text?.startsWith('👤') || b.action?.startsWith('set_preference'));
    if (hasUsers) return 'layout-users';
    const navOnly = buttons.every(b => b.text?.startsWith('🔙') || b.text?.startsWith('🏠'));
    if (navOnly) return 'layout-nav';
    return 'layout-options';
};

const uploadToS3 = async (ticketId, file) => {
    const presignedResponse = await api.post(`/tickets/${ticketId}/generate-presigned-url/`, {
        filename: file.name, filetype: file.type, filesize: file.size
    });
    const presignedData = presignedResponse.data;
    const uploadResponse = await fetch(presignedData.upload_url, {
        method: 'PUT', headers: { 'Content-Type': file.type }, body: file
    });
    if (!uploadResponse.ok) throw new Error('Error subiendo archivo a S3');
    const confirmResponse = await api.post(`/tickets/${ticketId}/confirm-upload/`, {
        s3_key: presignedData.s3_key, filename: file.name,
        filetype: file.type, filesize: file.size
    });
    return confirmResponse.data;
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const Chat = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const [chatState, setChatState] = useState({
        current: 'SELECTING_ACTION',
        context: {
            categoryKey: null, subcategoryKey: null,
            problemDescription: '', attachedFiles: [],
            finalOptionIndex: 0, finalOptionsTried: [],
            sugTipo: null,   // ← para sugerencias
        }
    });

    const [messages,       setMessages]       = useState([]);
    const [isTyping,       setIsTyping]       = useState(false);
    const [inputText,      setInputText]      = useState('');
    const [knowledgeBase,  setKnowledgeBase]  = useState(null);
    const [showTickets,    setShowTickets]    = useState(false);
    const [userTickets,    setUserTickets]    = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef   = useRef(null);

    // ── INIT ──
    useEffect(() => {
        const init = async () => {
            try {
                const res  = await fetch('/knowledge_base.json');
                const data = await res.json();
                setKnowledgeBase(data);
                const nombre = user?.nombre_completo || user?.nombreCompleto || user?.username || 'Usuario';
                addMessage({
                    text: `¡Hola, <strong>${nombre}</strong>! 👋 Soy tu asistente virtual de TI.<br>Estoy aquí para ayudarte a resolver problemas técnicos o consultar políticas.`,
                    sender: 'bot'
                });
                setTimeout(() => displayMainMenu(data), 600);
            } catch {
                addMessage({ text: "Error cargando la configuración del chat.", sender: 'bot' });
            }
        };
        if (user) init();
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // ── CERRAR SESIÓN ──
    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('notificationsLastCheck');
        window.location.href = HUB_LOGIN_URL;
    };

    // ── TICKETS ──
    const fetchUserTickets = async () => {
        if (!user) return;
        setLoadingTickets(true);
        try {
            const response = await api.get('/tickets/');
            const sorted = [...response.data].sort((a, b) => {
                if (a.ticket_est_ticket === 'PE' && b.ticket_est_ticket !== 'PE') return -1;
                if (a.ticket_est_ticket !== 'PE' && b.ticket_est_ticket === 'PE') return 1;
                return 0;
            });
            setUserTickets(sorted);
        } catch (error) {
            console.error("Error cargando tickets:", error);
        } finally {
            setLoadingTickets(false);
        }
    };

    const handleRateTicket = async (ticketId, rating) => {
        try {
            await api.patch(`/tickets/${ticketId}/`, { ticket_calificacion: rating });
            setUserTickets(prev => prev.map(t => {
                const tId = t.ticket_cod_ticket || t.id;
                return String(tId) === String(ticketId) ? { ...t, ticket_calificacion: rating } : t;
            }));
        } catch (error) {
            console.error("Error al calificar:", error);
        }
    };

    // ── CORE ──
    const addMessage = ({ text, buttons = [], sender = 'bot' }) => {
        setMessages(prev => [...prev, {
            id: Date.now() + Math.random(), text, buttons, sender, timestamp: new Date()
        }]);
    };

    const displayMainMenu = (kb = knowledgeBase) => {
        if (!kb) return;
        setChatState(prev => ({
            ...prev,
            current: 'SELECTING_ACTION',
            context: { ...prev.context, attachedFiles: [], sugTipo: null }
        }));
        addMessage({
            text: "¿En qué te puedo ayudar hoy?",
            buttons: [
                { text: "🛎️ Reportar un Problema",  action: "report_problem",   desc: "Crea un ticket de soporte técnico" },
                { text: "📋 Consultar Políticas",    action: "consult_policies", desc: "Revisa las políticas de TI" },
                { text: "💡 Sugerencias al Sistema", action: "sugerencias",      desc: "Comparte ideas o reporta errores" },
            ],
            sender: 'bot'
        });
    };

    const handleAction = (action) => {
        const [type, ...params] = action.split(':');
        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);

            // ── Navegación global ──
            if (type === 'main_menu')        return displayMainMenu();
            if (type === 'report_problem')   return handleMainMenuSelection('report_problem');
            if (type === 'consult_policies') return handleMainMenuSelection('consult_policies');
            if (type === 'sugerencias')      return handleMainMenuSelection('sugerencias');
            if (type === 'category')         return handleCategorySelection('category', params);

            // ── Selección de tipo de sugerencia ──
            if (type === 'sug_tipo') {
                const tipoSug = params[0];
                setChatState(prev => ({ ...prev, current: 'DESCRIBING_SUG', context: { ...prev.context, sugTipo: tipoSug } }));
                const tipoLabel = { BUG: '🐛 Bug / Error', MEJORA: '✨ Mejora', OTRO: '💬 Otro' }[tipoSug] || tipoSug;
                addMessage({
                    text: `Entendido, registraré tu <strong>${tipoLabel}</strong>.<br>Describe con detalle tu sugerencia o el problema que encontraste:`,
                    sender: 'bot'
                });
                return;
            }

            switch (chatState.current) {
                case 'SELECTING_ACTION':      handleMainMenuSelection(type); break;
                case 'SELECTING_CATEGORY':    handleCategorySelection(type, params); break;
                case 'SELECTING_SUBCATEGORY': handleSubcategorySelection(type, params); break;
                case 'CONFIRMING_ESCALATION':
                case 'ASKING_FINAL_OPTIONS':  handleEscalationLogic(type, params); break;
                case 'SELECTING_PREFERENCE':
                    if (type === 'set_preference') {
                        const admin = params[0] === 'none' ? null : params[0];
                        createTicketWithAttachments(admin);
                    }
                    break;
                case 'SELECTING_POLICY':
                    if (type === 'policy') handlePolicySelection(params[0]);
                    break;
                default: break;
            }
        }, 500);
    };

    const handleMainMenuSelection = (selection) => {
        if (selection === 'report_problem') {
            setChatState(prev => ({ ...prev, current: 'SELECTING_CATEGORY' }));
            const categories = Object.keys(knowledgeBase.casos_soporte).map(key => ({
                text: knowledgeBase.casos_soporte[key].titulo, action: `category:${key}`
            }));
            categories.push({ text: "🔙 Volver al menú", action: "main_menu" });
            addMessage({ text: "¿Qué tipo de problema estás experimentando?", buttons: categories });

        } else if (selection === 'consult_policies') {
            setChatState(prev => ({ ...prev, current: 'SELECTING_POLICY' }));
            const policies = Object.keys(knowledgeBase.politicas).map(key => ({
                text: knowledgeBase.politicas[key].titulo, action: `policy:${key}`
            }));
            policies.push({ text: "🔙 Volver al menú", action: "main_menu" });
            addMessage({ text: "Selecciona la política que deseas consultar:", buttons: policies });

        } else if (selection === 'sugerencias') {
            setChatState(prev => ({ ...prev, current: 'SELECTING_SUG_TIPO' }));
            addMessage({
                text: "¿Qué tipo de sugerencia quieres enviar?",
                buttons: [
                    { text: "🐛 Bug / Error",  action: "sug_tipo:BUG",    desc: "Algo no funciona como debería" },
                    { text: "✨ Mejora",        action: "sug_tipo:MEJORA", desc: "Una idea para mejorar el sistema" },
                    { text: "💬 Otro",         action: "sug_tipo:OTRO",   desc: "Cualquier otro comentario" },
                    { text: "🔙 Volver",       action: "main_menu" },
                ],
                sender: 'bot'
            });
        }
    };

    // ── Enviar sugerencia ──
    const submitSugerencia = async (descripcion) => {
        setIsTyping(true);
        try {
            await api.post('/sugerencias/', {
                tipo:        chatState.context.sugTipo || 'OTRO',
                descripcion: descripcion,
            });
            setIsTyping(false);
            addMessage({
                text: `<div class="ticket-created-box">✅ <strong>¡Gracias por tu aporte!</strong><br>Tu sugerencia fue enviada al equipo de TI.<br><small>La revisaremos y tomaremos en cuenta para mejorar el sistema.</small></div>`,
                sender: 'bot'
            });
            setTimeout(displayMainMenu, 3000);
        } catch {
            setIsTyping(false);
            addMessage({ text: "❌ No se pudo enviar la sugerencia. Intenta de nuevo.", sender: 'bot' });
            setTimeout(displayMainMenu, 2500);
        }
    };

    const handleCategorySelection = (type, params) => {
        if (type === 'main_menu') return displayMainMenu();
        const categoryKey = params[0];
        setChatState(prev => ({ ...prev, current: 'SELECTING_SUBCATEGORY', context: { ...prev.context, categoryKey } }));
        const subcategories = Object.keys(knowledgeBase.casos_soporte[categoryKey].categorias).map(key => ({
            text: knowledgeBase.casos_soporte[categoryKey].categorias[key].titulo, action: `subcategory:${key}`
        }));
        subcategories.push({ text: "🔙 Volver", action: "report_problem" });
        subcategories.push({ text: "🏠 Menú principal", action: "main_menu" });
        addMessage({
            text: `Entendido. ¿Cuál es el problema específico con <strong>${knowledgeBase.casos_soporte[categoryKey].titulo}</strong>?`,
            buttons: subcategories
        });
    };

    const handleSubcategorySelection = (type, params) => {
        if (type === 'report_problem') return handleMainMenuSelection('report_problem');
        if (type === 'category')       return handleCategorySelection('category', [chatState.context.categoryKey]);
        const subKey          = params[0];
        const { categoryKey } = chatState.context;
        setChatState(prev => ({ ...prev, current: 'CONFIRMING_ESCALATION', context: { ...prev.context, subcategoryKey: subKey } }));
        const solution  = knowledgeBase.casos_soporte[categoryKey].categorias[subKey];
        const pasosHtml = solution.pasos.map(p => `<li>${parseMarkdown(p)}</li>`).join('');
        addMessage({
            text: `Para resolver <strong>"${solution.titulo}"</strong>, prueba estos pasos:<br><ol class="steps-list">${pasosHtml}</ol><div class="confirmacion-box">${solution.titulo_confirmacion}</div>`,
            buttons: [
                { text: "✅ Sí, se solucionó",  action: "solved" },
                { text: "❌ No, necesito ayuda", action: "escalate" },
                { text: "🔙 Volver",             action: `category:${categoryKey}` }
            ]
        });
    };

    const handleEscalationLogic = (type, params) => {
        if (type === 'solved') {
            addMessage({ text: "¡Excelente! Me alegra haber podido ayudarte. 🎉<br><small>Si tienes otro problema, no dudes en escribirme.</small>" });
            setTimeout(displayMainMenu, 2500);
            return;
        }
        if (type === 'escalate') {
            const { categoryKey, subcategoryKey } = chatState.context;
            const solution = knowledgeBase.casos_soporte[categoryKey].categorias[subcategoryKey];
            if (solution.opciones_finales?.length > 0) askFinalOption(0);
            else startDescriptionPhase();
            return;
        }
        if (type.startsWith('final_option')) {
            const index = parseInt(params[0]);
            if (type.includes('solved')) {
                addMessage({ text: "¡Perfecto! Me alegra que se haya resuelto. 👍" });
                setTimeout(displayMainMenu, 2000);
            } else {
                askFinalOption(index + 1);
            }
        }
    };

    const askFinalOption = (index) => {
        const { categoryKey, subcategoryKey } = chatState.context;
        const solution = knowledgeBase.casos_soporte[categoryKey].categorias[subcategoryKey];
        const options  = solution.opciones_finales || [];
        if (index >= options.length) { startDescriptionPhase(); return; }
        setChatState(prev => ({ ...prev, current: 'ASKING_FINAL_OPTIONS' }));
        const opt = options[index];
        addMessage({
            text: `Prueba esta solución adicional:<br><div class="final-option-box"><strong>${opt.titulo}</strong><p>${parseMarkdown(opt.descripcion)}</p></div>`,
            buttons: [
                { text: "✅ ¡Funcionó!",  action: `final_option_solved:${index}` },
                { text: "❌ No funcionó", action: `final_option_failed:${index}` }
            ]
        });
    };

    const startDescriptionPhase = () => {
        setChatState(prev => ({ ...prev, current: 'DESCRIBING_ISSUE' }));
        addMessage({
            text: "Voy a crear un ticket de soporte para ti. 📝<br><strong>Describe tu problema con el mayor detalle posible.</strong><br><small>Puedes pegar imágenes con Ctrl+V o adjuntar archivos con el botón 📎</small>",
            sender: 'bot'
        });
    };

    const handlePolicySelection = (key) => {
        const p = knowledgeBase.politicas[key];
        addMessage({
            text: `<div class="policy-header">📋 ${p.titulo}</div><div class="policy-content">${parseMarkdown(p.contenido)}</div>`,
            buttons: [
                { text: "🔙 Ver otras políticas", action: "consult_policies" },
                { text: "🏠 Menú principal",       action: "main_menu" }
            ]
        });
    };

    const handleSend = () => {
        const text = inputText.trim();
        if (!text) return;
        addMessage({ text, sender: 'user' });
        setInputText('');

        if (chatState.current === 'DESCRIBING_ISSUE') {
            setChatState(prev => ({ ...prev, context: { ...prev.context, problemDescription: text } }));
            askAdminPreference();
        } else if (chatState.current === 'DESCRIBING_SUG') {
            submitSugerencia(text);
        } else {
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                addMessage({ text: "Por favor, utiliza los botones para seleccionar una opción." });
            }, 800);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const askAdminPreference = async () => {
        setChatState(prev => ({ ...prev, current: 'SELECTING_PREFERENCE' }));
        setIsTyping(true);
        try {
            const response = await api.get('/admins/');
            setIsTyping(false);
            const admins = response.data;
            if (!Array.isArray(admins)) throw new Error();
            const buttons = admins.map(a => ({
                text:   `👤 ${a.nombreCompleto || a.nombre_completo || a.username || 'Técnico'}`,
                action: `set_preference:${a.username || 'auto'}`
            }));
            buttons.push({ text: "🎲 Asignación automática", action: "set_preference:none" });
            addMessage({ text: "Casi listo. ¿Deseas asignar tu ticket a un técnico específico?", buttons });
        } catch {
            setIsTyping(false);
            addMessage({ text: "⚠️ No se pudo cargar la lista de técnicos. Se asignará automáticamente." });
            setTimeout(() => createTicketWithAttachments(null), 2000);
        }
    };

    const createTicketWithAttachments = async (preferredAdmin) => {
        setIsTyping(true);
        try {
            const response = await api.post('/tickets/', {
                context: chatState.context, user: { ...user }, preferred_admin: preferredAdmin
            });
            const result   = response.data;
            let uploaded = 0, failed = 0;
            if (chatState.context.attachedFiles.length > 0) {
                await Promise.all(chatState.context.attachedFiles.map(async (file) => {
                    try { await uploadToS3(result.ticket_cod_ticket, file); uploaded++; }
                    catch { failed++; }
                }));
            }
            setIsTyping(false);
            let msg = `<div class="ticket-created-box">✅ <strong>Ticket #${result.ticket_id_ticket || result.ticket_cod_ticket} creado exitosamente</strong>`;
            if (result.assigned_to) msg += `<br>👨‍💻 Asignado a: <strong>${result.assigned_to}</strong>`;
            if (uploaded > 0) msg += `<br>📎 ${uploaded} archivo(s) adjunto(s)`;
            if (failed   > 0) msg += `<br>⚠️ ${failed} archivo(s) no se pudieron subir`;
            msg += `<br><small>Recibirás atención a la brevedad posible.</small></div>`;
            addMessage({ text: msg });
            setTimeout(() => setChatState(prev => ({ ...prev, context: { ...prev.context, attachedFiles: [] } })), 0);
            setTimeout(displayMainMenu, 4500);
        } catch (error) {
            setIsTyping(false);
            let errorMessage = '❌ Error al crear el ticket';
            if (error.response?.data?.error) errorMessage += `: ${error.response.data.error}`;
            addMessage({ text: errorMessage });
            setTimeout(displayMainMenu, 3000);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files?.length > 0) {
            setChatState(prev => ({ ...prev, context: { ...prev.context, attachedFiles: [...prev.context.attachedFiles, ...Array.from(e.target.files)] } }));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePaste = (e) => {
        if (chatState.current !== 'DESCRIBING_ISSUE') return;
        for (let item of e.clipboardData.items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                setChatState(prev => ({ ...prev, context: { ...prev.context, attachedFiles: [...prev.context.attachedFiles, file] } }));
            }
        }
    };

    const removeFile = (index) => {
        setChatState(prev => {
            const newFiles = [...prev.context.attachedFiles];
            newFiles.splice(index, 1);
            return { ...prev, context: { ...prev.context, attachedFiles: newFiles } };
        });
    };

    const getStatusConfig = (statusCode) => {
        switch (statusCode) {
            case 'PE': return { label: 'Pendiente',  className: 'status-pendiente' };
            case 'FN': return { label: 'Finalizado', className: 'status-finalizado' };
            default:   return { label: statusCode || 'Desconocido', className: 'status-default' };
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleDateString('es-EC', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil'
            });
        } catch { return ''; }
    };

    const inputActive = chatState.current === 'DESCRIBING_ISSUE' || chatState.current === 'DESCRIBING_SUG';

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="chat-wrapper">
            <div className="chat-container">

                {/* HEADER */}
                <div className="chat-header">
                    <div className="logo">
                        <img src="/logo-mirai.png" alt="mirAI"
                            style={{ height: 38, width: 'auto', borderRadius: 8 }}
                            onError={e => { e.target.style.display = 'none'; }} />
                        <div className="title-group">
                            <h2>mirAI</h2>
                            <p>Asistente de TI</p>
                        </div>
                    </div>

                    <div className="header-actions">
                        {/* Mis Tickets */}
                        <button className="theme-toggle"
                            onClick={() => { setShowTickets(!showTickets); if (!showTickets) fetchUserTickets(); }}
                            title="Mis Tickets">
                            <i className="fas fa-ticket-alt"></i>
                            {userTickets.filter(t => t.ticket_est_ticket === 'PE').length > 0 && (
                                <span className="ticket-badge">
                                    {userTickets.filter(t => t.ticket_est_ticket === 'PE').length}
                                </span>
                            )}
                        </button>

                        {/* Admin Panel */}
                        {(user?.rol === 'SISTEMAS_ADMIN' || user?.rol_nombre === 'SISTEMAS_ADMIN') && (
                            <button className="admin-header-btn" onClick={() => navigate('/admin')}>
                                <i className="fas fa-cog"></i> <span>Admin</span>
                            </button>
                        )}

                        {/* Tema */}
                        <button className="theme-toggle" onClick={toggleTheme} title="Cambiar tema">
                            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                        </button>

                        {/* Cerrar sesión */}
                        <button className="theme-toggle logout-btn" onClick={handleLogout} title="Cerrar sesión">
                            <i className="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>

                {/* SIDEBAR TICKETS */}
                {showTickets && (
                    <div className="tickets-sidebar">
                        <div className="tickets-header">
                            <h3><i className="fas fa-ticket-alt" style={{ marginRight: 8 }}></i>Mis Tickets</h3>
                            <button onClick={() => setShowTickets(false)} className="close-btn">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="tickets-list">
                            {loadingTickets ? (
                                <div className="tickets-loading"><i className="fas fa-spinner fa-spin"></i> Cargando...</div>
                            ) : userTickets.length === 0 ? (
                                <div className="tickets-empty"><i className="fas fa-inbox"></i><p>No tienes tickets aún</p></div>
                            ) : (
                                userTickets.map(ticket => {
                                    const statusConfig = getStatusConfig(ticket.ticket_est_ticket);
                                    return (
                                        <div key={ticket.id || ticket.ticket_cod_ticket} className="ticket-card-mini">
                                            <div className="ticket-mini-header">
                                                <span className="ticket-id">#{ticket.ticket_id_ticket || ticket.ticket_cod_ticket}</span>
                                                <span className={`ticket-status ${statusConfig.className}`}>{statusConfig.label}</span>
                                            </div>
                                            <p className="ticket-subject">{ticket.ticket_asu_ticket || "Sin Asunto"}</p>
                                            {ticket.ticket_des_ticket && (
                                                <p className="ticket-desc">
                                                    {ticket.ticket_des_ticket.length > 60
                                                        ? ticket.ticket_des_ticket.substring(0, 60) + '...'
                                                        : ticket.ticket_des_ticket}
                                                </p>
                                            )}
                                            <small className="ticket-date">{formatDate(ticket.ticket_fec_ticket || ticket.fecha_creacion)}</small>
                                            {ticket.ticket_est_ticket === 'FN' && (
                                                <div className="ticket-rating-section">
                                                    <p>Califica tu experiencia:</p>
                                                    <StarRating
                                                        initialRating={ticket.ticket_calificacion}
                                                        ticketId={ticket.ticket_cod_ticket || ticket.id}
                                                        onRate={handleRateTicket}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* MAIN AREA */}
                <div className="chat-main">
                    <div className="chat-messages" id="chatMessages">
                        {messages.map((msg, msgIndex) => (
                            <div key={msg.id}
                                className={`message ${msg.sender}-message`}
                                style={{ animationDelay: `${msgIndex * 0.02}s` }}>
                                <div className="message-avatar">
                                    <i className={`fas ${msg.sender === 'user' ? 'fa-user' : 'fa-robot'}`}></i>
                                </div>
                                <div className="message-content">
                                    <div className="message-text" dangerouslySetInnerHTML={{ __html: msg.text }}></div>
                                    {msg.buttons?.length > 0 && (
                                        <div className={`message-buttons ${getButtonsLayout(msg.buttons)}`}>
                                            {msg.buttons.map((btn, idx) => (
                                                <button key={idx}
                                                    className={getBtnClass(btn)}
                                                    onClick={() => handleAction(btn.action)}
                                                    style={{ animationDelay: `${idx * 0.07}s` }}>
                                                    {btn.text}
                                                    {btn.desc && <span className="btn-desc">{btn.desc}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="message bot-message">
                                <div className="message-avatar"><i className="fas fa-robot"></i></div>
                                <div className="message-content">
                                    <div className="message-text typing-indicator">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* SIDEBAR ARCHIVOS */}
                    {chatState.context.attachedFiles.length > 0 && (
                        <div className="file-sidebar">
                            <div className="file-sidebar-header">
                                <h4><i className="fas fa-paperclip"></i> Archivos ({chatState.context.attachedFiles.length})</h4>
                                <button className="close-sidebar-btn"
                                    onClick={() => setChatState(prev => ({ ...prev, context: { ...prev.context, attachedFiles: [] } }))}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                            <div className="file-sidebar-list">
                                {chatState.context.attachedFiles.map((file, idx) => (
                                    <div key={idx} className="file-sidebar-item">
                                        <div className="file-sidebar-icon"><i className="fas fa-file"></i></div>
                                        <div className="file-sidebar-info">
                                            <span className="file-sidebar-name">{file.name}</span>
                                            <span className="file-sidebar-size">{(file.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                        <button className="remove-file-sidebar" onClick={() => removeFile(idx)}>
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* INPUT */}
                <div className="chat-input-container">
                    {chatState.current === 'DESCRIBING_ISSUE' && (
                        <div className="input-hint">
                            <i className="fas fa-info-circle"></i> Describe tu problema con detalle para ayudarte mejor
                        </div>
                    )}
                    {chatState.current === 'DESCRIBING_SUG' && (
                        <div className="input-hint" style={{ background: '#f0f4ff', borderColor: '#6366f1', color: '#4338ca' }}>
                            <i className="fas fa-lightbulb"></i> Escribe tu sugerencia con detalle
                        </div>
                    )}
                    <div className="input-wrapper">
                        <textarea id="userInput" rows="1"
                            placeholder={
                                chatState.current === 'DESCRIBING_ISSUE' ? "Describe tu problema aquí..."
                                : chatState.current === 'DESCRIBING_SUG'  ? "Escribe tu sugerencia aquí..."
                                : "Usa los botones de arriba para navegar..."
                            }
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={handleKeyPress}
                            onPaste={handlePaste}
                            disabled={!inputActive}
                        ></textarea>
                        <div className="input-actions">
                            <input type="file" multiple style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileSelect} />
                            {chatState.current === 'DESCRIBING_ISSUE' && (
                                <button className="action-btn attach-btn" onClick={() => fileInputRef.current.click()} title="Adjuntar archivo">
                                    <i className="fas fa-paperclip"></i>
                                </button>
                            )}
                            <button className="action-btn send-btn" onClick={handleSend} title="Enviar" disabled={!inputActive}>
                                <i className="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;