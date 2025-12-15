import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios'; 
import '../styles/Chat.css'; 

// Ajusta esto si tu variable de entorno se llama diferente
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Función para subir archivo a S3 (Mantenemos tu lógica intacta)
const uploadToS3 = async (ticketId, file) => {
    try {
        const presignedResponse = await api.post(`/tickets/${ticketId}/generate-presigned-url/`, {
            filename: file.name,
            filetype: file.type,
            filesize: file.size
        });
        const presignedData = presignedResponse.data;
        
        const uploadResponse = await fetch(presignedData.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
        });
        
        if (!uploadResponse.ok) throw new Error('Error subiendo archivo a S3');
        
        const confirmResponse = await api.post(`/tickets/${ticketId}/confirm-upload/`, {
            s3_key: presignedData.s3_key,
            filename: file.name,
            filetype: file.type,
            filesize: file.size
        });
        
        return confirmResponse.data;
    } catch (error) {
        console.error('Error en uploadToS3:', error);
        throw error;
    }
};

const Chat = () => {
    // --- 1. HOOKS Y ESTADO GLOBAL ---
    const navigate = useNavigate(); 
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    
    // --- 2. ESTADO DEL CHAT ---
    const [chatState, setChatState] = useState({
        current: 'SELECTING_ACTION',
        context: {
            categoryKey: null,
            subcategoryKey: null,
            problemDescription: '',
            attachedFiles: [],
            finalOptionIndex: 0,
            finalOptionsTried: []
        }
    });

    // --- 3. ESTADOS DE INTERFAZ ---
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [inputText, setInputText] = useState('');
    const [knowledgeBase, setKnowledgeBase] = useState(null);
    
    // --- NUEVO: ESTADO PARA TICKETS ---
    const [showTickets, setShowTickets] = useState(false);
    const [userTickets, setUserTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    // Referencias
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // --- 4. EFECTOS ---

    useEffect(() => {
        const init = async () => {
            try {
                const res = await fetch('/knowledge_base.json');
                const data = await res.json();
                setKnowledgeBase(data);

                const nombre = user?.nombreCompleto || user?.username || 'Usuario';
                addMessage({ 
                    text: `¡Hola, <strong>${nombre}</strong>! 👋 Soy tu asistente virtual de TI. ¿Cómo puedo ayudarte hoy?`,
                    sender: 'bot'
                });

                setTimeout(() => displayMainMenu(data), 500);
            } catch (error) {
                console.error("Error cargando knowledge_base:", error);
                addMessage({ text: "Error cargando la configuración del chat.", sender: 'bot' });
            }
        };
        if (user) init();
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // --- NUEVO: CARGAR TICKETS DEL USUARIO ---
    const fetchUserTickets = async () => {
        if (!user) return;
        setLoadingTickets(true);
        try {
            // Asumimos que tienes un endpoint para listar los tickets del usuario actual
            // Si no, suele ser un GET a /tickets/ filtrado por el usuario en el backend
            const response = await api.get('/tickets/'); 
            // Filtramos solo los del usuario si el backend devuelve todos, 
            // aunque lo ideal es que el backend ya filtre por request.user
            setUserTickets(response.data); 
        } catch (error) {
            console.error("Error cargando tickets:", error);
        } finally {
            setLoadingTickets(false);
        }
    };

    // --- NUEVO: CALIFICAR TICKET ---
 const handleRateTicket = async (ticketId, rating) => {
    try {
        console.log("Enviando calificación...", ticketId, rating); // DEBE IMPRIMIR UN NUMERO, NO 'undefined'

        // Asegúrate de que tu URL use ticketId
        const response = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/`, {
            method: 'PATCH', // O POST, según tu backend
            headers: {
                'Content-Type': 'application/json',
                // Asegúrate de incluir el token si es necesario
            },
            body: JSON.stringify({ calificacion: rating })
        });
        
        // ... resto del código ...
    } catch (error) {
        console.error("Error al calificar:", error);
    }
};

    // --- 5. FUNCIONES CORE (Lógica del Chat) ---
    // (Mantenemos todo igual que tu código original)
    
    const addMessage = ({ text, buttons = [], sender = 'bot' }) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            text,
            buttons,
            sender,
            timestamp: new Date()
        }]);
    };

    const displayMainMenu = (kb = knowledgeBase) => {
        if (!kb) return;
        setChatState(prev => ({
            ...prev,
            current: 'SELECTING_ACTION',
            context: { ...prev.context, attachedFiles: [] }
        }));

        addMessage({
            text: "¿Qué necesitas hacer?",
            buttons: [
                { text: "🛎️ Reportar un Problema", action: "report_problem" },
                { text: "📋 Consultar Políticas", action: "consult_policies" }
            ],
            sender: 'bot'
        });
    };

    const handleAction = (action) => {
        const [type, ...params] = action.split(':');
        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);
            if (type === 'main_menu') return displayMainMenu();

            switch (chatState.current) {
                case 'SELECTING_ACTION':
                    handleMainMenuSelection(type);
                    break;
                case 'SELECTING_CATEGORY':
                    handleCategorySelection(type, params);
                    break;
                case 'SELECTING_SUBCATEGORY':
                    handleSubcategorySelection(type, params);
                    break;
                case 'CONFIRMING_ESCALATION':
                case 'ASKING_FINAL_OPTIONS':
                    handleEscalationLogic(type, params);
                    break;
                case 'SELECTING_PREFERENCE':
                    if (type === 'set_preference') {
                        const admin = params[0] === 'none' ? null : params[0];
                        createTicketWithAttachments(admin);
                    }
                    break;
                case 'SELECTING_POLICY':
                    if (type === 'policy') handlePolicySelection(params[0]);
                    else if (type === 'consult_policies') handleMainMenuSelection('consult_policies');
                    break;
                default:
                    if (chatState.current === 'DESCRIBING_ISSUE' && type === 'main_menu') displayMainMenu();
                    break;
            }
        }, 500);
    };

    // --- SUB-HANDLERS ---
    const handleMainMenuSelection = (selection) => {
        if (selection === 'report_problem') {
            setChatState(prev => ({ ...prev, current: 'SELECTING_CATEGORY' }));
            const categories = Object.keys(knowledgeBase.casos_soporte).map(key => ({
                text: knowledgeBase.casos_soporte[key].titulo,
                action: `category:${key}`
            }));
            categories.push({ text: "🔙 Volver", action: "main_menu" });
            addMessage({ text: "Entendido. ¿Qué tipo de problema tienes?", buttons: categories });
        } else if (selection === 'consult_policies') {
            setChatState(prev => ({ ...prev, current: 'SELECTING_POLICY' }));
            const policies = Object.keys(knowledgeBase.politicas).map(key => ({
                text: knowledgeBase.politicas[key].titulo,
                action: `policy:${key}`
            }));
            policies.push({ text: "🔙 Volver", action: "main_menu" });
            addMessage({ text: "Claro, aquí están las políticas.", buttons: policies });
        }
    };

    const handleCategorySelection = (type, params) => {
        if (type === 'main_menu') return displayMainMenu();
        const categoryKey = params[0];
        
        setChatState(prev => ({
            ...prev,
            current: 'SELECTING_SUBCATEGORY',
            context: { ...prev.context, categoryKey }
        }));

        const subcategories = Object.keys(knowledgeBase.casos_soporte[categoryKey].categorias).map(key => ({
            text: knowledgeBase.casos_soporte[categoryKey].categorias[key].titulo,
            action: `subcategory:${key}`
        }));
        subcategories.push({ text: "🔙 Volver", action: "report_problem" });
        subcategories.push({ text: "🏠 Menú", action: "main_menu" });

        addMessage({ text: "Ok. Ahora, sé más específico:", buttons: subcategories });
    };

    const handleSubcategorySelection = (type, params) => {
        if (type === 'report_problem') return handleMainMenuSelection('report_problem');
        if (type === 'category') return handleCategorySelection('category', [chatState.context.categoryKey]);

        const subKey = params[0];
        const { categoryKey } = chatState.context;
        
        setChatState(prev => ({
            ...prev,
            current: 'CONFIRMING_ESCALATION',
            context: { ...prev.context, subcategoryKey: subKey }
        }));

        const solution = knowledgeBase.casos_soporte[categoryKey].categorias[subKey];
        const pasos = solution.pasos.join('<br>');

        addMessage({
            text: `Ok, para <strong>"${solution.titulo}"</strong>, intenta estos pasos:<br><br>${pasos}<br><br>--------------------<br><strong>${solution.titulo_confirmacion}</strong>`,
            buttons: [
                { text: "✅ Sí, se solucionó", action: "solved" },
                { text: "❌ No, necesito ayuda", action: "escalate" },
                { text: "🔙 Atrás", action: `category:${categoryKey}` }
            ]
        });
    };

    const handleEscalationLogic = (type, params) => {
        if (type === 'solved') {
            addMessage({ text: "¡Excelente! Me alegra haberte ayudado. 👍" });
            setTimeout(displayMainMenu, 2000);
            return;
        }
        
        if (type === 'escalate') {
            const { categoryKey, subcategoryKey } = chatState.context;
            const solution = knowledgeBase.casos_soporte[categoryKey].categorias[subcategoryKey];
            
            if (solution.opciones_finales && solution.opciones_finales.length > 0) {
                askFinalOption(0);
            } else {
                startDescriptionPhase();
            }
            return;
        }
        
        if (type.startsWith('final_option')) {
            const index = parseInt(params[0]);
            if (type.includes('solved')) {
                addMessage({ text: "¡Genial! Me alegro." });
                setTimeout(displayMainMenu, 2000);
            } else {
                askFinalOption(index + 1);
            }
        }
    };

    const askFinalOption = (index) => {
        const { categoryKey, subcategoryKey } = chatState.context;
        const solution = knowledgeBase.casos_soporte[categoryKey].categorias[subcategoryKey];
        const options = solution.opciones_finales || [];

        if (index >= options.length) {
            startDescriptionPhase();
        } else {
            setChatState(prev => ({ ...prev, current: 'ASKING_FINAL_OPTIONS' }));
            const opt = options[index];
            addMessage({
                text: `Prueba esto:<br><strong>${opt.titulo}</strong><br>${opt.descripcion}`,
                buttons: [
                    { text: "✅ Funcionó", action: `final_option_solved:${index}` },
                    { text: "❌ No funcionó", action: `final_option_failed:${index}` }
                ]
            });
        }
    };

    const startDescriptionPhase = () => {
        setChatState(prev => ({ ...prev, current: 'DESCRIBING_ISSUE' }));
        addMessage({
            text: "📝 <strong>Describe tu problema detalladamente</strong><br>Puedes pegar imágenes (Ctrl+V) o adjuntar archivos con el clip.",
            sender: 'bot'
        });
    };
    
    const handlePolicySelection = (key) => {
        const p = knowledgeBase.politicas[key];
        addMessage({
            text: `<strong>${p.titulo}</strong><br><br>${p.contenido.replace(/\n/g, '<br>')}`,
            buttons: [{ text: "🔙 Volver", action: "consult_policies" }]
        });
    };

    const handleSend = () => {
        const text = inputText.trim();
        if (!text) return;
        addMessage({ text, sender: 'user' });
        setInputText('');

        if (chatState.current === 'DESCRIBING_ISSUE') {
            setChatState(prev => ({ 
                ...prev, 
                context: { ...prev.context, problemDescription: text } 
            }));
            askAdminPreference();
        } else {
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                addMessage({ text: "Por favor, utiliza los botones para seleccionar una opción." });
            }, 800);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // --- API CALLS ---
    const askAdminPreference = async () => {
        setChatState(prev => ({ ...prev, current: 'SELECTING_PREFERENCE' }));
        setIsTyping(true);
        try {
            const response = await api.get('/admins/');
            const admins = response.data;
            setIsTyping(false);

            if (!Array.isArray(admins)) throw new Error('Error en formato de admins');

            const buttons = admins.map(a => ({
                text: `👤 ${a.nombreCompleto || a.username || a.nombre || 'Técnico'}`,
                action: `set_preference:${a.username || a.nombre || 'auto'}`
            }));
            
            buttons.push({ text: "🎲 Asignación Automática", action: "set_preference:none" });

            addMessage({
                text: "👥 <strong>Selecciona un técnico</strong> para tu ticket:",
                buttons
            });

        } catch (error) {
            console.error("Error fetching admins:", error);
            setIsTyping(false);
            addMessage({
                text: "⚠️ No se pudo cargar la lista de técnicos. Se asignará automáticamente.",
                sender: 'bot'
            });
            setTimeout(() => {
                createTicketWithAttachments(null);
            }, 2000);
        }
    };

    const createTicketWithAttachments = async (preferredAdmin) => {
        setIsTyping(true);
        try {
            const ticketData = {
                context: chatState.context,
                user: { ...user },
                preferred_admin: preferredAdmin
            };
            const response = await api.post('/tickets/', ticketData);
            const result = response.data;
            
            let uploaded = 0;
            let failed = 0;
            
            if (chatState.context.attachedFiles.length > 0) {
                const ticketIdReal = result.ticket_cod_ticket;
                const uploadPromises = chatState.context.attachedFiles.map(async (file) => {
                    try {
                       await uploadToS3(ticketIdReal, file);
                       uploaded++;
                       return { success: true, filename: file.name };
                    } catch (uploadError) {
                        failed++;
                        return { success: false, filename: file.name, error: uploadError.message };
                    }
                });
                await Promise.all(uploadPromises);
            }

            setIsTyping(false);
            let messageText = `✅ <strong>Ticket #${result.ticket_id_ticket || result.ticket_cod_ticket} creado!</strong><br>`;
            if (result.assigned_to) messageText += `Asignado a: <strong>${result.assigned_to}</strong><br>`;
            messageText += `Archivos subidos a S3: ${uploaded}`;
            if (failed > 0) messageText += `<br><span style="color: #f59e0b;">⚠️ ${failed} archivo(s) fallaron</span>`;
            
            addMessage({ text: messageText });

            setTimeout(() => {
                setChatState(prev => ({
                    ...prev,
                    context: { ...prev.context, attachedFiles: [] } 
                }));
            });
            setTimeout(() => { displayMainMenu(); }, 4000);

        } catch (error) {
            console.error('Error creando ticket:', error);
            setIsTyping(false);
            let errorMessage = '❌ Error creando ticket';
            if (error.response?.data?.error) errorMessage += `: ${error.response.data.error}`;
            else if (error.message) errorMessage += `: ${error.message}`;
            addMessage({ text: errorMessage });
            setTimeout(() => displayMainMenu(), 3000);
        }
    };

    const handleFileSelect = (e) => {
       if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        setChatState(prev => ({
            ...prev,
            context: {
                ...prev.context,
                attachedFiles: [...prev.context.attachedFiles, ...files]
            }
        }));
    }
    if (fileInputRef.current) fileInputRef.current.value = ''; 
    };

    const handlePaste = (e) => {
        if (chatState.current !== 'DESCRIBING_ISSUE') return;
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                setChatState(prev => ({
                    ...prev,
                    context: {
                        ...prev.context,
                        attachedFiles: [...prev.context.attachedFiles, file]
                    }
                }));
            }
        }
    };

    const removeFile = (index) => {
        setChatState(prev => {
            const newFiles = [...prev.context.attachedFiles];
            newFiles.splice(index, 1);
            return {
                ...prev,
                context: { ...prev.context, attachedFiles: newFiles }
            };
        });
    };

  const renderStars = (ticket) => {
    // 1. DEFINIR EL ID CORRECTO:
    // A veces viene como 'id', a veces como 'ticket_cod_ticket'. 
    // Usamos '||' para agarrar el que exista.
    const ticketIdReal = ticket.ticket_cod_ticket || ticket.id;

    return (
        <div className="stars-container">
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    style={{ 
                        cursor: 'pointer', 
                        fontSize: '1.2rem',
                        // Colorear si la estrella es menor o igual a la calificación actual
                        color: star <= (ticket.calificacion || 0) ? '#FFD700' : '#ccc' 
                    }}
                    onClick={() => {
                        console.log("Intentando calificar ticket ID:", ticketIdReal); // Para depurar
                        if (!ticketIdReal) {
                            alert("Error: No se encuentra el ID del ticket");
                            return;
                        }
                        // 2. USAR EL ID REAL AQUÍ:
                        handleRateTicket(ticketIdReal, star); 
                    }}
                >
                    ★
                </span>
            ))}
        </div>
    );
};
    // --- NUEVO: Función para traducir los estados ---
    const getStatusConfig = (statusCode) => {
        switch (statusCode) {
            case 'PE':
                return { label: 'Pendiente', className: 'status-pendiente' };
            case 'FN':
                return { label: 'Finalizado', className: 'status-finalizado' };
            // Puedes agregar más casos aquí si tienes otros estados (ej: 'PR' -> Proceso)
            default:
                return { label: statusCode || 'Desconocido', className: 'status-default' };
        }
    };

    // --- RENDERIZADO (JSX) ---
    return (
        <div className="chat-wrapper">
            <div className="chat-container">
                {/* HEADER */}
                <div className="chat-header">
                    <div className="header-left">
                        <div className="logo">
                            <div className="logo-icon"><i className="fas fa-headset"></i></div>
                            <div className="title-group">
                                <h2>Asistente TI</h2>
                                <p>En línea</p>
                            </div>
                        </div>
                    </div>
                    <div className="header-actions">
                         {/* --- NUEVO: Botón Mis Tickets (Para todos los usuarios) --- */}
                        <button 
                            className="theme-toggle" 
                            onClick={() => {
                                setShowTickets(!showTickets);
                                if (!showTickets) fetchUserTickets();
                            }}
                            title="Mis Tickets"
                            style={{ marginRight: '10px' }}
                        >
                            <i className="fas fa-ticket-alt"></i>
                        </button>

                        {/* Botón Admin solo para ADMINS */}
                        {user?.rol === 'SISTEMAS_ADMIN' && (
                            <button className="admin-header-btn" onClick={() => navigate('/admin')}>
                                <i className="fas fa-cog"></i> <span>Admin</span>
                            </button>
                        )}
                        <button className="theme-toggle" onClick={toggleTheme}>
                            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                        </button>
                    </div>
                </div>

                {/* --- NUEVO: PANEL LATERAL DE TICKETS --- */}
                {showTickets && (
                    <div className="tickets-sidebar">
                        <div className="tickets-header">
                            <h3>Mis Tickets</h3>
                            <button onClick={() => setShowTickets(false)} className="close-btn">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                     <div className="tickets-list">
    {loadingTickets ? (
        <p style={{padding: '20px', textAlign: 'center'}}>Cargando...</p>
    ) : userTickets.length === 0 ? (
        <p style={{padding: '20px', textAlign: 'center', opacity: 0.7}}>No tienes tickets recientes.</p>
    ) : (
        userTickets.map(ticket => {
            // 1. Obtenemos la config (texto y clase) basada en el código 'PE', 'FN', etc.
            const statusConfig = getStatusConfig(ticket.ticket_est_ticket);
            
            return (
                <div key={ticket.id || ticket.ticket_cod_ticket} className="ticket-card-mini">
                    <div className="ticket-mini-header">
                        <span className="ticket-id">#{ticket.id || ticket.ticket_cod_ticket}</span>
                        
                        {/* 2. Usamos la clase y el label traducido */}
                        <span className={`ticket-status ${statusConfig.className}`}>
                            {statusConfig.label}
                        </span>
                    </div>
                    
                    <p className="ticket-subject">{ticket.asunto || ticket.titulo || "Sin asunto"}</p>
                    <small className="ticket-date">
                        {new Date(ticket.fecha_creacion).toLocaleDateString()}
                    </small>
                    
                    {/* 3. CONDICIÓN ESTRICTA: Solo mostrar estrellas si es 'FN' */}
                    {ticket.ticket_est_ticket === 'FN' && (
                        <div className="ticket-rating-section">
                            <p style={{fontSize: '0.8rem', margin: '5px 0'}}>Calificar atención:</p>
                            {renderStars(ticket)}
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
                        {messages.map((msg) => (
                            <div key={msg.id} className={`message ${msg.sender}-message`}>
                                <div className="message-avatar">
                                    <i className={`fas ${msg.sender === 'user' ? 'fa-user' : 'fa-robot'}`}></i>
                                </div>
                                <div className="message-content">
                                    <div className="message-text" dangerouslySetInnerHTML={{ __html: msg.text }}></div>
                                    {msg.buttons && msg.buttons.length > 0 && (
                                        <div className="message-buttons">
                                            {msg.buttons.map((btn, idx) => (
                                                <button key={idx} className="message-btn" onClick={() => handleAction(btn.action)}>
                                                    {btn.text}
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
                    
                    {/* PREVIEW DE ARCHIVOS */}
                    {chatState.context.attachedFiles.length > 0 && (
                        <div className="file-sidebar">
                            <div className="file-sidebar-header">
                                <h4>
                                    <i className="fas fa-paperclip"></i>
                                    Archivos ({chatState.context.attachedFiles.length})
                                </h4>
                                <button className="close-sidebar-btn" onClick={() => setChatState(prev => ({ ...prev, context: { ...prev.context, attachedFiles: [] } }))}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                            <div className="file-sidebar-list">
                                {chatState.context.attachedFiles.map((file, idx) => (
                                    <div key={idx} className="file-sidebar-item">
                                        <div className="file-sidebar-icon">
                                            <i className="fas fa-file"></i>
                                        </div>
                                        <div className="file-sidebar-info">
                                            <span className="file-sidebar-name">{file.name}</span>
                                            <span className="file-sidebar-size">{(file.size/1024).toFixed(1)} KB</span>
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

                {/* INPUT AREA */}
                <div className="chat-input-container">
                    <div className="input-wrapper">
                        <textarea 
                            id="userInput" 
                            rows="1" 
                            placeholder="Escribe tu mensaje..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={handleKeyPress}
                            onPaste={handlePaste}
                        ></textarea>
                        
                        <div className="input-actions">
                            <input 
                                type="file" multiple style={{display:'none'}} ref={fileInputRef} onChange={handleFileSelect}
                            />
                            {chatState.current === 'DESCRIBING_ISSUE' && (
                                <button className="action-btn attach-btn" onClick={() => fileInputRef.current.click()} title="Adjuntar archivo">
                                    <i className="fas fa-paperclip"></i>
                                </button>
                            )}
                            <button className="action-btn send-btn" onClick={handleSend} title="Enviar">
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