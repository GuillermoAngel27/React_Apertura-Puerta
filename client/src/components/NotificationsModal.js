import React, { useState, useEffect } from 'react';
import './NotificationsModal.css';

const NotificationsModal = ({ onClose, refreshTrigger = 0 }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Modal siempre está abierto cuando se renderiza
  // Removido: visibleTokens ya no se necesita

  useEffect(() => {
    loadNotifications();
  }, []);

  // Efecto para refrescar cuando cambie el trigger (desde Dashboard)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 NotificationsModal: Trigger recibido desde Dashboard, refrescando...');
      setIsAutoRefreshing(true);
      loadNotifications();
      
      // Ocultar indicador después de 2 segundos
      setTimeout(() => {
        setIsAutoRefreshing(false);
      }, 2000);
    }
  }, [refreshTrigger]);

  // Efecto para escuchar eventos globales directamente
  useEffect(() => {
    const handleTokenGenerated = (event) => {
      console.log('🔄 NotificationsModal: Evento tokenGenerated recibido directamente:', event.detail);
      setIsAutoRefreshing(true);
      setRefreshMessage('🆕 Nuevo token solicitado');
      loadNotifications();
      
      // Ocultar indicador después de 2 segundos
      setTimeout(() => {
        setIsAutoRefreshing(false);
        setRefreshMessage('');
      }, 2000);
    };

    const handleTokenActivated = (event) => {
      console.log('🔄 NotificationsModal: Evento tokenActivated recibido directamente:', event.detail);
      setIsAutoRefreshing(true);
      setRefreshMessage('✅ Token activado');
      loadNotifications();
      
      // Ocultar indicador después de 2 segundos
      setTimeout(() => {
        setIsAutoRefreshing(false);
        setRefreshMessage('');
      }, 2000);
    };

    // Registrar listeners globales
    window.addEventListener('tokenGenerated', handleTokenGenerated);
    window.addEventListener('tokenActivated', handleTokenActivated);

    // Cleanup
    return () => {
      window.removeEventListener('tokenGenerated', handleTokenGenerated);
      window.removeEventListener('tokenActivated', handleTokenActivated);
    };
  }, []);

  // Removido: Polling ya no es necesario, se usa sistema de eventos

  // Mostrar indicador cuando se refresca automáticamente
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  // WebSocket temporalmente deshabilitado

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔄 NotificationsModal: Cargando notificaciones...');
      
      const response = await fetch('http://localhost:5000/api/notifications', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        console.log(`✅ NotificationsModal: ${data.notifications?.length || 0} notificaciones cargadas`);
      } else {
        setError('Error al cargar las notificaciones');
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      setError('Error de conexión al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  // Función para copiar token al portapapeles
  const copyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      console.log('Token copiado al portapapeles:', token);
      // Aquí podrías agregar una notificación visual de éxito
    } catch (error) {
      console.error('Error copiando token:', error);
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = token;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  // Función para enviar token (abrir cliente de email)
  const sendToken = (token, username) => {
    const subject = `Token de activación para ${username}`;
    const body = `Hola,\n\nTu token de activación es: ${token}\n\nPor favor, ingresa este token en el sistema para activar tu dispositivo.\n\nSaludos.`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha no disponible';
    }
  };

  // Función maskToken removida - no se utiliza

  return (
    <div className="modal-overlay">
      <div className="modal-content notifications-modal">
        <div className="modal-header">
          <h2>🔔 Notificaciones de Tokens</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="notifications-content">
          <div className="notifications-top-bar">
            <button 
              className="refresh-icon-button"
              onClick={loadNotifications}
              disabled={loading}
              title="Actualizar notificaciones"
            >
              🔄
            </button>
            
            {isAutoRefreshing && (
              <div className="auto-refresh-indicator">
                {refreshMessage || '🔄 Actualizando automáticamente...'}
              </div>
            )}
          </div>

          {loading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Cargando notificaciones...</p>
            </div>
          )}

          {error && (
            <div className="error-message">{error}</div>
          )}

          {!loading && !error && notifications.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <h3>No hay notificaciones</h3>
              <p>Todos los tokens están activados correctamente</p>
            </div>
          )}

          {!loading && !error && notifications.length > 0 && (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <div key={notification.id} className="notification-item">
                  <div className="notification-header">
                    <div className="user-info">
                      <div className="user-name">
                        {notification.nombre && notification.apellido 
                          ? `${notification.nombre} ${notification.apellido}`
                          : notification.username
                        }
                      </div>
                      <div className="user-email">{notification.email}</div>
                    </div>
                    <div className="notification-date">
                      {formatDate(notification.fecha_token)}
                    </div>
                  </div>
                  
                  <div className="token-section">
                    <div className="token-label">Token:</div>
                    <div className="token-display">
                      <span className="token-value">
                        {notification.token}
                      </span>
                      <div className="token-buttons">
                        <button 
                          className="copy-token-btn"
                          onClick={() => copyToken(notification.token)}
                          title="Copiar token"
                        >
                          📋 Copiar
                        </button>
                        <button 
                          className="send-token-btn"
                          onClick={() => sendToken(notification.token, notification.username)}
                          title="Enviar por email"
                        >
                          📧 Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
