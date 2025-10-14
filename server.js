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
require('dotenv').config({ path: './config.env' });

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

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
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
    const [rows] = await pool.execute(query, params);
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
  const ip = req.ip || req.connection.remoteAddress || '';
  
  // Crear fingerprint estable (sin User-Agent para permitir cambio PC/móvil)
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${acceptLanguage}-${acceptEncoding}-${connection}-${ip}`)
    .digest('hex')
    .substring(0, 16); // Usar solo primeros 16 caracteres
  
  return fingerprint;
}

// Función para validar sesión activa y renovar automáticamente
async function validateActiveSession(userId, deviceFingerprint, ip) {
  try {
    // Verificar si existe una sesión activa para este usuario y IP (más flexible)
    const sessions = await executeQuery(
      'SELECT * FROM user_sessions WHERE user_id = ? AND ip_address = ? AND is_active = TRUE AND expires_at > NOW()',
      [userId, ip]
    );
    
    if (sessions.length > 0) {
      // Sesión encontrada - Renovar automáticamente la actividad y actualizar fingerprint
      await executeQuery(
        'UPDATE user_sessions SET last_activity = NOW(), device_fingerprint = ? WHERE user_id = ? AND ip_address = ? AND is_active = TRUE',
        [deviceFingerprint, userId, ip]
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
    // Solo invalidar sesiones de otros dispositivos/IPs, no del mismo usuario
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
    const { username, email, password, rol, nombre, apellido, telefono } = req.body;

    // Verificar si el usuario ya existe
    const existingUsers = await executeQuery(
      'SELECT * FROM usuarios WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'El usuario o email ya existe' });
    }

    // Encriptar contraseña con sistema bidireccional
    const encryptedPassword = encryptPassword(password);

    // Crear nuevo usuario
    const result = await executeQuery(
      'INSERT INTO usuarios (username, email, password, rol, nombre, apellido, telefono, activo, fecha_creado_user) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW())',
      [username, email, encryptedPassword, rol || 'user', nombre || '', apellido || '', telefono || null]
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
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para abrir puerta
app.post('/api/abrir-puerta', authenticateToken, async (req, res) => {
  try {
    // Datos para enviar a Node-RED
    const datosPuerta = {
      accion: "Activa",
      timestamp: req.body.timestamp || new Date().toISOString(),
      usuario: req.user.username,
      id_usuario: req.user.id,
      rol: req.user.role
    };

    // Agregar datos de geolocalización directamente al nivel raíz si están disponibles
    if (req.body.location) {
      datosPuerta.lat = req.body.location.lat;
      datosPuerta.lon = req.body.location.lon;
      datosPuerta.precision = req.body.location.accuracy;
      //   lat: datosPuerta.lat,
      //   lon: datosPuerta.lon,
      //   precision: datosPuerta.precision
      // });
    } else {
    }

    // URL del webhook de Node-RED (usar configuración dinámica SOLO desde BD)
    const nodeRedUrl = await getNodeRedConfigFromDB();

    // VALIDACIÓN DE DUPLICADOS: Verificar si ya existe un registro para este usuario en los últimos 5 segundos
    try {
      const duplicateCheck = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM historial_aperturas 
        WHERE usuario_id = ? 
        AND timestamp > DATE_SUB(NOW(), INTERVAL 5 SECOND)
      `, [req.user.id]);

      if (duplicateCheck[0].count > 0) {
        return res.json({
          message: 'Solicitud duplicada - Espera antes de intentar nuevamente',
          status: 'duplicate',
          canOpenDoor: false,
          datos: datosPuerta,
          timestamp: new Date().toISOString()
        });
      }
    } catch (duplicateError) {
      // Continuar con el proceso si hay error en la verificación
    }

    // Variables para usar después del try-catch de Node-RED
    let finalResponseStatus = 'incorrecto'; // Valor por defecto
    let finalResponseMessage = 'Error interno del servidor';
    let finalCanOpenDoor = false;
    let finalNodeRedResponse = null;

    try {
      // Enviar datos a Node-RED
      const response = await axios.post(nodeRedUrl, datosPuerta, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 segundos de timeout
      });


      // Procesar la respuesta de Node-RED
      const nodeRedResponse = response.data;
      let responseMessage = '';
      let responseStatus = 'success';
      let canOpenDoor = false;

      
      // MANEJAR TANTO OBJETOS COMO STRINGS
      if (typeof nodeRedResponse === 'string') {
        // Node-RED devolvió un string directo
        
        if (nodeRedResponse === 'NoActiva') {
          responseMessage = 'Usuario fuera de la ubicación autorizada - Puerta no activada';
          responseStatus = 'fuera_de_area';
          canOpenDoor = false;

        } else if (nodeRedResponse === 'Activa') {
          responseMessage = 'Usuario autorizado - Puerta abierta exitosamente';
          responseStatus = 'correcto';
          canOpenDoor = true;

        } else {
          // String no reconocido
          responseMessage = 'Node-RED devolvió respuesta no reconocida - Procesando como exitosa';
          responseStatus = 'advertencia';
          canOpenDoor = true;
        }
      } else if (nodeRedResponse && typeof nodeRedResponse === 'object') {
        // Node-RED devolvió un objeto

        // Buscar el estado de activación en 'mensaje' (prioridad) o 'payload' (fallback)
        const activationStatus = nodeRedResponse.mensaje || nodeRedResponse.payload;
        
        if (activationStatus === 'NoActiva') {
          responseMessage = 'Usuario fuera de la ubicación autorizada - Puerta no activada';
          responseStatus = 'fuera_de_area';
          canOpenDoor = false;
          
        } else if (activationStatus === 'Activa') {
          responseMessage = 'Usuario autorizado - Puerta abierta exitosamente';
          responseStatus = 'correcto';
          canOpenDoor = true;
          
        } else {
          // TEMPORAL: Si Node-RED no procesa, hacer validación básica en backend
          
          // Validación temporal: verificar si tiene coordenadas
          if (datosPuerta.lat && datosPuerta.lon) {
            // Aquí puedes agregar tu lógica de validación de coordenadas
            // Por ahora, asumimos que si tiene coordenadas, está autorizado
            responseMessage = 'Node-RED no procesó - Validación temporal: Usuario autorizado';
            responseStatus = 'advertencia';
            canOpenDoor = true;
          } else {
            responseMessage = 'Node-RED no procesó - Sin coordenadas: Acceso denegado';
            responseStatus = 'advertencia';
            canOpenDoor = false;
          }
        }
      } else {
        // Respuesta vacía o no válida
        responseMessage = 'Node-RED no devolvió información de ubicación - Procesando como exitosa';
        responseStatus = 'advertencia';
        canOpenDoor = true;
      }

      // Actualizar variables finales con los valores procesados
      finalResponseStatus = responseStatus;
      finalResponseMessage = responseMessage;
      finalCanOpenDoor = canOpenDoor;
      finalNodeRedResponse = nodeRedResponse;
    } catch (nodeRedError) {
      
      // Determinar el tipo de error
      let errorType = 'Error de conexión';
      let errorMessage = 'Node-RED no está disponible';
      
      if (nodeRedError.code === 'ECONNREFUSED') {
        errorType = 'Conexión rechazada';
        errorMessage = 'Node-RED no está ejecutándose o la IP es incorrecta';
      } else if (nodeRedError.response?.status === 404) {
        errorType = 'Endpoint no encontrado';
        errorMessage = 'La URL de Node-RED no es correcta (404)';
      } else if (nodeRedError.code === 'ENOTFOUND') {
        errorType = 'IP no encontrada';
        errorMessage = 'La IP de Node-RED no es accesible';
      } else if (nodeRedError.code === 'ETIMEDOUT') {
        errorType = 'Timeout';
        errorMessage = 'Node-RED no respondió en el tiempo esperado';
      }
      

      
      // Establecer variables finales para el caso de error
      finalResponseStatus = 'incorrecto';
      finalResponseMessage = `Error de conexión: ${errorMessage}`;
      finalCanOpenDoor = false;
      finalNodeRedResponse = null;
    }

    // UN SOLO PUNTO DE INSERCIÓN EN HISTORIAL - Se ejecuta siempre, independientemente del resultado de Node-RED
    try {
      const eventData = {
        usuario_id: req.user.id,
        status: finalResponseStatus,
        message: finalResponseMessage,
        location_lat: datosPuerta.lat || null,
        location_lon: datosPuerta.lon || null,
        location_accuracy: datosPuerta.precision || null
      };
      
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
      
      const eventResult = await executeQuery(insertQuery, insertParams);
      
      // Emitir evento WebSocket para notificaciones en tiempo real
      if (wss) {
        const eventNotification = {
          type: 'door_event',
          data: {
            id: eventResult.insertId,
            userId: req.user.id,
            username: req.user.username,
            status: finalResponseStatus,
            message: finalResponseMessage,
            location: datosPuerta.lat && datosPuerta.lon ? {
              lat: datosPuerta.lat,
              lon: datosPuerta.lon,
              accuracy: datosPuerta.precision
            } : null,
            timestamp: new Date().toISOString()
          }
        };
        
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(eventNotification));
          }
        });
        

      }
      
    } catch (historyError) {
      // No fallar la respuesta principal por error en historial
    }

    // Respuesta final al frontend
    const finalResponse = {
      message: finalResponseMessage,
      status: finalResponseStatus,
      canOpenDoor: finalCanOpenDoor,
      datos: datosPuerta,
      nodeRedResponse: finalNodeRedResponse,
      timestamp: new Date().toISOString()
    };
    
    res.json(finalResponse);
    
  } catch (error) {
    res.status(500).json({ 
      message: '❌ Error interno del servidor - No se pudo procesar la solicitud',
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
    
    // Consulta optimizada con paginación y búsqueda
    let query = `
      SELECT 
        id, username, email, rol, nombre, apellido, telefono, activo, 
        fecha_creado_user, token, fecha_token 
      FROM usuarios 
    `;
    
    const params = [];
    
    // Agregar filtro de búsqueda si existe
    if (search && search.trim() !== '') {
      query += ` WHERE (
        LOWER(username) LIKE LOWER(?) OR
        LOWER(email) LIKE LOWER(?) OR
        LOWER(nombre) LIKE LOWER(?) OR
        LOWER(apellido) LIKE LOWER(?)
      )`;
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    const users = await executeQuery(query, params);
    
    // Obtener total para paginación
    let countQuery = `SELECT COUNT(*) as total FROM usuarios`;
    const countParams = [];
    
    if (search && search.trim() !== '') {
      countQuery += ` WHERE (
        LOWER(username) LIKE LOWER(?) OR
        LOWER(email) LIKE LOWER(?) OR
        LOWER(nombre) LIKE LOWER(?) OR
        LOWER(apellido) LIKE LOWER(?)
      )`;
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
      fecha_token: user.fecha_token
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
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para obtener un usuario específico con contraseña (solo admin)
app.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    const users = await executeQuery(
      'SELECT id, username, email, password, rol, nombre, apellido, telefono, activo, fecha_creado_user, token, fecha_token FROM usuarios WHERE id = ?',
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
      fecha_token: user.fecha_token
    });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para actualizar usuario (solo admin)
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, password, rol, nombre, apellido, telefono } = req.body;

    // Verificar si el usuario existe
    const existingUsers = await executeQuery(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar si el nuevo username/email ya existe en otro usuario
    const duplicateUsers = await executeQuery(
      'SELECT * FROM usuarios WHERE id != ? AND (username = ? OR email = ?)',
      [userId, username, email]
    );

    if (duplicateUsers.length > 0) {
      return res.status(400).json({ message: 'El usuario o email ya existe' });
    }

    // Construir query de actualización
    let updateFields = ['username = ?', 'email = ?', 'rol = ?', 'nombre = ?', 'apellido = ?', 'telefono = ?'];
    let updateValues = [username, email, rol, nombre, apellido, telefono || null];

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

    res.json({
      message: 'Usuario actualizado exitosamente',
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    let query = `
      SELECT 
        id, 
        tipo, 
        titulo, 
        mensaje, 
        nombre_usuario, 
        direccion_ip, 
        severidad, 
        fecha_creacion 
      FROM notificaciones_sistema 
      WHERE tipo IN ('login_exitoso', 'login_fallido', 'logout')
    `;
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
    let query = `
      SELECT 
        h.id,
        h.usuario_id,
        h.timestamp,
        h.status,
        h.message,
        h.location_lat,
        h.location_lon,
        h.location_accuracy,
        u.username,
        u.email,
        u.nombre,
        u.apellido,
        u.rol
      FROM historial_aperturas h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filtro por estado
    if (status && status !== 'all') {
      query += ` AND h.status = ?`;
      params.push(status);
    }
    
    // Filtro por rango de fechas
    if (dateFrom && dateFrom.trim() !== '') {
      query += ` AND DATE(h.timestamp) >= ?`;
      params.push(dateFrom);
    }
    
    if (dateTo && dateTo.trim() !== '') {
      query += ` AND DATE(h.timestamp) <= ?`;
      params.push(dateTo);
    }
    
    // Filtro por usuario (búsqueda en nombre, apellido, username, email)
    if (user && user.trim() !== '') {
      query += ` AND (
        LOWER(u.nombre) LIKE LOWER(?) OR
        LOWER(u.apellido) LIKE LOWER(?) OR
        LOWER(u.username) LIKE LOWER(?) OR
        LOWER(u.email) LIKE LOWER(?)
      )`;
      params.push(`%${user.trim()}%`, `%${user.trim()}%`, `%${user.trim()}%`, `%${user.trim()}%`);
    }
    
    // Ordenar por fecha descendente
    query += ` ORDER BY h.timestamp DESC`;
    
    // Paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    
    const history = await executeQuery(query, params);
    
    // Contar total de registros para paginación
    let countQuery = `
      SELECT COUNT(*) as total
      FROM historial_aperturas h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE 1=1
    `;
    
    const countParams = [];
    
    // Aplicar los mismos filtros para el conteo
    if (status && status !== 'all') {
      countQuery += ` AND h.status = ?`;
      countParams.push(status);
    }
    
    if (dateFrom && dateFrom.trim() !== '') {
      countQuery += ` AND DATE(h.timestamp) >= ?`;
      countParams.push(dateFrom);
    }
    
    if (dateTo && dateTo.trim() !== '') {
      countQuery += ` AND DATE(h.timestamp) <= ?`;
      countParams.push(dateTo);
    }
    
    if (user && user.trim() !== '') {
      countQuery += ` AND (
        LOWER(u.nombre) LIKE LOWER(?) OR
        LOWER(u.apellido) LIKE LOWER(?) OR
        LOWER(u.username) LIKE LOWER(?) OR
        LOWER(u.email) LIKE LOWER(?)
      )`;
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
