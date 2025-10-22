import React, { useState, useEffect, useCallback } from 'react';
import './HistoryModal.css';
import { apiGet } from '../utils/api';

const HistoryModal = ({ onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, correcto, incorrecto, fuera_de_area, advertencia, denegado_horario, timeout, duplicate
  const [dateFrom, setDateFrom] = useState(''); // fecha desde
  const [dateTo, setDateTo] = useState(''); // fecha hasta
  const [userSearch, setUserSearch] = useState(''); // búsqueda por usuario
  const [workingHoursFilter, setWorkingHoursFilter] = useState('all'); // all, within, outside
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  
  // Estados para dropdowns personalizados
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  
  // Estado para items expandidos
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-wrapper')) {
        setStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounce para prevenir refreshes excesivos
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.log('StatusFilter cambió a:', statusFilter);
      loadHistory();
    }, 300); // 300ms de debounce

    return () => clearTimeout(timeoutId);
  }, [statusFilter, dateFrom, dateTo, userSearch, currentPage, workingHoursFilter]);

  // useEffect específico para monitorear cambios en statusFilter
  useEffect(() => {
    console.log('useEffect statusFilter:', statusFilter);
  }, [statusFilter]);

  const loadHistory = async () => {
    // Prevenir cargas múltiples simultáneas
    if (loading) {
      console.log('⚠️ Carga ya en progreso, ignorando nueva solicitud');
      return;
    }
    
    try {
      setLoading(true);
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

      console.log('Filtros enviados:', {
        status: statusFilter,
        dateFrom,
        dateTo,
        user: userSearch,
        page: currentPage,
        workingHours: workingHoursFilter
      });
      console.log('StatusFilter actual:', statusFilter);

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
               
               console.log('🔍 Filtrado simplificado:', {
                 statusFilter,
                 totalRegistros: originalCount,
                 registrosFiltrados: filteredHistory.length,
                 tiposIncluidos: statusFilter === 'denegado' ? 
                   'incorrecto, fuera_de_area, denegado_horario, timeout' :
                   statusFilter === 'sospechoso' ? 'advertencia, duplicate' : 'correcto',
                 registrosEncontrados: filteredHistory.map(r => ({ 
                   id: r.id, 
                   status: r.status, 
                   usuario: r.username 
                 }))
               });
             }
        
        setHistory(filteredHistory);
        
        // Manejar paginación según el tipo de filtro
        if (statusFilter !== 'all') {
          // Para filtros frontend, implementar paginación frontend
          const totalFiltered = filteredHistory.length;
          const calculatedTotalPages = Math.ceil(totalFiltered / itemsPerPage);
          setTotalPages(calculatedTotalPages);
          
          // Aplicar paginación frontend a los datos filtrados
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const paginatedHistory = filteredHistory.slice(startIndex, endIndex);
          
          setHistory(paginatedHistory);
          
          // Ajustar página actual si es necesario
          if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
            setCurrentPage(calculatedTotalPages);
          }
          
          console.log('📄 Paginación frontend:', {
            totalFiltrados: totalFiltered,
            paginaActual: currentPage,
            totalPaginas: calculatedTotalPages,
            registrosEnPagina: paginatedHistory.length,
            rango: `${startIndex + 1}-${Math.min(endIndex, totalFiltered)} de ${totalFiltered}`
          });
        } else {
          // Para 'all', usar paginación del backend
          setHistory(filteredHistory);
          setTotalPages(data.pagination?.totalPages || 1);
        }
      } else {
        setError('Error al cargar el historial');
      }
    } catch (error) {
      setError('Error de conexión al cargar historial');
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
    console.log('Seleccionando status:', status);
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

  const clearFilters = () => {
    console.log('clearFilters ejecutado - reseteando a all');
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
    <div className="modal-overlay">
      <div className="modal-content history-modal">
        <div className="modal-header">
          <h2>📊 Histórico de Aperturas</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="history-content">
          {/* Search Bar, Filters and Clear Button Row - usando la misma estructura que UserManagementModal */}
          <div className="history-search-row">
            <div className="history-search-input-wrapper">
              <input
                type="text"
                placeholder="🔍 Buscar por usuario..."
                value={userSearch}
                onChange={handleUserSearchChange}
                className="history-search-input"
              />
              {userSearch && (
                <button 
                  className="history-clear-search-button"
                  onClick={() => setUserSearch('')}
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="history-status-filter-wrapper">
              <div className="dropdown-wrapper">
                <button 
                  className="dropdown-toggle"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  disabled={loading}
                >
                  <span className="dropdown-text">
                    {statusFilter === 'all' ? '📋 Todos los registros' :
                     statusFilter === 'correcto' ? '✅ Accesos exitosos' :
                     statusFilter === 'denegado' ? '❌ Accesos denegados' :
                     statusFilter === 'sospechoso' ? '⚠️ Accesos sospechosos' :
                     '📋 Todos los registros'}
                  </span>
                  <span className={`dropdown-arrow ${statusDropdownOpen ? 'open' : ''}`}>▼</span>
                </button>
                
                {statusDropdownOpen && (
                  <div className="dropdown-menu">
                    <div 
                      className={`dropdown-item ${statusFilter === 'all' ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect('all')}
                    >
                      <span className="dropdown-item-name">📋 Todos los registros</span>
                    </div>
                    <div 
                      className={`dropdown-item ${statusFilter === 'correcto' ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect('correcto')}
                    >
                      <span className="dropdown-item-name">✅ Accesos exitosos</span>
                    </div>
                    <div 
                      className={`dropdown-item ${statusFilter === 'denegado' ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect('denegado')}
                    >
                      <span className="dropdown-item-name">❌ Accesos denegados</span>
                    </div>
                    <div 
                      className={`dropdown-item ${statusFilter === 'sospechoso' ? 'selected' : ''}`}
                      onClick={() => handleStatusSelect('sospechoso')}
                    >
                      <span className="dropdown-item-name">⚠️ Accesos sospechosos</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="history-date-filter-wrapper">
              <div className="history-date-range-wrapper">
                <div className="date-input-group">
                  <label className="date-input-label">Desde</label>
                  <input
                    type="date"
                    className="history-date-input"
                    value={dateFrom}
                    onChange={handleDateFromChange}
                    placeholder="Desde"
                  />
                </div>
                <div className="date-input-group">
                  <label className="date-input-label">Hasta</label>
                  <input
                    type="date"
                    className="history-date-input"
                    value={dateTo}
                    onChange={handleDateToChange}
                    placeholder="Hasta"
                  />
                </div>
              </div>
            </div>
              <button 
              className="history-clear-filters-btn"
                onClick={clearFilters}
                title="Limpiar todos los filtros"
              >
                🗑️ Limpiar
              </button>
            </div>
          {/* Contenido */}
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Cargando historial...</p>
            </div>
          )}

          {error && (
            <div className="error-message">{error}</div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No hay registros</h3>
              <p>No se encontraron registros de apertura con los filtros seleccionados</p>
            </div>
          )}

          {/* Botón de Refresh */}
          <div className="history-refresh-container">
            <button 
              className="history-refresh-button"
              onClick={loadHistory}
              disabled={loading}
              title="🔄 Refrescar historial"
            >
              <span className="refresh-icon">🔄</span>
            </button>
          </div>

          {!loading && !error && history.length > 0 && (
            <>
              <div className="history-list">
                {history.map((record) => {
                  const accessBadge = getAccessTypeBadge(record);
                  return (
                    <div 
                      key={record.id} 
                      className="history-item"
                      style={{ 
                        borderColor: accessBadge.borderColor,
                        backgroundColor: accessBadge.backgroundColor
                      }}
                    >
                    <div className="history-header">
                      <div className="history-user">
                          <div className="user-name-container">
                        <div className="user-name">
                          {record.nombre && record.apellido 
                            ? `${record.nombre} ${record.apellido}`
                            : record.username
                          }
                        </div>
                        <div className="user-role">
                          {record.role === 'admin' ? '👑 Admin' : 
                           record.role === 'jefe' ? '👔 Jefe' : 
                           '👤 Usuario'}
                        </div>
                      </div>
                          <div className="history-timestamp">
                            {formatDate(record.timestamp)}
                          </div>
                        </div>
                        <button 
                          className="history-toggle-btn"
                          onClick={() => toggleExpanded(record.id)}
                          title={expandedItems.has(record.id) ? "Ocultar detalles" : "Mostrar detalles"}
                        >
                          <span className={`toggle-icon ${expandedItems.has(record.id) ? 'open' : ''}`}>
                            ▼
                        </span>
                        </button>
                    </div>
                    
                    <div className={`history-details ${expandedItems.has(record.id) ? 'expanded' : ''}`}>
                      {/* Badge Principal de Tipo de Acceso */}
                      <div className="access-type-badge" style={{ borderColor: accessBadge.color }}>
                        <span className="access-icon">{accessBadge.icon}</span>
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
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      title="Página anterior"
                    >
                      ◀
                    </button>
                    
                    <div className="page-info">
                      Página {currentPage} de {totalPages}
                    </div>
                    
                    <button 
                      className="page-btn"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      title="Página siguiente"
                    >
                      ▶
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
