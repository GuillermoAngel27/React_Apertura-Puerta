import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay un token en cookies
    verifyToken();
  }, []);

  // Función para leer cookie del navegador
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const verifyToken = async () => {
    console.log('🔍 VERIFICANDO TOKEN EN COOKIES...');
    
    // Primero verificar si tenemos cookie local
    const cookieToken = getCookie('token');
    console.log('🍪 Cookie token encontrada localmente:', cookieToken ? 'SÍ' : 'NO');
    
    if (!cookieToken) {
      console.log('❌ NO hay token en cookie local');
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/verify-token', {
        credentials: 'include'
      });

      console.log('📡 TOKEN VERIFY STATUS:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ TOKEN VÁLIDO - Usuario:', data.user);
        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        const errorData = await response.json();
        console.log('❌ TOKEN INVÁLIDO:', errorData.message);
        // NOTA: NO limpiar cookie - podría ser usuario diferente en mismo dispositivo
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('💥 ERROR VERIFICANDO TOKEN:', error);
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
    console.log('✅ LOGIN COMPLETO - Tiempo marcado para detectar logout automático');
  };

  const handleLogout = async () => {
    console.log('🚪 HANDLELOGOUT LLAMADO');
    
    // SOLUCIÓN FINAL: No limpiar cookies en logout - son permanentes del dispositivo
    try {
      await fetch('http://localhost:5000/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      console.log('✅ Sesión cerrada - Token del dispositivo MANTENIDO');
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      // Solo limpiar estado de sesión, NO la cookie
      setUser(null);
      setIsAuthenticated(false);
      console.log('🔄 Usuario deslogueado - Token disponible para futuros logins');
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