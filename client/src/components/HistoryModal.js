import React, { useState, useEffect } from 'react';
import './HistoryModal.css';

const HistoryModal = ({ onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, correcto, incorrecto, fuera_de_area, advertencia
  const [dateFrom, setDateFrom] = useState(''); // fecha desde
  const [dateTo, setDateTo] = useState(''); // fecha hasta
  const [userSearch, setUserSearch] = useState(''); // búsqueda por usuario
  const [workingHoursFilter, setWorkingHoursFilter] = useState('all'); // all, within, outside
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadHistory();
  }, [statusFilter, dateFrom, dateTo, userSearch, currentPage, workingHoursFilter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');
      
      
      const params = new URLSearchParams({
        status: statusFilter,
        dateFrom: dateFrom,
        dateTo: dateTo,
        user: userSearch,
        page: currentPage,
        limit: itemsPerPage,
        workingHours: workingHoursFilter
      });

      const response = await fetch(`http://localhost:5000/api/history?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        setTotalPages(data.pagination?.totalPages || 1);
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

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
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
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setUserSearch('');
    setWorkingHoursFilter('all');
    setCurrentPage(1);
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
          {/* Filtros Mejorados */}
          <div className="history-filters">
            {/* Búsqueda por Usuario */}
            <div className="filter-group">
              <label htmlFor="userSearch" className="filter-label">
                🔍 Buscar Usuario:
              </label>
              <input
                id="userSearch"
                type="text"
                className="user-search-input"
                placeholder="Nombre, email o username..."
                value={userSearch}
                onChange={handleUserSearchChange}
              />
            </div>

            {/* Filtro por Estado */}
            <div className="filter-group">
              <label htmlFor="statusFilter" className="filter-label">📊 Estado:</label>
                <select
                  id="statusFilter"
                  className="status-dropdown"
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                >
                  <option value="all">📋 Todos los estados</option>
                  <option value="correcto">✅ Correctos</option>
                  <option value="incorrecto">❌ Incorrectos</option>
                  <option value="fuera_de_area">🚫 Fuera de área</option>
                  <option value="advertencia">⚠️ Advertencias</option>
                </select>
            </div>

            {/* Filtro por Rango de Fechas */}
            <div className="filter-group">
              <label className="filter-label">📅 Rango de Fechas:</label>
              <div className="date-range-inputs">
                <div className="date-input-group">
                  <label htmlFor="dateFrom" className="date-input-label">Desde:</label>
                  <input
                    id="dateFrom"
                    type="date"
                    className="date-input"
                    value={dateFrom}
                    onChange={handleDateFromChange}
                  />
                </div>
                <div className="date-input-group">
                  <label htmlFor="dateTo" className="date-input-label">Hasta:</label>
                  <input
                    id="dateTo"
                    type="date"
                    className="date-input"
                    value={dateTo}
                    onChange={handleDateToChange}
                  />
                </div>
              </div>
            </div>

            {/* Filtro por Horarios Laborales */}
            <div className="filter-group">
              <label htmlFor="workingHoursFilter" className="filter-label">⏰ Horarios:</label>
              <select
                id="workingHoursFilter"
                className="status-dropdown"
                value={workingHoursFilter}
                onChange={(e) => {
                  setWorkingHoursFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">📋 Todos los horarios</option>
                <option value="within">✅ Dentro de horario</option>
                <option value="outside">⏰ Fuera de horario</option>
              </select>
            </div>

            {/* Botón Limpiar Filtros */}
            <div className="filter-group">
              <button 
                className="clear-filters-btn"
                onClick={clearFilters}
                title="Limpiar todos los filtros"
              >
                🗑️ Limpiar
              </button>
            </div>
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

          {!loading && !error && history.length > 0 && (
            <>
              <div className="history-list">
                {history.map((record) => (
                  <div key={record.id} className="history-item">
                    <div className="history-header">
                      <div className="history-user">
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
                      <div className="history-status">
                        <span 
                          className="status-badge"
                          style={{ color: getStatusColor(record.status) }}
                        >
                          {getStatusIcon(record.status)} {getStatusText(record.status)}
                        </span>
                        {/* Indicador de horarios laborales */}
                        <span 
                          className="working-hours-badge"
                          style={{ color: getWorkingHoursColor(record.isWithinWorkingHours, record.workingHoursInfo) }}
                          title={getWorkingHoursText(record.isWithinWorkingHours, record.workingHoursInfo)}
                        >
                          {getWorkingHoursIcon(record.isWithinWorkingHours, record.workingHoursInfo)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="history-details">
                      <div className="history-date">
                        <strong>Fecha:</strong> {formatDate(record.timestamp)}
                      </div>
                      
                      {record.location && (
                        <div className="history-location">
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
                        <div className="history-message">
                          <strong>Mensaje:</strong> {record.message}
                        </div>
                      )}
                      
                      {/* Información de horarios laborales */}
                      <div className="working-hours-info">
                        <strong>Horario laboral:</strong> 
                        <span style={{ color: getWorkingHoursColor(record.isWithinWorkingHours, record.workingHoursInfo) }}>
                          {getWorkingHoursText(record.isWithinWorkingHours, record.workingHoursInfo)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
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
