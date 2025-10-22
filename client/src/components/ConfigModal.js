import React, { useState, useEffect } from 'react';
import './ConfigModal.css';
import { apiGet, apiPut } from '../utils/api';

const ConfigModal = ({ onClose, onSuccess }) => {
  const [config, setConfig] = useState({
    horarios: {
      lunesViernes: {
        inicio: '08:00',
        fin: '18:00',
        habilitado: true
      },
      sabados: {
        inicio: '09:00',
        fin: '14:00',
        habilitado: true
      },
      domingos: {
        inicio: '10:00',
        fin: '12:00',
        habilitado: false
      }
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [noConfigMessage, setNoConfigMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError('');
      setNoConfigMessage('');
      
      // Token se maneja automáticamente con cookies
      const response = await apiGet('/api/config');

      if (response.ok) {
        const data = await response.json();
    
        
        // Verificar si hay configuración válida
        if (data.config && data.config.horarios) {
          setConfig({
            horarios: data.config.horarios || {
              lunesViernes: { inicio: '08:00', fin: '18:00', habilitado: true },
              sabados: { inicio: '09:00', fin: '14:00', habilitado: true },
              domingos: { inicio: '10:00', fin: '12:00', habilitado: false }
            }
          });
          setConfigLoaded(true);
        } else {
          // No hay configuración en base de datos
          setNoConfigMessage('⚠️ No se encontró configuración en la base de datos. Se mostrarán valores por defecto.');
          setConfigLoaded(true);
        }
      } else {
        setError('Error al cargar la configuración desde el servidor');
        setConfigLoaded(true);
      }
    } catch (error) {
      setError('Error de conexión al cargar configuración');
      setConfigLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    const [periodo, campo] = name.split('.');
    setConfig(prev => ({
      ...prev,
      horarios: {
        ...prev.horarios,
        [periodo]: {
          ...prev.horarios[periodo],
          [campo]: type === 'checkbox' ? checked : value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Token se maneja automáticamente con cookies
      
      // Enviar solo la configuración de horarios
      const configToSend = {
        horarios: config.horarios
      };

      const response = await apiPut('/api/config', configToSend);

      const data = await response.json();

      if (response.ok) {
        setSuccess('Configuración actualizada exitosamente');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(data.message || 'Error al actualizar configuración');
      }
    } catch (error) {
      setError('Error de conexión. Verifique que el servidor esté ejecutándose.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content config-modal">
        <div className="modal-header">
          <h2>⚙️ Configuración del Sistema</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="config-form">
          {loading && (
            <div className="loading-message">
              🔄 Cargando configuración desde base de datos...
            </div>
          )}
          
          {noConfigMessage && (
            <div className="no-config-message">
              {noConfigMessage}
            </div>
          )}
          

          <div className="config-section">
            <h3>🕐 Horarios de Apertura</h3>
            
            <div className="horario-group">
              <h4>Lunes - Viernes</h4>
              <div className="horario-controls">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="lunesViernes.habilitado"
                    checked={config.horarios.lunesViernes.habilitado}
                    onChange={handleChange}
                  />
                  <span>Habilitado</span>
                </label>
                <div className="time-inputs">
                  <input
                    type="time"
                    name="lunesViernes.inicio"
                    value={config.horarios.lunesViernes.inicio}
                    onChange={handleChange}
                    disabled={!config.horarios.lunesViernes.habilitado}
                  />
                  <span>a</span>
                  <input
                    type="time"
                    name="lunesViernes.fin"
                    value={config.horarios.lunesViernes.fin}
                    onChange={handleChange}
                    disabled={!config.horarios.lunesViernes.habilitado}
                  />
                </div>
              </div>
            </div>

            <div className="horario-group">
              <h4>Sábados</h4>
              <div className="horario-controls">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="sabados.habilitado"
                    checked={config.horarios.sabados.habilitado}
                    onChange={handleChange}
                  />
                  <span>Habilitado</span>
                </label>
                <div className="time-inputs">
                  <input
                    type="time"
                    name="sabados.inicio"
                    value={config.horarios.sabados.inicio}
                    onChange={handleChange}
                    disabled={!config.horarios.sabados.habilitado}
                  />
                  <span>a</span>
                  <input
                    type="time"
                    name="sabados.fin"
                    value={config.horarios.sabados.fin}
                    onChange={handleChange}
                    disabled={!config.horarios.sabados.habilitado}
                  />
                </div>
              </div>
            </div>

            <div className="horario-group">
              <h4>Domingos</h4>
              <div className="horario-controls">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="domingos.habilitado"
                    checked={config.horarios.domingos.habilitado}
                    onChange={handleChange}
                  />
                  <span>Habilitado</span>
                </label>
                <div className="time-inputs">
                  <input
                    type="time"
                    name="domingos.inicio"
                    value={config.horarios.domingos.inicio}
                    onChange={handleChange}
                    disabled={!config.horarios.domingos.habilitado}
                  />
                  <span>a</span>
                  <input
                    type="time"
                    name="domingos.fin"
                    value={config.horarios.domingos.fin}
                    onChange={handleChange}
                    disabled={!config.horarios.domingos.habilitado}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-actions">
            <button 
              type="submit" 
              className="save-button"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button 
              type="button" 
              className="cancel-button"
              onClick={onClose}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfigModal;
