import React, { useState, useEffect, useRef } from 'react';
import './HistoryModal.css';
import { apiGet } from '../utils/api';

const HistoryModal = ({ onClose }) => {
  const [history, setHistory] = useState([]);
  const [allHistoryData, setAllHistoryData] = useState([]); // Almacenar todos los datos para paginación frontend
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false); // Loading solo para la lista
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, correcto, incorrecto, fuera_de_area, advertencia, denegado_horario, timeout, duplicate
  const [dateFrom, setDateFrom] = useState(''); // fecha desde
  const [dateTo, setDateTo] = useState(''); // fecha hasta
  const [userSearch, setUserSearch] = useState(''); // búsqueda por usuario
  const [workingHoursFilter, setWorkingHoursFilter] = useState('all'); // all, within, outside
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const itemsPerPage = 10;
  
  // Estados para dropdowns personalizados
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  
  // Estado para items expandidos
  const [expandedItems, setExpandedItems] = useState(new Set());
  
  // Ref para rastrear filtros anteriores
  const prevFilters = useRef({ statusFilter, dateFrom, dateTo, userSearch, workingHoursFilter });

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.history-dropdown-wrapper')) {
        setStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cargar datos iniciales al montar el componente
  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useEffect para cambios en filtros (cargar datos completos)
  useEffect(() => {
    const filtersChanged = 
      prevFilters.current.statusFilter !== statusFilter ||
      prevFilters.current.dateFrom !== dateFrom ||
      prevFilters.current.dateTo !== dateTo ||
      prevFilters.current.userSearch !== userSearch ||
      prevFilters.current.workingHoursFilter !== workingHoursFilter;
    
    if (filtersChanged) {
      prevFilters.current = { statusFilter, dateFrom, dateTo, userSearch, workingHoursFilter };
      setCurrentPage(1); // Reset a página 1 cuando cambian los filtros
      const timeoutId = setTimeout(() => {
        loadHistory();
      }, 300); // 300ms de debounce
      return () => clearTimeout(timeoutId);
    }
  }, [statusFilter, dateFrom, dateTo, userSearch, workingHoursFilter]);

  // useEffect para cambios solo de página (actualizar lista sin recargar)
  useEffect(() => {
    // Si tenemos datos en memoria y usamos filtros frontend, solo actualizar la lista
    if (statusFilter !== 'all' && allHistoryData.length > 0) {
      setLoadingList(true);
      setTimeout(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedHistory = allHistoryData.slice(startIndex, endIndex);
        setHistory(paginatedHistory);
        setLoadingList(false);
      }, 50); // Pequeño delay para animación suave
      return;
    }
    
    // Si usamos paginación backend, solo hacer API call cuando cambia la página
    if (statusFilter === 'all') {
      const timeoutId = setTimeout(() => {
        loadHistory(true); // Pasar true para indicar que es cambio de página
      }, 100); // Menor debounce para cambios de página
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const loadHistory = async (isPageChange = false) => {
    // Prevenir cargas múltiples simultáneas
    if (loading && !isPageChange) {
      return;
    }
    if (loadingList && isPageChange) {
      return;
    }
    
    try {
      // Si es solo cambio de página, usar loadingList en lugar de loading
      if (isPageChange) {
        setLoadingList(true);
      } else {
        setLoading(true);
      }
      setError('');
      
           // Estrategia diferente para filtros frontend vs backend
           let params;
           if (statusFilter === 'all') {
             // Para 'all', usar paginación del backend
             params = new URLSearchParams({
               status: 'all',
               dateFrom: dateFrom,
               dateTo: dateTo,
               user: userSearch,
               page: currentPage,
               limit: itemsPerPage,
               workingHours: workingHoursFilter
             });
           } else {
             // Para filtros frontend, pedir TODOS los registros sin paginación
             params = new URLSearchParams({
               status: 'all',
               dateFrom: dateFrom,
               dateTo: dateTo,
               user: userSearch,
               page: 1,
               limit: 1000, // Obtener muchos registros para filtrar
               workingHours: workingHoursFilter
             });
           }


      const response = await apiGet(`/api/history?${params}`);

           if (response.ok) {
             const data = await response.json();
             let filteredHistory = data.history || [];
             
             // Filtro inteligente en frontend para opciones simplificadas
             if (statusFilter !== 'all') {
               const originalCount = filteredHistory.length;
               
               filteredHistory = filteredHistory.filter(record => {
                 if (statusFilter === 'correcto') {
                   return record.status === 'correcto';
                 } else if (statusFilter === 'denegado') {
                   // Incluir todos los tipos de denegación
                   return ['incorrecto', 'fuera_de_area', 'denegado_horario', 'timeout'].includes(record.status);
                 } else if (statusFilter === 'sospechoso') {
                   // Incluir accesos sospechosos y duplicados
                   return ['advertencia', 'duplicate'].includes(record.status);
                 }
                 return true;
               });
               
             }
        
        setHistory(filteredHistory);
        
        // Manejar paginación según el tipo de filtro
        if (statusFilter !== 'all') {
          // Para filtros frontend, almacenar todos los datos y aplicar paginación
          const totalFiltered = filteredHistory.length;
          const calculatedTotalPages = Math.ceil(totalFiltered / itemsPerPage);
          setTotalPages(calculatedTotalPages);
          setTotalRecords(totalFiltered);
          
          // Guardar todos los datos filtrados
          setAllHistoryData(filteredHistory);
          
          // Aplicar paginación frontend a los datos filtrados
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const paginatedHistory = filteredHistory.slice(startIndex, endIndex);
          
          setHistory(paginatedHistory);
          
          // Ajustar página actual si es necesario
          if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
            setCurrentPage(calculatedTotalPages);
          }
          
        } else {
          // Para 'all', usar paginación del backend
          setAllHistoryData([]); // Limpiar datos frontend
          setHistory(filteredHistory);
          setTotalPages(data.pagination?.totalPages || 1);
          // Usar totalRecords de la paginación del backend, que es el total real de registros
          setTotalRecords(data.pagination?.totalRecords || data.pagination?.totalItems || 0);
        }
      } else {
        setError('Error al cargar el historial');
      }
    } catch (error) {
      setError('Error de conexión al cargar historial');
    } finally {
      if (isPageChange) {
        // Pequeño delay para mostrar animación suave
        setTimeout(() => {
          setLoadingList(false);
        }, 150);
      } else {
        setLoading(false);
      }
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
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return 'Fecha no disponible';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'correcto':
        return '✅';
      case 'incorrecto':
        return '❌';
      case 'fuera_de_area':
        return '🚫';
      case 'advertencia':
        return '⚠️';
      case 'denegado_horario':
        return '🕐';
      case 'timeout':
        return '⏰';
      case 'duplicate':
        return '🔄';
      default:
        return '❓';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'correcto':
        return 'Correcto';
      case 'incorrecto':
        return 'Incorrecto';
      case 'fuera_de_area':
        return 'Fuera de área';
      case 'advertencia':
        return 'Advertencia';
      case 'denegado_horario':
        return 'Denegado por horario';
      case 'timeout':
        return 'Timeout';
      case 'duplicate':
        return 'Duplicado';
      default:
        return 'Desconocido';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'correcto':
        return '#4CAF50';
      case 'incorrecto':
        return '#F44336';
      case 'fuera_de_area':
        return '#FF9800';
      case 'advertencia':
        return '#FFC107';
      case 'denegado_horario':
        return '#FF5722';
      case 'timeout':
        return '#9C27B0';
      case 'duplicate':
        return '#607D8B';
      default:
        return '#9E9E9E';
    }
  };

  // Funciones para horarios laborales
  const getWorkingHoursIcon = (isWithinHours, workingHoursInfo) => {
    if (!workingHoursInfo.isEnabled) {
      return '🚫'; // Día no laborable
    }
    return isWithinHours ? '✅' : '⏰'; // Dentro/Fuera de horario
  };

  const getWorkingHoursText = (isWithinHours, workingHoursInfo) => {
    if (!workingHoursInfo.isEnabled) {
      return `Día no laborable (${workingHoursInfo.dayName})`;
    }
    return isWithinHours 
      ? `Dentro de horario (${workingHoursInfo.workingHours})`
      : `Fuera de horario (${workingHoursInfo.workingHours})`;
  };

  const getWorkingHoursColor = (isWithinHours, workingHoursInfo) => {
    if (!workingHoursInfo.isEnabled) {
      return '#9E9E9E'; // Gris para días no laborables
    }
    return isWithinHours ? '#4CAF50' : '#FF9800'; // Verde/Naranja
  };

  // Nuevo sistema de badges específicos para tipo de acceso
  const getAccessTypeBadge = (record) => {
    const { status, isWithinWorkingHours, workingHoursInfo } = record;
    
    // Acceso Normal
    if (status === 'correcto' && isWithinWorkingHours) {
      return {
        icon: '✅',
        text: 'Acceso Normal',
        color: '#4CAF50',
        description: 'Dentro de horario laboral y ubicación autorizada',
        borderColor: 'rgba(76, 175, 80, 0.3)', // Verde desvanecido
        backgroundColor: 'rgba(76, 175, 80, 0.05)' // Verde neural glass
      };
    }
    
    // Acceso con Permisos Especiales
    if (status === 'correcto' && !isWithinWorkingHours) {
      return {
        icon: '🔑',
        text: 'Permisos Especiales',
        color: '#FF9800',
        description: 'Acceso autorizado fuera de horario laboral',
        borderColor: 'rgba(76, 175, 80, 0.3)', // Verde desvanecido (correcto)
        backgroundColor: 'rgba(76, 175, 80, 0.05)' // Verde neural glass
      };
    }
    
    // Acceso Denegado por Ubicación
    if (status === 'fuera_de_area') {
      return {
        icon: '🚫',
        text: 'Fuera de Área',
        color: '#F44336',
        description: 'Usuario fuera del área autorizada',
        borderColor: 'rgba(244, 67, 54, 0.3)', // Rojo desvanecido
        backgroundColor: 'rgba(244, 67, 54, 0.05)' // Rojo neural glass
      };
    }
    
    // Acceso Denegado por Horario
    if (status === 'denegado_horario') {
      return {
        icon: '🕐',
        text: 'Fuera de Horario',
        color: '#FF5722',
        description: 'Acceso denegado - Fuera de horario laboral',
        borderColor: 'rgba(244, 67, 54, 0.3)', // Rojo desvanecido
        backgroundColor: 'rgba(244, 67, 54, 0.05)' // Rojo neural glass
      };
    }
    
    // Acceso Incorrecto
    if (status === 'incorrecto') {
      return {
        icon: '❌',
        text: 'Acceso Incorrecto',
        color: '#F44336',
        description: 'Credenciales inválidas o error en la autenticación',
        borderColor: 'rgba(244, 67, 54, 0.3)', // Rojo desvanecido
        backgroundColor: 'rgba(244, 67, 54, 0.05)' // Rojo neural glass
      };
    }
    
    // Acceso Sospechoso
    if (status === 'advertencia') {
      return {
        icon: '⚠️',
        text: 'Acceso Sospechoso',
        color: '#FFC107',
        description: 'Patrón de acceso anómalo detectado',
        borderColor: 'rgba(255, 193, 7, 0.3)', // Amarillo desvanecido
        backgroundColor: 'rgba(255, 193, 7, 0.05)' // Amarillo neural glass
      };
    }
    
    // Timeout
    if (status === 'timeout') {
      return {
        icon: '⏰',
        text: 'Timeout',
        color: '#9C27B0',
        description: 'Tiempo de respuesta excedido',
        borderColor: 'rgba(244, 67, 54, 0.3)', // Rojo desvanecido
        backgroundColor: 'rgba(244, 67, 54, 0.05)' // Rojo neural glass
      };
    }
    
    // Duplicado
    if (status === 'duplicate') {
      return {
        icon: '🔄',
        text: 'Duplicado',
        color: '#607D8B',
        description: 'Intento de acceso duplicado',
        borderColor: 'rgba(255, 193, 7, 0.3)', // Amarillo desvanecido
        backgroundColor: 'rgba(255, 193, 7, 0.05)' // Amarillo neural glass
      };
    }
    
    // Default
    return {
      icon: '❓',
      text: 'Desconocido',
      color: '#9E9E9E',
      description: 'Estado no identificado',
      borderColor: 'rgba(158, 158, 158, 0.3)', // Gris desvanecido
      backgroundColor: 'rgba(158, 158, 158, 0.05)' // Gris neural glass
    };
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
  };

  // Funciones para dropdowns personalizados
  const handleStatusSelect = (status) => {
    setStatusFilter(status);
    setStatusDropdownOpen(false);
    setCurrentPage(1);
  };


  const handleDateFromChange = (event) => {
    setDateFrom(event.target.value);
    setCurrentPage(1);
  };

  const handleDateToChange = (event) => {
    setDateTo(event.target.value);
    setCurrentPage(1);
  };

  const handleUserSearchChange = (event) => {
    setUserSearch(event.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
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

  const clearFilters = () => {
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setUserSearch('');
    setWorkingHoursFilter('all');
    setCurrentPage(1);
  };

  // Función para toggle de items expandidos
  const toggleExpanded = (itemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
      <div className="modal-content history-modal">
        <div className="modal-header">
          <h2 id="history-modal-title">📊 Histórico de Aperturas</h2>
          <button 
            className="close-button" 
            onClick={onClose}
            aria-label="Cerrar modal de historial"
            title="Cerrar modal de historial"
          >
            ✕
          </button>
        </div>

        <div className="history-content">
          {/* Search Bar, Filters and Clear Button Row - usando la misma estructura que UserManagementModal */}
          <div className="history-filters-container">
            {/* Fila de búsqueda y dropdown */}
            <div className="history-search-dropdown-row">
              <div className="history-search-input-wrapper">
                <input
                  type="text"
                  placeholder="🔍 Buscar por usuario..."
                  value={userSearch}
                  onChange={handleUserSearchChange}
                  className="history-search-input"
                  aria-label="Buscar por nombre de usuario"
                  aria-describedby="search-help"
                />
                <div id="search-help" className="sr-only">
                  Escriba el nombre del usuario para filtrar los resultados
                </div>
                {userSearch && (
                  <button 
                    className="history-clear-search-button"
                    onClick={() => setUserSearch('')}
                    title="Limpiar búsqueda"
                    aria-label="Limpiar búsqueda de usuario"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="history-status-filter-wrapper">
              <div className="history-dropdown-wrapper">
                <button 
                  className="history-dropdown-toggle"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  disabled={loading}
                  aria-label="Filtrar por estado de acceso"
                  aria-expanded={statusDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <span className="history-dropdown-text">
                    {statusFilter === 'all' ? '📋 Todos los registros' :
                     statusFilter === 'correcto' ? '✅ Accesos exitosos' :
                     statusFilter === 'denegado' ? '❌ Accesos denegados' :
                     statusFilter === 'sospechoso' ? '⚠️ Accesos sospechosos' :
                     '📋 Todos los registros'}
                  </span>
                  <span className={`history-dropdown-arrow ${statusDropdownOpen ? 'open' : ''}`} aria-hidden="true">▼</span>
                </button>
                
                {statusDropdownOpen && (
                  <div className="history-dropdown-menu" role="listbox" aria-label="Opciones de filtro de estado">
                    <div 
                      className={`history-dropdown-item ${statusFilter === 'all' ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect('all')}
                      role="option"
                      aria-selected={statusFilter === 'all'}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleStatusSelect('all');
                        }
                      }}
                    >
                      <span className="history-dropdown-item-name">📋 Todos los registros</span>
                    </div>
                    <div 
                      className={`history-dropdown-item ${statusFilter === 'correcto' ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect('correcto')}
                      role="option"
                      aria-selected={statusFilter === 'correcto'}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleStatusSelect('correcto');
                        }
                      }}
                    >
                      <span className="history-dropdown-item-name">✅ Accesos exitosos</span>
                    </div>
                    <div 
                      className={`history-dropdown-item ${statusFilter === 'denegado' ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect('denegado')}
                      role="option"
                      aria-selected={statusFilter === 'denegado'}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleStatusSelect('denegado');
                        }
                      }}
                    >
                      <span className="history-dropdown-item-name">❌ Accesos denegados</span>
                    </div>
                    <div 
                      className={`history-dropdown-item ${statusFilter === 'sospechoso' ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect('sospechoso')}
                      role="option"
                      aria-selected={statusFilter === 'sospechoso'}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleStatusSelect('sospechoso');
                        }
                      }}
                    >
                      <span className="history-dropdown-item-name">⚠️ Accesos sospechosos</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
            
            {/* Filtros de fecha */}
            <div className="history-date-filter-wrapper">
              <div className="history-date-range-wrapper">
                <div className="history-date-input-group">
                  <label className="history-date-input-label" htmlFor="date-from-input">Desde</label>
                  <input
                    id="date-from-input"
                    type="date"
                    className="history-date-input"
                    value={dateFrom}
                    onChange={handleDateFromChange}
                    placeholder="Desde"
                    aria-label="Fecha desde"
                  />
                </div>
                <div className="history-date-input-group">
                  <label className="history-date-input-label" htmlFor="date-to-input">Hasta</label>
                  <input
                    id="date-to-input"
                    type="date"
                    className="history-date-input"
                    value={dateTo}
                    onChange={handleDateToChange}
                    placeholder="Hasta"
                    aria-label="Fecha hasta"
                  />
                </div>
              </div>
            </div>
            
            {/* Botones de acción debajo de los filtros */}
            <div className="history-action-buttons">
              <button 
                className="history-refresh-button"
                onClick={loadHistory}
                disabled={loading}
                title="🔄 Refrescar historial"
                aria-label="Refrescar lista de historial"
              >
                <span className="refresh-icon" aria-hidden="true">🔄</span>
              </button>
              
              <button 
                className="history-clear-filters-btn"
                onClick={clearFilters}
                title="Limpiar todos los filtros"
                aria-label="Limpiar todos los filtros aplicados"
              >
                🗑️
              </button>
            </div>
          </div>
          {/* Contenido */}
          {loading && (
            <div className="loading-state" role="status" aria-live="polite">
              <div className="loading-spinner" aria-hidden="true"></div>
              <p>Cargando historial...</p>
            </div>
          )}

          {error && (
            <div className="error-message" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="empty-state" role="status" aria-live="polite">
              <div className="empty-icon" aria-hidden="true">📊</div>
              <h3>No hay registros</h3>
              <p>No se encontraron registros de apertura con los filtros seleccionados</p>
            </div>
          )}


          {!loading && !error && history.length > 0 && (
            <>
              <div className={`history-list ${loadingList ? 'loading' : ''}`} role="list" aria-label="Lista de registros de historial">
                {history.map((record) => {
                  const accessBadge = getAccessTypeBadge(record);
                  return (
                    <div 
                      key={record.id} 
                      className="history-item"
                      role="listitem"
                      style={{ 
                        borderColor: accessBadge.borderColor,
                        backgroundColor: accessBadge.backgroundColor
                      }}
                      aria-label={`${record.nombre || record.username} - ${accessBadge.text}`}
                    >
                    <div className="history-header">
                      <div className="user-name">
                        {record.nombre && record.apellido 
                          ? `${record.nombre} ${record.apellido}`
                          : record.username
                        }
                      </div>
                      <div className="history-info-row">
                        <div className="user-role">
                          {record.role === 'admin' ? '👑 Admin' : 
                           record.role === 'jefe' ? '👔 Jefe' : 
                           '👤 Usuario'}
                        </div>
                        <div className="history-right-section">
                          <div className="history-timestamp">
                            {formatDate(record.timestamp)}
                          </div>
                          <button 
                            className="history-toggle-btn"
                            onClick={() => toggleExpanded(record.id)}
                            title={expandedItems.has(record.id) ? "Ocultar detalles" : "Mostrar detalles"}
                            aria-label={expandedItems.has(record.id) ? "Ocultar detalles del registro" : "Mostrar detalles del registro"}
                            aria-expanded={expandedItems.has(record.id)}
                          >
                            <span className={`toggle-icon ${expandedItems.has(record.id) ? 'open' : ''}`} aria-hidden="true">
                              ▼
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      className={`history-details ${expandedItems.has(record.id) ? 'expanded' : ''}`}
                      role="region"
                      aria-label="Detalles del registro"
                    >
                      {/* Badge Principal de Tipo de Acceso */}
                      <div className="access-type-badge" style={{ borderColor: accessBadge.color }}>
                        <span className="access-icon" aria-hidden="true">{accessBadge.icon}</span>
                        <span className="access-text">{accessBadge.text}</span>
                        <span className="access-description">{accessBadge.description}</span>
                      </div>
                      
                      {/* Información de Validación */}
                      <div className="validation-info">
                        <div className="validation-item">
                          <span className="validation-label">Horario Laboral:</span>
                          <span 
                            className="validation-value"
                            style={{ color: getWorkingHoursColor(record.isWithinWorkingHours, record.workingHoursInfo) }}
                          >
                            {getWorkingHoursIcon(record.isWithinWorkingHours, record.workingHoursInfo)} {getWorkingHoursText(record.isWithinWorkingHours, record.workingHoursInfo)}
                          </span>
                        </div>
                        <div className="validation-item">
                          <span className="validation-label">Ubicación:</span>
                          <span 
                            className="validation-value"
                            style={{ color: record.status === 'fuera_de_area' ? '#F44336' : '#4CAF50' }}
                          >
                            {record.status === 'fuera_de_area' ? '🚫 Fuera del área autorizada' : '✅ Dentro del área autorizada'}
                          </span>
                        </div>
                        {!record.isWithinWorkingHours && record.status === 'correcto' && (
                          <div className="validation-item">
                            <span className="validation-label">Permisos:</span>
                            <span className="validation-value" style={{ color: '#FF9800' }}>
                              🔑 Permisos especiales activos
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Información Técnica */}
                      <div className="technical-info">
                      {record.location && (
                          <div className="info-item">
                          <strong>Ubicación:</strong> 
                          <span className="location-coords">
                            {record.location.lat?.toFixed(6)}, {record.location.lon?.toFixed(6)}
                          </span>
                          {record.location.accuracy && (
                            <span className="location-accuracy">
                              (Precisión: {record.location.accuracy}m)
                            </span>
                          )}
                        </div>
                      )}
                      
                      {record.message && (
                          <div className="info-item">
                          <strong>Mensaje:</strong> {record.message}
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="history-pagination">
                  <div className="pagination-controls">
                    <button 
                      className="page-btn"
                      onClick={handleFirstPage}
                      disabled={currentPage === 1}
                      title="Primera página"
                      aria-label="Ir a la primera página"
                    >
                      <span aria-hidden="true">◀◀</span>
                    </button>
                    <button 
                      className="page-btn"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      title="Página anterior"
                      aria-label="Ir a la página anterior"
                    >
                      <span aria-hidden="true">◀</span>
                    </button>
                    
                    <div className="page-info" role="status" aria-live="polite">
                      {(() => {
                        const currentCount = Math.min(currentPage * itemsPerPage, totalRecords);
                        return `${currentCount} de ${totalRecords} Reg.`;
                      })()}
                    </div>
                    
                    <button 
                      className="page-btn"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      title="Página siguiente"
                      aria-label="Ir a la página siguiente"
                    >
                      <span aria-hidden="true">▶</span>
                    </button>
                    <button 
                      className="page-btn"
                      onClick={handleLastPage}
                      disabled={currentPage === totalPages}
                      title="Última página"
                      aria-label="Ir a la última página"
                    >
                      <span aria-hidden="true">▶▶</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
