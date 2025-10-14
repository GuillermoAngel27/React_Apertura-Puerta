import React, { useState, useEffect } from 'react';
import ConfigModal from './ConfigModal';
import UserManagementModal from './UserManagementModal';
import NotificationsModal from './NotificationsModal';
import HistoryModal from './HistoryModal';
import MessageContainer from './MessageContainer';
import LogoutAnimation from './LogoutAnimation';
import useAnimatedMessages from '../hooks/useAnimatedMessages';
import './Dashboard.css';
import { apiPost } from '../utils/api';

const Dashboard = ({ user, onLogout }) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [logoutCountdown, setLogoutCountdown] = useState(0);
  const [showLogoutAnimation, setShowLogoutAnimation] = useState(false);

  // Sistema de mensajes animados
  const { messages, showSuccess, showError, showWarning, showInfo, showLoading, removeMessage } = useAnimatedMessages();





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
   
        } else {
          // PC: Configuración rápida
          options.enableHighAccuracy = false;
          options.timeout = 3000; // 3 segundos máximo
          options.maximumAge = 300000; // 5 minutos de cache
        }
      } else if (attempt === 2) {
        if (isMobileDevice) {
          // MÓVIL: Precisión media con cache
          options.enableHighAccuracy = true;
          options.timeout = 8000; // 8 segundos
          options.maximumAge = 30000; // 30 segundos de cache
        } else {
          // PC: Configuración permisiva
          options.enableHighAccuracy = false;
          options.timeout = 2000; // 2 segundos
          options.maximumAge = 600000; // 10 minutos de cache
        }
      } else if (attempt === 3) {
        // Último intento: Configuración muy permisiva para ambos
        options.enableHighAccuracy = false;
        options.timeout = isMobileDevice ? 5000 : 2000; // Más rápido en PC
        options.maximumAge = isMobileDevice ? 60000 : 900000; // 15 minutos en PC
       
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


          // Solo reintentar si la precisión es muy baja y no es el último intento
          if (locationData.accuracy > precisionThreshold && attempt < maxAttempts) {
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
          // No mostrar mensaje para mantener discreción
        } catch (geoError) {
          showMessage(`🚫 Error crítico de ubicación: ${geoError.message}`, 'error');
          setLoading(false);
          return; // NO continuar sin ubicación por seguridad
        }
      } else {
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

        const response = await apiPost('/api/abrir-puerta', requestBody);

      const data = await response.json();

    

      if (response.ok) {
        // Verificar si la puerta se puede abrir según la respuesta del backend
        
        if (data.canOpenDoor === true) {
          showMessage('Puerta abierta - Usuario autorizado', 'success');
        } else if (data.status === 'fuera_de_area') {
          showMessage('Usuario fuera de ubicación autorizada', 'error');
        } else if (data.status === 'warning') {
          showMessage(`⚠️ ${data.message}`, 'warning');
        } else if (data.status === 'incorrecto') {
          showMessage(`🚨 Error del sistema: ${data.message}`, 'error');
        } else {
          // Fallback para otros casos - Solo mostrar éxito si realmente se puede abrir
          if (data.canOpenDoor === true) {
            showMessage(data.message || '🎉 ¡Puerta abierta exitosamente! Acceso autorizado', 'success');
          } else {
            showMessage(data.message || '🚫 Acceso denegado: Ubicación no autorizada', 'error');
          }
        }
        
        if (locationData) {
        
        } else {
        }
      } else {
        
        // Detectar token inválido o cookies borradas - CERRAR SESIÓN AUTOMÁTICAMENTE
        if (data.autoLogout || data.tokenInvalid) {
          
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
            clearInterval(countdownInterval);
            onLogout();
          }, 3000); // 3 segundos como solicitado
        } else {
          // Otros errores - mostrar normalmente sin cerrar sesión
          showMessage(`🚨 Error del sistema: ${data.message}`, 'error');
        }
      }
    } catch (error) {
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
    
  };

  const handleLogoutClick = () => {
    setShowLogoutAnimation(true);
  };

  const handleLogoutAnimationComplete = () => {
    setShowLogoutAnimation(false);
    onLogout();
  };

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <div className="dashboard-logo">
              <img src="/logotaq02.png" alt="Logo TAQ" className="logo-image" />
            </div>
          </div>
          <div className="navbar-actions">
            {user.role === 'admin' && (
              <>
                <button 
                  className="notifications-button"
                  onClick={() => setShowNotificationsModal(true)}
                  title="Ver actividad de login/logout"
                >
                  🔐
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
              <button className="logout-button" onClick={handleLogoutClick}>
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
               <span className="nav-icon">🔐</span>
               <span className="nav-label"></span>
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
          onClick={handleLogoutClick}
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

        {showNotificationsModal && user.role === 'admin' && (
          <NotificationsModal 
            onClose={() => setShowNotificationsModal(false)}
          />
        )}

              {showHistoryModal && (
                <HistoryModal
                  onClose={() => setShowHistoryModal(false)}
                />
              )}

      {/* Animación de cierre de sesión */}
      {showLogoutAnimation && (
        <LogoutAnimation
          onComplete={handleLogoutAnimationComplete}
          userName={user.username}
                />
              )}
    </div>
  );
};

export default Dashboard;
