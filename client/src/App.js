import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';
import { apiGet, apiPost } from './utils/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay un token en cookies
    verifyToken();
    
    // Verificación periódica de sesión (cada 30 segundos)
    const sessionCheckInterval = setInterval(() => {
      if (isAuthenticated) {
        verifyToken();
      }
    }, 30000);
    
    // Cleanup del interval al desmontar
    return () => {
      clearInterval(sessionCheckInterval);
    };
  }, [isAuthenticated]);

  // Función para leer cookie del navegador
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const verifyToken = async () => {
    
    // Primero verificar si tenemos cookie local
    const cookieToken = getCookie('token');
    
    if (!cookieToken) {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      const response = await apiGet('/api/verify-token');

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        const errorData = await response.json();
        
        // Solo limpiar estado, NO las cookies (dispositivo sigue autorizado)
        console.log('🔒 Sesión inválida detectada - Manteniendo dispositivo autorizado');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('❌ Error verificando token:', error);
      
      // Error de conexión - solo limpiar estado, mantener dispositivo autorizado
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    // Marcar tiempo de login para detectar logout automático
    window.lastLoginTime = Date.now();
  };

  const handleLogout = async () => {
    
    // SOLUCIÓN FINAL: No limpiar cookies en logout - son permanentes del dispositivo
    try {
      await apiPost('/api/logout');
    } catch (error) {
    } finally {
      // Solo limpiar estado de sesión, NO la cookie
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Verificando autenticación...</p>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Neural Background Effects */}
      <div className="neural-background"></div>
      
      {/* Floating Geometric Shapes */}
      <div className="geometric-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>

      {/* Neural Network Lines */}
      <div className="neural-lines">
        <div className="neural-line"></div>
        <div className="neural-line"></div>
        <div className="neural-line"></div>
      </div>

      {isAuthenticated ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;