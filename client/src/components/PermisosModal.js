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
  const [searchTerm, setSearchTerm] = useState('');
  const [horariosGlobales, setHorariosGlobales] = useState(null);
  
  // Estados para modales anidados
  const [showPermisoForm, setShowPermisoForm] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [showHistorial, setShowHistorial] = useState(false);
  
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

  const handleVerHistorial = (usuario) => {
    setSelectedUsuario(usuario);
    setShowHistorial(true);
  };

  const handlePermisoFormClose = () => {
    setShowPermisoForm(false);
    setSelectedUsuario(null);
    // Recargar usuarios para mostrar cambios
    loadUsuariosAsignados();
  };

  const handleHistorialClose = () => {
    setShowHistorial(false);
    setSelectedUsuario(null);
  };

  // Filtrar usuarios por término de búsqueda
  const usuariosFiltrados = usuarios.filter(usuario => 
    usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2>🕐 Gestión de Permisos de Acceso</h2>
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

          {/* Lista de usuarios */}
          <div className="usuarios-section">
            <h3>👥 Mis Usuarios Asignados:</h3>
            
            {/* Búsqueda */}
            <div className="search-container">
              <input
                type="text"
                placeholder="🔍 Buscar usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button 
                  className="clear-search-button"
                  onClick={() => setSearchTerm('')}
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">⏳ Cargando usuarios...</div>}

            {/* Lista de usuarios */}
            <div className="usuarios-list">
              {usuariosFiltrados.length === 0 ? (
                <div className="no-users">
                  {searchTerm ? 'No se encontraron usuarios' : 'No tienes usuarios asignados'}
                </div>
              ) : (
                usuariosFiltrados.map((usuario) => {
                  const estado = getEstadoUsuario(usuario);
                  return (
                    <div key={usuario.id} className="usuario-card">
                      <div className="usuario-header">
                        <div className="usuario-info">
                          <h4>👤 {usuario.nombre} {usuario.apellido}</h4>
                          <span className="username">({usuario.username})</span>
                        </div>
                        <div className={`estado-badge ${estado.color}`}>
                          {estado.icon} {estado.text}
                        </div>
                      </div>
                      
                      <div className="usuario-details">
                        <div className="detail-item">
                          <span className="label">Último acceso:</span>
                          <span className="value">{formatFecha(usuario.ultimo_acceso)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Permisos especiales:</span>
                          <span className="value">{usuario.permisos_activos}</span>
                        </div>
                      </div>
                      
                      <div className="usuario-actions">
                        {usuario.permisos_activos === 0 ? (
                          <button 
                            className="action-button primary"
                            onClick={() => handleAgregarPermiso(usuario)}
                            title="Agregar permiso especial"
                          >
                            ➕ Agregar Permiso
                          </button>
                        ) : (
                          <button 
                            className="action-button secondary"
                            onClick={() => handleGestionarPermisos(usuario)}
                            title="Gestionar permisos existentes"
                          >
                            ✏️ Gestionar
                          </button>
                        )}
                        
                        <button 
                          className="action-button info"
                          onClick={() => handleVerHistorial(usuario)}
                          title="Ver historial de accesos"
                        >
                          📋 Ver Historial
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Botón actualizar */}
          <div className="modal-footer">
            <button 
              className="update-button"
              onClick={loadUsuariosAsignados}
              disabled={loading}
            >
              🔄 Actualizar
            </button>
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

      {/* Modal de historial (placeholder - se implementará después) */}
      {showHistorial && selectedUsuario && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📋 Historial de Accesos - {selectedUsuario.nombre}</h3>
              <button className="close-button" onClick={handleHistorialClose}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>Historial de accesos para {selectedUsuario.nombre} {selectedUsuario.apellido}</p>
              <p><em>Esta funcionalidad se implementará en la siguiente fase.</em></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermisosModal;
