import { useState, useCallback } from 'react';

const useAnimatedMessages = () => {
  const [messages, setMessages] = useState([]);

  const addMessage = useCallback((message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random();
    const newMessage = {
      id,
      message,
      type,
      duration: options.duration || 5000,
      position: options.position || 'top-center',
      icon: options.icon || null,
      show: true
    };

    setMessages(prev => [...prev, newMessage]);

    // Auto-remove message after duration
    setTimeout(() => {
      removeMessage(id);
    }, newMessage.duration);

    return id;
  }, []);

  const removeMessage = useCallback((id) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const clearAllMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Métodos de conveniencia
  const showSuccess = useCallback((message, options = {}) => {
    return addMessage(message, 'success', { duration: 4000, ...options });
  }, [addMessage]);

  const showError = useCallback((message, options = {}) => {
    return addMessage(message, 'error', { duration: 6000, ...options });
  }, [addMessage]);

  const showWarning = useCallback((message, options = {}) => {
    return addMessage(message, 'warning', { duration: 5000, ...options });
  }, [addMessage]);

  const showInfo = useCallback((message, options = {}) => {
    return addMessage(message, 'info', { duration: 4000, ...options });
  }, [addMessage]);

  const showLoading = useCallback((message, options = {}) => {
    return addMessage(message, 'loading', { duration: 0, ...options }); // 0 = no auto-remove
  }, [addMessage]);

  const showConfirm = useCallback((message, onConfirm, onCancel, options = {}) => {
    const id = Date.now() + Math.random();
    const confirmMessage = {
      id,
      message,
      type: 'confirm',
      duration: 0, // No auto-remove
      onConfirm,
      onCancel,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      show: true
    };

    setMessages(prev => [...prev, confirmMessage]);
    return id;
  }, []);

  return {
    messages,
    addMessage,
    removeMessage,
    clearAllMessages,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    showConfirm
  };
};

export default useAnimatedMessages;
