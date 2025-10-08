import React, { useState, useEffect } from 'react';
import ConfigModal from './ConfigModal';
import UserManagementModal from './UserManagementModal';
import NotificationsModal from './NotificationsModal';
import HistoryModal from './HistoryModal';
import MessageContainer from './MessageContainer';
import useAnimatedMessages from '../hooks/useAnimatedMessages';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(0);
  const [notificationsRefreshTrigger, setNotificationsRefreshTrigger] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  // Sistema de mensajes animados
  const { messages, showSuccess, showError, showWarning, showInfo, showLoading, removeMessage } = useAnimatedMessages();

  // WebSocket temporalmente deshabilitado - usando polling

  // Función para cargar contador de notificaciones
  const loadNotificationCount = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/notifications', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.notifications?.length || 0;
        setNotificationCount(count);
        console.log(`🔔 Dashboard: Contador de notificaciones actualizado: ${count}`);
      }
    } catch (error) {
      console.error('Error cargando contador de notificaciones:', error);
    }
  };

  // Función para disparar refresco de notificaciones
  const triggerNotificationsRefresh = () => {
    console.log('🔄 Dashboard: Disparando refresco de notificaciones');
    setNotificationsRefreshTrigger(prev => prev + 1);
    // También actualizar el contador
    loadNotificationCount();
  };

  // Cargar contador inicial al montar el componente
  useEffect(() => {
    loadNotificationCount();
  }, []);

  // Escuchar eventos globales para refrescar notificaciones
  useEffect(() => {
    const handleTokenGenerated = (event) => {
      console.log('🔄 Dashboard: Evento tokenGenerated recibido:', event.detail);
      triggerNotificationsRefresh();
    };

    const handleTokenActivated = (event) => {
      console.log('🔄 Dashboard: Evento tokenActivated recibido:', event.detail);
      triggerNotificationsRefresh();
    };

    // Polling para detectar cambios (WebSocket temporalmente deshabilitado)
    let pollingInterval;
    const startPolling = () => {
      console.log('🔄 Dashboard: Iniciando polling para contador');
      pollingInterval = setInterval(async () => {
        try {
          const response = await fetch('http://localhost:5000/api/notifications', {
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            const currentCount = data.notifications?.length || 0;
            
            if (currentCount !== notificationCount) {
              console.log(`🔄 Dashboard: Polling detectó cambio en contador: ${notificationCount} → ${currentCount}`);
              setNotificationCount(currentCount);
            }
          }
        } catch (error) {
          console.error('Error en polling:', error);
        }
      }, 5000); // Verificar cada 5 segundos
    };

    // Registrar listeners
    window.addEventListener('tokenGenerated', handleTokenGenerated);
    window.addEventListener('tokenActivated', handleTokenActivated);
    
    // Iniciar polling
    startPolling();

    // Cleanup
    return () => {
      window.removeEventListener('tokenGenerated', handleTokenGenerated);
      window.removeEventListener('tokenActivated', handleTokenActivated);
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [notificationCount]);

  const showMessage = (text, type) => {
    switch (type) {
      case 'success':
        showSuccess(text);
        break;
      case 'error':
        showError(text);
        break;
      case 'warning':
        showWarning(text);
        break;
      case 'loading':
        showLoading(text);
        break;
      default:
        showInfo(text);
    }
  };


  const getCurrentLocation = (attempt = 1, maxAttempts = 3) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada por este navegador'));
        return;
      }

      // Detectar tipo de dispositivo
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobileDevice = isMobile || isTouchDevice;
      
      console.log(`📱 Dispositivo detectado: ${isMobileDevice ? 'MÓVIL' : 'PC/DESKTOP'}`);

      // Configuración base
      const options = {
        enableHighAccuracy: isMobileDevice, // Solo alta precisión en móviles
        timeout: isMobileDevice ? 8000 : 3000, // Más rápido en PC
        maximumAge: isMobileDevice ? 10000 : 60000 // Más cache en PC
      };

      // Configuración específica por intento y dispositivo
      if (attempt === 1) {
        if (isMobileDevice) {
          // MÓVIL: Máxima precisión
          options.enableHighAccuracy = true;
          options.timeout = 10000; // 10 segundos para GPS preciso
          options.maximumAge = 0; // Sin cache, ubicación fresca
          console.log('🎯 Intento 1 (MÓVIL): Máxima precisión GPS');
        } else {
          // PC: Configuración rápida
          options.enableHighAccuracy = false;
          options.timeout = 3000; // 3 segundos máximo
          options.maximumAge = 300000; // 5 minutos de cache
          console.log('💻 Intento 1 (PC): Configuración rápida');
        }
      } else if (attempt === 2) {
        if (isMobileDevice) {
          // MÓVIL: Precisión media con cache
          options.enableHighAccuracy = true;
          options.timeout = 8000; // 8 segundos
          options.maximumAge = 30000; // 30 segundos de cache
          console.log('🎯 Intento 2 (MÓVIL): Precisión media con cache');
        } else {
          // PC: Configuración permisiva
          options.enableHighAccuracy = false;
          options.timeout = 2000; // 2 segundos
          options.maximumAge = 600000; // 10 minutos de cache
          console.log('💻 Intento 2 (PC): Configuración permisiva');
        }
      } else if (attempt === 3) {
        // Último intento: Configuración muy permisiva para ambos
        options.enableHighAccuracy = false;
        options.timeout = isMobileDevice ? 5000 : 2000; // Más rápido en PC
        options.maximumAge = isMobileDevice ? 60000 : 900000; // 15 minutos en PC
        console.log(`🔄 Intento 3 (${isMobileDevice ? 'MÓVIL' : 'PC'}): Configuración muy permisiva`);
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
            attempt: attempt
          };

          // VALIDACIÓN DE PRECISIÓN
          console.log(`🎯 Ubicación obtenida (Intento ${attempt}):`, {
            lat: locationData.lat,
            lon: locationData.lon,
            accuracy: `${locationData.accuracy}m`,
            altitude: locationData.altitude ? `${locationData.altitude}m` : 'N/A',
            speed: locationData.speed ? `${locationData.speed}m/s` : 'N/A'
          });

          // Evaluar calidad de la ubicación según el dispositivo
          let quality = 'EXCELENTE';
          let precisionThreshold = isMobileDevice ? 100 : 1000; // Más permisivo en PC
          
          if (isMobileDevice) {
            // Estándares para móviles (GPS real)
            if (locationData.accuracy > 50) quality = 'BUENA';
            if (locationData.accuracy > 100) quality = 'REGULAR';
            if (locationData.accuracy > 200) quality = 'BAJA';
          } else {
            // Estándares para PC (IP/WiFi)
            if (locationData.accuracy > 500) quality = 'BUENA';
            if (locationData.accuracy > 1000) quality = 'REGULAR';
            if (locationData.accuracy > 2000) quality = 'BAJA';
          }

          console.log(`📊 Calidad de ubicación (${isMobileDevice ? 'MÓVIL' : 'PC'}): ${quality} (${locationData.accuracy}m)`);

          // Solo reintentar si la precisión es muy baja y no es el último intento
          if (locationData.accuracy > precisionThreshold && attempt < maxAttempts) {
            console.log(`⚠️ Precisión baja (${locationData.accuracy}m), reintentando...`);
            const retryDelay = isMobileDevice ? 2000 : 1000; // Más rápido en PC
            setTimeout(() => {
              getCurrentLocation(attempt + 1, maxAttempts)
                .then(resolve)
                .catch(reject);
            }, retryDelay);
            return;
          }

          resolve(locationData);
        },
        (error) => {
          let errorMessage = 'Error al obtener ubicación: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Permiso denegado por el usuario';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Ubicación no disponible';
              break;
            case error.TIMEOUT:
              errorMessage += 'Tiempo de espera agotado';
              break;
            default:
              errorMessage += 'Error desconocido';
              break;
          }
          
          // Si no es el último intento, reintentar
          if (attempt < maxAttempts) {
            console.log(`Intento ${attempt} falló, reintentando... (${errorMessage})`);
            setTimeout(() => {
              getCurrentLocation(attempt + 1, maxAttempts)
                .then(resolve)
                .catch(reject);
            }, 1000); // Esperar 1 segundo antes del siguiente intento
          } else {
            reject(new Error(`${errorMessage} (${maxAttempts} intentos fallidos)`));
          }
        },
        options
      );
    });
  };

  const handleAbrirPuerta = async () => {
    setLoading(true);

    try {
      // Obtener geolocalización solo para usuarios (NO para admins ni jefes)
      let locationData = null;
      if (user.role === 'user') {
        try {
          // Obtener ubicación de forma silenciosa (solo animación del botón)
          locationData = await getCurrentLocation();
          console.log('Ubicación obtenida:', locationData);
          // No mostrar mensaje para mantener discreción
        } catch (geoError) {
          console.error('Error crítico: No se pudo obtener la ubicación:', geoError.message);
          showMessage(`🚫 Error crítico de ubicación: ${geoError.message}`, 'error');
          setLoading(false);
          return; // NO continuar sin ubicación por seguridad
        }
      } else {
        console.log('Usuario admin/jefe - no se requiere geolocalización');
      }

        // Token se maneja automáticamente con cookies
      const requestBody = {
        timestamp: new Date().toISOString(),
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      };

      // Agregar coordenadas solo si están disponibles (usuarios normales)
      if (locationData) {
        requestBody.location = {
          lat: locationData.lat,
          lon: locationData.lon,
          accuracy: locationData.accuracy,
          attempt: locationData.attempt
        };
      }

        const response = await fetch('http://localhost:5000/api/abrir-puerta', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(requestBody)
        });

      const data = await response.json();

      // LOGGING DETALLADO DEL FRONTEND
      console.log('🔍 FRONTEND - Respuesta completa del servidor:', data);
      console.log('🔍 FRONTEND - response.ok:', response.ok);
      console.log('🔍 FRONTEND - data.canOpenDoor:', data.canOpenDoor);
      console.log('🔍 FRONTEND - data.status:', data.status);
      console.log('🔍 FRONTEND - data.message:', data.message);

      if (response.ok) {
        // Verificar si la puerta se puede abrir según la respuesta del backend
        console.log('🔍 FRONTEND - Evaluando decisión...');
        console.log('🔍 FRONTEND - data.canOpenDoor === true:', data.canOpenDoor === true);
        console.log('🔍 FRONTEND - data.status === "location_denied":', data.status === 'location_denied');
        
        if (data.canOpenDoor === true) {
          showMessage('Puerta abierta - Usuario autorizado', 'success');
          console.log('✅ FRONTEND - Puerta abierta - Usuario autorizado');
        } else if (data.status === 'fuera_de_area') {
          showMessage('Usuario fuera de ubicación autorizada', 'error');
          console.log('❌ FRONTEND - Acceso denegado - Usuario fuera de ubicación autorizada');
        } else if (data.status === 'warning') {
          showMessage(`⚠️ ${data.message}`, 'warning');
          console.log('⚠️ FRONTEND - Advertencia:', data.message);
        } else if (data.status === 'incorrecto') {
          showMessage(`🚨 Error del sistema: ${data.message}`, 'error');
          console.log('🚨 FRONTEND - Error del sistema:', data.message);
        } else {
          // Fallback para otros casos - Solo mostrar éxito si realmente se puede abrir
          if (data.canOpenDoor === true) {
            showMessage(data.message || '🎉 ¡Puerta abierta exitosamente! Acceso autorizado', 'success');
          } else {
            showMessage(data.message || '🚫 Acceso denegado: Ubicación no autorizada', 'error');
          }
          console.log('📝 FRONTEND - Respuesta del servidor:', data.message);
        }
        
        console.log('Datos enviados a Node-RED:', data.datos);
        if (locationData) {
          console.log('Coordenadas enviadas:', {
            lat: locationData.lat,
            lon: locationData.lon,
            accuracy: locationData.accuracy,
            attempt: locationData.attempt
          });
        } else {
          console.log('Usuario admin/jefe - sin coordenadas enviadas');
        }
      } else {
        console.log(`❌ ERROR PUERTA: Status ${response.status}, Message: ${data.message}`);
        
        // Detectar token inválido o cookies borradas - CERRAR SESIÓN AUTOMÁTICAMENTE
        if (data.autoLogout || data.tokenInvalid) {
          console.log('🚨 TOKEN INVÁLIDO/COOKIES BORRADAS DETECTADO - Cerrando sesión automáticamente');
          
          // Iniciar contador visual
          setLogoutCountdown(3);
          
          // Contador visual cada segundo
          const countdownInterval = setInterval(() => {
            setLogoutCountdown(prev => {
              if (prev <= 1) {
                clearInterval(countdownInterval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          // Cerrar sesión automáticamente después de 3 segundos
          setTimeout(() => {
            console.log('🚪 CERRANDO SESIÓN AUTOMÁTICA - Token inválido/cookies borradas');
            clearInterval(countdownInterval);
            onLogout();
          }, 3000); // 3 segundos como solicitado
        } else {
          // Otros errores - mostrar normalmente sin cerrar sesión
          showMessage(`🚨 Error del sistema: ${data.message}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error al abrir puerta:', error);
      showMessage('🌐 Error de conexión. Verifique que el servidor esté ejecutándose.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSuccess = () => {
    setShowConfigModal(false);
    showMessage('⚙️ ¡Configuración actualizada exitosamente! Sistema optimizado', 'success');
  };

  const handleUserManagementSuccess = (action = '') => {
    // Solo cerrar modal para acciones que no sean refresh token
    if (action !== 'token_refreshed') {
      setShowUserManagementModal(false);
      showMessage('👥 ¡Usuarios actualizados exitosamente! Gestión completada', 'success');
    }
    
    // Si la acción fue refrescar token, disparar refresco de notificaciones
    if (action === 'token_refreshed') {
      console.log('🔄 Dashboard: Token refrescado, actualizando notificaciones');
      triggerNotificationsRefresh();
    }
  };

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <h1>Control Puerta</h1>
          </div>
          <div className="navbar-actions">
            {user.role === 'admin' && (
              <>
                <button 
                  className="notifications-button"
                  onClick={() => {
                    setShowNotificationsModal(true);
                    // Actualizar contador cuando se abre el modal
                    loadNotificationCount();
                  }}
                  title="Ver notificaciones de tokens"
                >
                  🔔
                  {notificationCount > 0 && (
                    <span className="notification-badge">
                      {notificationCount}
                    </span>
                  )}
                </button>
                <button
                  className="history-button"
                  onClick={() => setShowHistoryModal(true)}
                  title="Ver histórico de aperturas"
                >
                  📋
                </button>
                 <button 
                   className="user-management-button"
                   onClick={() => setShowUserManagementModal(true)}
                 >
                   👥
                 </button>
                 <button 
                   className="config-button"
                   onClick={() => setShowConfigModal(true)}
                 >
                   ⚙️
                 </button>
               </>
             )}
              <button className="logout-button" onClick={onLogout}>
              ❌Salir
              </button>
          </div>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="control-panel">
          <div className="panel-header">
            <h2>Control de Acceso</h2>
            {/* <p>Control remoto de la puerta</p> */}
          </div>

          <div className="control-actions">
            <button 
              className="abrir-puerta-button"
              onClick={handleAbrirPuerta}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Procesando...
                </>
              ) : (
                <>
                  🚪 Abrir Puerta
                </>
              )}
            </button>
          </div>

          {/* Sistema de mensajes animados */}
          <MessageContainer 
            messages={messages} 
            onRemoveMessage={removeMessage} 
          />

          {/* Contador regresivo para cierre de sesión */}
          {logoutCountdown > 0 && (
            <div className="logout-countdown-overlay">
              <div className="logout-countdown-content">
                <div className="logout-countdown-text">
                  Cerrando sesión...
                </div>
                <div className="logout-countdown-number">
                  {logoutCountdown}
                </div>
              </div>
            </div>
          )}

          <div className="info-panel">
            <div className="user-info">
              <div className="username-display">{user.username}</div>
              <div className="fullname-display">{user.nombre} {user.apellido}</div>
            </div>
            <div className="status-section">
              <span className="status-online">🟢 Conectado</span>
            </div>
          </div>
        </div>
      </main>

       {/* Mobile Bottom Navigation */}
       <div className="mobile-bottom-nav">
         {user.role === 'admin' && (
           <>
             <button 
               className="mobile-nav-button"
               onClick={() => setShowNotificationsModal(true)}
             >
               <span className="nav-icon">🔔</span>
               <span className="nav-label"></span>
               {notificationCount > 0 && (
                 <span className="notification-badge">{notificationCount}</span>
               )}
             </button>
                <button
                  className="mobile-nav-button"
                  onClick={() => setShowHistoryModal(true)}
                >
                  <span className="nav-icon">📋</span>
                  <span className="nav-label"></span>
                </button>
             <button 
               className="mobile-nav-button"
               onClick={() => setShowUserManagementModal(true)}
             >
               <span className="nav-icon">👥</span>
               <span className="nav-label"></span>
             </button>
             <button 
               className="mobile-nav-button"
               onClick={() => setShowConfigModal(true)}
             >
               <span className="nav-icon">⚙️</span>
               <span className="nav-label"></span>
             </button>
           </>
         )}
        
        <button 
          className="mobile-nav-button logout"
          onClick={onLogout}
        >
          <span className="nav-icon">❌</span>
          <span className="nav-label"></span>
        </button>
      </div>

       {showConfigModal && (
        <ConfigModal
          onClose={() => setShowConfigModal(false)}
          onSuccess={handleConfigSuccess}
        />
      )}

      {showUserManagementModal && (
        <UserManagementModal
          onClose={() => setShowUserManagementModal(false)}
          onSuccess={handleUserManagementSuccess}
          currentUser={user}
        />
      )}

      {showNotificationsModal && (
        <NotificationsModal 
          onClose={() => setShowNotificationsModal(false)}
          refreshTrigger={notificationsRefreshTrigger}
        />
      )}

              {showHistoryModal && (
                <HistoryModal
                  onClose={() => setShowHistoryModal(false)}
                />
              )}
    </div>
  );
};

export default Dashboard;
