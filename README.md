# Sistema de Apertura de Puerta

Sistema completo de apertura remota de puerta desarrollado con React y Express.js, integrado con Node-RED para validación de ubicación.

## 🚀 Características

- **Autenticación Segura**: Sistema de tokens permanentes con activación por dispositivo
- **Gestión de Usuarios**: Panel de administración completo
- **Validación de Ubicación**: Integración con Node-RED para verificar coordenadas GPS
- **Historial Completo**: Registro de todas las aperturas con filtros avanzados
- **Notificaciones**: Sistema de notificaciones en tiempo real
- **WebSocket**: Comunicación bidireccional para actualizaciones instantáneas
- **Responsive Design**: Interfaz moderna y adaptable

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js** con Express.js
- **MySQL** para base de datos
- **WebSocket** para comunicación en tiempo real
- **JWT** para autenticación
- **bcryptjs** para encriptación de contraseñas
- **Crypto** para encriptación bidireccional

### Frontend
- **React 19** con hooks modernos
- **CSS3** con efectos visuales avanzados
- **Fetch API** para comunicación con backend

### Integración
- **Node-RED** para procesamiento de datos de ubicación
- **Axios** para peticiones HTTP

## 📋 Requisitos Previos

- Node.js (versión 14 o superior)
- MySQL (versión 5.7 o superior)
- Git

## ⚙️ Instalación

### 1. Clonar el Repositorio
```bash
git clone https://github.com/GuillermoAngel27/React_Apertura-Puerta.git
cd React_Apertura-Puerta
```

### 2. Instalar Dependencias del Servidor
```bash
npm install
```

### 3. Instalar Dependencias del Cliente
```bash
cd client
npm install
cd ..
```

### 4. Configurar Base de Datos
1. Crear base de datos MySQL llamada `sistema_puerta`
2. Copiar el archivo de configuración:
```bash
cp config.env.example config.env
```
3. Editar `config.env` con tus credenciales de MySQL

### 5. Configurar Node-RED
- Instalar Node-RED
- Crear un endpoint en `http://localhost:1880/datosRecibidos`
- Configurar la URL en el archivo `config.env`

## 🚀 Ejecución

### Desarrollo
```bash
# Terminal 1: Servidor
npm run server

# Terminal 2: Cliente
npm run client
```

### Producción
```bash
# Construir cliente
npm run build

# Iniciar servidor
npm start
```

## 📱 Uso del Sistema

### Para Administradores
1. **Login**: Acceder con credenciales de administrador
2. **Gestión de Usuarios**: Crear, editar y eliminar usuarios
3. **Configuración**: Establecer URL de Node-RED y horarios
4. **Historial**: Revisar todas las aperturas con filtros
5. **Notificaciones**: Gestionar tokens pendientes de activación

### Para Usuarios
1. **Login**: Ingresar credenciales asignadas
2. **Activación de Token**: Activar dispositivo para uso permanente
3. **Apertura de Puerta**: Usar botón principal con validación GPS
4. **Historial Personal**: Ver sus propias aperturas

## 🔧 Configuración Avanzada

### Variables de Entorno
- `DB_HOST`: Host de MySQL
- `DB_USER`: Usuario de MySQL
- `DB_PASSWORD`: Contraseña de MySQL
- `DB_NAME`: Nombre de la base de datos
- `JWT_SECRET`: Clave secreta para JWT
- `ENCRYPTION_KEY`: Clave de encriptación (32 caracteres)
- `NODE_RED_URL`: URL del endpoint de Node-RED
- `PORT`: Puerto del servidor

### Estructura de Base de Datos
El sistema crea automáticamente las tablas necesarias:
- `usuarios`: Gestión de usuarios y tokens
- `historial_aperturas`: Registro de eventos
- `configuracion_sistema`: Configuración dinámica

## 🔒 Seguridad

- **Tokens Permanentes**: Sistema de tokens únicos por dispositivo
- **Encriptación**: Contraseñas encriptadas con algoritmo bidireccional
- **Validación de Ubicación**: Verificación GPS obligatoria
- **Sesiones Seguras**: Cookies HTTPOnly con expiración configurable
- **CORS**: Configuración de origen cruzado segura

## 📊 API Endpoints

### Autenticación
- `POST /api/login` - Iniciar sesión
- `POST /api/logout` - Cerrar sesión
- `GET /api/verify-token` - Verificar token
- `POST /api/activate-token` - Activar dispositivo

### Usuarios (Admin)
- `GET /api/users` - Listar usuarios
- `POST /api/register` - Registrar usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

### Sistema
- `POST /api/abrir-puerta` - Abrir puerta
- `GET /api/history` - Obtener historial
- `GET /api/config` - Obtener configuración
- `PUT /api/config` - Actualizar configuración

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 👨‍💻 Autor

**Guillermo Angel**
- GitHub: [@GuillermoAngel27](https://github.com/GuillermoAngel27)

## 🙏 Agradecimientos

- Node-RED por la plataforma de flujo
- React por el framework frontend
- Express.js por el framework backend
- MySQL por la base de datos
