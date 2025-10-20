const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const mysql = require('mysql2/promise');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Configuración de WebSocket
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  perMessageDeflate: false
});

// Almacenar conexiones WebSocket por usuario
const wsConnections = new Map();

// Función para enviar mensaje a todos los clientes conectados
const broadcastToAll = (message) => {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

// Función para enviar mensaje a usuarios específicos
const sendToUser = (userId, message) => {
  const connection = wsConnections.get(userId);
  if (connection && connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify(message));
    
  }
};

// Manejo de conexiones WebSocket
wss.on('connection', (ws, req) => {
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Manejar diferentes tipos de mensajes
      if (data.type === 'register') {
        // Registrar conexión por usuario
        wsConnections.set(data.userId, ws);
        ws.userId = data.userId;
      }
    } catch (error) {
    }
  });
  
  ws.on('close', () => {
    if (ws.userId) {
      wsConnections.delete(ws.userId);
    }
  });
  
  ws.on('error', (error) => {
  });
});

// Configuración de encriptación bidireccional
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi_clave_secreta_de_32_caracteres_123456'; // 32 caracteres
const ALGORITHM = 'aes-256-cbc';

// Función para encriptar contraseñas
function encryptPassword(password) {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const result = iv.toString('hex') + ':' + encrypted;
    return result;
  } catch (error) {
    throw error; // Re-lanzar el error para que se maneje arriba
  }
}

// Función para desencriptar contraseñas
function decryptPassword(encryptedPassword) {
  try {
    const textParts = encryptedPassword.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return encryptedPassword; // Fallback sin desencriptar
  }
}

// Configurar trust proxy para Passenger/cPanel
app.set('trust proxy', 1);

// Configuración CORS dinámico para producción
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
if (allowedOrigins.length === 0) {
  // Fallback para desarrollo
  allowedOrigins.push('http://localhost:3000');
}

// Middleware CORS - Configuración permisiva para producción
app.use(cors({
  origin: true, // Permitir todos los orígenes
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(cookieParser());

// Middleware para manejar preflight requests
app.options('*', cors());

// Configuración de base de datos MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sistema_puerta',
  charset: 'utf8mb4'
};

// Pool de conexiones MySQL
const pool = mysql.createPool(dbConfig);

// Función para ejecutar queries
const executeQuery = async (query, params = []) => {
  try {
    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {

    throw error;
  }
};

// ========================================
// FUNCIONES DE CONFIGURACIÓN DEL SISTEMA
// ========================================

// Función para crear tabla de sesiones si no existe
async function createSessionsTable() {
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        device_fingerprint VARCHAR(16) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        invalidated_at DATETIME NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_device (user_id, device_fingerprint),
        INDEX idx_token_hash (token_hash),
        INDEX idx_expires_at (expires_at),
        INDEX idx_last_activity (last_activity),
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // Agregar columna last_activity si no existe (para tablas existentes)
    try {
      await executeQuery(`
        ALTER TABLE user_sessions 
        ADD COLUMN IF NOT EXISTS last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
      `);
      
      await executeQuery(`
        ALTER TABLE user_sessions 
        ADD INDEX IF NOT EXISTS idx_last_activity (last_activity)
      `);
    } catch (error) {
      // La columna ya existe o hay otro error, continuar
    }
    
  } catch (error) {
  }
}

// Función para crear tabla de notificaciones del sistema (en español)
async function createSystemNotificationsTable() {
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS notificaciones_sistema (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo ENUM('login_exitoso', 'login_fallido', 'logout') NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        mensaje TEXT NOT NULL,
        nombre_usuario VARCHAR(100) NULL,
        direccion_ip VARCHAR(45) NULL,
        severidad ENUM('bajo', 'medio', 'alto', 'critico') DEFAULT 'bajo',
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
  } catch (error) {
  }
}

// Función para inicializar usuario maestro automáticamente
async function initializeMasterAdmin() {
  try {
    
    // Verificar si la funcionalidad está habilitada
    const masterAdminEnabled = process.env.MASTER_ADMIN_ENABLED !== 'false';
    
    if (!masterAdminEnabled) {
      return;
    }

    // Configuración del usuario maestro desde variables de entorno
    const masterAdmin = {
      username: process.env.MASTER_ADMIN_USERNAME || 'admin',
      email: process.env.MASTER_ADMIN_EMAIL || 'admin@sistema.com',
      password: process.env.MASTER_ADMIN_PASSWORD || 'admin123',
      rol: 'admin',
      nombre: process.env.MASTER_ADMIN_NAME || 'Administrador',
      apellido: 'Sistema'
    };

    // Verificar si ya existe algún usuario administrador
    const existingAdmins = await executeQuery(
      'SELECT id, username, email, rol FROM usuarios WHERE rol = ?',
      ['admin']
    );

    
    if (existingAdmins.length > 0) {
      existingAdmins.forEach(admin => {
      });
      return;
    }

    
    // Verificar si el usuario maestro específico ya existe
    const existingMaster = await executeQuery(
      'SELECT id, username, email FROM usuarios WHERE username = ? OR email = ?',
      [masterAdmin.username, masterAdmin.email]
    );

    
    if (existingMaster.length > 0) {
      existingMaster.forEach(user => {
      });
      return;
    }

    // Crear usuario maestro
    const encryptedPassword = encryptPassword(masterAdmin.password);
    
    
    const result = await executeQuery(
      'INSERT INTO usuarios (username, email, password, rol, nombre, apellido, activo, fecha_creado_user) VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())',
      [masterAdmin.username, masterAdmin.email, encryptedPassword, masterAdmin.rol, masterAdmin.nombre, masterAdmin.apellido]
    );

   
  } catch (error) {
   
  }
}

// Obtener configuración específica de la base de datos
async function getConfig(clave) {
  try {
    const [rows] = await executeQuery(
      'SELECT valor FROM configuracion_sistema WHERE clave = ? AND activo = TRUE',
      [clave]
    );
    
    if (Array.isArray(rows) && rows.length > 0) {
      // Parsear el JSON si es un string
      const valor = rows[0].valor;
      const parsedValue = typeof valor === 'string' ? JSON.parse(valor) : valor;
      return parsedValue;
    } else if (rows && rows.valor) {
      // Si la respuesta no es un array pero tiene la propiedad valor
      const valor = rows.valor;
      const parsedValue = typeof valor === 'string' ? JSON.parse(valor) : valor;
      return parsedValue;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Actualizar configuración en la base de datos
async function updateConfig(clave, valor, modificadoPor) {
  try {
    await executeQuery(
      `INSERT INTO configuracion_sistema (clave, valor, modificado_por) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       valor = VALUES(valor), 
       modificado_por = VALUES(modificado_por),
       fecha_modificacion = CURRENT_TIMESTAMP`,
      [clave, JSON.stringify(valor), modificadoPor]
    );
    return true;
  } catch (error) {
    return false;
  }
}

// Cargar toda la configuración del sistema
async function loadAllConfig() {
  try {
    const [rows] = await executeQuery(
      'SELECT clave, valor FROM configuracion_sistema WHERE activo = TRUE'
    );
    
  
    const config = {};
    
    // Manejar tanto arrays como objetos directos
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        // Parsear el JSON si es un string
        const valor = row.valor;
        config[row.clave] = typeof valor === 'string' ? JSON.parse(valor) : valor;
      });
    } else if (rows && typeof rows === 'object') {
      // Si es un objeto directo, procesarlo
      const valor = rows.valor;
      config[rows.clave] = typeof valor === 'string' ? JSON.parse(valor) : valor;
    }
    
    
    return config;
  } catch (error) {
 
    return null;
  }
}

// Obtener configuración de Node-RED SOLO desde BD (sin fallback)
async function getNodeRedConfigFromDB() {
  const nodeRedConfig = await getConfig('node_red');
  
  if (nodeRedConfig && nodeRedConfig.url) {
    return nodeRedConfig.url;
  }
  
  throw new Error('No se encontró configuración de Node-RED en la base de datos');
}

// Obtener configuración de Node-RED (con fallback para compatibilidad)
async function getNodeRedConfig() {
  try {
    return await getNodeRedConfigFromDB();
  } catch (error) {
    // Solo fallback a variable de entorno si no hay configuración en BD
    const fallbackUrl = process.env.NODE_RED_URL || 'http://localhost:1880/datosRecibidos';
    return fallbackUrl;
  }
}

// Obtener configuración de horarios
async function getHorariosConfig() {
  const horariosConfig = await getConfig('horarios');
  if (horariosConfig) {
    return horariosConfig;
  }
  // Solo fallback a configuración por defecto si no hay configuración en BD
  return {
    lunesViernes: { inicio: '08:00', fin: '18:00', habilitado: true },
    sabados: { inicio: '09:00', fin: '14:00', habilitado: true },
    domingos: { inicio: '10:00', fin: '12:00', habilitado: false }
  };
}

// Función para validar si un timestamp está dentro de horarios laborales
function isWithinWorkingHours(timestamp, horariosConfig) {
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
  const currentTime = date.toTimeString().slice(0, 5); // HH:MM
  
  let schedule;
  
  // Determinar qué horario aplicar
  if (dayOfWeek === 0) { // Domingo
    schedule = horariosConfig.domingos;
  } else if (dayOfWeek === 6) { // Sábado
    schedule = horariosConfig.sabados;
  } else { // Lunes a Viernes
    schedule = horariosConfig.lunesViernes;
  }
  
  // Si el día no está habilitado, está fuera de horario
  if (!schedule.habilitado) {
    return false;
  }
  
  // Verificar si está dentro del rango de horas
  return currentTime >= schedule.inicio && currentTime <= schedule.fin;
}

// Función auxiliar para obtener información de horarios laborales
function getWorkingHoursInfo(timestamp, horariosConfig) {
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay();
  
  let schedule;
  let dayName;
  
  if (dayOfWeek === 0) {
    schedule = horariosConfig.domingos;
    dayName = 'Domingo';
  } else if (dayOfWeek === 6) {
    schedule = horariosConfig.sabados;
    dayName = 'Sábado';
  } else {
    schedule = horariosConfig.lunesViernes;
    dayName = 'Lunes-Viernes';
  }
  
  return {
    dayName: dayName,
    isEnabled: schedule.habilitado,
    workingHours: schedule.habilitado ? `${schedule.inicio} - ${schedule.fin}` : 'No laborable',
    isWithinHours: isWithinWorkingHours(timestamp, horariosConfig)
  };
}

// Configuración del sistema (solo fallback para casos extremos)
// NOTA: La configuración principal viene de la base de datos

// Función para generar fingerprint del dispositivo
function generateDeviceFingerprint(req) {
  const acceptLanguage = req.get('Accept-Language') || '';
  const acceptEncoding = req.get('Accept-Encoding') || '';
  const connection = req.get('Connection') || '';
  const userAgent = req.get('User-Agent') || '';
  
  // Crear fingerprint estable basado en características del navegador
  // NO incluir IP para permitir cambio de red (WiFi ↔ Datos móviles)
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${acceptLanguage}-${acceptEncoding}-${connection}-${userAgent}`)
    .digest('hex')
    .substring(0, 16); // Usar solo primeros 16 caracteres
  
  return fingerprint;
}

// Función para validar sesión activa y renovar automáticamente
async function validateActiveSession(userId, deviceFingerprint, ip) {
  try {
    // Verificar si existe una sesión activa para este usuario y device fingerprint
    // NO usar IP porque cambia al cambiar de red (WiFi ↔ Datos móviles)
    const sessions = await executeQuery(
      'SELECT * FROM user_sessions WHERE user_id = ? AND device_fingerprint = ? AND is_active = TRUE AND expires_at > NOW()',
      [userId, deviceFingerprint]
    );
    
    if (sessions.length > 0) {
      // Sesión encontrada - Renovar automáticamente la actividad y actualizar IP
      await executeQuery(
        'UPDATE user_sessions SET last_activity = NOW(), ip_address = ? WHERE user_id = ? AND device_fingerprint = ? AND is_active = TRUE',
        [ip, userId, deviceFingerprint]
      );
      
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// Función para crear nueva sesión
async function createUserSession(userId, deviceFingerprint, ip, token) {
  try {
    // Crear sesión persistente (sin expiración fija)
    // La sesión se mantiene activa mientras haya actividad del usuario
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 año como máximo
    
    await executeQuery(
      'INSERT INTO user_sessions (user_id, device_fingerprint, ip_address, token_hash, expires_at, created_at, is_active, last_activity) VALUES (?, ?, ?, ?, ?, NOW(), TRUE, NOW())',
      [userId, deviceFingerprint, ip, crypto.createHash('sha256').update(token).digest('hex'), expiresAt]
    );
    
    return true;
  } catch (error) {
    return false;
  }
}

// Función para invalidar sesiones anteriores
async function invalidatePreviousSessions(userId, currentDeviceFingerprint) {
  try {
    // Solo invalidar sesiones de otros dispositivos, no del mismo dispositivo
    // Esto permite que el mismo dispositivo mantenga la sesión al cambiar de red
    await executeQuery(
      'UPDATE user_sessions SET is_active = FALSE, invalidated_at = NOW() WHERE user_id = ? AND device_fingerprint != ? AND is_active = TRUE',
      [userId, currentDeviceFingerprint]
    );
    return true;
  } catch (error) {
    return false;
  }
}

// Función para limpiar sesiones inactivas
async function cleanupExpiredSessions() {
  try {
    // Limpiar sesiones inactivas por más de 30 días
    const result = await executeQuery(
      'DELETE FROM user_sessions WHERE (last_activity < DATE_SUB(NOW(), INTERVAL 30 DAY) AND is_active = TRUE) OR is_active = FALSE OR expires_at < NOW()'
    );
    return result.affectedRows || 0;
  } catch (error) {
    return 0;
  }
}

// Función para obtener estadísticas de sesiones
async function getSessionStats() {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN is_active = TRUE AND expires_at > NOW() THEN 1 END) as active_sessions,
        COUNT(CASE WHEN is_active = TRUE AND last_activity > DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as recently_active_sessions,
        COUNT(CASE WHEN is_active = TRUE AND last_activity < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as inactive_week_sessions,
        COUNT(CASE WHEN is_active = TRUE AND last_activity < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as inactive_month_sessions,
        COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_sessions,
        COUNT(CASE WHEN is_active = FALSE THEN 1 END) as invalidated_sessions
      FROM user_sessions
    `);
    
    return stats[0];
  } catch (error) {
    return null;
  }
}

