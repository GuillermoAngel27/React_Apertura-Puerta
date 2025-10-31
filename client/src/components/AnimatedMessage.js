import React, { useState, useEffect } from 'react';
import './AnimatedMessage.css';

const AnimatedMessage = ({ 
  message, 
  type = 'info', 
  duration = 5000, 
  onClose, 
  show = true,
  icon = null,
  position = 'top-center',
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const messageIdRef = React.useRef(null);

  useEffect(() => {
    // Crear un ID único para este mensaje basado en su contenido
    const currentMessageId = `${message}-${type}`;
    
    // Si el mensaje cambió, resetear el estado de animación
    if (messageIdRef.current !== currentMessageId) {
      messageIdRef.current = currentMessageId;
      setIsVisible(false);
      setIsLeaving(false);
    }
    
    // Inicializar visibilidad cuando show es true y el mensaje está listo
    if (show && message && !isVisible && !isLeaving) {
      // Pequeño delay para asegurar que el DOM está listo antes de animar
      const timeoutId = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Solo configurar timer para tipos que no sean 'confirm' y si ya está visible
    if (show && message && isVisible && type !== 'confirm' && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
    
    // Cleanup: resetear cuando el componente se desmonta
    return () => {
      if (!show) {
        messageIdRef.current = null;
      }
    };
  }, [show, message, type, duration, isVisible, isLeaving]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  const handleConfirm = () => {
    // Cerrar el mensaje primero para evitar parpadeo antes de ejecutar la acción
    setIsLeaving(true);
    setTimeout(() => {
      if (onConfirm) {
        onConfirm();
      }
      // Remover el mensaje después de confirmar
      if (onClose) {
        onClose();
      }
    }, 150); // Delay corto para permitir animación de salida
  };

  const handleCancel = () => {
    // Cerrar el mensaje primero para evitar parpadeo
    setIsLeaving(true);
    setTimeout(() => {
      if (onCancel) {
        onCancel();
      }
      // Remover el mensaje después de cancelar
      if (onClose) {
        onClose();
      }
    }, 150); // Delay corto para permitir animación de salida
  };

  const getIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'loading':
        return '⏳';
      case 'confirm':
        return '⚠️';
      default:
        return '💬';
    }
  };

  const getMessageClass = () => {
    return `animated-message animated-message--${type} animated-message--${position} ${
      isVisible ? 'animated-message--visible' : ''
    } ${isLeaving ? 'animated-message--leaving' : ''}`;
  };

  if (!isVisible && !show) return null;

  return (
    <div className={getMessageClass()}>
      <div className="animated-message__content">
        <div className="animated-message__icon">
          {type === 'loading' ? (
            <div className="animated-message__spinner"></div>
          ) : (
            <span className="animated-message__icon-text">{getIcon()}</span>
          )}
        </div>
        <div className="animated-message__text">
          <div className="animated-message__title">
            {type === 'success' && '¡Éxito!'}
            {type === 'error' && 'Error'}
            {type === 'warning' && 'Advertencia'}
            {type === 'info' && 'Información'}
            {type === 'loading' && 'Procesando...'}
            {type === 'confirm' && 'Confirmar Acción'}
          </div>
          <div className="animated-message__message">{message}</div>
          
          {/* Botones de acción para tipo 'confirm' - dentro del texto */}
          {type === 'confirm' && (
            <div className="animated-message__actions">
              <button 
                className="animated-message__cancel"
                onClick={handleCancel}
              >
                {cancelText}
              </button>
              <button 
                className="animated-message__confirm"
                onClick={handleConfirm}
              >
                {confirmText}
              </button>
            </div>
          )}
        </div>
        <button 
          className="animated-message__close"
          onClick={handleClose}
          aria-label="Cerrar mensaje"
        >
          ✕
        </button>
      </div>
      <div className="animated-message__progress">
        <div className="animated-message__progress-bar"></div>
      </div>
    </div>
  );
};

export default AnimatedMessage;
