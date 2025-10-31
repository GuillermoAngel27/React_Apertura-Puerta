import React, { useState, useEffect, useRef } from 'react';
import './NotificationsModal.css';
import { apiGet } from '../utils/api';

const NotificationsModal = ({ onClose }) => {
  const [loginNotifications, setLoginNotifications] = useState([]);
  const [allNotifications, setAllNotifications] = useState([]); // Almacenar todos los datos
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados para filtros
  const [searchUser, setSearchUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [notificationsPerPage] = useState(10); // 10 notificaciones por página
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal siempre está abierto cuando se renderiza

  useEffect(() => {
    // Solo cargar datos cuando el modal se abre por primera vez
    loadLoginNotifications();
  }, []); // Solo ejecutar una vez al montar el componente

  // Evitar doble carga: solo recargar cuando existan filtros activos y no en el primer render
  const didMountFilters = useRef(false);
  useEffect(() => {
    // Saltar primera ejecución (montaje del modal)
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return;
    }

    const hasFilters =
      (searchUser && searchUser.trim() !== '') || dateFrom !== '' || dateTo !== '';

    if (!hasFilters) return;

    const timeoutId = setTimeout(() => {
      loadLoginNotifications();
    }, 500); // Debounce de 500ms para evitar demasiadas consultas

    return () => clearTimeout(timeoutId);
  }, [searchUser, dateFrom, dateTo]);

  // Reset page when search term or date filters change
  useEffect(() => {
    if (searchUser.trim() !== '' || dateFrom !== '' || dateTo !== '') {
      setCurrentPage(1);
    }
  }, [searchUser, dateFrom, dateTo]);

  // Función para aplicar paginación local
  const applyPagination = (notificationsData) => {
    const totalNotificationsCount = notificationsData.length;
    const totalPagesCount = Math.ceil(totalNotificationsCount / notificationsPerPage);
    
    // Validar que currentPage no exceda totalPages
    let validCurrentPage = currentPage;
    if (currentPage > totalPagesCount && totalPagesCount > 0) {
      validCurrentPage = totalPagesCount;
      setCurrentPage(totalPagesCount);
    }
    
    // Aplicar paginación
    const startIndex = (validCurrentPage - 1) * notificationsPerPage;
    const endIndex = startIndex + notificationsPerPage;
    const paginatedNotifications = notificationsData.slice(startIndex, endIndex);
    
    // Actualizar estados
    setLoginNotifications(paginatedNotifications);
    setTotalPages(totalPagesCount);
    setTotalNotifications(totalNotificationsCount);
  };

  // useEffect para manejar cambios de página sin refrescar datos
  useEffect(() => {
    // Solo actualizar la paginación local sin hacer nueva consulta al backend
    if (allNotifications.length > 0) {
      applyPagination(allNotifications);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);






  const loadLoginNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Construir parámetros de consulta - Solicitar TODOS los registros
      const params = new URLSearchParams({
        includeStats: 'false',
        limit: '1000' // Solicitar un límite alto para obtener todos los registros
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
      
      const response = await apiGet(`/api/login-notifications?${params}`);

      if (response.ok) {
        const data = await response.json();
        
        // Almacenar todos los registros
        const allNotificationsData = data.notifications || [];
        setAllNotifications(allNotificationsData);
        
        // Aplicar paginación inicial
        applyPagination(allNotificationsData);
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

  // Funciones de paginación
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages && totalPages > 0) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleFirstPage = () => {
    if (currentPage > 1) {
      setCurrentPage(1);
    }
  };

  const handleLastPage = () => {
    if (currentPage < totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  };

  // Manejar tecla Escape para cerrar modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal-content notifications-modal">
        <div className="modal-header">
          <h2>🔐 Actividad de Login/Logout</h2>
          <button 
            className="close-button" 
            onClick={onClose}
            aria-label="Cerrar modal de notificaciones"
          >
            ✕
          </button>
        </div>

        <div className="notifications-content">
          <div className="notifications-top-bar">
            <div className="filters-section">
              {/* Primera fila: Búsqueda */}
              <div className="search-row">
                <input
                  type="text"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="👤 Usuario..."
                  className="search-input"
                />
              </div>
              
              {/* Segunda fila: Fechas */}
              <div className="dates-row">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="notifications-date-input"
                  title="Fecha inicio"
                />
                
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="notifications-date-input"
                  title="Fecha fin"
                />
              </div>
              
              {/* Botones - Fila con dos columnas */}
              <div className="buttons-row">
                <button 
                  className="clear-filters-button"
                  onClick={handleClearFilters}
                  disabled={loading}
                  title="Limpiar filtros"
                  aria-label="Limpiar filtros de búsqueda"
                >
                  🗑️
                </button>
                
                <button 
                  className="refresh-button"
                  onClick={() => {
                    loadLoginNotifications();
                  }}
                  disabled={loading}
                  title="Actualizar notificaciones de login/logout"
                  aria-label="Actualizar lista de notificaciones"
                >
                  🔄
                </button>
              </div>
            </div>
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
            <>
              {/* Área scrollable para notificaciones */}
              <div className="notifications-scroll-area">
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
                          <div className="notification-user">👤 {notification.nombre_usuario}</div>
                        </div>
                        <div className="notification-date">
                          {formatDate(notification.fecha_creacion)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paginación - Fija en la parte inferior */}
              <div className="notifications-pagination-container">
                <div className="notifications-pagination-controls">
                  {totalPages > 1 && (
                    <>
                      <button 
                        className="notifications-pagination-button"
                        onClick={handleFirstPage}
                        disabled={currentPage === 1 || loading}
                        title="Primera página"
                        aria-label="Ir a primera página"
                      >
                        ◀◀
                      </button>
                      <button 
                        className="notifications-pagination-button"
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1 || loading}
                        title="Página anterior"
                        aria-label="Ir a página anterior"
                      >
                        ◀
                      </button>
                    </>
                  )}
                  
                  <div className="notifications-pagination-info" role="status" aria-live="polite">
                    {loading ? (
                      <span>⏳ Cargando...</span>
                    ) : (
                      <span>
                        {(() => {
                          const currentCount = Math.min(currentPage * notificationsPerPage, totalNotifications);
                          return `${currentCount} de ${totalNotifications} Reg.`;
                        })()}
                      </span>
                    )}
                  </div>
                  
                  {totalPages > 1 && (
                    <>
                      <button 
                        className="notifications-pagination-button"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages || loading}
                        title="Página siguiente"
                        aria-label="Ir a página siguiente"
                      >
                        ▶
                      </button>
                      <button 
                        className="notifications-pagination-button"
                        onClick={handleLastPage}
                        disabled={currentPage === totalPages || loading}
                        title="Última página"
                        aria-label="Ir a última página"
                      >
                        ▶▶
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
