import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios'; 
// Importamos los estilos específicos
import '../styles/Chat.css'; 

// Ajusta esto si tu variable de entorno se llama diferente
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
// Función para subir archivo a S3
const uploadToS3 = async (ticketId, file) => {
    try {
        const token = localStorage.getItem('jwt_token');
        
        // 1. Obtener URL firmada del backend
        const presignedResponse = await fetch(`${API_BASE_URL}/tickets/${ticketId}/generate-presigned-url/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                filename: file.name,
                filetype: file.type,
                filesize: file.size
            })
        });
        
        const presignedData = await presignedResponse.json();
        
        if (!presignedResponse.ok) {
            throw new Error(presignedData.error || 'Error obteniendo URL firmada');
        }
        
        // 2. Subir archivo DIRECTAMENTE a S3 (sin pasar por Django)
        const uploadResponse = await fetch(presignedData.upload_url, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
                'x-amz-acl': 'private'
            },
            body: file
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Error subiendo archivo a S3');
        }
        
        // 3. Confirmar subida a Django
        const confirmResponse = await fetch(`${API_BASE_URL}/tickets/${ticketId}/confirm-upload/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                s3_key: presignedData.s3_key,
                filename: file.name,
                filetype: file.type,
                filesize: file.size
            })
        });
        
        const confirmData = await confirmResponse.json();
        
        if (!confirmResponse.ok) {
            throw new Error(confirmData.error || 'Error confirmando subida');
        }
        
        return confirmData;
        
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
    
    // --- 2. ESTADO DEL CHAT (Tu máquina de estados) ---
    const [chatState, setChatState] = useState({
        current: 'SELECTING_ACTION', // El estado inicial
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
    
    // Panel lateral de tickets
    const [showTickets, setShowTickets] = useState(false);
    const [userTickets, setUserTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    // Referencias para DOM (Scroll y Input de Archivos)
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // --- 4. EFECTOS (Lifecycle) ---

    // Cargar Knowledge Base al inicio
    useEffect(() => {
        const init = async () => {
            try {
                // Fetch desde la carpeta public/
                const res = await fetch('/knowledge_base.json');
                const data = await res.json();
                setKnowledgeBase(data);

                // Mensaje de Bienvenida
                const nombre = user?.nombreCompleto || user?.username || 'Usuario';
                addMessage({ 
                    text: `¡Hola, <strong>${nombre}</strong>! 👋 Soy tu asistente virtual de TI. ¿Cómo puedo ayudarte hoy?`,
                    sender: 'bot'
                });

                // Mostrar menú principal tras un breve delay
                setTimeout(() => displayMainMenu(data), 500);
            } catch (error) {
                console.error("Error cargando knowledge_base:", error);
                addMessage({ text: "Error cargando la configuración del chat.", sender: 'bot' });
            }
        };
        if (user) init();
    }, [user]); // Se ejecuta cuando tenemos usuario

    // Auto-scroll al recibir mensajes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // --- 5. FUNCIONES CORE (Lógica del Chat) ---

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
            context: { ...prev.context, attachedFiles: [] } // Limpiamos archivos al volver al inicio
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

    // --- MANEJADOR PRINCIPAL DE ACCIONES (Tu switch gigante) ---
    const handleAction = (action) => {
        const [type, ...params] = action.split(':');
        
        // Simular pensamiento del bot
        setIsTyping(true);

        setTimeout(() => {
            setIsTyping(false);
            
            // Navegación Global
            if (type === 'main_menu') return displayMainMenu();

            // Máquina de Estados
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

    // --- SUB-HANDLERS (Lógica específica) ---

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
            // Revisar si hay opciones finales antes de pedir descripción
            const { categoryKey, subcategoryKey } = chatState.context;
            const solution = knowledgeBase.casos_soporte[categoryKey].categorias[subcategoryKey];
            
            if (solution.opciones_finales && solution.opciones_finales.length > 0) {
                // Aquí iría la lógica de askFinalOption, simplificada:
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

    // --- MANEJO DE ENTRADAS DE USUARIO ---

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
            // Pasamos a seleccionar preferencia de admin
            askAdminPreference();
        } else {
            // Si escribe en un momento donde debe usar botones
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

    // --- API CALLS Y GESTIÓN DE ARCHIVOS ---

  const askAdminPreference = async () => {
        setChatState(prev => ({ ...prev, current: 'SELECTING_PREFERENCE' }));
        setIsTyping(true);
        try {
            // Usando Axios (que maneja cookies automáticamente)
            const response = await api.get('/admins/');
            const admins = response.data;
            
            setIsTyping(false);

            console.log('Admins recibidos:', admins);

            // Verificar que admins sea un array
            if (!Array.isArray(admins)) {
                console.error('Admins no es un array:', admins);
                throw new Error('Error en formato de admins');
            }

            const buttons = admins.map(a => ({
                text: `👤 ${a.nombreCompleto || a.username || a.nombre || 'Técnico'}`,
                action: `set_preference:${a.username || a.nombre || 'auto'}`
            }));
            
            // Botón de asignación automática
            buttons.push({ 
                text: "🎲 Asignación Automática", 
                action: "set_preference:none" 
            });

            addMessage({
                text: "👥 <strong>Selecciona un técnico</strong> para tu ticket:",
                buttons
            });

        } catch (error) {
            console.error("Error fetching admins:", error);
            setIsTyping(false);
            
            // Mostrar mensaje de error y continuar
            addMessage({
                text: "⚠️ No se pudo cargar la lista de técnicos. Se asignará automáticamente.",
                sender: 'bot'
            });
            
            // Crear ticket sin preferencia después de un delay
            setTimeout(() => {
                createTicketWithAttachments(null);
            }, 2000);
        }
    };

    const createTicketWithAttachments = async (preferredAdmin) => {
        setIsTyping(true);
        
        try {
            // 1. Crear Ticket usando Axios
            const ticketData = {
                context: chatState.context,
                user: { ...user },
                preferred_admin: preferredAdmin
            };

            console.log('Creando ticket con datos:', ticketData);

            const response = await api.post('/tickets/', ticketData);
            const result = response.data;
            
            console.log('Ticket creado:', result);

            // 2. Subir Archivos a S3 si hay
            let uploaded = 0;
            let failed = 0;
            
            if (chatState.context.attachedFiles.length > 0) {
                const uploadPromises = chatState.context.attachedFiles.map(async (file) => {
                    try {
                        await uploadToS3(result.ticket_id || result.id, file);
                        uploaded++;
                        return { success: true, filename: file.name };
                    } catch (uploadError) {
                        console.error('❌ Error subiendo archivo:', file.name, uploadError);
                        failed++;
                        return { success: false, filename: file.name, error: uploadError.message };
                    }
                });
                
                await Promise.all(uploadPromises);
            }

            setIsTyping(false);
            
            let messageText = `✅ <strong>Ticket #${result.ticket_id || result.id} creado!</strong><br>`;
            
            if (result.assigned_to) {
                messageText += `Asignado a: <strong>${result.assigned_to}</strong><br>`;
            }
            
            messageText += `Archivos subidos a S3: ${uploaded}`;
            
            if (failed > 0) {
                messageText += `<br><span style="color: #f59e0b;">⚠️ ${failed} archivo(s) fallaron</span>`;
            }
            
            addMessage({
                text: messageText
            });

            setTimeout(() => {
                // Limpiar archivos después de enviar
                setChatState(prev => ({
                    ...prev,
                    context: { ...prev.context, attachedFiles: [] }
                }));
                displayMainMenu();
            }, 5000);

        } catch (error) {
            console.error('Error creando ticket:', error);
            setIsTyping(false);
            
            let errorMessage = '❌ Error creando ticket';
            if (error.response?.data?.error) {
                errorMessage += `: ${error.response.data.error}`;
            } else if (error.message) {
                errorMessage += `: ${error.message}`;
            }
            
            addMessage({ text: errorMessage });
            setTimeout(() => displayMainMenu(), 3000);
        }
    };
    const handleFileSelect = (e) => {
       if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        console.log("✅ Archivos seleccionados:", files);

        setChatState(prev => ({
            ...prev,
            context: {
                ...prev.context,
                attachedFiles: [...prev.context.attachedFiles, ...files]
            }
        }));
    } else {
        console.log("⚠️ No se seleccionaron archivos");
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = ''; 
    }
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
       {/* Botón Admin solo para ADMINS */}
{user?.rol === 'SISTEMAS_ADMIN' && (
    <button 
        className="admin-header-btn" 
        onClick={() => navigate('/admin')}  // <-- Cambia esto
    >
        <i className="fas fa-cog"></i> <span>Admin</span>
    </button>
)}
        <button className="theme-toggle" onClick={toggleTheme}>
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
                    </div>
                </div>

                {/* MAIN AREA */}
                <div className="chat-main">
                    <div className="chat-messages" id="chatMessages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`message ${msg.sender}-message`}>
                                <div className="message-avatar">
                                    <i className={`fas ${msg.sender === 'user' ? 'fa-user' : 'fa-robot'}`}></i>
                                </div>
                                <div className="message-content">
                                    {/* IMPORTANTE: Renderizar HTML de manera segura */}
                                    <div className="message-text" dangerouslySetInnerHTML={{ __html: msg.text }}></div>
                                    
                                    {msg.buttons && msg.buttons.length > 0 && (
                                        <div className="message-buttons">
                                            {msg.buttons.map((btn, idx) => (
                                                <button 
                                                    key={idx} 
                                                    className="message-btn" 
                                                    onClick={() => handleAction(btn.action)}
                                                >
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
                        
                        {/* Dummy div para auto-scroll */}
                        <div ref={messagesEndRef} />

                       
                      
                    </div>
                             {/* PREVIEW DE ARCHIVOS */}
                             {chatState.context.attachedFiles.length > 0 && (
        <div className="file-preview-modal"> {/* Nota: Cambié la clase a -modal */}
            <div className="file-preview-header">
                <h4>📎 Archivos Adjuntos ({chatState.context.attachedFiles.length})</h4>
                {/* Botón opcional para minimizar/cerrar si quisieras */}
            </div>
            <div className="files-list">
                {chatState.context.attachedFiles.map((file, idx) => (
                    <div key={idx} className="file-item">
                        <div className="file-icon"><i className="fas fa-file"></i></div>
                        <div className="file-info">
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{(file.size/1024).toFixed(1)} KB</span>
                        </div>
                        <button className="remove-file" onClick={() => removeFile(idx)}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )}
    {/* --- FIN DEL MODAL --- */}
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
                type="file" 
                multiple 
                style={{display:'none'}} 
                ref={fileInputRef}
                onChange={handleFileSelect}
            />
            {/* Botón Adjuntar: Solo visible en la fase de descripción */}
            {chatState.current === 'DESCRIBING_ISSUE' && (
                <button 
                    className="action-btn attach-btn" 
                    onClick={() => fileInputRef.current.click()}
                    title="Adjuntar archivo"
                >
                    <i className="fas fa-paperclip"></i>
                </button>
            )}
            
            {/* CAMBIO AQUÍ: Elimina el id y cambia la clase */}
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