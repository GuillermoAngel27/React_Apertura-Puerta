import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './PermisosModal.css';
import { apiGet } from '../utils/api';
import useAnimatedMessages from '../hooks/useAnimatedMessages';
import MessageContainer from './MessageContainer';
import PermisoFormModal from './PermisoFormModal';

const PermisosModal = ({ onClose, currentUser }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [horariosGlobales, setHorariosGlobales] = useState(null);
  
  // Estados para modales anidados
  const [showPermisoForm, setShowPermisoForm] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Sistema de mensajes animados
  const { messages, showSuccess, showError, removeMessage } = useAnimatedMessages();

  useEffect(() => {
    if (currentUser && currentUser.role === 'jefe') {
      loadUsuariosAsignados();
      loadHorariosGlobales();
    }
  }, [currentUser]);

  const loadUsuariosAsignados = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiGet('/api/permisos-especiales/usuarios-asignados');
      
      if (response.ok) {
        const data = await response.json();
        setUsuarios(data);
        console.log('📋 Usuarios asignados cargados:', data.length);
      } else {
        setError('Error al cargar usuarios asignados');
      }
    } catch (error) {
      setError('Error de conexión al cargar usuarios');
      console.error('Error cargando usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHorariosGlobales = async () => {
    try {
      const response = await apiGet('/api/configuracion/horarios');
      if (response.ok) {
        const data = await response.json();
        setHorariosGlobales(data);
      }
    } catch (error) {
      console.error('Error cargando horarios globales:', error);
    }
  };

  const handleAgregarPermiso = (usuario) => {
    setSelectedUsuario(usuario);
    setShowPermisoForm(true);
  };

  const handleGestionarPermisos = (usuario) => {
    setSelectedUsuario(usuario);
    setShowPermisoForm(true);
  };

  const handlePermisoFormClose = () => {
    setShowPermisoForm(false);
    setSelectedUsuario(null);
    // Recargar usuarios para mostrar cambios
    loadUsuariosAsignados();
  };

  const handleUsuarioSelect = (usuario) => {
    setSelectedUsuario(usuario);
    setDropdownOpen(false);
  };

  const handleDropdownToggle = () => {
    setDropdownOpen(!dropdownOpen);
  };


  // Función para obtener estado visual del usuario
  const getEstadoUsuario = (usuario) => {
    if (usuario.permisos_activos > 0) {
      return {
        icon: '⚠️',
        text: 'Con Permisos Especiales',
        color: 'warning'
      };
    }
    return {
      icon: '✅',
      text: 'Acceso Normal',
      color: 'success'
    };
  };

  // Función para formatear fecha
  const formatFecha = (fecha) => {
    if (!fecha) return 'Nunca';
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Componente Portal para mensajes
  const MessagePortal = () => {
    return createPortal(
      <MessageContainer 
        messages={messages} 
        onRemoveMessage={removeMessage} 
      />,
      document.body
    );
  };

  // Verificar que el usuario sea jefe
  if (!currentUser || currentUser.role !== 'jefe') {
    return null;
  }

  return (
    <div className="modal-overlay">
      {/* Portal de mensajes */}
      <MessagePortal />
      
      <div className="modal-content permisos-modal">
        <div className="modal-header">
          <h2>🔑 Gestión de Permisos de Acceso</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="permisos-content">
          {/* Información de horarios globales */}
          {horariosGlobales && (
            <div className="horarios-globales">
              <h3>📋 Horarios Generales del Sistema (Solo para Usuarios):</h3>
              <div className="horarios-info">
                <div className="horario-item">
                  <span className="horario-label">Lunes a Viernes:</span>
                  <span className={`horario-value ${horariosGlobales.lunesViernes?.habilitado ? 'habilitado' : 'deshabilitado'}`}>
                    {horariosGlobales.lunesViernes?.inicio || '--:--'} - {horariosGlobales.lunesViernes?.fin || '--:--'}
                    {horariosGlobales.lunesViernes?.habilitado ? ' ✅' : ' ❌'}
                  </span>
                </div>
                <div className="horario-item">
                  <span className="horario-label">Sábados:</span>
                  <span className={`horario-value ${horariosGlobales.sabados?.habilitado ? 'habilitado' : 'deshabilitado'}`}>
                    {horariosGlobales.sabados?.inicio || '--:--'} - {horariosGlobales.sabados?.fin || '--:--'}
                    {horariosGlobales.sabados?.habilitado ? ' ✅' : ' ❌'}
                  </span>
                </div>
                <div className="horario-item">
                  <span className="horario-label">Domingos:</span>
                  <span className={`horario-value ${horariosGlobales.domingos?.habilitado ? 'habilitado' : 'deshabilitado'}`}>
                    {horariosGlobales.domingos?.inicio || '--:--'} - {horariosGlobales.domingos?.fin || '--:--'}
                    {horariosGlobales.domingos?.habilitado ? ' ✅' : ' ❌'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sección de selección de usuario */}
          <div className="usuarios-section">
            <div className="section-header">
              <h3>👥 Mis Usuarios Asignados:</h3>
              <button 
                className="refresh-button"
                onClick={loadUsuariosAsignados}
                disabled={loading}
                title="Actualizar lista"
              >
                🔄 Actualizar
              </button>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">⏳ Cargando usuarios...</div>}

            {/* Dropdown para seleccionar usuario */}
            <div className="user-selector-container">
              <div className="dropdown-wrapper">
                <button 
                  className="dropdown-toggle"
                  onClick={handleDropdownToggle}
                  disabled={loading || usuarios.length === 0}
                >
                  <span className="dropdown-text">
                    {selectedUsuario 
                      ? `👤 ${selectedUsuario.nombre} ${selectedUsuario.apellido}` 
                      : 'Seleccionar usuario...'
                    }
                  </span>
                  <span className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}>▼</span>
                </button>
                
                {dropdownOpen && usuarios.length > 0 && (
                  <div className="dropdown-menu">
                    {usuarios.map((usuario) => (
                      <div 
                        key={usuario.id}
                        className={`dropdown-item ${selectedUsuario?.id === usuario.id ? 'selected' : ''}`}
                        onClick={() => handleUsuarioSelect(usuario)}
                      >
                        <span className="dropdown-item-name">
                          👤 {usuario.nombre} {usuario.apellido}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cuadro de usuario seleccionado */}
            {selectedUsuario && (
              <div className="selected-user-card">
                <div className="user-card-content">
                  <div className="user-card-info">
                    <h4>👤 {selectedUsuario.nombre} {selectedUsuario.apellido}</h4>
                    <span className="user-card-username">({selectedUsuario.username})</span>
                  </div>
                  
                  <div className="user-card-actions">
                    {selectedUsuario.permisos_activos === 0 ? (
                      <button 
                        className="action-button primary"
                        onClick={() => handleAgregarPermiso(selectedUsuario)}
                        title="Agregar permiso especial"
                      >
                        ➕ Agregar Permiso
                      </button>
                    ) : (
                      <button 
                        className="action-button secondary"
                        onClick={() => handleGestionarPermisos(selectedUsuario)}
                        title="Gestionar permisos existentes"
                      >
                        ✏️ Gestionar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje cuando no hay usuarios */}
            {!loading && usuarios.length === 0 && (
              <div className="no-users">
                <p>No tienes usuarios asignados</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modal de formulario de permisos */}
      {showPermisoForm && selectedUsuario && (
        <PermisoFormModal
          usuario={selectedUsuario}
          onClose={handlePermisoFormClose}
          onSuccess={() => {
            showSuccess('Permiso actualizado exitosamente');
            loadUsuariosAsignados();
          }}
        />
      )}

    </div>
  );
};

export default PermisosModal;
