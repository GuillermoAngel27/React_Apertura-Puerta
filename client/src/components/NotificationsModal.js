import React, { useState, useEffect } from 'react';
import './NotificationsModal.css';
import { apiGet } from '../utils/api';

const NotificationsModal = ({ onClose }) => {
  const [loginNotifications, setLoginNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({});
  
  // Estados para filtros
  const [searchUser, setSearchUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Modal siempre está abierto cuando se renderiza

  useEffect(() => {
    // Solo cargar datos cuando el modal se abre por primera vez
    loadLoginNotifications();
  }, []);

  // useEffect para filtros en tiempo real
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchUser.trim() || dateFrom || dateTo) {
        loadLoginNotifications();
      }
    }, 500); // Debounce de 500ms para evitar demasiadas consultas

    return () => clearTimeout(timeoutId);
  }, [searchUser, dateFrom, dateTo]);






  const loadLoginNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Construir parámetros de consulta
      const params = new URLSearchParams({
        limit: 1000, // Aumentar límite para mostrar más registros
        includeStats: false
      });
      
      // Agregar filtros si están presentes
      if (searchUser.trim()) {
        params.append('user', searchUser.trim());
      }
      if (dateFrom) {
        params.append('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.append('dateTo', dateTo);
      }
      
      // No usar filtro de horas por defecto - mostrar todos los registros
      
      const response = await apiGet(`/api/login-notifications?${params}`);

      if (response.ok) {
        const data = await response.json();
        setLoginNotifications(data.notifications || []);
        setStats(data.stats || []);
      } else {
        setError('Error al cargar notificaciones');
      }
    } catch (error) {
      setError('Error de conexión al cargar notificaciones');
    } finally {
      setLoading(false);
    }
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

  // Función para limpiar filtros
  const handleClearFilters = () => {
    setSearchUser('');
    setDateFrom('');
    setDateTo('');
  };

  // Función maskToken removida - no se utiliza

  return (
    <div className="modal-overlay">
      <div className="modal-content notifications-modal">
        <div className="modal-header">
          <h2>🔐 Actividad de Login/Logout</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="notifications-content">
          <div className="notifications-top-bar">
            <div className="filters-section">
              <div className="inline-filters">
                <input
                  type="text"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="👤 Usuario..."
                  className="inline-filter-input"
                />
                
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="inline-filter-input"
                  title="Fecha inicio"
                />
                
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="inline-filter-input"
                  title="Fecha fin"
                />
                
                <button 
                  className="clear-filters-button inline"
                  onClick={handleClearFilters}
                  disabled={loading}
                  title="Limpiar filtros"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <button 
              className="refresh-icon-button"
              onClick={() => {
                loadLoginNotifications();
              }}
              disabled={loading}
              title="Actualizar notificaciones de login/logout"
            >
              🔄
            </button>
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

          {!loading && !error && loginNotifications.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔐</div>
              <h3>No hay actividad de login/logout</h3>
              <p>No se han registrado eventos de login o logout en las últimas 24 horas</p>
            </div>
          )}

          {!loading && !error && loginNotifications.length > 0 && (
            <div className="notifications-list">
              {loginNotifications.map((notification) => (
                <div key={notification.id} className={`notification-item login-notification ${notification.tipo}`}>
                  <div className="notification-header">
                    <div className="notification-icon">
                      {notification.tipo === 'login_exitoso' && '✅'}
                      {notification.tipo === 'login_fallido' && '❌'}
                      {notification.tipo === 'logout' && '👋'}
                    </div>
                    <div className="notification-info">
                      <div className="notification-title">{notification.titulo}</div>
                      <div className="notification-message">{notification.mensaje}</div>
                      <div className="notification-details">
                        <span className="username">👤 {notification.nombre_usuario}</span>
                        <span className="ip">🌐 {notification.direccion_ip}</span>
                        <span className="severity">⚡ {notification.severidad}</span>
                      </div>
                    </div>
                    <div className="notification-date">
                      {formatDate(notification.fecha_creacion)}
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