// Función para registrar eventos de login exitoso
async function logLoginSuccessEvent(data) {
  try {
    const eventData = {
      tipo: 'login_exitoso',
      titulo: 'Inició sesión',
      mensaje: `${data.username} inició sesión desde ${data.ip}`,
      nombre_usuario: data.username,
      direccion_ip: data.ip,
      severidad: 'bajo',
      fecha_creacion: new Date()
    };
    
    await executeQuery(
      'INSERT INTO notificaciones_sistema (tipo, titulo, mensaje, nombre_usuario, direccion_ip, severidad, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [eventData.tipo, eventData.titulo, eventData.mensaje, eventData.nombre_usuario, eventData.direccion_ip, eventData.severidad, eventData.fecha_creacion]
    );
    
  } catch (error) {
  }
}

// Función para registrar eventos de login fallido
async function logLoginFailedEvent(data) {
  try {
    const eventData = {
      tipo: 'login_fallido',
      titulo: 'Intento de login fallido',
      mensaje: `Intento de login fallido para ${data.attemptedUsername} desde ${data.ip}`,
      nombre_usuario: data.attemptedUsername,
      direccion_ip: data.ip,
      severidad: 'medio',
      fecha_creacion: new Date()
    };
    
    await executeQuery(
      'INSERT INTO notificaciones_sistema (tipo, titulo, mensaje, nombre_usuario, direccion_ip, severidad, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [eventData.tipo, eventData.titulo, eventData.mensaje, eventData.nombre_usuario, eventData.direccion_ip, eventData.severidad, eventData.fecha_creacion]
    );
    
  } catch (error) {
  }
}

// Función para registrar eventos de logout
async function logLogoutEvent(data) {
  try {
    const eventData = {
      tipo: 'logout',
      titulo: 'Cerró sesión',
      mensaje: `${data.username} cerró sesión`,
      nombre_usuario: data.username,
      direccion_ip: data.ip,
      severidad: 'bajo',
      fecha_creacion: new Date()
    };
    
    await executeQuery(
      'INSERT INTO notificaciones_sistema (tipo, titulo, mensaje, nombre_usuario, direccion_ip, severidad, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [eventData.tipo, eventData.titulo, eventData.mensaje, eventData.nombre_usuario, eventData.direccion_ip, eventData.severidad, eventData.fecha_creacion]
    );
    
  } catch (error) {
  }
}

// Middleware de autenticación con tokens permanentes y validación de sesión
const authenticateToken = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ 
      message: 'Token no encontrado',
      tokenInvalid: true,
      autoLogout: true
    });
  }

  try {
    // Generar fingerprint del dispositivo actual
    const deviceFingerprint = generateDeviceFingerprint(req);
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    // Desencriptar token de cookies para comparar con BD
    const decryptedToken = decryptPassword(token);
    
    // Buscar usuario por token en texto plano en la base de datos
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE token = ? AND activo = TRUE',
      [decryptedToken]
    );

    if (users.length === 0) {
      return res.status(403).json({ 
        message: 'Token inválido o usuario inactivo',
        tokenInvalid: true,
        autoLogout: true,
        possibleCause: 'Admin refresh executed'
      });
    }

    const validUser = users[0];
    
    // VALIDACIÓN DE SEGURIDAD: Verificar sesión activa
    const hasValidSession = await validateActiveSession(validUser.id, deviceFingerprint, clientIP);
    
    if (!hasValidSession) {
      return res.status(403).json({ 
        message: 'Sesión inválida. Token posiblemente inyectado desde otro dispositivo.',
        tokenInvalid: true,
        autoLogout: true,
        securityAlert: true,
        possibleAttack: 'Token injection detected'
      });
    }

    req.user = {
      id: validUser.id,
      username: validUser.username,
      role: validUser.rol,
      nombre: validUser.nombre,
      apellido: validUser.apellido,
      email: validUser.email
    };
    
    
    req.deviceFingerprint = deviceFingerprint;
    req.clientIP = clientIP;
    
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Middleware para verificar rol admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador' });
  }
  next();
};



