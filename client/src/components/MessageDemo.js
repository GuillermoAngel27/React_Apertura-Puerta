// Ejemplo de uso del sistema de mensajes animados
// Este archivo muestra cómo usar el nuevo sistema de mensajes

import React from 'react';
import MessageContainer from './MessageContainer';
import useAnimatedMessages from '../hooks/useAnimatedMessages';

const MessageDemo = () => {
  const { 
    messages, 
    showSuccess, 
    showError, 
    showWarning, 
    showInfo, 
    showLoading, 
    removeMessage 
  } = useAnimatedMessages();

  const handleSuccess = () => {
    showSuccess('🎉 ¡Operación completada exitosamente!');
  };

  const handleError = () => {
    showError('🚫 Error crítico: No se pudo procesar la solicitud');
  };

  const handleWarning = () => {
    showWarning('⚠️ Advertencia: Verifique los datos ingresados');
  };

  const handleInfo = () => {
    showInfo('ℹ️ Información: Sistema actualizado correctamente');
  };

  const handleLoading = () => {
    const loadingId = showLoading('⏳ Procesando solicitud...');
    
    // Simular operación asíncrona
    setTimeout(() => {
      removeMessage(loadingId);
      showSuccess('✅ Proceso completado');
    }, 3000);
  };

  return (
    <div>
      <h2>Demo de Mensajes Animados</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={handleSuccess}>Mensaje de Éxito</button>
        <button onClick={handleError}>Mensaje de Error</button>
        <button onClick={handleWarning}>Mensaje de Advertencia</button>
        <button onClick={handleInfo}>Mensaje de Información</button>
        <button onClick={handleLoading}>Mensaje de Carga</button>
      </div>

      {/* Contenedor de mensajes */}
      <MessageContainer 
        messages={messages} 
        onRemoveMessage={removeMessage} 
      />
    </div>
  );
};

export default MessageDemo;
