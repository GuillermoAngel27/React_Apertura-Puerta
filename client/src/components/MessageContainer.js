import React from 'react';
import AnimatedMessage from './AnimatedMessage';

const MessageContainer = ({ messages, onRemoveMessage }) => {
  // Si hay mensajes de confirmación, mostrar overlay de bloqueo
  const hasConfirmMessages = messages.some(msg => msg.type === 'confirm');
  
  return (
    <div className="message-container">
      {/* Overlay de bloqueo para mensajes de confirmación */}
      {hasConfirmMessages && (
        <div 
          className="message-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            pointerEvents: 'all'
          }}
        />
      )}
      
      {messages.map((msg) => (
        <AnimatedMessage
          key={msg.id}
          message={msg.message}
          type={msg.type}
          duration={msg.duration}
          position={msg.position}
          icon={msg.icon}
          show={msg.show}
          onClose={() => onRemoveMessage(msg.id)}
          // Props específicas para mensajes de confirmación
          onConfirm={msg.onConfirm}
          onCancel={msg.onCancel}
          confirmText={msg.confirmText}
          cancelText={msg.cancelText}
        />
      ))}
    </div>
  );
};

export default MessageContainer;
