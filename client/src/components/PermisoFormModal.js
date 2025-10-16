import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './PermisoFormModal.css';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import useAnimatedMessages from '../hooks/useAnimatedMessages';
import MessageContainer from './MessageContainer';

const PermisoFormModal = ({ usuario, onClose, onSuccess }) => {
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados para el formulario
  const [showForm, setShowForm] = useState(false);
  const [editingPermiso, setEditingPermiso] = useState(null);
  
  const [formData, setFormData] = useState({
    tipo: 'horario_especial',
    fecha_inicio: '',
    fecha_fin: '',
    hora_inicio: '',
    hora_fin: '',
    observaciones: ''
  });

  // Sistema de mensajes animados
  const { messages, showSuccess: showMsgSuccess, showError: showMsgError, removeMessage } = useAnimatedMessages();

  useEffect(() => {
    if (usuario) {
      loadPermisosUsuario();
    }
  }, [usuario]);

  const loadPermisosUsuario = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiGet(`/api/permisos-especiales/usuario/${usuario.id}`);
      
      if (response.ok) {
        const data = await response.json();
        setPermisos(data.permisos || []);
        console.log('📋 Permisos cargados:', data.permisos?.length || 0);
      } else {
        setError('Error al cargar permisos del usuario');
      }
    } catch (error) {
      setError('Error de conexión al cargar permisos');
      console.error('Error cargando permisos:', error);
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


  const resetForm = () => {
    setFormData({
      tipo: 'horario_especial',
      fecha_inicio: '',
      fecha_fin: '',
      hora_inicio: '',
      hora_fin: '',
      observaciones: ''
    });
    setEditingPermiso(null);
    setShowForm(false);
    setError('');
    setSuccess('');
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
    if (!window.confirm('¿Estás seguro de que quieres eliminar este permiso?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiDelete(`/api/permisos-especiales/${permisoId}`);
      
      if (response.ok) {
        setSuccess('Permiso eliminado exitosamente');
        loadPermisosUsuario();
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
        response = await apiPut(`/api/permisos-especiales/${editingPermiso.id}`, permisoData);
      } else {
        response = await apiPost('/api/permisos-especiales', permisoData);
      }

      if (response.ok) {
        const message = editingPermiso ? 'Permiso actualizado exitosamente' : 'Permiso creado exitosamente';
        setSuccess(message);
        loadPermisosUsuario();
        resetForm();
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
    return `${inicio} - ${fin}`;
  };

  const getTipoText = (tipo) => {
    const tipos = {
      'horario_especial': 'Horario Extendido',
      'dia_adicional': 'Día Adicional',
      'restriccion': 'Restricción'
    };
    return tipos[tipo] || tipo;
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

  if (!usuario) return null;

  return (
    <div className="modal-overlay">
      {/* Portal de mensajes */}
      <MessagePortal />
      
      <div className="modal-content permiso-form-modal">
        <div className="modal-header">
          <h2>📅 Permisos de Acceso - {usuario.nombre} {usuario.apellido}</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="permiso-content">
          {!showForm ? (
            <div className="permisos-list">
              {/* Botón agregar */}
              <div className="list-header">
                <h3>Permisos Especiales</h3>
                <button 
                  className="add-button"
                  onClick={handleNuevoPermiso}
                  disabled={loading}
                >
                  ➕ Nuevo Permiso
                </button>
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}
              {loading && <div className="loading-message">⏳ Cargando...</div>}

              {/* Lista de permisos */}
              <div className="permisos-grid">
                {permisos.length === 0 ? (
                  <div className="no-permisos">
                    <p>No hay permisos especiales asignados.</p>
                    <p>Este usuario usa los horarios generales del sistema.</p>
                  </div>
                ) : (
                  permisos.map((permiso) => (
                    <div key={permiso.id} className={`permiso-card ${!permiso.activo ? 'inactivo' : ''}`}>
                      <div className="permiso-header">
                        <div className="permiso-tipo">
                          <span className="tipo-badge">{getTipoText(permiso.tipo)}</span>
                          {!permiso.activo && <span className="inactivo-badge">Inactivo</span>}
                        </div>
                        <div className="permiso-actions">
                          <button 
                            className="edit-btn"
                            onClick={() => handleEditarPermiso(permiso)}
                            title="Editar permiso"
                          >
                            ✏️
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={() => handleEliminarPermiso(permiso.id)}
                            title="Eliminar permiso"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <div className="permiso-details">
                        <div className="detail-row">
                          <span className="label">Período:</span>
                          <span className="value">
                            {formatFecha(permiso.fecha_inicio)} - {formatFecha(permiso.fecha_fin)}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Horario:</span>
                          <span className="value">
                            {formatHorario(permiso.hora_inicio, permiso.hora_fin)}
                          </span>
                        </div>
                        {permiso.observaciones && (
                          <div className="detail-row">
                            <span className="label">Observaciones:</span>
                            <span className="value observaciones">
                              {permiso.observaciones}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="permiso-form">
              <div className="form-header">
                <h3>{editingPermiso ? '✏️ Editar Permiso' : '➕ Nuevo Permiso'}</h3>
                <button 
                  className="back-button"
                  onClick={resetForm}
                >
                  ← Volver
                </button>
              </div>

              <form onSubmit={handleSubmit} className="form">
                {/* Días */}
                <div className="form-section">
                  <label className="section-label">Días:</label>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="fecha_inicio" className="field-label">Inicio</label>
                      <input
                        type="date"
                        id="fecha_inicio"
                        name="fecha_inicio"
                        value={formData.fecha_inicio}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="fecha_fin" className="field-label">Fin</label>
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
                <div className="form-section">
                  <label className="section-label">Horarios:</label>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="hora_inicio" className="field-label">De</label>
                      <input
                        type="time"
                        id="hora_inicio"
                        name="hora_inicio"
                        value={formData.hora_inicio}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="hora_fin" className="field-label">Hasta</label>
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
                <div className="form-group">
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

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="save-button"
                    disabled={loading}
                  >
                    {loading ? 'Procesando...' : (editingPermiso ? 'Actualizar' : 'Guardar')}
                  </button>
                  <button 
                    type="button" 
                    className="cancel-button"
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
  );
};

export default PermisoFormModal;
