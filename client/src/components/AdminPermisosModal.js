import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './AdminPermisosModal.css';
import { apiGet } from '../utils/api';
import useAnimatedMessages from '../hooks/useAnimatedMessages';
import MessageContainer from './MessageContainer';
import PermisoFormModal from './PermisoFormModal';

const AdminPermisosModal = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados para los dropdowns
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [categoriaDropdownOpen, setCategoriaDropdownOpen] = useState(false);
  const [jefesDropdownOpen, setJefesDropdownOpen] = useState(false);
  
  // Estados para las listas de usuarios
  const [usuariosSinJefe, setUsuariosSinJefe] = useState([]);
  const [jefes, setJefes] = useState([]);
  const [usuariosPorJefe, setUsuariosPorJefe] = useState([]);
  const [jefeSeleccionado, setJefeSeleccionado] = useState(null);
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(5);
  
  // Estados para el modal de permisos
  const [showPermisoForm, setShowPermisoForm] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  
  // Sistema de mensajes animados
  const { messages, showSuccess, showError, showWarning, showInfo, showLoading, showConfirm, removeMessage } = useAnimatedMessages();

  // Cargar datos iniciales
  useEffect(() => {
    loadUsuariosSinJefe();
    loadJefes();
  }, []);

  const loadUsuariosSinJefe = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/permisos-admin/usuarios-sin-jefe');
      if (response.ok) {
        const usuarios = await response.json();
        setUsuariosSinJefe(usuarios);
      } else {
        setError('Error al cargar usuarios sin jefe');
      }
    } catch (error) {
      setError('Error de conexión al cargar usuarios sin jefe');
    } finally {
      setLoading(false);
    }
  };

  const loadJefes = async () => {
    try {
      const response = await apiGet('/api/permisos-admin/jefes');
      if (response.ok) {
        const jefesData = await response.json();
        setJefes(jefesData);
      } else {
        setError('Error al cargar jefes');
      }
    } catch (error) {
      setError('Error de conexión al cargar jefes');
    }
  };

  const loadUsuariosPorJefe = async (jefeId) => {
    try {
      setLoading(true);
      const response = await apiGet(`/api/permisos-admin/usuarios-por-jefe/${jefeId}`);
      if (response.ok) {
        const data = await response.json();
        setUsuariosPorJefe(data.usuarios);
        setJefeSeleccionado(data.jefe);
      } else {
        setError('Error al cargar usuarios del jefe');
      }
    } catch (error) {
      setError('Error de conexión al cargar usuarios del jefe');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoriaSelect = (categoria) => {
    setCategoriaSeleccionada(categoria);
    setCategoriaDropdownOpen(false);
    setJefeSeleccionado(null);
    setUsuariosPorJefe([]);
    setCurrentPage(1); // Reset a la primera página
    
    // No cargar datos automáticamente, se mostrarán cuando corresponda
  };

  const handleJefeSelect = (jefe) => {
    setJefeSeleccionado(jefe);
    setJefesDropdownOpen(false);
    setCurrentPage(1); // Reset a la primera página
    loadUsuariosPorJefe(jefe.id);
  };

  const handleAgregarPermiso = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setShowPermisoForm(true);
  };

  const handlePermisoFormClose = () => {
    setShowPermisoForm(false);
    setUsuarioSeleccionado(null);
  };

  const handlePermisoSuccess = () => {
    // No mostrar mensaje aquí, ya se muestra en PermisoFormModal con showMsgSuccess
    // Solo recargar datos según la categoría actual
    if (categoriaSeleccionada === 'sin_jefe') {
      loadUsuariosSinJefe();
    } else if (categoriaSeleccionada === 'jefes' && jefeSeleccionado) {
      loadUsuariosPorJefe(jefeSeleccionado.id);
    }
  };

  const getUsuariosActuales = () => {
    if (categoriaSeleccionada === 'sin_jefe') {
      return usuariosSinJefe;
    } else if (categoriaSeleccionada === 'jefes' && jefeSeleccionado) {
      return usuariosPorJefe;
    }
    // No mostrar nada cuando se selecciona "jefes" pero no un jefe específico
    return [];
  };

  const getTituloLista = () => {
    if (categoriaSeleccionada === 'sin_jefe') {
      return '👥 Usuarios sin jefe asignado';
    } else if (categoriaSeleccionada === 'jefes' && jefeSeleccionado) {
      return `👥 Usuarios de ${jefeSeleccionado.nombre} ${jefeSeleccionado.apellido}`;
    } else if (categoriaSeleccionada === 'jefes' && !jefeSeleccionado) {
      return '👔 Seleccione un jefe de departamento para ver sus usuarios';
    }
    return '👥 Seleccione una categoría';
  };

  // Funciones de paginación
  const getTotalUsuarios = () => {
    return getUsuariosActuales().length;
  };

  const getTotalPages = () => {
    return Math.ceil(getTotalUsuarios() / usersPerPage);
  };

  const getCurrentPageUsers = () => {
    const usuarios = getUsuariosActuales();
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    return usuarios.slice(startIndex, endIndex);
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= getTotalPages()) {
      setCurrentPage(pageNumber);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < getTotalPages()) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleFirstPage = () => {
    if (currentPage > 1) {
      setCurrentPage(1);
    }
  };

  const handleLastPage = () => {
    const total = getTotalPages();
    if (currentPage < total && total > 0) {
      setCurrentPage(total);
    }
  };

  // Componente Portal para mensajes - renderiza fuera del modal
  const MessagePortal = () => {
    return createPortal(
      <MessageContainer 
        messages={messages} 
        onRemoveMessage={removeMessage} 
      />,
      document.body
    );
  };

  return (
    <div className="admin-permisos-overlay">
      {/* Portal de mensajes - renderiza en document.body */}
      <MessagePortal />
      
      <div className="admin-permisos-content-container">
        <div className="admin-permisos-header">
          <h2>🔑 Administración de Permisos Especiales</h2>
          <button className="admin-permisos-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="admin-permisos-body">
          {/* Dropdowns en el mismo renglón */}
          <div className="admin-permisos-dropdowns-row">
            {/* Dropdown principal para seleccionar categoría */}
            <div className="admin-permisos-categoria-section">
              <div className="admin-permisos-dropdown-wrapper">
                <button 
                  className="admin-permisos-dropdown-toggle"
                  onClick={() => setCategoriaDropdownOpen(!categoriaDropdownOpen)}
                  disabled={loading}
                >
                  <span className="admin-permisos-dropdown-text">
                    {categoriaSeleccionada === 'sin_jefe' ? '👥 Usuarios sin jefe' :
                     categoriaSeleccionada === 'jefes' ? '👔 Jefes de departamentos' :
                     'Seleccionar categoría...'}
                  </span>
                  <span className={`admin-permisos-dropdown-arrow ${categoriaDropdownOpen ? 'open' : ''}`}>▼</span>
                </button>
                
                {categoriaDropdownOpen && (
                  <div className="admin-permisos-dropdown-menu">
                    <div 
                      className={`admin-permisos-dropdown-item ${categoriaSeleccionada === 'sin_jefe' ? 'selected' : ''}`}
                      onClick={() => handleCategoriaSelect('sin_jefe')}
                    >
                      <span className="admin-permisos-dropdown-item-name">
                        👥 Usuarios sin jefe
                      </span>
                    </div>
                    <div 
                      className={`admin-permisos-dropdown-item ${categoriaSeleccionada === 'jefes' ? 'selected' : ''}`}
                      onClick={() => handleCategoriaSelect('jefes')}
                    >
                      <span className="admin-permisos-dropdown-item-name">
                        👔 Jefes de departamentos
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dropdown secundario para jefes (solo visible cuando se selecciona "jefes") */}
            {categoriaSeleccionada === 'jefes' && (
              <div className="admin-permisos-jefes-section">
                <div className="admin-permisos-jefes-dropdown-wrapper">
                  <button 
                    className="admin-permisos-jefes-dropdown-toggle"
                    onClick={() => setJefesDropdownOpen(!jefesDropdownOpen)}
                    disabled={loading}
                    >
                      <span className="admin-permisos-dropdown-text">
                        {jefeSeleccionado 
                          ? `👔 ${jefeSeleccionado.nombre} ${jefeSeleccionado.apellido}`
                          : 'Seleccionar jefe...'
                        }
                      </span>
                      <span className={`admin-permisos-dropdown-arrow ${jefesDropdownOpen ? 'open' : ''}`}>▼</span>
                    </button>
                    
                    {jefesDropdownOpen && (
                      <div className="admin-permisos-dropdown-menu">
                        {jefes.map((jefe) => (
                          <div 
                            key={jefe.id}
                            className={`admin-permisos-dropdown-item ${jefeSeleccionado?.id === jefe.id ? 'selected' : ''}`}
                            onClick={() => handleJefeSelect(jefe)}
                          >
                            <span className="admin-permisos-dropdown-item-name">
                              👔 {jefe.nombre} {jefe.apellido}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          {/* Mensajes de error y éxito */}
          {error && <div className="admin-permisos-error-message">{error}</div>}
          {success && <div className="admin-permisos-success-message">{success}</div>}
          {loading && <div className="admin-permisos-loading-message">⏳ Cargando datos...</div>}

          {/* Lista de usuarios */}
          {categoriaSeleccionada && (
            <div className="admin-permisos-usuarios-section">
              <div className="admin-permisos-section-header">
                <div className="admin-permisos-header-actions">
                  <span className="admin-permisos-users-count">
                    {getTotalUsuarios()} usuario{getTotalUsuarios() !== 1 ? 's' : ''}
                  </span>
                  <button 
                    className="admin-permisos-refresh-button"
                    onClick={() => {
                      if (categoriaSeleccionada === 'sin_jefe') {
                        loadUsuariosSinJefe();
                      } else if (categoriaSeleccionada === 'jefes' && jefeSeleccionado) {
                        loadUsuariosPorJefe(jefeSeleccionado.id);
                      }
                    }}
                    disabled={loading}
                    title="Actualizar lista"
                  >
                    🔄 Actualizar
                  </button>
                </div>
              </div>

              <div className="admin-permisos-usuarios-list">
                {getUsuariosActuales().length === 0 ? (
                  <div className="admin-permisos-no-users-message">
                    {categoriaSeleccionada === 'sin_jefe' 
                      ? 'No hay usuarios sin jefe asignado'
                      : categoriaSeleccionada === 'jefes' && !jefeSeleccionado
                      ? 'Seleccione un jefe para ver sus usuarios'
                      : 'No hay usuarios asignados a este jefe'
                    }
                  </div>
                ) : (
                  getCurrentPageUsers().map((usuario) => (
                    <div key={usuario.id} className="admin-permisos-usuario-card">
                      <div className="admin-permisos-usuario-info">
                        <div className="admin-permisos-usuario-nombre">
                          👤 {usuario.nombre} {usuario.apellido}
                        </div>
                        <div className="admin-permisos-usuario-details">
                          <span className="admin-permisos-usuario-username">({usuario.username})</span>
                          <span className="admin-permisos-permisos-count">
                            {usuario.permisos_activos > 0 
                              ? `🔑 ${usuario.permisos_activos} permiso${usuario.permisos_activos > 1 ? 's' : ''} activo${usuario.permisos_activos > 1 ? 's' : ''}`
                              : 'Sin permisos especiales'
                            }
                          </span>
                        </div>
                      </div>
                      <div className="admin-permisos-usuario-actions">
                        <button 
                          className="admin-permisos-add-permiso-button"
                          onClick={() => handleAgregarPermiso(usuario)}
                          title="Gestionar permisos especiales"
                        >
                          {usuario.permisos_activos > 0 ? '✏️ Gestionar' : '➕ Permisos'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Paginación */}
              {getTotalPages() > 1 && (
                <div className="admin-permisos-pagination-container">
                  <div className="admin-permisos-pagination-controls">
                    <button 
                      className="admin-permisos-pagination-button"
                      onClick={handleFirstPage}
                      disabled={currentPage === 1 || loading}
                      title="Primera página"
                    >
                      ◀◀
                    </button>
                    <button 
                      className="admin-permisos-pagination-button"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1 || loading}
                      title="Página anterior"
                    >
                      ◀
                    </button>
                    
                    <div className="admin-permisos-pagination-info">
                      {loading ? (
                        <span>⏳ Cargando...</span>
                      ) : (
                        <span>
                          {(() => {
                            const currentCount = Math.min(currentPage * usersPerPage, getTotalUsuarios());
                            return `${currentCount} de ${getTotalUsuarios()} Reg.`;
                          })()}
                        </span>
                      )}
                    </div>
                    
                    <button 
                      className="admin-permisos-pagination-button"
                      onClick={handleNextPage}
                      disabled={currentPage === getTotalPages() || loading}
                      title="Página siguiente"
                    >
                      ▶
                    </button>
                    <button 
                      className="admin-permisos-pagination-button"
                      onClick={handleLastPage}
                      disabled={currentPage === getTotalPages() || loading}
                      title="Última página"
                    >
                      ▶▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulario de permisos */}
      {showPermisoForm && usuarioSeleccionado && (
        <PermisoFormModal
          usuario={usuarioSeleccionado}
          onClose={handlePermisoFormClose}
          onSuccess={handlePermisoSuccess}
          isAdminMode={true}
        />
      )}
    </div>
  );
};

export default AdminPermisosModal;
