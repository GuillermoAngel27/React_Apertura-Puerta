import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './PermisoFormModal.css';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import useAnimatedMessages from '../hooks/useAnimatedMessages';
import MessageContainer from './MessageContainer';

const PermisoFormModal = ({ usuario, onClose, onSuccess, isAdminMode = false }) => {
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados para el formulario
  const [showForm, setShowForm] = useState(false);
  const [editingPermiso, setEditingPermiso] = useState(null);
  
  const [formData, setFormData] = useState({
    tipo: 'horario_especial',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    hora_inicio: '07:00',
    hora_fin: '23:00',
    observaciones: ''
  });

  // Sistema de mensajes animados (solo para confirmaciones)
  const { messages, showConfirm, removeMessage } = useAnimatedMessages();

  useEffect(() => {
    if (usuario) {
      loadPermisosUsuario();
    }
  }, [usuario]);

  const loadPermisosUsuario = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Usar endpoint diferente según el modo
      const endpoint = isAdminMode 
        ? `/api/permisos-admin/usuario/${usuario.id}`
        : `/api/permisos-especiales/usuario/${usuario.id}`;
      
      const response = await apiGet(endpoint);
      
      if (response.ok) {
        const data = await response.json();
        setPermisos(data.permisos || []);
      } else {
        setError('Error al cargar permisos del usuario');
      }
    } catch (error) {
      setError('Error de conexión al cargar permisos');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };


  const resetForm = (preserveSuccess = false) => {
    setFormData({
      tipo: 'horario_especial',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: new Date().toISOString().split('T')[0],
      hora_inicio: '07:00',
      hora_fin: '23:00',
      observaciones: ''
    });
    setEditingPermiso(null);
    setShowForm(false);
    setError('');
    // Solo limpiar success si no se debe preservar (cuando se muestra mensaje de éxito)
    if (!preserveSuccess) {
      setSuccess('');
    }
  };

  const handleNuevoPermiso = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditarPermiso = (permiso) => {
    setEditingPermiso(permiso);
    
    // Formatear fechas para input type="date" (YYYY-MM-DD)
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };
    
    setFormData({
      tipo: permiso.tipo,
      fecha_inicio: formatDateForInput(permiso.fecha_inicio),
      fecha_fin: formatDateForInput(permiso.fecha_fin),
      hora_inicio: permiso.hora_inicio || '',
      hora_fin: permiso.hora_fin || '',
      observaciones: permiso.observaciones || ''
    });
    
    setShowForm(true);
  };

  const handleEliminarPermiso = async (permisoId) => {
    // Mostrar mensaje de confirmación en lugar del alert
    showConfirm(
      `¿Eliminar permiso especial?\n\nEsta acción no se puede deshacer. El permiso será eliminado permanentemente del sistema.`,
      () => {
        // Función de confirmación - ejecutar la eliminación
        executeEliminarPermiso(permisoId);
      },
      () => {
        // Función de cancelación - no hacer nada
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    );
  };

  // Función separada para ejecutar la eliminación
  const executeEliminarPermiso = async (permisoId) => {
    try {
      setLoading(true);
      const endpoint = isAdminMode 
        ? `/api/permisos-admin/${permisoId}`
        : `/api/permisos-especiales/${permisoId}`;
      const response = await apiDelete(endpoint);
      
      if (response.ok) {
        setSuccess('✅ Permiso eliminado exitosamente');
        await loadPermisosUsuario();
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(''), 3000);
        // Llamar onSuccess solo para recargar datos del padre
        if (onSuccess) onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Error al eliminar permiso');
      }
    } catch (error) {
      setError('Error de conexión al eliminar permiso');
      console.error('Error eliminando permiso:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validaciones básicas
      if (formData.tipo === 'horario_especial' && (!formData.hora_inicio || !formData.hora_fin)) {
        setError('Los horarios especiales requieren hora de inicio y fin');
        setLoading(false);
        return;
      }

      if (formData.fecha_inicio && formData.fecha_fin && formData.fecha_inicio > formData.fecha_fin) {
        setError('La fecha de inicio no puede ser posterior a la fecha de fin');
        setLoading(false);
        return;
      }

      if (formData.hora_inicio && formData.hora_fin && formData.hora_inicio >= formData.hora_fin) {
        setError('La hora de inicio debe ser anterior a la hora de fin');
        setLoading(false);
        return;
      }

      const permisoData = {
        usuario_id: usuario.id,
        tipo: formData.tipo,
        fecha_inicio: formData.fecha_inicio || null,
        fecha_fin: formData.fecha_fin || null,
        hora_inicio: formData.hora_inicio || null,
        hora_fin: formData.hora_fin || null,
        dias_semana: null, // Siempre null para simplificar
        observaciones: formData.observaciones || null
      };

      let response;
      if (editingPermiso) {
        const endpoint = isAdminMode 
          ? `/api/permisos-admin/${editingPermiso.id}`
          : `/api/permisos-especiales/${editingPermiso.id}`;
        response = await apiPut(endpoint, permisoData);
      } else {
        const endpoint = isAdminMode 
          ? '/api/permisos-admin'
          : '/api/permisos-especiales';
        response = await apiPost(endpoint, permisoData);
      }

      if (response.ok) {
        const message = editingPermiso ? 'Permiso actualizado exitosamente' : 'Permiso creado exitosamente';
        // Recargar permisos antes de resetear para evitar refresco visual
        await loadPermisosUsuario();
        resetForm(true); // Preservar mensaje de éxito
        // Mostrar mensaje después de resetear (se mostrará en la lista de permisos)
        setSuccess(message);
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(''), 3000);
        // Llamar onSuccess solo para recargar datos del padre
        if (onSuccess) onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Error al procesar permiso');
      }
    } catch (error) {
      setError('Error de conexión al procesar permiso');
      console.error('Error procesando permiso:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'Sin límite';
    return new Date(fecha).toLocaleDateString('es-ES');
  };

  const formatHorario = (inicio, fin) => {
    if (!inicio || !fin) return 'Sin restricción';
    // Eliminar segundos si existen (HH:MM:SS -> HH:MM)
    const formatTime = (time) => {
      if (!time) return '';
      return time.substring(0, 5); // Toma solo HH:MM
    };
    return `${formatTime(inicio)} - ${formatTime(fin)}`;
  };

  const getTipoText = (tipo) => {
    const tipos = {
      'horario_especial': 'Horario Extendido',
      'dia_adicional': 'Día Adicional',
      'restriccion': 'Restricción'
    };
    return tipos[tipo] || tipo;
  };


  // Componente Portal para mensajes de confirmación
  const MessagePortal = React.useMemo(() => {
    // Solo renderizar si hay mensajes (confirmaciones)
    if (messages.length === 0) return null;
    
    return (
      <MessageContainer 
        messages={messages} 
        onRemoveMessage={removeMessage} 
      />
    );
  }, [messages, removeMessage]);

  if (!usuario) return null;

  return (
    <>
      {/* Portal de mensajes (solo para confirmaciones) */}
      {MessagePortal && createPortal(MessagePortal, document.body)}
      <div className="permiso-form-overlay">
      
      <div className="permiso-form-content-container">
        <div className="permiso-form-header">
          <h2>📅 Agregar Permisos</h2>
        </div>

        <div className="permiso-form-body">
          {!showForm ? (
            <div className="permiso-form-permisos-list">
               {/* Header con botones */}
               <div className="permiso-form-list-header">
                 <button 
                   className="permiso-form-back-button"
                   onClick={onClose}
                   title="Volver"
                 >
                   ← Volver
                 </button>
                 <button 
                   className="permiso-form-add-button"
                   onClick={handleNuevoPermiso}
                   disabled={loading}
                 >
                   ➕ Permiso
                 </button>
               </div>

              {error && <div className="permiso-form-error-message">{error}</div>}
              {success && <div className="permiso-form-success-message">{success}</div>}
              {loading && <div className="permiso-form-loading-message">⏳ Cargando...</div>}

              {/* Lista de permisos */}
              <div className="permiso-form-grid">
                {permisos.length === 0 ? (
                  <div className="permiso-form-no-permisos">
                    <p>No hay permisos especiales asignados.</p>
                    <p>Este usuario usa los horarios generales del sistema.</p>
                  </div>
                ) : (
                  permisos.map((permiso) => (
                    <div key={permiso.id} className={`permiso-form-card ${!permiso.activo ? 'permiso-form-inactivo' : ''}`}>
                      <div className="permiso-form-card-header">
                        <div className="permiso-form-tipo">
                          {!permiso.activo && <span className="permiso-form-inactivo-badge">Inactivo</span>}
                        </div>
                      </div>
                      
                      <div className="permiso-form-card-details">
                        <div className="permiso-form-detail-row">
                          <span className="permiso-form-label">Período:</span>
                          <span className="permiso-form-value">
                            {formatFecha(permiso.fecha_inicio)} - {formatFecha(permiso.fecha_fin)}
                          </span>
                        </div>
                        <div className="permiso-form-detail-row">
                          <span className="permiso-form-label">Horario:</span>
                          <span className="permiso-form-value">
                            {formatHorario(permiso.hora_inicio, permiso.hora_fin)}
                          </span>
                        </div>
                        {permiso.observaciones && (
                          <div className="permiso-form-detail-row">
                            <span className="permiso-form-label">Observaciones:</span>
                            <span className="permiso-form-value permiso-form-observaciones">
                              {permiso.observaciones}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="permiso-form-card-actions">
                        <button 
                          className="permiso-form-edit-btn"
                          onClick={() => handleEditarPermiso(permiso)}
                          title="Editar permiso"
                        >
                          ✏️
                        </button>
                        <button 
                          className="permiso-form-delete-btn"
                          onClick={() => handleEliminarPermiso(permiso.id)}
                          title="Eliminar permiso"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="permiso-form-wrapper">
               <div className="permiso-form-wrapper-header">
                 <h3>{editingPermiso ? '✏️ Editar Permiso' : '➕ Nuevo Permiso'}</h3>
                 <button 
                   className="permiso-form-back-button"
                   onClick={resetForm}
                 >
                   ← Volver
                 </button>
               </div>

              <form onSubmit={handleSubmit} className="permiso-form-form">
                {/* Días */}
                <div className="permiso-form-section">
                  <label className="permiso-form-section-label">Días:</label>
                  <div className="permiso-form-row">
                    <div className="permiso-form-group">
                      <label htmlFor="fecha_inicio" className="permiso-form-field-label">Inicio</label>
                      <input
                        type="date"
                        id="fecha_inicio"
                        name="fecha_inicio"
                        value={formData.fecha_inicio}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="permiso-form-group">
                      <label htmlFor="fecha_fin" className="permiso-form-field-label">Fin</label>
                      <input
                        type="date"
                        id="fecha_fin"
                        name="fecha_fin"
                        value={formData.fecha_fin}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Horarios */}
                <div className="permiso-form-section">
                  <label className="permiso-form-section-label">Horarios:</label>
                  <div className="permiso-form-row">
                    <div className="permiso-form-group">
                      <label htmlFor="hora_inicio" className="permiso-form-field-label">De</label>
                      <input
                        type="time"
                        id="hora_inicio"
                        name="hora_inicio"
                        value={formData.hora_inicio}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="permiso-form-group">
                      <label htmlFor="hora_fin" className="permiso-form-field-label">Hasta</label>
                      <input
                        type="time"
                        id="hora_fin"
                        name="hora_fin"
                        value={formData.hora_fin}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div className="permiso-form-group">
                  <label htmlFor="observaciones">Observaciones:</label>
                  <textarea
                    id="observaciones"
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleInputChange}
                    placeholder="Descripción del permiso especial..."
                    rows="3"
                  />
                </div>

                {error && <div className="permiso-form-error-message">{error}</div>}
                {success && <div className="permiso-form-success-message">{success}</div>}

                 <div className="permiso-form-actions">
                   <button 
                     type="submit" 
                     className="permiso-form-save-button"
                     disabled={loading}
                   >
                     {loading ? 'Procesando...' : (editingPermiso ? 'Actualizar' : 'Guardar')}
                   </button>
                   <button 
                     type="button" 
                     className="permiso-form-cancel-button"
                     onClick={resetForm}
                   >
                     Cancelar
                   </button>
                 </div>
              </form>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default PermisoFormModal;