// Función para validar IP
const isValidIP = (ip) => {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

// Función para validar horario
const isValidTime = (time) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

// Rutas de autenticación
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cookieToken = req.cookies.token;

    // PASO 1: Verificar si existe token válido en cookies (LOGIN AUTOMÁTICO)
    if (cookieToken) {
      
      // Desencriptar token de cookies para comparar con BD
      const decryptedCookieToken = decryptPassword(cookieToken);
      
      // Buscar usuario por token en texto plano en la base de datos
      const users = await executeQuery(
        'SELECT * FROM usuarios WHERE token = ? AND activo = TRUE',
        [decryptedCookieToken]
      );

      const user = users.length > 0 ? users[0] : null;

      if (user) {
        
        // CORRECCIÓN CRÍTICA: Verificar que el token pertenece al usuario solicitado
        if (user.username !== username) {
          
        } else if (!user.token_activo) {
          return res.status(403).json({ 
            message: 'Token encontrado pero no activado. Debe activar el token antes de iniciar sesión.',
            hasToken: true,
            tokenNotActivated: true
          });
        } else {
          
          // IMPORTANTE: Siempre validar contraseña, incluso con token válido
          const decryptedPassword = decryptPassword(user.password);
          if (password !== decryptedPassword) {
            
            // Registrar evento de login fallido
            await logLoginFailedEvent({
              attemptedUsername: username,
              reason: 'invalid_password',
              ip: req.ip || req.connection.remoteAddress || '',
              userAgent: req.get('User-Agent')
            });
            
            return res.status(401).json({ message: 'Credenciales inválidas' });
          }
          
        
          // Renovar cookie por 1 año
          res.cookie('token', cookieToken, {
            httpOnly: false, // Permitir acceso desde JS
            secure: process.env.NODE_ENV === 'production', // HTTPS en producción
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            domain: process.env.COOKIE_DOMAIN || undefined,
            maxAge: 365 * 24 * 60 * 60 * 1000,
            path: '/'
          });
          
          // Establecer cookie de sesión para indicar que el usuario está logueado
          res.cookie('user_logged_in', 'true', {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            domain: process.env.COOKIE_DOMAIN || undefined,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
            path: '/'
          });
          

          // Crear sesión de usuario para el dispositivo actual
          const deviceFingerprint = generateDeviceFingerprint(req);
          const clientIP = req.ip || req.connection.remoteAddress || '';
          
          // Invalidar sesiones anteriores del mismo usuario
          await invalidatePreviousSessions(user.id, deviceFingerprint);
          
          // Crear nueva sesión
          await createUserSession(user.id, deviceFingerprint, clientIP, decryptedCookieToken);

          // Registrar evento de login exitoso
          await logLoginSuccessEvent({
            username: user.username,
            userId: user.id,
            role: user.rol,
            ip: clientIP,
            userAgent: req.get('User-Agent'),
            deviceFingerprint: deviceFingerprint
          });

          return res.json({
            success: true,
            message: 'Login automático exitoso',
            user: {
              id: user.id,
              username: user.username,
              role: user.rol,
              nombre: user.nombre,
              apellido: user.apellido
            }
          });
        }
      }
    }

    // PASO 2: Validación normal por credenciales
    
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE username = ? AND activo = TRUE',
      [username]
    );

    if (users.length === 0) {
      // Registrar evento de login fallido
      await logLoginFailedEvent({
        attemptedUsername: username,
        reason: 'user_not_found',
        ip: req.ip || req.connection.remoteAddress || '',
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Verificar contraseña con sistema bidireccional
    const decryptedPassword = decryptPassword(user.password);
    if (password !== decryptedPassword) {
      // Registrar evento de login fallido
      await logLoginFailedEvent({
        attemptedUsername: username,
        reason: 'invalid_password',
        ip: req.ip || req.connection.remoteAddress || '',
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // PASO 3: Usuario con token - Verificar si está activado
    if (user.token) {
      // Verificar si el token está activado (token_activo = 1)
      if (!user.token_activo) {
        return res.status(403).json({ 
          message: '❌ Token asignado pero no activado. Debe activar el token antes de iniciar sesión.',
          hasToken: true,
          tokenNotActivated: true
        });
      }

      // Token está activado - Verificar si este dispositivo ya tiene el token activado
      const cookieToken = req.cookies.token;
   
      // Desencriptar token de cookies para comparar con BD
      const decryptedCookieToken = decryptPassword(cookieToken);
      
      if (decryptedCookieToken === user.token) {
        // Token ya activado en este dispositivo - Validar contraseña antes de login directo
        
        // IMPORTANTE: Siempre validar contraseña, incluso con token coincidente
        const decryptedPassword = decryptPassword(user.password);
        if (password !== decryptedPassword) {
          
          // Registrar evento de login fallido
          await logLoginFailedEvent({
            attemptedUsername: username,
            reason: 'invalid_password',
            ip: req.ip || req.connection.remoteAddress || '',
            userAgent: req.get('User-Agent')
          });
          
          return res.status(401).json({ message: 'Credenciales inválidas' });
        }
        
        
        // Encriptar token antes de guardarlo en cookies para seguridad en el navegador
        const encryptedCookieToken = encryptPassword(user.token);
        
        res.cookie('token', encryptedCookieToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          domain: process.env.COOKIE_DOMAIN || undefined,
          maxAge: 365 * 24 * 60 * 60 * 1000,
          path: '/'
        });
        
        // Establecer cookie de sesión para indicar que el usuario está logueado
        res.cookie('user_logged_in', 'true', {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          domain: process.env.COOKIE_DOMAIN || undefined,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
          path: '/'
        });
       
        
        return res.json({
          success: true,
          message: 'Login exitoso',
          user: {
        id: user.id, 
        username: user.username, 
            role: user.rol,
            nombre: user.nombre,
            apellido: user.apellido
          }
        });
      } else {
        // Token existe y está activado pero no en este dispositivo
        return res.status(403).json({ 
          message: '❌ Este dispositivo no tiene autorización. Contacte al administrador.',
          hasToken: true 
        });
      }
    }

    // PASO 4: Generación de token SOLO si está autorizado por admin
    // CONDICIONES CRÍTICAS DE SEGURIDAD:
    // - token DEBE ser NULL (autorizado por admin para nuevo token)
    // - token_activo DEBE ser 0 (autorizado por admin para activación)
 
    
    let generatedToken = null; // Variable para almacenar el token generado
    
    if (user.token !== null) {

      return res.status(403).json({
        success: false,
        message: 'Token existente no autorizado para nueva activación. Contacte al administrador.',
        hasToken: true,
        tokenExists: true,
        requiresAdminRefresh: true
      });
    } else if (user.token === null && user.token_activo === 0) {
    
      generatedToken = crypto.randomBytes(4).toString('hex'); // Token de 8 caracteres (4 bytes = 8 hex chars)

      // Guardar token en texto plano en BD para consultas eficientes
      await executeQuery(
        'UPDATE usuarios SET token = ?, fecha_token = NOW(), token_activo = 1, ultima_activacion = NOW() WHERE id = ?',
        [generatedToken, user.id]
      );

      // Encriptar token antes de guardarlo en cookies para seguridad en el navegador
      const encryptedCookieToken = encryptPassword(generatedToken);
      
      res.cookie('token', encryptedCookieToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/'
      });

     } else {
 
      return res.status(403).json({
        success: false,
        message: 'Estado de token inconsistente. Contacte al administrador.',
        hasToken: user.token !== null,
        inconsistentState: true,
        requiresAdminRefresh: true
      });
    }

    // Solo enviar respuesta si se generó un token válido
    if (generatedToken) {
      
      // Enviar notificación via WebSocket a todos los admins conectados
      broadcastToAll({
        type: 'token_generated',
        data: {
          username: user.username,
          userId: user.id,
          token: generatedToken,
          timestamp: new Date().toISOString()
        }
      });

    // Crear sesión de usuario para el dispositivo actual
    const deviceFingerprint = generateDeviceFingerprint(req);
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    // Invalidar sesiones anteriores del mismo usuario
    await invalidatePreviousSessions(user.id, deviceFingerprint);
    
    // Crear nueva sesión
    await createUserSession(user.id, deviceFingerprint, clientIP, generatedToken);

    // Registrar evento de login exitoso
    await logLoginSuccessEvent({
      username: user.username,
      userId: user.id,
      role: user.rol,
      ip: clientIP,
      userAgent: req.get('User-Agent'),
      deviceFingerprint: deviceFingerprint
      });

    res.json({
        success: true,
        message: 'Dispositivo activado automáticamente. Acceso autorizado.',
      user: {
        id: user.id,
        username: user.username,
          role: user.rol,
          nombre: user.nombre,
          apellido: user.apellido
        },
        autoActivated: true
      });
    } else {
      return res.status(500).json({
        message: 'Error: No se pudo generar token. Contacte al administrador.'
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para registrar nuevos usuarios (solo admin)
app.post('/api/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    
    const { username, email, password, rol, nombre, apellido, telefono, jefe_id } = req.body;

    // Verificar si el username ya existe (solo username, no email)
    const existingUsers = await executeQuery(
      'SELECT * FROM usuarios WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }


    // Encriptar contraseña con sistema bidireccional
    const encryptedPassword = encryptPassword(password);

    // Crear nuevo usuario
    const result = await executeQuery(
      'INSERT INTO usuarios (username, email, password, rol, nombre, apellido, telefono, activo, fecha_creado_user, jefe_id) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), ?)',
      [username, email, encryptedPassword, rol || 'user', nombre || '', apellido || '', telefono || null, jefe_id || null]
    );


    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: result.insertId,
        username,
        email,
        role: rol || 'user',
        nombre: nombre || '',
        apellido: apellido || ''
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
});

// Ruta para abrir puerta (con respuesta inmediata y procesamiento asíncrono)
app.post('/api/abrir-puerta', authenticateToken, async (req, res) => {
  try {
    
    // Preparar datos para Node-RED
    const datosPuerta = {
      accion: "Activa",
      timestamp: req.body.timestamp || new Date().toISOString(),
      usuario: req.user.username,
      id_usuario: req.user.id,
      rol: req.user.role
    };

    // Agregar datos de geolocalización si están disponibles
    if (req.body.location) {
      datosPuerta.lat = req.body.location.lat;
      datosPuerta.lon = req.body.location.lon;
      datosPuerta.precision = req.body.location.accuracy;
    } else {
    }

    // VALIDACIÓN DE DUPLICADOS: Verificar si ya existe un registro para este usuario en los últimos 5 segundos
    const duplicateCheck = await executeQuery(
      'SELECT COUNT(*) as count FROM historial_aperturas WHERE usuario_id = ? AND timestamp > DATE_SUB(NOW(), INTERVAL 5 SECOND)',
      [req.user.id]
    );

      if (duplicateCheck[0].count > 0) {
        return res.json({
          message: 'Solicitud duplicada - Espera antes de intentar nuevamente',
          status: 'duplicate',
          canOpenDoor: false,
          timestamp: new Date().toISOString()
        });
    }

    // 🆕 VALIDACIÓN DE PERMISOS DE ACCESO
    const validacionPermisos = await validarPermisoAcceso(req.user.id);
    
    if (!validacionPermisos.permite) {
      
      // Registrar intento denegado en historial_aperturas
      await executeQuery(
        'INSERT INTO historial_aperturas (usuario_id, status, message, location_lat, location_lon, location_accuracy) VALUES (?, ?, ?, ?, ?, ?)',
        [
          req.user.id,
          'denegado_horario',
          validacionPermisos.mensaje,
          req.body.location?.lat || null,
          req.body.location?.lon || null,
          req.body.location?.accuracy || null
        ]
      );
      
      return res.json({
        success: false,
        message: validacionPermisos.mensaje,
        status: 'denegado_horario',
        canOpenDoor: false,
        timestamp: new Date().toISOString()
      });
    }
    

    // 1. GUARDAR INMEDIATAMENTE EN BD CON STATUS 'PROCESSING'
    const result = await executeQuery(
      'INSERT INTO historial_aperturas (usuario_id, status, message, location_lat, location_lon, location_accuracy) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        'processing',
        'Solicitud enviada a Node-RED',
        datosPuerta.lat || null,
        datosPuerta.lon || null,
        datosPuerta.precision || null
      ]
    );

    const eventId = result.insertId;

    // 2. RESPONDER INMEDIATAMENTE AL FRONTEND (NO ESPERAR A NODE-RED)
    res.json({
      message: 'Solicitud de apertura enviada - Procesando...',
      status: 'processing',
      eventId: eventId,
      canOpenDoor: null, // Aún no se sabe
      timestamp: new Date().toISOString()
    });


  } catch (error) {
    res.status(500).json({ 
      message: 'Error interno del servidor',
      status: 'server_error',
      canOpenDoor: false,
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta para verificar token (verificación inicial sin autenticación previa)
app.get('/api/verify-token', async (req, res) => {
  try {
    const token = req.cookies.token;
    const userLoggedIn = req.cookies.user_logged_in;
    

    if (!token) {
      return res.status(401).json({ message: 'No hay token en cookies' });
    }
    
    // Si no hay cookie de sesión, no permitir login automático
    if (!userLoggedIn) {
      return res.status(401).json({ 
        message: 'Sesión cerrada. Ingrese sus credenciales para continuar.',
        sessionClosed: true
      });
    }

    // Desencriptar token de cookies para comparar con BD
    const decryptedToken = decryptPassword(token);
    
    // Buscar usuario por token en texto plano en la base de datos
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE token = ? AND activo = TRUE',
      [decryptedToken]
    );


    if (users.length === 0) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    const user = users[0];
    
    // CORRECCIÓN CRÍTICA: Verificar si token está activado
    if (!user.token_activo) {
      return res.status(403).json({ 
        message: 'Token encontrado pero no activado',
        tokenNotActivated: true
      });
    }


    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.rol,
        nombre: user.nombre,
        apellido: user.apellido
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
});

// Ruta para verificar token con autenticación (para middleware)
app.get('/api/verify-auth-token', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      nombre: req.user.nombre,
      apellido: req.user.apellido
    }
  });
});


// Ruta para obtener lista de usuarios (solo admin)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
   
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Consulta optimizada con paginación y búsqueda incluyendo información del jefe
    let query = `SELECT 
      u.id, u.username, u.email, u.rol, u.nombre, u.apellido, u.telefono, 
      u.activo, u.fecha_creado_user, u.token, u.fecha_token, u.jefe_id,
      j.nombre as jefe_nombre, j.apellido as jefe_apellido, j.username as jefe_username
    FROM usuarios u 
    LEFT JOIN usuarios j ON u.jefe_id = j.id`;
    
    const params = [];
    
    // Agregar filtro de búsqueda si existe
    if (search && search.trim() !== '') {
      query += ' WHERE (LOWER(u.username) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?) OR LOWER(u.nombre) LIKE LOWER(?) OR LOWER(u.apellido) LIKE LOWER(?))';
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY u.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const users = await executeQuery(query, params);
    
    // Obtener total para paginación
    let countQuery = 'SELECT COUNT(*) as total FROM usuarios u';
    const countParams = [];
    
    if (search && search.trim() !== '') {
      countQuery += ' WHERE (LOWER(u.username) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?) OR LOWER(u.nombre) LIKE LOWER(?) OR LOWER(u.apellido) LIKE LOWER(?))';
      const searchTerm = `%${search.trim()}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0]?.total || 0;
    
    const userList = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.rol,
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono,
      activo: user.activo,
      fecha_creado_user: user.fecha_creado_user,
      hasToken: !!user.token,
      fecha_token: user.fecha_token,
      jefe_id: user.jefe_id,
      jefe_nombre: user.jefe_nombre,
      jefe_apellido: user.jefe_apellido,
      jefe_username: user.jefe_username
    }));
    
    res.json({ 
      users: userList,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
});

// Ruta para obtener un usuario específico con contraseña (solo admin)
app.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const users = await executeQuery(
      'SELECT id, username, email, password, rol, nombre, apellido, telefono, activo, fecha_creado_user, token, fecha_token, jefe_id FROM usuarios WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = users[0];
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      password: decryptPassword(user.password), // Desencriptar contraseña para mostrar
      role: user.rol,
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono,
      activo: user.activo,
      fecha_creado_user: user.fecha_creado_user,
      hasToken: !!user.token,
      fecha_token: user.fecha_token,
      jefe_id: user.jefe_id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para obtener lista de jefes
app.get('/api/jefes', authenticateToken, async (req, res) => {
  try {
    
    // Retornar solo usuarios activos con rol 'jefe'
    const jefes = await executeQuery(
      'SELECT id, username, nombre, apellido FROM usuarios WHERE rol = ? AND activo = 1 ORDER BY nombre, apellido',
      ['jefe']
    );
    
    res.json(jefes);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ========================================
// ENDPOINTS PARA GESTIÓN DE PERMISOS ESPECIALES
// ========================================

// Endpoint para obtener usuarios asignados a un jefe (solo jefes)
app.get('/api/permisos-especiales/usuarios-asignados', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea jefe
    if (req.user.role !== 'jefe') {
      return res.status(403).json({ error: 'Solo los jefes pueden acceder a esta función' });
    }

    
    // Obtener usuarios asignados al jefe con conteo de permisos y último acceso
    const usuarios = await executeQuery(`
      SELECT 
        u.id, u.username, u.nombre, u.apellido, u.activo,
        COALESCE(
          (SELECT COUNT(*) 
           FROM permisos_entrada p 
           WHERE p.usuario_id = u.id 
             AND p.activo = TRUE 
             AND (p.fecha_fin IS NULL OR p.fecha_fin >= CURDATE())
          ), 0
        ) as permisos_activos,
        (SELECT MAX(timestamp) 
         FROM historial_aperturas h 
         WHERE h.usuario_id = u.id
        ) as ultimo_acceso
      FROM usuarios u
      WHERE u.jefe_id = ? AND u.activo = 1
      ORDER BY u.nombre, u.apellido
    `, [req.user.id]);
    
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener permisos de un usuario específico
app.get('/api/permisos-especiales/usuario/:id', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea jefe
    if (req.user.role !== 'jefe') {
      return res.status(403).json({ error: 'Solo los jefes pueden acceder a esta función' });
    }

    const usuarioId = parseInt(req.params.id);
    
    // Verificar que el usuario pertenezca al jefe
    const usuarioValido = await executeQuery(
      'SELECT id, username, nombre, apellido FROM usuarios WHERE id = ? AND jefe_id = ? AND activo = 1',
      [usuarioId, req.user.id]
    );
    
    if (usuarioValido.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o no asignado a este jefe' });
    }
    
    // Obtener permisos del usuario (solo activos y vigentes)
    const permisos = await executeQuery(`
      SELECT * FROM permisos_entrada 
      WHERE usuario_id = ? 
        AND activo = TRUE
        AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())
      ORDER BY fecha_creado DESC
    `, [usuarioId]);
    
    
    res.json({
      usuario: usuarioValido[0],
      permisos: permisos
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para crear nuevo permiso especial
app.post('/api/permisos-especiales', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea jefe
    if (req.user.role !== 'jefe') {
      return res.status(403).json({ error: 'Solo los jefes pueden crear permisos especiales' });
    }

    const { usuario_id, tipo, fecha_inicio, fecha_fin, hora_inicio, hora_fin, dias_semana, observaciones } = req.body;
    
    
    // Verificar que el usuario pertenezca al jefe
    const usuarioValido = await executeQuery(
      'SELECT id FROM usuarios WHERE id = ? AND jefe_id = ? AND activo = 1',
      [usuario_id, req.user.id]
    );
    
    if (usuarioValido.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado o no asignado a este jefe' });
    }
    
    // Validaciones básicas
    if (!tipo || !['horario_especial', 'dia_adicional', 'restriccion'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de permiso inválido' });
    }
    
    // Crear el permiso
    const result = await executeQuery(`
      INSERT INTO permisos_entrada 
      (usuario_id, jefe_id, tipo, fecha_inicio, fecha_fin, hora_inicio, hora_fin, dias_semana, observaciones) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [usuario_id, req.user.id, tipo, fecha_inicio || null, fecha_fin || null, hora_inicio || null, hora_fin || null, dias_semana || null, observaciones || null]);
    
    
    res.status(201).json({
      message: 'Permiso especial creado exitosamente',
      permiso: {
        id: result.insertId,
        usuario_id,
        tipo,
        fecha_inicio,
        fecha_fin,
        hora_inicio,
        hora_fin,
        dias_semana,
        observaciones
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para actualizar permiso especial
app.put('/api/permisos-especiales/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Actualizando permiso especial:', req.params.id);
    console.log('📋 Datos recibidos:', req.body);
    
    // Verificar que el usuario sea jefe
    if (req.user.role !== 'jefe') {
      console.log('❌ Usuario no es jefe:', req.user.role);
      return res.status(403).json({ error: 'Solo los jefes pueden modificar permisos especiales' });
    }

    const permisoId = parseInt(req.params.id);
    const { tipo, fecha_inicio, fecha_fin, hora_inicio, hora_fin, dias_semana, observaciones, activo } = req.body;
    
    console.log('📋 Datos procesados:', {
      permisoId,
      tipo,
      fecha_inicio,
      fecha_fin,
      hora_inicio,
      hora_fin,
      dias_semana,
      observaciones,
      activo
    });
        
    // Verificar que el permiso pertenezca al jefe
    const permisoValido = await executeQuery(
      'SELECT * FROM permisos_entrada WHERE id = ? AND jefe_id = ?',
      [permisoId, req.user.id]
    );
    
    if (permisoValido.length === 0) {
      console.log('❌ Permiso no encontrado o no pertenece al jefe');
      return res.status(404).json({ error: 'Permiso no encontrado o no pertenece a este jefe' });
    }
    
    console.log('✅ Permiso válido encontrado, procediendo con actualización');
    
    // Actualizar el permiso
    const result = await executeQuery(`
      UPDATE permisos_entrada 
      SET tipo = ?, fecha_inicio = ?, fecha_fin = ?, hora_inicio = ?, hora_fin = ?, 
          dias_semana = ?, observaciones = ?, activo = ?
      WHERE id = ? AND jefe_id = ?
    `, [tipo, fecha_inicio || null, fecha_fin || null, hora_inicio || null, hora_fin || null, 
        dias_semana || null, observaciones || null, activo !== undefined ? activo : true, permisoId, req.user.id]);
    
    console.log('✅ Permiso actualizado exitosamente');
        
    res.json({
      message: 'Permiso especial actualizado exitosamente',
      permiso: {
        id: permisoId,
        tipo,
        fecha_inicio,
        fecha_fin,
        hora_inicio,
        hora_fin,
        dias_semana,
        observaciones,
        activo
      }
    });
  } catch (error) {
    console.error('❌ Error actualizando permiso especial:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Endpoint para eliminar permiso especial
app.delete('/api/permisos-especiales/:id', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea jefe
    if (req.user.role !== 'jefe') {
      return res.status(403).json({ error: 'Solo los jefes pueden eliminar permisos especiales' });
    }

    const permisoId = parseInt(req.params.id);
        
    // Verificar que el permiso pertenezca al jefe
    const permisoValido = await executeQuery(
      'SELECT * FROM permisos_entrada WHERE id = ? AND jefe_id = ?',
      [permisoId, req.user.id]
    );
    
    if (permisoValido.length === 0) {
      return res.status(404).json({ error: 'Permiso no encontrado o no pertenece a este jefe' });
    }
    
    // Eliminar el permiso
    await executeQuery(
      'DELETE FROM permisos_entrada WHERE id = ? AND jefe_id = ?',
      [permisoId, req.user.id]
    );
        
    res.json({
      message: 'Permiso especial eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para actualizar usuario (solo admin)
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    
    const userId = parseInt(req.params.id);
    const { username, email, password, rol, nombre, apellido, telefono, jefe_id } = req.body;

    // Verificar si el usuario existe
    const existingUsers = await executeQuery(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar si el nuevo username ya existe en otro usuario (solo username, no email)
    const duplicateUsers = await executeQuery(
      'SELECT * FROM usuarios WHERE id != ? AND username = ?',
      [userId, username]
    );

    if (duplicateUsers.length > 0) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Obtener rol anterior para manejar cambio de jefe
    const rolAnterior = existingUsers[0].rol;

    // Si cambia de jefe a otro rol, limpiar jefe_id de usuarios asignados
    if (rolAnterior === 'jefe' && rol !== 'jefe') {
      const usuariosAfectados = await executeQuery(
        'SELECT COUNT(*) as count FROM usuarios WHERE jefe_id = ?',
        [userId]
      );
      
      if (usuariosAfectados[0].count > 0) {
        await executeQuery(
          'UPDATE usuarios SET jefe_id = NULL WHERE jefe_id = ?',
          [userId]
        );
      }
    }


    // Construir query de actualización
    let updateFields = ['username = ?', 'email = ?', 'rol = ?', 'nombre = ?', 'apellido = ?', 'telefono = ?', 'jefe_id = ?'];
    let updateValues = [username, email, rol, nombre, apellido, telefono || null, jefe_id || null];

    // Actualizar contraseña si se proporciona
    if (password && password.length >= 6) {
      try {
        const encryptedPassword = encryptPassword(password);
        updateFields.push('password = ?');
        updateValues.push(encryptedPassword);
      } catch (encryptError) {
        return res.status(500).json({ message: 'Error encriptando contraseña' });
      }
    } else if (password && password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    updateValues.push(userId);

    await executeQuery(
      `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Preparar mensaje de respuesta
    let responseMessage = 'Usuario actualizado exitosamente';
    let usuariosAfectados = 0;
    
    // Si cambió de jefe a otro rol, informar sobre usuarios afectados
    if (rolAnterior === 'jefe' && rol !== 'jefe') {
      const usuariosSinJefe = await executeQuery(
        'SELECT COUNT(*) as count FROM usuarios WHERE jefe_id IS NULL AND rol = ?',
        ['user']
      );
      usuariosAfectados = usuariosSinJefe[0].count;
      
      if (usuariosAfectados > 0) {
        responseMessage += `. ${usuariosAfectados} usuarios quedaron sin jefe asignado.`;
      }
    }

    res.json({
      message: responseMessage,
      usuariosAfectados: usuariosAfectados,
      user: {
        id: userId,
        username,
        email,
        role: rol,
        nombre,
        apellido
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// Ruta para eliminar usuario (solo admin)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Verificar si el usuario existe
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = users[0];

    // No permitir eliminar el último admin
    if (user.rol === 'admin') {
      const adminCount = await executeQuery(
        'SELECT COUNT(*) as count FROM usuarios WHERE rol = "admin"'
      );
      if (adminCount[0].count <= 1) {
        return res.status(400).json({ message: 'No se puede eliminar el último administrador' });
      }
    }

    // Eliminar usuario
    await executeQuery(
      'DELETE FROM usuarios WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Rutas de configuración del sistema (solo admin)
app.get('/api/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nodeRedConfig = await getConfig('node_red');
    const horariosConfig = await getConfig('horarios');

    // Construir respuesta SOLO con configuración de base de datos
    const config = {
      nodeRedUrl: nodeRedConfig?.url || null,
      horarios: horariosConfig || null
    };
    
   
    res.json({
      success: true,
      config: config
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


app.put('/api/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { nodeRedUrl, horarios } = req.body;
    const modificadoPor = req.user.username;

    // Validar IP si se proporciona
    if (nodeRedUrl) {
      const url = new URL(nodeRedUrl);
      const ip = url.hostname;
      if (!isValidIP(ip)) {
        return res.status(400).json({ message: 'IP de Node-RED inválida' });
      }
    }

    // Validar horarios si se proporcionan
    if (horarios) {
      const { lunesViernes, sabados, domingos } = horarios;
      
      if (lunesViernes) {
        if (lunesViernes.inicio && !isValidTime(lunesViernes.inicio)) {
          return res.status(400).json({ message: 'Horario de inicio inválido para lunes-viernes' });
        }
        if (lunesViernes.fin && !isValidTime(lunesViernes.fin)) {
          return res.status(400).json({ message: 'Horario de fin inválido para lunes-viernes' });
        }
      }

      if (sabados) {
        if (sabados.inicio && !isValidTime(sabados.inicio)) {
          return res.status(400).json({ message: 'Horario de inicio inválido para sábados' });
        }
        if (sabados.fin && !isValidTime(sabados.fin)) {
          return res.status(400).json({ message: 'Horario de fin inválido para sábados' });
        }
      }

      if (domingos) {
        if (domingos.inicio && !isValidTime(domingos.inicio)) {
          return res.status(400).json({ message: 'Horario de inicio inválido para domingos' });
        }
        if (domingos.fin && !isValidTime(domingos.fin)) {
          return res.status(400).json({ message: 'Horario de fin inválido para domingos' });
        }
      }
    }

    // Actualizar configuración en base de datos
    let configuracionActualizada = false;

    if (nodeRedUrl) {
      const nodeRedConfig = {
        url: nodeRedUrl,
        timeout: 5000,
        retry_attempts: 3,
        enabled: true
      };
      const resultado = await updateConfig('node_red', nodeRedConfig, modificadoPor);
      if (resultado) configuracionActualizada = true;
    }

    if (horarios) {
      const resultado = await updateConfig('horarios', horarios, modificadoPor);
      if (resultado) configuracionActualizada = true;
    }

    if (!configuracionActualizada) {
      return res.status(500).json({ message: 'Error al actualizar la configuración en base de datos' });
    }


    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      config: {
        nodeRedUrl: nodeRedUrl || null,
        horarios: horarios || null
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Función para limpiar solicitudes expiradas (más de 2 segundos)
async function limpiarSolicitudesExpiradas() {
  try {
    const result = await executeQuery(
      `UPDATE historial_aperturas 
       SET status = 'timeout', message = 'Solicitud expirada - No procesada por Node-RED'
       WHERE status = 'processing' 
       AND timestamp < DATE_SUB(NOW(), INTERVAL 2 SECOND)`,
      []
    );
    
    if (result.affectedRows > 0) {
    }
  } catch (error) {
  }
}

// Endpoint para que Node-RED consulte solicitudes pendientes (polling)
app.get('/api/solicitudes-pendientes', async (req, res) => {
  try {
    
    // Limpiar solicitudes expiradas antes de buscar nuevas
    await limpiarSolicitudesExpiradas();
    
    // Buscar la solicitud más antigua con status 'processing' de los últimos 2 segundos
    // Esto asegura que Node-RED (que consulta cada segundo) pueda leer la solicitud antes de que expire
    const solicitudesPendientes = await executeQuery(
      `SELECT 
        h.id, 
        h.usuario_id, 
        h.status, 
        h.message, 
        h.location_lat, 
        h.location_lon, 
        h.location_accuracy, 
        h.timestamp,
        u.username,
        u.rol
       FROM historial_aperturas h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.status = 'processing' 
       AND h.timestamp > DATE_SUB(NOW(), INTERVAL 2 SECOND)
       ORDER BY h.timestamp ASC 
       LIMIT 1`,
      []
    );

    if (solicitudesPendientes.length > 0) {
      const solicitud = solicitudesPendientes[0];
      

      // Responder con los datos de la solicitud
      res.json({
        haySolicitud: true,
        accion: "Activa",
        eventId: solicitud.id,
        usuario: solicitud.username,
        id_usuario: solicitud.usuario_id,
        rol: solicitud.rol,
        lat: solicitud.location_lat,
        lon: solicitud.location_lon,
        precision: solicitud.location_accuracy,
        timestamp: solicitud.timestamp,
        callbackUrl: `${process.env.BACKEND_URL || 'https://api-puerta.taqro.com.mx'}/api/node-red-callback`
      });
    } else {
      // No hay solicitudes pendientes
      res.json({
        haySolicitud: false
      });
    }
  } catch (error) {
    res.status(500).json({ 
      haySolicitud: false,
      error: 'Error al consultar solicitudes' 
    });
  }
});

// Ruta para callback de Node-RED (sin autenticación, validación por eventId)
app.post('/api/node-red-callback', async (req, res) => {
  try {
    const { eventId, status, message, result } = req.body;


    // 1. VALIDAR QUE SE PROPORCIONE eventId Y status
    if (!eventId || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'eventId y status son requeridos' 
      });
    }

    // 2. VERIFICAR QUE EL eventId EXISTA EN LA BD
    const existingEvent = await executeQuery(
      'SELECT id, status, timestamp FROM historial_aperturas WHERE id = ?',
      [eventId]
    );

    if (existingEvent.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Evento no encontrado' 
      });
    }

    // 3. VALIDAR QUE EL EVENTO ESTÉ EN ESTADO 'PROCESSING'
    if (existingEvent[0].status !== 'processing') {
      return res.status(400).json({ 
        success: false, 
        error: 'Evento ya fue procesado anteriormente' 
      });
    }

    // 4. VALIDAR QUE EL EVENTO SEA RECIENTE (últimos 5 minutos)
    const eventTime = new Date(existingEvent[0].timestamp);
    const now = new Date();
    const diffMinutes = (now - eventTime) / 1000 / 60;

    if (diffMinutes > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Evento expirado (más de 5 minutos)' 
      });
    }

    // 5. VALIDAR QUE EL status SEA VÁLIDO
    const validStatuses = ['correcto', 'fuera_de_area', 'incorrecto', 'advertencia'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status inválido. Debe ser: correcto, fuera_de_area, incorrecto o advertencia' 
      });
    }

    // 6. ACTUALIZAR EL REGISTRO EN BD
    await executeQuery(
      'UPDATE historial_aperturas SET status = ?, message = ? WHERE id = ?',
      [status, message || 'Procesado por Node-RED', eventId]
    );


    // 7. EMITIR WEBSOCKET PARA NOTIFICAR AL FRONTEND EN TIEMPO REAL
    if (wss) {
      const notification = {
        type: 'door_response',
        data: {
          eventId: eventId,
          status: status,
          message: message || 'Procesado',
          result: result,
          timestamp: new Date().toISOString()
        }
      };

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(notification));
        }
      });

    }

    res.json({ 
      success: true, 
      message: 'Callback procesado correctamente',
      eventId: eventId,
      status: status
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Error al procesar callback de Node-RED' 
    });
  }
});

// Endpoint para consultar el estado de una solicitud de puerta
app.get('/api/door-status/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
        
    const result = await executeQuery(
      'SELECT id, status, message, timestamp FROM historial_aperturas WHERE id = ?',
      [eventId]
    );
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Solicitud no encontrada' 
      });
    }
    
    const solicitud = result[0];
    
    res.json({
      success: true,
      eventId: solicitud.id,
      status: solicitud.status,
      message: solicitud.message,
      timestamp: solicitud.timestamp
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Error al consultar estado de la solicitud' 
    });
  }
});

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

// Ruta temporal para debuggear cookies
app.get('/api/debug-cookies', (req, res) => {

  
  // Establecer una cookie de prueba SIMPLE
  res.cookie('test-cookie', 'valor-prueba', {
    httpOnly: false, // Permitir acceso desde JS para debug
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: 60000, // 1 minuto
    path: '/'
  });
  
  res.json({ 
    message: 'Cookies debuggeadas',
    cookies: req.cookies,
    headers: req.headers.cookie,
    testCookieSet: 'Simple cookie establecida'
  });
});

// Ruta para activar token
app.post('/api/activate-token', async (req, res) => {
  try {
    const { token, username } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token requerido' });
    }

    if (!username) {
      return res.status(400).json({ message: 'Usuario requerido para validación de seguridad' });
    }

    // Buscar usuario por token en texto plano en la base de datos
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE token = ? AND activo = TRUE',
      [token]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Token inválido o usuario inactivo' });
    }

    const user = users[0];
    
    // VALIDACIÓN CRÍTICA DE SEGURIDAD: Verificar que el token pertenece al usuario correcto
    if (user.username !== username) {
      
      return res.status(403).json({ 
        message: 'Token no corresponde al usuario especificado. Contacte al administrador.',
        securityError: true,
        tokenOwner: user.username,
        requestedUser: username
      });
    }


    // Verificar si el token ya está activo en otro dispositivo
    const cookieToken = req.cookies.token;
    if (cookieToken) {
      // Desencriptar token de cookies para comparar
      const decryptedCookieToken = decryptPassword(cookieToken);
      if (decryptedCookieToken === token) {
      // Token ya activo en este dispositivo - VERIFICAR que esté realmente activado en BD
      
      if (user.token_activo) {
        // Confirmar que está realmente activado y establecer cookie fresca
        
          // Encriptar token antes de guardarlo en cookies para seguridad en el navegador
          const encryptedCookieToken = encryptPassword(token);
          
          res.cookie('token', encryptedCookieToken, {
          httpOnly: false, // CORREGIDO: Permitir acceso desde JS
          secure: false, // Cambiado a false para desarrollo
          sameSite: 'lax', // Cambiado a 'lax' para desarrollo
          maxAge: 365 * 24 * 60 * 60 * 1000,
          path: '/'
        });
        
        
        return res.json({
          success: true,
          message: 'Token ya está activado en este dispositivo',
          user: {
            id: user.id,
            username: user.username,
            role: user.rol,
            nombre: user.nombre,
            apellido: user.apellido
          }
        });
      } else {
        // Token en cookie pero no activado en BD - proceder con activación
        }
      }
    }

    // Verificar si hay otro dispositivo con este token activo
    const activeUsers = await executeQuery(
      'SELECT COUNT(*) as count FROM usuarios WHERE token = ? AND token_activo = 1',
      [user.token] // Usar el token en texto plano de la BD
    );

    if (activeUsers[0].count > 0) {
      return res.status(403).json({ 
        message: 'Token ya está activo en otro dispositivo. Contacte al administrador.' 
      });
    }

    const updateResult = await executeQuery(
      'UPDATE usuarios SET token_activo = 1, ultima_activacion = NOW() WHERE token = ?',
      [user.token] // Usar el token en texto plano de la BD
    );
    
    // Verificar que se actualizó correctamente
    const verification = await executeQuery(
      'SELECT token_activo, ultima_activacion FROM usuarios WHERE token = ?',
      [user.token] // Usar el token en texto plano de la BD
    );
    

    // Encriptar token antes de guardarlo en cookies para seguridad en el navegador
    const encryptedCookieToken = encryptPassword(token);
    
    res.cookie('token', encryptedCookieToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.COOKIE_DOMAIN || undefined,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/'
    });

  
    // Crear sesión de usuario para el dispositivo actual
    const deviceFingerprint = generateDeviceFingerprint(req);
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    // Invalidar sesiones anteriores del mismo usuario
    await invalidatePreviousSessions(user.id, deviceFingerprint);
    
    // Crear nueva sesión
    await createUserSession(user.id, deviceFingerprint, clientIP, token);

    // Enviar notificación via WebSocket de token activado
    broadcastToAll({
      type: 'token_activated',
      data: {
        username: user.username,
        userId: user.id,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: 'Dispositivo activado exitosamente',
        user: {
          id: user.id,
          username: user.username,
          role: user.rol,
          nombre: user.nombre,
          apellido: user.apellido
        }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta temporal para limpiar tokens (DEBUG)
app.post('/api/clear-tokens', async (req, res) => {
  try {
    await executeQuery('UPDATE usuarios SET token = NULL, fecha_token = NULL, token_activo = FALSE');
    res.json({ message: 'Tokens limpiados exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error limpiando tokens' });
  }
});

// Ruta específica para limpiar usuario admin
app.post('/api/reset-admin', async (req, res) => {
  try {
    await executeQuery(
      'UPDATE usuarios SET token = NULL, fecha_token = NULL, token_activo = FALSE WHERE username = "admin"'
    );
    // Limpiar cookie del navegador también
    res.clearCookie('token', { path: '/' });
    
    res.json({ message: 'Usuario admin reseteado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetendo admin' });
  }
});

// Ruta para obtener tokens pendientes (solo admin)
app.get('/api/pending-tokens', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await executeQuery(
      'SELECT id, username, nombre, apellido, token, fecha_token FROM usuarios WHERE token IS NOT NULL ORDER BY fecha_token DESC'
    );
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para revocar token del dispositivo actual (usuario logueado)
app.post('/api/revoke-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await executeQuery(
      'UPDATE usuarios SET token = NULL, fecha_token = NULL WHERE id = ?',
      [userId]
    );
    
    
    res.json({
      success: true,
      message: 'Token del dispositivo revocado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para revocar token (solo admin)
app.post('/api/revoke-token/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    await executeQuery(
      'UPDATE usuarios SET token = NULL, fecha_token = NULL WHERE id = ?',
      [userId]
    );
    
    res.json({
      message: 'Token revocado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para refrescar token (solo admin) - NUEVA FUNCIONALIDAD DE SEGURIDAD
app.post('/api/refresh-token/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
   
    // Obtener datos del usuario para verificación y logs
    const userInfo = await executeQuery('SELECT username, token, token_activo FROM usuarios WHERE id = ?', [userId]);
    
    if (userInfo.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = userInfo[0];
    
    // CRÍTICO: Limpiar token existente para autorizar nueva activación
    const updateResult = await executeQuery(
      'UPDATE usuarios SET token = NULL, fecha_token = NULL, token_activo = 0 WHERE id = ?',
      [userId]
    );
    
    // Enviar notificación via WebSocket de token refrescado
    broadcastToAll({
      type: 'token_refreshed',
      data: {
        username: user.username,
        userId: userId,
        refreshedBy: req.user.username,
        timestamp: new Date().toISOString()
      }
    });
    
    res.json({
      success: true,
      message: `Token refrescado exitosamente para ${user.username}`,
      username: user.username,
      action: 'token_refresh_authorized',
      previousToken: user.token ? 'had_active_token' : 'no_token',
      newStatus: 'authorized_for_activation'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para logout
app.post('/api/logout', authenticateToken, async (req, res) => {
  try {
    // Obtener información del usuario y IP para el log
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
    
    // Registrar evento de logout
    await logLogoutEvent({
      username: req.user.username,
      userId: req.user.id,
      role: req.user.role,
      ip: clientIP,
      userAgent: req.get('User-Agent')
    });
    
    // Limpiar solo la cookie de sesión, NO el token del dispositivo
    res.clearCookie('user_logged_in', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.COOKIE_DOMAIN || undefined,
      path: '/'
    });
    
   
    res.json({
      message: 'Logout exitoso - Token del dispositivo mantenido'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para registrar evento de apertura de puerta
app.post('/api/register-door-event', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      message, 
      location
    } = req.body;
    
    const userId = req.user.id;
    
     
    // Validar datos requeridos
    if (!status || !['correcto', 'incorrecto', 'fuera_de_area', 'advertencia'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Estado de evento inválido'
      });
    }
    
    // Preparar datos para inserción
    const eventData = {
      usuario_id: userId,
      status: status,
      message: message || '',
      location_lat: location?.lat || null,
      location_lon: location?.lon || null,
      location_accuracy: location?.accuracy || null
    };
    
    // Insertar evento en la base de datos
    const insertQuery = `
      INSERT INTO historial_aperturas 
      (usuario_id, status, message, location_lat, location_lon, location_accuracy)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const insertParams = [
      eventData.usuario_id,
      eventData.status,
      eventData.message,
      eventData.location_lat,
      eventData.location_lon,
      eventData.location_accuracy
    ];
    
    const result = await executeQuery(insertQuery, insertParams);
    
    
    // Emitir evento WebSocket para notificaciones en tiempo real
    if (wss) {
      const eventNotification = {
        type: 'door_event',
        data: {
          id: result.insertId,
          userId: userId,
          username: req.user.username,
          status: status,
          message: message,
          location: location,
          timestamp: new Date().toISOString()
        }
      };
      
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(eventNotification));
        }
      });
      
    }
    
    res.json({
      success: true,
      eventId: result.insertId,
      message: 'Evento de apertura registrado exitosamente'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al registrar evento de apertura'
    });
  }
});

// Ruta de prueba para verificar la tabla historial_aperturas
app.get('/api/history-test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    
    // Verificar que la tabla existe
    const tableCheck = await executeQuery(`
      SELECT COUNT(*) as table_exists 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'historial_aperturas'
    `);
    
    
    if (tableCheck[0]?.table_exists === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tabla historial_aperturas no existe',
        message: 'Ejecutar create_historial_aperturas_table.sql'
      });
    }
    
    // Verificar estructura de la tabla
    const structure = await executeQuery(`DESCRIBE historial_aperturas`);
    
    // Verificar datos en la tabla
    const count = await executeQuery(`SELECT COUNT(*) as total FROM historial_aperturas`);
    
    // Obtener algunos registros de ejemplo
    const sample = await executeQuery(`
      SELECT h.*, u.username, u.nombre, u.apellido, u.rol
      FROM historial_aperturas h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      LIMIT 3
    `);
    
    
    res.json({
      success: true,
      tableExists: true,
      totalRecords: count[0]?.total,
      structure: structure,
      sampleData: sample
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Ruta para obtener estadísticas de sesiones (solo admin)
app.get('/api/session-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await getSessionStats();
    
    if (!stats) {
      return res.status(500).json({ message: 'Error obteniendo estadísticas de sesiones' });
    }
    
    res.json({
      success: true,
      stats: {
        totalSessions: stats.total_sessions,
        activeSessions: stats.active_sessions,
        recentlyActiveSessions: stats.recently_active_sessions,
        inactiveWeekSessions: stats.inactive_week_sessions,
        inactiveMonthSessions: stats.inactive_month_sessions,
        expiredSessions: stats.expired_sessions,
        invalidatedSessions: stats.invalidated_sessions
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para obtener sesiones activas con detalles (solo admin)
app.get('/api/active-sessions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sessions = await executeQuery(`
      SELECT 
        us.id,
        us.user_id,
        us.device_fingerprint,
        us.ip_address,
        us.last_activity,
        us.created_at,
        u.username,
        u.nombre,
        u.apellido,
        u.rol
      FROM user_sessions us
      JOIN usuarios u ON us.user_id = u.id
      WHERE us.is_active = TRUE AND us.expires_at > NOW()
      ORDER BY us.last_activity DESC
      LIMIT 50
    `);
    
    res.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        userId: session.user_id,
        username: session.username,
        nombre: session.nombre,
        apellido: session.apellido,
        rol: session.rol,
        deviceFingerprint: session.device_fingerprint,
        ipAddress: session.ip_address,
        lastActivity: session.last_activity,
        createdAt: session.created_at,
        daysSinceActivity: Math.floor((new Date() - new Date(session.last_activity)) / (1000 * 60 * 60 * 24))
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint específico para notificaciones de login/logout - OPTIMIZADO
app.get('/api/login-notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
      
    const { type, limit = 50, offset = 0, hours = 24, user, dateFrom, dateTo } = req.query;
    
    // Consulta optimizada con índices
    let query = "SELECT id, tipo, titulo, mensaje, nombre_usuario, direccion_ip, severidad, fecha_creacion FROM notificaciones_sistema WHERE tipo IN ('login_exitoso', 'login_fallido', 'logout')";
    const params = [];
    
    // Filtro por horas (solo si se especifica explícitamente)
    if (req.query.forceHours === 'true' && !dateFrom && !dateTo) {
      query += ' AND fecha_creacion > DATE_SUB(NOW(), INTERVAL ? HOUR)';
      params.push(parseInt(hours));
    }
    
    // Filtro por tipo de notificación
    if (type) {
      // Mapear tipos del frontend a tipos de la BD
      const typeMapping = {
        'login_success': 'login_exitoso',
        'login_failed': 'login_fallido',
        'logout': 'logout'
      };
      const dbType = typeMapping[type] || type;
      query += ' AND tipo = ?';
      params.push(dbType);
    }
    
    // Filtro por usuario (búsqueda en nombre_usuario)
    if (user && user.trim() !== '') {
      query += ' AND LOWER(nombre_usuario) LIKE LOWER(?)';
      params.push(`%${user.trim()}%`);
    }
    
    // Filtro por rango de fechas
    if (dateFrom && dateFrom.trim() !== '') {
      query += ' AND DATE(fecha_creacion) >= ?';
      params.push(dateFrom);
    }
    
    if (dateTo && dateTo.trim() !== '') {
      query += ' AND DATE(fecha_creacion) <= ?';
      params.push(dateTo);
    }
    
    query += ' ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const notifications = await executeQuery(query, params);
    
    // Estadísticas optimizadas - solo si se solicitan
    let stats = [];
    if (req.query.includeStats === 'true') {
      stats = await executeQuery(`
        SELECT 
          tipo,
          COUNT(*) as count,
          DATE(fecha_creacion) as date
        FROM notificaciones_sistema 
        WHERE tipo IN ('login_exitoso', 'login_fallido', 'logout')
        AND fecha_creacion > DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY tipo, DATE(fecha_creacion)
        ORDER BY date DESC
        LIMIT 30
      `);
    }
    
    res.json({
      success: true,
      notifications: notifications,
      stats: stats,
      total: notifications.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para limpiar sesiones expiradas (solo admin)
app.post('/api/cleanup-sessions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const cleanedCount = await cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: `Sesiones limpiadas: ${cleanedCount}`,
      cleanedCount: cleanedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para obtener historial de aperturas con filtros avanzados (solo admin)
app.get('/api/history', authenticateToken, requireAdmin, async (req, res) => {
  try {

    
    const { status, dateFrom, dateTo, user, page = 1, limit = 10 } = req.query;
    
    
    // Construir query base
    let query = 'SELECT h.id, h.usuario_id, h.timestamp, h.status, h.message, h.location_lat, h.location_lon, h.location_accuracy, u.username, u.email, u.nombre, u.apellido, u.rol FROM historial_aperturas h LEFT JOIN usuarios u ON h.usuario_id = u.id WHERE 1=1';
    
    const params = [];
    
    // Filtro por estado
    if (status && status !== 'all') {
      query += ' AND h.status = ?';
      params.push(status);
    }
    
    // Filtro por rango de fechas
    if (dateFrom && dateFrom.trim() !== '') {
      query += ' AND DATE(h.timestamp) >= ?';
      params.push(dateFrom);
    }
    
    if (dateTo && dateTo.trim() !== '') {
      query += ' AND DATE(h.timestamp) <= ?';
      params.push(dateTo);
    }
    
    // Filtro por usuario (búsqueda en nombre, apellido, username, email)
    if (user && user.trim() !== '') {
      query += ' AND (LOWER(u.nombre) LIKE LOWER(?) OR LOWER(u.apellido) LIKE LOWER(?) OR LOWER(u.username) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))';
      params.push(`%${user.trim()}%`, `%${user.trim()}%`, `%${user.trim()}%`, `%${user.trim()}%`);
    }
    
    // Ordenar por fecha descendente
    query += ' ORDER BY h.timestamp DESC';
    
    // Paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    
    const history = await executeQuery(query, params);
    
    // Contar total de registros para paginación
    let countQuery = 'SELECT COUNT(*) as total FROM historial_aperturas h LEFT JOIN usuarios u ON h.usuario_id = u.id WHERE 1=1';
    
    const countParams = [];
    
    // Aplicar los mismos filtros para el conteo
    if (status && status !== 'all') {
      countQuery += ' AND h.status = ?';
      countParams.push(status);
    }
    
    if (dateFrom && dateFrom.trim() !== '') {
      countQuery += ' AND DATE(h.timestamp) >= ?';
      countParams.push(dateFrom);
    }
    
    if (dateTo && dateTo.trim() !== '') {
      countQuery += ' AND DATE(h.timestamp) <= ?';
      countParams.push(dateTo);
    }
    
    if (user && user.trim() !== '') {
      countQuery += ' AND (LOWER(u.nombre) LIKE LOWER(?) OR LOWER(u.apellido) LIKE LOWER(?) OR LOWER(u.username) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))';
      countParams.push(`%${user.trim()}%`, `%${user.trim()}%`, `%${user.trim()}%`, `%${user.trim()}%`);
    }
    
    const countResult = await executeQuery(countQuery, countParams);
    const totalRecords = parseInt(countResult[0]?.total || 0);
    const totalPages = Math.ceil(totalRecords / parseInt(limit));
    
    // Obtener configuración de horarios para validación
    const horariosConfig = await getHorariosConfig();
    
    // Formatear datos para el frontend
    const formattedHistory = history.map(record => ({
      id: record.id,
      timestamp: record.timestamp,
      status: record.status,
      message: record.message,
      location: record.location_lat && record.location_lon ? {
        lat: parseFloat(record.location_lat),
        lon: parseFloat(record.location_lon),
        accuracy: record.location_accuracy ? parseFloat(record.location_accuracy) : null
      } : null,
      username: record.username,
      email: record.email,
      nombre: record.nombre,
      apellido: record.apellido,
      role: record.rol,
      // Agregar validación de horarios laborales
      isWithinWorkingHours: isWithinWorkingHours(record.timestamp, horariosConfig),
      workingHoursInfo: getWorkingHoursInfo(record.timestamp, horariosConfig)
    }));
    
    res.json({
      success: true,
      history: formattedHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
        itemsPerPage: parseInt(limit)
      },
      filters: {
        status,
        dateFrom,
        dateTo,
        user
      }
    });
    
  } catch (error) {
    
    res.status(500).json({
      success: false,
      error: 'Error al cargar el historial de aperturas',
      details: error.message,
      code: error.code
    });
  }
});

// ========================================
// FUNCIONES DE VALIDACIÓN DE PERMISOS
// ========================================

// Función principal para validar permisos de acceso
async function validarPermisoAcceso(usuarioId) {
  try {
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
    const hora = ahora.toTimeString().split(' ')[0]; // HH:MM:SS
    const diaSemana = ahora.getDay(); // 0=Domingo, 1=Lunes, etc.
    
    // 0. PRIMERO: Verificar el rol del usuario
    const usuarioInfo = await executeQuery(
      'SELECT rol FROM usuarios WHERE id = ? AND activo = 1',
      [usuarioId]
    );
    
    if (usuarioInfo.length === 0) {
      return { permite: false, mensaje: 'Usuario no encontrado o inactivo' };
    }
    
    const rolUsuario = usuarioInfo[0].rol;
    
    // 🚀 ADMIN Y JEFE: Acceso libre sin restricciones de horario
    if (rolUsuario === 'admin' || rolUsuario === 'jefe') {
      console.log(`✅ Acceso libre para ${rolUsuario} - Sin restricciones de horario`);
      return { 
        permite: true, 
        mensaje: `Acceso permitido (${rolUsuario} - sin restricciones de horario)` 
      };
    }
    
    // 👤 USUARIO: Aplicar validaciones de horarios y permisos especiales
    console.log(`🔐 Validando permisos para usuario con rol: ${rolUsuario}`);
    
    // 1. Verificar si tiene permisos especiales (sobrescriben configuración global)
    const permisosEspeciales = await executeQuery(`
      SELECT * FROM permisos_entrada 
      WHERE usuario_id = ? 
      AND activo = TRUE 
      AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
      AND (fecha_fin IS NULL OR fecha_fin >= ?)
    `, [usuarioId, fecha, fecha]);
    
    console.log(`📋 Encontrados ${permisosEspeciales.length} permisos especiales para el usuario`);
    
    // Si tiene permisos especiales, validar contra ellos
    if (permisosEspeciales.length > 0) {
      console.log('🎯 Validando permisos especiales...');
      const resultadoPermisos = await validarPermisosEspeciales(permisosEspeciales, diaSemana, hora);
      console.log('🎯 Resultado de permisos especiales:', resultadoPermisos);
      return resultadoPermisos;
    }
    
    // 2. Si no tiene permisos especiales, usar configuración global
    console.log('🌍 Validando contra configuración global de horarios');
    return await validarHorariosGlobales(diaSemana, hora);
    
  } catch (error) {
    console.error('❌ Error validando permisos:', error);
    return {
      permite: false,
      mensaje: 'Error validando permisos de acceso'
    };
  }
}

// Validar contra configuración global de horarios
async function validarHorariosGlobales(diaSemana, hora) {
  try {
    // Obtener configuración de horarios
    const config = await executeQuery(
      'SELECT valor FROM configuracion_sistema WHERE clave = ? AND activo = 1',
      ['horarios']
    );
    
    if (config.length === 0) {
      console.log('⚠️ No se encontró configuración de horarios en la base de datos');
      return { permite: false, mensaje: 'Configuración de horarios no encontrada' };
    }
    
    console.log('📅 Configuración de horarios encontrada:', config[0].valor);
    console.log('📅 Tipo de dato:', typeof config[0].valor);
    
    let horarios;
    
    // Verificar si ya es un objeto o si necesita ser parseado
    if (typeof config[0].valor === 'object') {
      console.log('📅 La configuración ya es un objeto, usando directamente');
      horarios = config[0].valor;
    } else if (typeof config[0].valor === 'string') {
      console.log('📅 La configuración es un string, parseando JSON');
      try {
        horarios = JSON.parse(config[0].valor);
        console.log('📅 Horarios parseados exitosamente:', horarios);
      } catch (parseError) {
        console.error('❌ Error parseando JSON:', parseError.message);
        console.error('❌ JSON problemático:', config[0].valor);
        return { permite: false, mensaje: 'Error en configuración de horarios - JSON inválido' };
      }
    } else {
      console.error('❌ Tipo de dato inesperado:', typeof config[0].valor);
      return { permite: false, mensaje: 'Error en configuración de horarios - Tipo de dato inválido' };
    }
    
    // Validar estructura de horarios
    if (!horarios.lunesViernes || !horarios.sabados || !horarios.domingos) {
      console.error('❌ Estructura de horarios incompleta:', horarios);
      return { permite: false, mensaje: 'Error en configuración de horarios - Estructura incompleta' };
    }
    
    console.log('📅 Estructura de horarios validada correctamente');
    console.log(`📅 Validando día: ${diaSemana} (0=Domingo, 1=Lunes, etc.), Hora: ${hora}`);
    
    // Lunes a Viernes (1-5)
    if (diaSemana >= 1 && diaSemana <= 5) {
      console.log('📅 Procesando día laboral (Lunes-Viernes)');
      if (horarios.lunesViernes.habilitado) {
        const inicio = horarios.lunesViernes.inicio;
        const fin = horarios.lunesViernes.fin;
        if (hora >= inicio && hora <= fin) {
          return { permite: true, mensaje: 'Acceso permitido (horario laboral)' };
        } else {
          return { 
            permite: false, 
            mensaje: `Acceso denegado. Horario laboral: ${inicio} - ${fin}` 
          };
        }
      } else {
        return { permite: false, mensaje: 'Acceso denegado. Días laborales deshabilitados' };
      }
    }
    
    // Sábado (6)
    if (diaSemana === 6) {
      console.log('📅 Procesando sábado');
      if (horarios.sabados.habilitado) {
        const inicio = horarios.sabados.inicio;
        const fin = horarios.sabados.fin;
        if (hora >= inicio && hora <= fin) {
          return { permite: true, mensaje: 'Acceso permitido (sábado)' };
        } else {
          return { 
            permite: false, 
            mensaje: `Acceso denegado. Horario sábado: ${inicio} - ${fin}` 
          };
        }
      } else {
        return { permite: false, mensaje: 'Acceso denegado. Sábados deshabilitados' };
      }
    }
    
    // Domingo (0)
    if (diaSemana === 0) {
      console.log('📅 Procesando domingo');
      if (horarios.domingos.habilitado) {
        const inicio = horarios.domingos.inicio;
        const fin = horarios.domingos.fin;
        if (hora >= inicio && hora <= fin) {
          return { permite: true, mensaje: 'Acceso permitido (domingo)' };
        } else {
          return { 
            permite: false, 
            mensaje: `Acceso denegado. Horario domingo: ${inicio} - ${fin}` 
          };
        }
      } else {
        return { permite: false, mensaje: 'Acceso denegado. Domingos deshabilitados' };
      }
    }
    
    console.log('📅 Día no reconocido o no procesado:', diaSemana);
    return { permite: false, mensaje: 'Acceso denegado' };
    
  } catch (error) {
    console.error('❌ Error validando horarios globales:', error.message);
    console.error('❌ Error completo:', error);
    return { permite: false, mensaje: 'Error validando configuración de horarios' };
  }
}

// Validar permisos especiales
async function validarPermisosEspeciales(permisos, diaSemana, hora) {
  const diasMap = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
  const diaActual = diasMap[diaSemana];
  
  console.log(`🔍 Validando permisos especiales para día ${diaActual} a las ${hora}`);
  
  for (const permiso of permisos) {
    console.log(`📋 Evaluando permiso ID ${permiso.id} - Tipo: ${permiso.tipo}`);
    console.log(`📋 Días semana: "${permiso.dias_semana}" (${permiso.dias_semana ? 'definido' : 'NULL'})`);
    console.log(`📋 Horario: ${permiso.hora_inicio || 'NULL'} - ${permiso.hora_fin || 'NULL'}`);
    
    // Verificar si aplica para este día
    // Si dias_semana es NULL o vacío, aplica para todos los días
    // Si dias_semana tiene valor, debe incluir el día actual
    const aplicaParaEsteDia = !permiso.dias_semana || 
                             permiso.dias_semana.trim() === '' || 
                             permiso.dias_semana.includes(diaActual);
    
    console.log(`📋 ¿Aplica para día ${diaActual}?: ${aplicaParaEsteDia}`);
    
    if (aplicaParaEsteDia) {
      console.log(`✅ Permiso aplica para día ${diaActual}`);
      
      // Verificar horario si está definido
      if (permiso.hora_inicio && permiso.hora_fin) {
        console.log(`🕐 Verificando horario: ${permiso.hora_inicio} - ${permiso.hora_fin}`);
        if (hora >= permiso.hora_inicio && hora <= permiso.hora_fin) {
          console.log('✅ Acceso permitido por permiso especial con horario');
          return { 
            permite: true, 
            mensaje: `Acceso permitido (permiso especial: ${permiso.observaciones || 'Sin observaciones'})`,
            permiso: permiso
          };
        } else {
          console.log(`❌ Fuera de horario del permiso especial`);
        }
      } else {
        // Permiso sin restricción de horario
        console.log('✅ Acceso permitido por permiso especial sin restricción de horario');
        return { 
          permite: true, 
          mensaje: `Acceso permitido (permiso especial: ${permiso.observaciones || 'Sin observaciones'})`,
          permiso: permiso
        };
      }
    } else {
      console.log(`❌ Permiso no aplica para día ${diaActual}`);
    }
  }
  
  console.log('❌ Acceso denegado - Permisos especiales no aplican para este horario');
  return { permite: false, mensaje: 'Acceso denegado. Permisos especiales no aplican para este horario' };
}

// Iniciar servidor
server.listen(PORT, async () => {

  
  // Verificar conexión a base de datos
  try {
    await executeQuery('SELECT 1');
    
    // Crear tabla de sesiones
    await createSessionsTable();
    
    // Crear tabla de notificaciones del sistema
    await createSystemNotificationsTable();
    
    // Inicializar usuario maestro automáticamente
    await initializeMasterAdmin();
    
    // Cargar configuración del sistema desde base de datos
    const configCargada = await loadAllConfig();
    if (configCargada) {
     
    } else {
    }
    
    // Configurar limpieza automática de sesiones expiradas cada hora
    setInterval(async () => {
      try {
        await cleanupExpiredSessions();
      } catch (error) {
      }
    }, 60 * 60 * 1000); // Cada hora
    
    
  } catch (error) {
    
  }
  
  
});
