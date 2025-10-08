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
  console.log(`📡 WebSocket: Mensaje enviado a ${wss.clients.size} clientes:`, message);
};

// Función para enviar mensaje a usuarios específicos
const sendToUser = (userId, message) => {
  const connection = wsConnections.get(userId);
  if (connection && connection.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify(message));
    console.log(`📡 WebSocket: Mensaje enviado a usuario ${userId}:`, message);
  }
};

// Manejo de conexiones WebSocket
wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket: Nueva conexión establecida');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 WebSocket: Mensaje recibido:', data);
      
      // Manejar diferentes tipos de mensajes
      if (data.type === 'register') {
        // Registrar conexión por usuario
        wsConnections.set(data.userId, ws);
        ws.userId = data.userId;
        console.log(`👤 WebSocket: Usuario ${data.userId} registrado`);
      }
    } catch (error) {
      console.error('❌ WebSocket: Error procesando mensaje:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket: Conexión cerrada');
    if (ws.userId) {
      wsConnections.delete(ws.userId);
      console.log(`👤 WebSocket: Usuario ${ws.userId} desconectado`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket: Error en conexión:', error);
  });
});

// Configuración de encriptación bidireccional
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'mi_clave_secreta_de_32_caracteres_123456'; // 32 caracteres
const ALGORITHM = 'aes-256-cbc';

// Función para encriptar contraseñas
function encryptPassword(password) {
  try {
    console.log('🔐 Encriptando contraseña...');
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const result = iv.toString('hex') + ':' + encrypted;
    console.log('✅ Contraseña encriptada exitosamente');
    return result;
  } catch (error) {
    console.error('❌ Error encriptando contraseña:', error);
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
    console.error('Error desencriptando contraseña:', error);
    return encryptedPassword; // Fallback sin desencriptar
  }
}

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
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
    console.error('Error en query:', error);
    throw error;
  }
};

// ========================================
// FUNCIONES DE CONFIGURACIÓN DEL SISTEMA
// ========================================

// Obtener configuración específica de la base de datos
async function getConfig(clave) {
  try {
    console.log(`🔍 Debug - getConfig buscando clave: ${clave}`);
    const [rows] = await executeQuery(
      'SELECT valor FROM configuracion_sistema WHERE clave = ? AND activo = TRUE',
      [clave]
    );
    console.log(`🔍 Debug - getConfig resultado para ${clave}:`, rows);
    console.log(`🔍 Debug - getConfig tipo de resultado:`, typeof rows);
    console.log(`🔍 Debug - getConfig es array:`, Array.isArray(rows));
    
    if (Array.isArray(rows) && rows.length > 0) {
      // Parsear el JSON si es un string
      const valor = rows[0].valor;
      console.log(`🔍 Debug - getConfig valor crudo para ${clave}:`, valor);
      const parsedValue = typeof valor === 'string' ? JSON.parse(valor) : valor;
      console.log(`🔍 Debug - getConfig valor parseado para ${clave}:`, parsedValue);
      return parsedValue;
    } else if (rows && rows.valor) {
      // Si la respuesta no es un array pero tiene la propiedad valor
      console.log(`🔍 Debug - getConfig respuesta directa para ${clave}:`, rows);
      const valor = rows.valor;
      console.log(`🔍 Debug - getConfig valor crudo para ${clave}:`, valor);
      const parsedValue = typeof valor === 'string' ? JSON.parse(valor) : valor;
      console.log(`🔍 Debug - getConfig valor parseado para ${clave}:`, parsedValue);
      return parsedValue;
    }
    
    console.log(`⚠️ getConfig no encontró configuración para ${clave}`);
    return null;
  } catch (error) {
    console.error(`Error obteniendo configuración ${clave}:`, error);
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
    console.log(`✅ Configuración ${clave} actualizada por ${modificadoPor}`);
    return true;
  } catch (error) {
    console.error(`❌ Error actualizando configuración ${clave}:`, error);
    return false;
  }
}

// Cargar toda la configuración del sistema
async function loadAllConfig() {
  try {
    const [rows] = await executeQuery(
      'SELECT clave, valor FROM configuracion_sistema WHERE activo = TRUE'
    );
    
    console.log('🔍 Debug - loadAllConfig resultado:', rows);
    console.log('🔍 Debug - loadAllConfig tipo:', typeof rows);
    console.log('🔍 Debug - loadAllConfig es array:', Array.isArray(rows));
    
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
    
    console.log('✅ Configuración del sistema cargada desde base de datos');
    console.log('🔍 Debug - Config cargada:', config);
    return config;
  } catch (error) {
    console.error('❌ Error cargando configuración desde base de datos:', error);
    console.log('⚠️ Usando configuración por defecto en memoria');
    return null;
  }
}

