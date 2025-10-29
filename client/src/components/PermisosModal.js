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
  
  // Estados para modales anidados
  const [showPermisoForm, setShowPermisoForm] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Sistema de mensajes animados
  const { messages, showSuccess, showError, removeMessage } = useAnimatedMessages();

  useEffect(() => {
    if (currentUser && currentUser.role === 'jefe') {
      loadUsuariosAsignados();
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
    <div className="permisos-overlay">
      {/* Portal de mensajes */}
      <MessagePortal />
      
      <div className="permisos-content-container">
        <div className="permisos-header">
          <h2>🔑 Gestión de Permisos de Acceso</h2>
          <button className="permisos-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="permisos-body">
          {/* Sección de selección de usuario */}
          <div className="permisos-usuarios-section">
            <div className="permisos-section-header">
              <h3>👥 Mis Usuarios Asignados:</h3>
              <button 
                className="permisos-refresh-button"
                onClick={loadUsuariosAsignados}
                disabled={loading}
                title="Actualizar lista"
              >
                🔄 Actualizar
              </button>
            </div>
            
            {error && <div className="permisos-error-message">{error}</div>}
            {loading && <div className="permisos-loading-message">⏳ Cargando usuarios...</div>}

            <div className="permisos-usuarios-section-title-mobile">
              <h3>👥 Mis Usuarios Asignados:</h3>
              {/* Botón de actualizar a la derecha (solo visible en móvil) */}
              <div className="permisos-refresh-button-wrapper-mobile">
                <button 
                  className="permisos-refresh-button"
                  onClick={loadUsuariosAsignados}
                  disabled={loading}
                  title="Actualizar lista"
                >
                  🔄 Actualizar
                </button>
              </div>
            </div>

            {/* Dropdown para seleccionar usuario */}
            <div className="permisos-user-selector-container">
              <div className="permisos-dropdown-wrapper">
                <button 
                  className="permisos-dropdown-toggle"
                  onClick={handleDropdownToggle}
                  disabled={loading || usuarios.length === 0}
                >
                  <span className="permisos-dropdown-text">
                    {selectedUsuario 
                      ? `👤 ${selectedUsuario.nombre} ${selectedUsuario.apellido}` 
                      : 'Seleccionar usuario...'
                    }
                  </span>
                  <span className={`permisos-dropdown-arrow ${dropdownOpen ? 'open' : ''}`}>▼</span>
                </button>
                
                {dropdownOpen && usuarios.length > 0 && (
                  <div className="permisos-dropdown-menu">
                    {usuarios.map((usuario) => (
                      <div 
                        key={usuario.id}
                        className={`permisos-dropdown-item ${selectedUsuario?.id === usuario.id ? 'selected' : ''}`}
                        onClick={() => handleUsuarioSelect(usuario)}
                      >
                        <span className="permisos-dropdown-item-name">
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
              <div className="permisos-selected-user-card">
                <div className="permisos-user-card-content">
                  <div className="permisos-user-card-info">
                    <h4>👤 {selectedUsuario.nombre} {selectedUsuario.apellido}</h4>
                    <span className="permisos-user-card-username">({selectedUsuario.username})</span>
                  </div>
                  
                  <div className="permisos-user-card-actions">
                    {selectedUsuario.permisos_activos === 0 ? (
                      <button 
                        className="permisos-action-button primary"
                        onClick={() => handleAgregarPermiso(selectedUsuario)}
                        title="Agregar permiso especial"
                      >
                        ➕ Agregar Permiso
                      </button>
                    ) : (
                      <button 
                        className="permisos-action-button secondary"
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
              <div className="permisos-no-users">
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
