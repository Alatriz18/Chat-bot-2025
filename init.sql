-- Crear esquema si no existe
CREATE SCHEMA IF NOT EXISTS soporte_ti;

-- Configurar search_path para el usuario
ALTER USER chatbot_user SET search_path TO soporte_ti;

-- Crear tablas (si no existen)
CREATE TABLE IF NOT EXISTS soporte_ti.stticket (
    ticket_cod_ticket SERIAL PRIMARY KEY,
    ticket_id_ticket VARCHAR(50) UNIQUE,
    ticket_des_ticket TEXT,
    ticket_tip_ticket VARCHAR(50),
    ticket_est_ticket VARCHAR(2),
    ticket_asu_ticket VARCHAR(255),
    ticket_fec_ticket TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ticket_tusua_ticket VARCHAR(100),
    ticket_cie_ticket VARCHAR(100),
    ticket_asignado_a VARCHAR(100),
    ticket_preferencia_usuario VARCHAR(100),
    ticket_calificacion INTEGER
);

CREATE TABLE IF NOT EXISTS soporte_ti.starchivos (
    archivo_cod_archivo SERIAL PRIMARY KEY,
    archivo_cod_ticket INTEGER REFERENCES soporte_ti.stticket(ticket_cod_ticket),
    archivo_nom_archivo VARCHAR(255),
    archivo_tip_archivo VARCHAR(50),
    archivo_tam_archivo BIGINT,
    archivo_rut_archivo VARCHAR(500),
    archivo_usua_archivo VARCHAR(100),
    archivo_fec_archivo TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS soporte_ti.stlogchat (
    log_cod_log SERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    username VARCHAR(100),
    action_type VARCHAR(100),
    action_value TEXT,
    bot_response TEXT,
    log_fec_log TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de prueba
INSERT INTO soporte_ti.stticket (
    ticket_id_ticket, ticket_des_ticket, ticket_tip_ticket, 
    ticket_est_ticket, ticket_asu_ticket, ticket_tusua_ticket,
    ticket_cie_ticket, ticket_asignado_a
) VALUES 
    ('TKT-20240101-0001', 'Problema con el software de contabilidad', 'Software', 'PE', 'Error en cálculo de impuestos', 'usuario1', '1', 'admin'),
    ('TKT-20240101-0002', 'Computadora no enciende', 'Hardware', 'FN', 'Equipo sin energía', 'usuario2', '2', 'soporte'),
    ('TKT-20240101-0003', 'Configuración de red', 'Software', 'PE', 'No puede acceder a recursos compartidos', 'usuario3', '3', NULL)
ON CONFLICT (ticket_id_ticket) DO NOTHING;