// Obtener configuración de Node-RED SOLO desde BD (sin fallback)
async function getNodeRedConfigFromDB() {
  console.log('🔍 Debug - getNodeRedConfigFromDB iniciada');
  const nodeRedConfig = await getConfig('node_red');
  console.log('🔍 Debug - nodeRedConfig obtenida:', nodeRedConfig);
  
  if (nodeRedConfig && nodeRedConfig.url) {
    console.log('🔍 Debug - Usando URL de BD:', nodeRedConfig.url);
    return nodeRedConfig.url;
  }
  
  console.log('❌ ERROR: No se encontró configuración de Node-RED en BD');
  throw new Error('No se encontró configuración de Node-RED en la base de datos');
}

// Obtener configuración de Node-RED (con fallback para compatibilidad)
async function getNodeRedConfig() {
  try {
    return await getNodeRedConfigFromDB();
  } catch (error) {
    console.log('⚠️ No se encontró configuración de Node-RED en BD, usando fallback');
    // Solo fallback a variable de entorno si no hay configuración en BD
    const fallbackUrl = process.env.NODE_RED_URL || 'http://localhost:1880/datosRecibidos';
    console.log('🔍 Debug - URL fallback:', fallbackUrl);
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

// Configuración del sistema (solo fallback para casos extremos)
// NOTA: La configuración principal viene de la base de datos

// Middleware de autenticación con tokens permanentes
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
    // Buscar usuario por token en la base de datos
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE token = ? AND activo = TRUE',
      [token]
    );

    if (users.length === 0) {
      console.log(`🚨 TOKEN INVÁLIDO MIDDLEWARE - Token en cookies no encontrado en BD: ${token.substring(0, 10)}...`);
      console.log(`🔍 MIDDLEWARE DEBUG - Posible causa: Admin hizo refresh token y usuario sigue usando token anterior`);
      return res.status(403).json({ 
        message: 'Token inválido o usuario inactivo',
        tokenInvalid: true,
        autoLogout: true,
        possibleCause: 'Admin refresh executed'
      });
    }

    const user = users[0];
    req.user = {
      id: user.id,
      username: user.username,
      role: user.rol,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email
    };
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
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
    console.log('🍪 TODAS LAS COOKIES RECIBIDAS:', req.cookies);
    const cookieToken = req.cookies.token;

    // PASO 1: Verificar si existe token válido en cookies (LOGIN AUTOMÁTICO)
    if (cookieToken) {
      console.log('📋 Token encontrado en cookies, verificando validez...');
      
      const usersWithToken = await executeQuery(
        'SELECT * FROM usuarios WHERE token = ? AND activo = TRUE',
        [cookieToken]
      );

      if (usersWithToken.length > 0) {
        const user = usersWithToken[0];
        
        // CORRECCIÓN CRÍTICA: Verificar que el token pertenece al usuario solicitado
        if (user.username !== username) {
          console.log(`🚨 SEGURIDAD: Token en cookies pertenece a ${user.username}, pero solicita login ${username}`);
          console.log(`❌ IGNORANDO token - No corresponde al usuario solicitado`);
          // Continuar con validación normal por credenciales (NO hacer return aquí)
        } else if (!user.token_activo) {
          console.log(`⚠️ Token del usuario ${username} encontrado pero NO activado`);
          return res.status(403).json({ 
            message: 'Token encontrado pero no activado. Debe activar el token antes de iniciar sesión.',
            hasToken: true,
            tokenNotActivated: true
          });
        } else {
          console.log(`✅ Token válido encontrado para ${username} - Validando contraseña antes de login automático`);
          
          // IMPORTANTE: Siempre validar contraseña, incluso con token válido
          const decryptedPassword = decryptPassword(user.password);
          if (password !== decryptedPassword) {
            console.log(`❌ Contraseña incorrecta para ${username} - Token válido pero credenciales incorrectas`);
            return res.status(401).json({ message: 'Credenciales inválidas' });
          }
          
          console.log(`✅ Contraseña válida para ${username} - Procediendo con login automático`);
        
          // Renovar cookie por 1 año
          res.cookie('token', cookieToken, {
            httpOnly: false, // CORREGIDO: Permitir acceso desde JS
            secure: false,
            sameSite: 'lax',
            maxAge: 365 * 24 * 60 * 60 * 1000,
            path: '/'
          });
          
          // Establecer cookie de sesión para indicar que el usuario está logueado
          res.cookie('user_logged_in', 'true', {
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
            path: '/'
          });
          
          console.log(`🍪 Login automático - Establecida cookie de sesión para ${user.username}`);

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
    console.log(`🔍 Validando credenciales para: ${username}`);
    
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE username = ? AND activo = TRUE',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Verificar contraseña con sistema bidireccional
    const decryptedPassword = decryptPassword(user.password);
    if (password !== decryptedPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // PASO 3: Usuario con token - Verificar si está activado
    if (user.token) {
      // Verificar si el token está activado (token_activo = 1)
      if (!user.token_activo) {
        console.log(`⚠️ Usuario ${username} tiene token pero NO está activado`);
        return res.status(403).json({ 
          message: '❌ Token asignado pero no activado. Debe activar el token antes de iniciar sesión.',
          hasToken: true,
          tokenNotActivated: true
        });
      }

      // Token está activado - Verificar si este dispositivo ya tiene el token activado
      const cookieToken = req.cookies.token;
      console.log('🔍 COMPARACIÓN DE TOKENS:');
      console.log('  🍪 Cookie token:', cookieToken);
      console.log('  🗄️ DB token:', user.token);
      console.log('  ✅ Coinciden:', cookieToken === user.token);
      
      if (cookieToken === user.token) {
        // Token ya activado en este dispositivo - Validar contraseña antes de login directo
        console.log(`✅ Token coincidente para ${username} - Validando contraseña antes de login automático`);
        
        // IMPORTANTE: Siempre validar contraseña, incluso con token coincidente
        const decryptedPassword = decryptPassword(user.password);
        if (password !== decryptedPassword) {
          console.log(`❌ Contraseña incorrecta para ${username} - Token válido pero credenciales incorrectas`);
          return res.status(401).json({ message: 'Credenciales inválidas' });
        }
        
        console.log(`✅ Contraseña válida para ${username} - Procediendo con login automático`);
        
        res.cookie('token', user.token, {
          httpOnly: false, // Cambio clave: Permitir acceso desde JS
          secure: false,
          sameSite: 'lax',
          maxAge: 365 * 24 * 60 * 60 * 1000,
          path: '/'
        });
        
        // Establecer cookie de sesión para indicar que el usuario está logueado
        res.cookie('user_logged_in', 'true', {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
          path: '/'
        });
        
        console.log('🍪 LOGIN-AUTO - Cookie establecida:', user.token);
        console.log(`🍪 LOGIN-AUTO - Establecida cookie de sesión para ${username}`);
        
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
        console.log(`⚠️ Usuario ${username} tiene token activado pero dispositivo no autorizado`);
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
    console.log(`🔍 VERIFICACIÓN DE SEGURIDAD para ${username}:`);
    console.log(`  📊 Token actual: ${user.token ? 'EXISTE' : 'NULL'}`);
    console.log(`  📊 Estado activo: ${user.token_activo}`);
    
    let generatedToken = null; // Variable para almacenar el token generado
    
    if (user.token !== null) {
      // Usuario tiene token existente - NO autorizado para nueva generación
      console.log(`🚨 SEGURIDAD: Usuario ${username} tiene token ${user.token} - NO autorizado para nueva activación`);
      console.log(`❌ BLOQUEO: Token existente requiere autorización admin para refresh`);
      
      return res.status(403).json({
        success: false,
        message: 'Token existente no autorizado para nueva activación. Contacte al administrador.',
        hasToken: true,
        tokenExists: true,
        requiresAdminRefresh: true
      });
    } else if (user.token === null && user.token_activo === 0) {
      // Usuario tiene autorización admin explícita - Proceder con nueva generación
      console.log(`✅ AUTORIZACIÓN ADMIN CONFIRMADA: Usuario ${username} autorizado para nueva activación`);
      console.log(`🆕 Generando nuevo token autorizado para: ${username}`);
      
      generatedToken = crypto.randomBytes(4).toString('hex'); // Token de 8 caracteres (4 bytes = 8 hex chars)

      await executeQuery(
        'UPDATE usuarios SET token = ?, fecha_token = NOW(), token_activo = 0 WHERE id = ?',
        [generatedToken, user.id]
      );

      res.cookie('token', generatedToken, {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      console.log(`✅ Token generado y autorizado para ${user.username}: ${generatedToken}`);
      console.log(`🍪 Cookie establecida con nuevo token autorizado: ${generatedToken}`);
      console.log(`🔐 ACTIVACIÓN DISPONIBLE: Usuario ${username} puede activar token en dispositivo`);
    } else {
      // Estado inconsistente - Requiere intervención admin
      console.log(`🚨 ESTADO INCONSISTENTE para ${username}:`);
      console.log(`  📊 Token: ${user.token ? user.token : 'NULL'} (expectativa: NULL)`);
      console.log(`  📊 Activo: ${user.token_activo} (expectativa: 0)`);
      
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
      console.log(`📤 ENVIANDO RESPUESTA - Token generado: ${generatedToken.substring(0, 10)}...`);
      
      // Disparar evento global para notificar que se generó un token
      console.log(`🔄 BACKEND: Disparando evento tokenGenerated para ${user.username}`);
      
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

    res.json({
        success: true,
        message: 'Token asignado exitosamente. Dispositivo autorizado.',
      user: {
        id: user.id,
        username: user.username,
          role: user.rol,
          nombre: user.nombre,
          apellido: user.apellido
        },
        tokenGenerated: true,
        token: generatedToken
      });
    } else {
      console.log(`❌ ERROR CRÍTICO: Ningún token generado pero llegó al final del proceso`);
      return res.status(500).json({
        message: 'Error: No se pudo generar token. Contacte al administrador.'
      });
    }
  } catch (error) {
    console.error('Error en login:', error);
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
    console.error('Error en registro:', error);
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
      console.log('Coordenadas recibidas (usuario):', {
        lat: datosPuerta.lat,
        lon: datosPuerta.lon,
        precision: datosPuerta.precision
      });
    } else {
      console.log('Usuario admin/jefe - sin coordenadas (no requeridas)');
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
        console.log('⚠️ DUPLICADO DETECTADO - Evitando inserción duplicada para usuario:', req.user.username);
        return res.json({
          message: 'Solicitud duplicada - Espera antes de intentar nuevamente',
          status: 'duplicate',
          canOpenDoor: false,
          datos: datosPuerta,
          timestamp: new Date().toISOString()
        });
      }
    } catch (duplicateError) {
      console.error('❌ Error verificando duplicados:', duplicateError);
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

      console.log('📤 Datos enviados a Node-RED:', datosPuerta);
      console.log('📥 Respuesta de Node-RED:', response.data);
      console.log('🔍 Status de respuesta HTTP:', response.status);
      console.log('🔍 Headers de respuesta:', response.headers);
      console.log('🔍 Tipo de respuesta:', typeof response.data);
      console.log('🔍 Es objeto:', typeof response.data === 'object');
      console.log('🔍 Claves del objeto:', Object.keys(response.data || {}));

      // Procesar la respuesta de Node-RED
      const nodeRedResponse = response.data;
      let responseMessage = '';
      let responseStatus = 'success';
      let canOpenDoor = false;

      // Verificar si la respuesta contiene información de ubicación
      console.log('🔍 Node-RED respuesta completa:', nodeRedResponse);
      console.log('🔍 Tipo de respuesta:', typeof nodeRedResponse);
      console.log('🔍 Es objeto:', typeof nodeRedResponse === 'object');
      console.log('🔍 Es string:', typeof nodeRedResponse === 'string');
      
      // MANEJAR TANTO OBJETOS COMO STRINGS
      if (typeof nodeRedResponse === 'string') {
        // Node-RED devolvió un string directo
        console.log('🔍 Node-RED devolvió STRING:', nodeRedResponse);
        
        if (nodeRedResponse === 'NoActiva') {
          responseMessage = 'Usuario fuera de la ubicación autorizada - Puerta no activada';
          responseStatus = 'fuera_de_area';
          canOpenDoor = false;
          console.log('🔴 STRING: "NoActiva" → DENEGAR');
          console.log('🔴 DECISIÓN: canOpenDoor = false, status = fuera_de_area');
        } else if (nodeRedResponse === 'Activa') {
          responseMessage = 'Usuario autorizado - Puerta abierta exitosamente';
          responseStatus = 'correcto';
          canOpenDoor = true;
          console.log('🟢 STRING: "Activa" → AUTORIZAR');
          console.log('🟢 DECISIÓN: canOpenDoor = true, status = correcto');
        } else {
          // String no reconocido
          responseMessage = 'Node-RED devolvió respuesta no reconocida - Procesando como exitosa';
          responseStatus = 'advertencia';
          canOpenDoor = true;
          console.log('🟡 STRING no reconocido:', nodeRedResponse);
        }
      } else if (nodeRedResponse && typeof nodeRedResponse === 'object') {
        // Node-RED devolvió un objeto
        console.log('🔍 Node-RED devolvió OBJETO:', nodeRedResponse);
        console.log('🔍 Claves del objeto:', Object.keys(nodeRedResponse));
        
        // Buscar el estado de activación en 'mensaje' (prioridad) o 'payload' (fallback)
        const activationStatus = nodeRedResponse.mensaje || nodeRedResponse.payload;
        console.log('🔍 activationStatus:', activationStatus);
        
        if (activationStatus === 'NoActiva') {
          responseMessage = 'Usuario fuera de la ubicación autorizada - Puerta no activada';
          responseStatus = 'fuera_de_area';
          canOpenDoor = false;
          console.log('🔴 OBJETO: mensaje/payload = "NoActiva" → DENEGAR');
          console.log('🔴 DECISIÓN: canOpenDoor = false, status = fuera_de_area');
        } else if (activationStatus === 'Activa') {
          responseMessage = 'Usuario autorizado - Puerta abierta exitosamente';
          responseStatus = 'correcto';
          canOpenDoor = true;
          console.log('🟢 OBJETO: mensaje/payload = "Activa" → AUTORIZAR');
          console.log('🟢 DECISIÓN: canOpenDoor = true, status = correcto');
        } else {
          // TEMPORAL: Si Node-RED no procesa, hacer validación básica en backend
          console.log('🟡 Node-RED no procesó la validación, haciendo validación temporal en backend');
          
          // Validación temporal: verificar si tiene coordenadas
          if (datosPuerta.lat && datosPuerta.lon) {
            // Aquí puedes agregar tu lógica de validación de coordenadas
            // Por ahora, asumimos que si tiene coordenadas, está autorizado
            responseMessage = 'Node-RED no procesó - Validación temporal: Usuario autorizado';
            responseStatus = 'advertencia';
            canOpenDoor = true;
            console.log('🟡 Validación temporal: Usuario con coordenadas autorizado');
          } else {
            responseMessage = 'Node-RED no procesó - Sin coordenadas: Acceso denegado';
            responseStatus = 'advertencia';
            canOpenDoor = false;
            console.log('🟡 Validación temporal: Usuario sin coordenadas denegado');
          }
        }
      } else {
        // Respuesta vacía o no válida
        responseMessage = 'Node-RED no devolvió información de ubicación - Procesando como exitosa';
        responseStatus = 'advertencia';
        canOpenDoor = true;
        console.log('🟡 Node-RED: Sin respuesta de ubicación, procesando como exitosa');
      }

      // Actualizar variables finales con los valores procesados
      finalResponseStatus = responseStatus;
      finalResponseMessage = responseMessage;
      finalCanOpenDoor = canOpenDoor;
      finalNodeRedResponse = nodeRedResponse;
    } catch (nodeRedError) {
      console.error('❌ Error al comunicarse con Node-RED:', nodeRedError.message);
      console.error('📍 URL intentada:', nodeRedUrl);
      
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
      
      console.error(`🔍 Tipo de error: ${errorType}`);
      console.error(`💡 Sugerencia: ${errorMessage}`);
      
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
      console.log(`📊 HISTORIAL - Evento registrado con ID: ${eventResult.insertId}`);
      
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
        
        console.log('📡 HISTORIAL - Notificación WebSocket enviada');
      }
      
    } catch (historyError) {
      console.error('❌ HISTORIAL - Error al registrar evento:', historyError);
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
    
    console.log('📤 RESPUESTA FINAL AL FRONTEND:', finalResponse);
    console.log('📤 canOpenDoor:', finalResponse.canOpenDoor);
    console.log('📤 status:', finalResponse.status);
    console.log('📤 message:', finalResponse.message);
    
    res.json(finalResponse);
    
  } catch (error) {
    console.error('Error al abrir puerta:', error);
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
    
    console.log('🔍 VERIFY-TOKEN - Cookies recibidas:', req.cookies);
    console.log('🔍 VERIFY-TOKEN - Token encontrado:', token);
    console.log('🔍 VERIFY-TOKEN - Usuario logueado:', userLoggedIn);

    if (!token) {
      console.log('❌ VERIFY-TOKEN - No hay token en cookies');
      return res.status(401).json({ message: 'No hay token en cookies' });
    }
    
    // Si no hay cookie de sesión, no permitir login automático
    if (!userLoggedIn) {
      console.log('❌ VERIFY-TOKEN - No hay sesión activa (logout manual detectado)');
      return res.status(401).json({ 
        message: 'Sesión cerrada. Ingrese sus credenciales para continuar.',
        sessionClosed: true
      });
    }

    // Buscar usuario por token
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE token = ? AND activo = TRUE',
      [token]
    );

    console.log('🔍 VERIFY-TOKEN - Usuarios encontrados:', users.length);

    if (users.length === 0) {
      console.log('❌ VERIFY-TOKEN - Token no válido en BD');
      return res.status(401).json({ message: 'Token inválido' });
    }

    const user = users[0];
    
    // CORRECCIÓN CRÍTICA: Verificar si token está activado
    if (!user.token_activo) {
      console.log(`⚠️ VERIFY-TOKEN - Token encontrado pero NO ACTIVADO para ${user.username}`);
      return res.status(403).json({ 
        message: 'Token encontrado pero no activado',
        tokenNotActivated: true
      });
    }

    console.log('✅ VERIFY-TOKEN - Token válido y ACTIVADO para:', user.username);

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
    console.error('💥 VERIFY-TOKEN ERROR:', error);
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
    const users = await executeQuery(
      'SELECT id, username, email, rol, nombre, apellido, telefono, activo, fecha_creado_user, token, fecha_token FROM usuarios ORDER BY id'
    );
    
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
  
  res.json(userList);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
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
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para actualizar usuario (solo admin)
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, password, rol, nombre, apellido, telefono } = req.body;

    console.log('🔄 ACTUALIZANDO USUARIO:', {
      userId,
      username,
      email,
      hasPassword: !!password,
      passwordLength: password ? password.length : 0,
      rol,
      nombre,
      apellido,
      telefono
    });

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
      console.log('🔐 Encriptando nueva contraseña...');
      try {
        const encryptedPassword = encryptPassword(password);
        console.log('✅ Contraseña encriptada exitosamente');
        updateFields.push('password = ?');
        updateValues.push(encryptedPassword);
      } catch (encryptError) {
        console.error('❌ Error encriptando contraseña:', encryptError);
        return res.status(500).json({ message: 'Error encriptando contraseña' });
      }
    } else if (password && password.length < 6) {
      console.log('❌ Contraseña muy corta:', password.length);
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    updateValues.push(userId);

    console.log('📝 Ejecutando query de actualización:', {
      fields: updateFields,
      valuesCount: updateValues.length
    });

    await executeQuery(
      `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    console.log('✅ Usuario actualizado exitosamente:', userId);

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
    console.error('💥 Error actualizando usuario:', error);
    console.error('💥 Stack trace:', error.stack);
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
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Rutas de configuración del sistema (solo admin)
app.get('/api/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nodeRedConfig = await getConfig('node_red');
    const horariosConfig = await getConfig('horarios');
    
    console.log('🔍 Debug - nodeRedConfig:', nodeRedConfig);
    console.log('🔍 Debug - horariosConfig:', horariosConfig);
    
    // Construir respuesta SOLO con configuración de base de datos
    const config = {
      nodeRedUrl: nodeRedConfig?.url || null,
      horarios: horariosConfig || null
    };
    
    console.log('🔍 Debug - config final:', config);
    
    res.json({
      success: true,
      config: config
    });
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para obtener notificaciones de tokens no activados (solo admin)
app.get('/api/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tokensNoActivados = await executeQuery(
      'SELECT id, username, email, nombre, apellido, fecha_token, token FROM usuarios WHERE token IS NOT NULL AND token_activo = 0 AND activo = TRUE ORDER BY fecha_token DESC'
    );
    
    res.json({
      notifications: tokensNoActivados,
      unreadCount: tokensNoActivados.length
    });
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
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

    console.log(`✅ Configuración actualizada por ${modificadoPor} en base de datos`);

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      config: {
        nodeRedUrl: nodeRedUrl || null,
        horarios: horarios || null
      }
    });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

// Ruta temporal para debuggear cookies
app.get('/api/debug-cookies', (req, res) => {
  console.log('🍪 DEBUG COOKIES - Headers:', req.headers.cookie);
  console.log('🍪 DEBUG COOKIES - Cookies parseadas:', req.cookies);
  
  // Establecer una cookie de prueba SIMPLE
  res.cookie('test-cookie', 'valor-prueba', {
    httpOnly: false, // Permitir acceso desde JS para debug
    secure: false,
    sameSite: 'lax',
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
    console.log(`🔐 ACTIVANDO TOKEN: ${token} para usuario: ${username}`);

    if (!token) {
      return res.status(400).json({ message: 'Token requerido' });
    }

    if (!username) {
      return res.status(400).json({ message: 'Usuario requerido para validación de seguridad' });
    }

    // Buscar usuario por token y verificar que no esté activo
    const users = await executeQuery(
      'SELECT * FROM usuarios WHERE token = ? AND activo = TRUE',
      [token]
    );

    if (users.length === 0) {
      console.log(`❌ SEGURIDAD: Token ${token} no encontrado o usuario inactivo`);
      return res.status(401).json({ message: 'Token inválido o usuario inactivo' });
    }

    const user = users[0];
    
    // VALIDACIÓN CRÍTICA DE SEGURIDAD: Verificar que el token pertenece al usuario correcto
    if (user.username !== username) {
      console.log(`🚨 SEGURIDAD: Token ${token} pertenece a ${user.username}, pero se intenta activar para ${username}`);
      console.log(`❌ SEGURIDAD: Activación DENEGADA - Token no corresponde al usuario`);
      return res.status(403).json({ 
        message: 'Token no corresponde al usuario especificado. Contacte al administrador.',
        securityError: true,
        tokenOwner: user.username,
        requestedUser: username
      });
    }

    console.log(`✅ SEGURIDAD: Token ${token} validado correctamente para usuario ${username}`);

    // Verificar si el token ya está activo en otro dispositivo
    const cookieToken = req.cookies.token;
    if (cookieToken && cookieToken === token) {
      // Token ya activo en este dispositivo - VERIFICAR que esté realmente activado en BD
      console.log(`✅ Token ya activo para ${user.username} - Verificando estado en BD`);
      
      if (user.token_activo) {
        // Confirmar que está realmente activado y establecer cookie fresca
        console.log(`✅ Token confirmado como ACTIVADO en BD para ${user.username}`);
        
        res.cookie('token', token, {
          httpOnly: false, // CORREGIDO: Permitir acceso desde JS
          secure: false, // Cambiado a false para desarrollo
          sameSite: 'lax', // Cambiado a 'lax' para desarrollo
          maxAge: 365 * 24 * 60 * 60 * 1000,
          path: '/'
        });
        
        console.log(`🍪 Cookie re-establecida para token activado: ${token}`);
        
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
        console.log(`⚠️ Token en cookie pero NO ACTIVADO en BD para ${user.username} - Procediendo con activación`);
      }
    }

    // Verificar si hay otro dispositivo con este token activo
    const activeUsers = await executeQuery(
      'SELECT COUNT(*) as count FROM usuarios WHERE token = ? AND token_activo = 1',
      [token]
    );

    if (activeUsers[0].count > 0) {
      return res.status(403).json({ 
        message: 'Token ya está activo en otro dispositivo. Contacte al administrador.' 
      });
    }

    // Activar token en este dispositivo
    console.log(`🔄 ACTIVANDO TOKEN en BD: ${token}`);
    console.log(`🔄 Query: UPDATE usuarios SET token_activo = 1, ultima_activacion = NOW() WHERE token = ?`);
    
    const updateResult = await executeQuery(
      'UPDATE usuarios SET token_activo = 1, ultima_activacion = NOW() WHERE token = ?',
      [token]
    );
    
    console.log(`📊 RESULTADO UPDATE:`, updateResult);
    console.log(`✅ TOKEN ACTIVADO en BD para: ${user.username}`);
    
    // Verificar que se actualizó correctamente
    const verification = await executeQuery(
      'SELECT token_activo, ultima_activacion FROM usuarios WHERE token = ?',
      [token]
    );
    
    console.log(`🔍 VERIFICACIÓN ACTIVACIÓN:`, verification[0]);

    res.cookie('token', token, {
      httpOnly: false, // CORREGIDO: Permitir acceso desde JS
      secure: false, // Cambiado a false para desarrollo
      sameSite: 'lax', // Cambiado a 'lax' para desarrollo
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    console.log(`✅ Token activado exitosamente para ${user.username}`);
    console.log(`🍪 Cookie establecida con token: ${token}`);
    console.log(`🔧 Configuración cookie - httpOnly: false, path: /, maxAge: 1 año`);
    console.log(`🍪 ACTIVATE-TOKEN - Configuración completa:`);
    console.log(`  ✅ httpOnly: false`);
    console.log(`  ✅ secure: false`);
    console.log(`  ✅ sameSite: lax`);
    console.log(`  ✅ maxAge: ${365 * 24 * 60 * 60 * 1000}`);
    console.log(`  ✅ path: /`);
    console.log(`🍪 ACTIVATE-TOKEN - Cookie DEBERÍA ser visible desde JS`);

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
    console.error('Error activando token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ruta temporal para limpiar tokens (DEBUG)
app.post('/api/clear-tokens', async (req, res) => {
  try {
    await executeQuery('UPDATE usuarios SET token = NULL, fecha_token = NULL, token_activo = FALSE');
    console.log('🧹 Todos los tokens limpiados de la base de datos');
    res.json({ message: 'Tokens limpiados exitosamente' });
  } catch (error) {
    console.error('❌ Error limpiando tokens:', error);
    res.status(500).json({ message: 'Error limpiando tokens' });
  }
});

// Ruta específica para limpiar usuario admin
app.post('/api/reset-admin', async (req, res) => {
  try {
    await executeQuery(
      'UPDATE usuarios SET token = NULL, fecha_token = NULL, token_activo = FALSE WHERE username = "admin"'
    );
    console.log('🧹 Token del admin limpiado correctamente');
    // Limpiar cookie del navegador también
    res.clearCookie('token', { path: '/' });
    console.log('🧹 Cookie del navegador limpiada');
    
    res.json({ message: 'Usuario admin reseteado exitosamente' });
  } catch (error) {
    console.error('❌ Error reseteando admin:', error);
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
    console.error('Error obteniendo tokens pendientes:', error);
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
    
    console.log(`🚫 Token revocado para usuario ${req.user.username} (ID: ${userId})`);
    
    res.json({
      success: true,
      message: 'Token del dispositivo revocado exitosamente'
    });
  } catch (error) {
    console.error('Error revocando token del dispositivo:', error);
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
    console.error('Error revocando token:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para refrescar token (solo admin) - NUEVA FUNCIONALIDAD DE SEGURIDAD
app.post('/api/refresh-token/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    console.log(`🔄 ADMIN REFRESH TOKEN - Solicitado para usuario ID: ${userId}`);
    console.log(`🔄 ADMIN REFRESH TOKEN - Ejecutado por admin: ${req.user.username}`);
    
    // Obtener datos del usuario para verificación y logs
    const userInfo = await executeQuery('SELECT username, token, token_activo FROM usuarios WHERE id = ?', [userId]);
    
    if (userInfo.length === 0) {
      console.log(`❌ ADMIN REFRESH TOKEN - Usuario ID ${userId} no encontrado`);
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = userInfo[0];
    console.log(`🔄 ADMIN REFRESH TOKEN - Estado anterior usuario ${user.username}: token=${user.token ? 'SET' : 'NULL'}, activo=${user.token_activo}`);
    
    // CRÍTICO: Limpiar token existente para autorizar nueva activación
    const updateResult = await executeQuery(
      'UPDATE usuarios SET token = NULL, fecha_token = NULL, token_activo = 0 WHERE id = ?',
      [userId]
    );
    
    console.log(`✅ ADMIN REFRESH TOKEN - Agregado exitosamente para usuario ${user.username} (ID: ${userId})`);
    console.log(`📊 ADMIN REFRESH TOKEN - Resultado UPDATE:`, updateResult);
    console.log(`🔐 ADMIN REFRESH TOKEN - Usuario ${user.username} ahora autorizado para nueva activación`);
    
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
    console.error('Error refrescando token:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ruta para logout
app.post('/api/logout', (req, res) => {
  // Limpiar solo la cookie de sesión, NO el token del dispositivo
  res.clearCookie('user_logged_in', {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    path: '/'
  });
  
  console.log('🚪 LOGOUT - Cookie de sesión eliminada, token del dispositivo mantenido');
  
  res.json({
    message: 'Logout exitoso - Token del dispositivo mantenido'
  });
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
    
    console.log('🚪 DOOR EVENT - Registrando evento:', {
      userId,
      status,
      message,
      location: location ? `${location.lat}, ${location.lon}` : 'No location'
    });
    
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
    
    console.log(`✅ DOOR EVENT - Evento registrado con ID: ${result.insertId}`);
    
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
      
      console.log('📡 DOOR EVENT - Notificación WebSocket enviada');
    }
    
    res.json({
      success: true,
      eventId: result.insertId,
      message: 'Evento de apertura registrado exitosamente'
    });
    
  } catch (error) {
    console.error('❌ DOOR EVENT - Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar evento de apertura'
    });
  }
});

// Ruta de prueba para verificar la tabla historial_aperturas
app.get('/api/history-test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🧪 HISTORY-TEST - Verificando tabla historial_aperturas...');
    
    // Verificar que la tabla existe
    const tableCheck = await executeQuery(`
      SELECT COUNT(*) as table_exists 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'historial_aperturas'
    `);
    
    console.log('🧪 HISTORY-TEST - Tabla existe:', tableCheck[0]?.table_exists > 0);
    
    if (tableCheck[0]?.table_exists === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tabla historial_aperturas no existe',
        message: 'Ejecutar create_historial_aperturas_table.sql'
      });
    }
    
    // Verificar estructura de la tabla
    const structure = await executeQuery(`DESCRIBE historial_aperturas`);
    console.log('🧪 HISTORY-TEST - Estructura de tabla:', structure);
    
    // Verificar datos en la tabla
    const count = await executeQuery(`SELECT COUNT(*) as total FROM historial_aperturas`);
    console.log('🧪 HISTORY-TEST - Total de registros:', count[0]?.total);
    
    // Obtener algunos registros de ejemplo
    const sample = await executeQuery(`
      SELECT h.*, u.username, u.nombre, u.apellido, u.rol
      FROM historial_aperturas h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      LIMIT 3
    `);
    
    console.log('🧪 HISTORY-TEST - Registros de ejemplo:', sample);
    
    res.json({
      success: true,
      tableExists: true,
      totalRecords: count[0]?.total,
      structure: structure,
      sampleData: sample
    });
    
  } catch (error) {
    console.error('❌ HISTORY-TEST - Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Ruta para obtener historial de aperturas con filtros avanzados (solo admin)
app.get('/api/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, dateFrom, dateTo, user, page = 1, limit = 10 } = req.query;
    
    console.log('📊 HISTORY - Filtros recibidos:', { status, dateFrom, dateTo, user, page, limit });
    
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
    
    console.log('📊 HISTORY - Query ejecutado:', query);
    console.log('📊 HISTORY - Parámetros:', params);
    
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
      role: record.rol
    }));
    
    console.log(`✅ HISTORY - ${formattedHistory.length} registros encontrados de ${totalRecords} total`);
    
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
    console.error('❌ HISTORY - Error completo:', error);
    console.error('❌ HISTORY - Stack trace:', error.stack);
    console.error('❌ HISTORY - Error message:', error.message);
    console.error('❌ HISTORY - Error code:', error.code);
    
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
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 API disponible en http://localhost:${PORT}/api`);
  console.log(`🔌 WebSocket disponible en ws://localhost:${PORT}/ws`);
  
  // Verificar conexión a base de datos
  try {
    await executeQuery('SELECT 1');
    console.log('✅ Conexión a base de datos MySQL establecida');
    
    // Cargar configuración del sistema desde base de datos
    const configCargada = await loadAllConfig();
    if (configCargada) {
      console.log('📋 Configuración del sistema cargada desde base de datos');
      console.log(`   - Node-RED: ${configCargada.node_red?.url || 'No configurado'}`);
      console.log(`   - Horarios: ${Object.keys(configCargada.horarios || {}).length} períodos configurados`);
    } else {
      console.log('⚠️ Usando configuración por defecto (tabla configuracion_sistema no encontrada)');
    }
  } catch (error) {
    console.error('❌ Error conectando a base de datos:', error.message);
    console.log('Asegúrate de que MySQL esté ejecutándose y la base de datos exista');
    console.log('⚠️ Usando configuración por defecto en memoria');
  }
  
  console.log('\n📡 Endpoints disponibles:');
  console.log('- POST /api/login');
  console.log('- POST /api/register (admin only)');
  console.log('- POST /api/verify-token');
  console.log('- POST /api/abrir-puerta');
  console.log('- POST /api/register-door-event');
  console.log('- GET /api/verify-token');
  console.log('- POST /api/logout');
  console.log('- GET /api/users (admin only)');
  console.log('- PUT /api/users/:id (admin only)');
  console.log('- DELETE /api/users/:id (admin only)');
  console.log('- GET /api/pending-tokens (admin only)');
  console.log('- POST /api/revoke-token (usuario actual)');
  console.log('- POST /api/revoke-token/:id (admin only)');
  console.log('- GET /api/config (admin only)');
  console.log('- PUT /api/config (admin only)');
  console.log('- GET /api/notifications (admin only)');
  console.log('- GET /api/history (admin only)');
});
