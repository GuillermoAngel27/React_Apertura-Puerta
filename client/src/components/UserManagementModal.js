import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './UserManagementModal.css';
import useAnimatedMessages from '../hooks/useAnimatedMessages';
import MessageContainer from './MessageContainer';

const UserManagementModal = ({ onClose, onSuccess, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estado para mensaje específico del usuario (móvil)
  const [userSpecificMessage, setUserSpecificMessage] = useState(null);
  
  // Sistema de mensajes animados
  const { messages, showSuccess, showError, showWarning, showInfo, showLoading, showConfirm, removeMessage } = useAnimatedMessages();
  
  // Search and pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(5);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    nombre: '',
    apellido: ''
  });

  // Estados para el generador de contraseñas
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPasswordGenerator, setShowPasswordGenerator] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  // Filter users based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.apellido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
    setCurrentPage(1); // Reset to first page when searching
  }, [searchTerm, users]);

  const loadUsers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/users', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
        setFilteredUsers(data);
      } else {
        setError('Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setError('Error de conexión al cargar usuarios');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      nombre: '',
      apellido: ''
    });
    setEditingUser(null);
    setShowAddForm(false);
    setGeneratedPassword('');
    setShowPasswordGenerator(false);
  };

  // Función para generar contraseña segura de 10 dígitos
  const generateSecurePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specialChars = '-';
    
    let password = '';
    
    // Asegurar al menos un carácter de cada tipo
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specialChars[Math.floor(Math.random() * specialChars.length)];
    
    // Completar hasta 10 caracteres con caracteres aleatorios
    const allChars = uppercase + lowercase + numbers + specialChars;
    for (let i = 4; i < 10; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mezclar la contraseña
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    setGeneratedPassword(password);
    setFormData({
      ...formData,
      password: password
    });
    setShowPasswordGenerator(true);
  };

  // Función para copiar contraseña al portapapeles
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Contraseña copiada al portapapeles');
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
      setError('Error al copiar al portapapeles');
    }
  };

  // Pagination functions
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleEdit = async (user) => {
    try {
      setLoading(true);
      setError('');
      
      // Obtener datos completos del usuario incluyendo contraseña
      const response = await fetch(`http://localhost:5000/api/users/${user.id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        setEditingUser(userData);
        setFormData({
          username: userData.username,
          email: userData.email,
          password: userData.password, // Cargar contraseña actual
          role: userData.role,
          nombre: userData.nombre || '',
          apellido: userData.apellido || ''
        });
        setGeneratedPassword('');
        setShowPasswordGenerator(false);
        setShowPassword(false);
        setShowAddForm(true);
      } else {
        setError('Error al cargar datos del usuario');
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
      setError('Error de conexión al cargar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId, username) => {
    // Mostrar mensaje de confirmación en lugar del alert
    showConfirm(
      `¿Eliminar usuario ${username}?\n\nEsta acción no se puede deshacer. El usuario será eliminado permanentemente del sistema.`,
      () => {
        // Función de confirmación - ejecutar la eliminación
        executeDelete(userId, username);
      },
      () => {
        // Función de cancelación - no hacer nada
        console.log('🗑️ Eliminación cancelada por el usuario');
      },
      {
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    );
  };

  // Función separada para ejecutar la eliminación
  const executeDelete = async (userId, username) => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setSuccess(`✅ Usuario ${username} eliminado exitosamente`);
        setTimeout(() => setSuccess(''), 3000);
        
        // Mensaje específico para móvil
        setUserSpecificMessage({
          userId: userId,
          username: username,
          message: `✅ Usuario ${username} eliminado exitosamente`,
          type: 'success'
        });
        
        // Limpiar mensaje específico después de 4 segundos
        setTimeout(() => setUserSpecificMessage(null), 4000);
        
        loadUsers();
      } else {
        const data = await response.json();
        setError(data.message || 'Error al eliminar usuario');
        
        // Mensaje específico para móvil (error)
        setUserSpecificMessage({
          userId: userId,
          username: username,
          message: `❌ Error al eliminar usuario ${username}`,
          type: 'error'
        });
        
        // Limpiar mensaje específico después de 5 segundos
        setTimeout(() => setUserSpecificMessage(null), 5000);
      }
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      setError('Error de conexión al eliminar usuario');
      
      // Mensaje específico para móvil (error de conexión)
      setUserSpecificMessage({
        userId: userId,
        username: username,
        message: `❌ Error de conexión al eliminar usuario`,
        type: 'error'
      });
      
      // Limpiar mensaje específico después de 5 segundos
      setTimeout(() => setUserSpecificMessage(null), 5000);
    }
  };

  // Nueva función para refrescar token de dispositivo (SOLO ADMIN)
  const handleRefreshToken = async (userId, username) => {
    // Mostrar mensaje de confirmación en lugar del alert
    showConfirm(
      `¿Refrescar token de dispositivo para ${username}?\n\nEsto permitirá que el usuario active su token en un dispositivo nuevo. El usuario deberá hacer login nuevamente.`,
      () => {
        // Función de confirmación - ejecutar el refresh token
        executeRefreshToken(userId, username);
      },
      () => {
        // Función de cancelación - no hacer nada
        console.log('🔄 Refresh token cancelado por el usuario');
      },
      {
        confirmText: 'Refrescar',
        cancelText: 'Cancelar'
      }
    );
  };

  // Función separada para ejecutar el refresh token
  const executeRefreshToken = async (userId, username) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      console.log(`🔄 ADMIN REFRESH TOKEN - Iniciando refresh para usuario ${username} (ID: ${userId})`);
      
      const response = await fetch(`http://localhost:5000/api/refresh-token/${userId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ADMIN REFRESH TOKEN - Éxito para ${username}:`)
        console.log('📄 Response:', data);
        
        setSuccess(`✅ Token refrescado exitosamente para ${username}. El usuario puede hacer login nuevamente.`);
        setTimeout(() => setSuccess(''), 5000);
        
        // Mensaje específico para móvil
        setUserSpecificMessage({
          userId: userId,
          username: username,
          message: `✅ Token refrescado exitosamente para ${username}`,
          type: 'success'
        });
        
        // Limpiar mensaje específico después de 4 segundos
        setTimeout(() => setUserSpecificMessage(null), 4000);
        
        // Recargar la lista de usuarios para mostrar el nuevo token
        loadUsers();
        
        // Notificar al Dashboard para actualizar notificaciones (pero NO cerrar modal)
        if (onSuccess) {
          onSuccess('token_refreshed');
        }
      } else {
        const errorData = await response.json();
        console.error(`❌ ADMIN REFRESH TOKEN - Error para ${username}:`, errorData);
        setError(`❌ Error al refrescar token de ${username}: ${errorData.message || 'Error desconocido'}`);
        
        // Mensaje específico para móvil (error)
        setUserSpecificMessage({
          userId: userId,
          username: username,
          message: `❌ Error al refrescar token de ${username}`,
          type: 'error'
        });
        
        // Limpiar mensaje específico después de 5 segundos
        setTimeout(() => setUserSpecificMessage(null), 5000);
      }
    } catch (error) {
      console.error('💥 ADMIN REFRESH TOKEN - Error de conexión:', error);
      setError(`❌ Error de conexión al refrescar token de ${username}`);
      
      // Mensaje específico para móvil (error de conexión)
      setUserSpecificMessage({
        userId: userId,
        username: username,
        message: `❌ Error de conexión al refrescar token`,
        type: 'error'
      });
      
      // Limpiar mensaje específico después de 5 segundos
      setTimeout(() => setUserSpecificMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validaciones
    if (formData.password && formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const url = editingUser 
        ? `http://localhost:5000/api/users/${editingUser.id}`
        : 'http://localhost:5000/api/register';
      
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          rol: formData.role,
          nombre: formData.nombre,
          apellido: formData.apellido
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(editingUser ? 'Usuario actualizado exitosamente' : 'Usuario registrado exitosamente');
        
        // Mensaje específico para móvil (solo para actualizaciones)
        if (editingUser) {
          setUserSpecificMessage({
            userId: editingUser.id,
            username: editingUser.username,
            message: `✅ Usuario ${editingUser.username} actualizado exitosamente`,
            type: 'success'
          });
          
          // Limpiar mensaje específico después de 4 segundos
          setTimeout(() => setUserSpecificMessage(null), 4000);
        }
        
        loadUsers();
        resetForm();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Error al procesar usuario');
        
        // Mensaje específico para móvil (error)
        if (editingUser) {
          setUserSpecificMessage({
            userId: editingUser.id,
            username: editingUser.username,
            message: `❌ Error al actualizar usuario ${editingUser.username}`,
            type: 'error'
          });
          
          // Limpiar mensaje específico después de 5 segundos
          setTimeout(() => setUserSpecificMessage(null), 5000);
        }
      }
    } catch (error) {
      console.error('Error procesando usuario:', error);
      setError('Error de conexión. Verifique que el servidor esté ejecutándose.');
      
      // Mensaje específico para móvil (error de conexión)
      if (editingUser) {
        setUserSpecificMessage({
          userId: editingUser.id,
          username: editingUser.username,
          message: `❌ Error de conexión al actualizar usuario`,
          type: 'error'
        });
        
        // Limpiar mensaje específico después de 5 segundos
        setTimeout(() => setUserSpecificMessage(null), 5000);
      }
    } finally {
      setLoading(false);
    }
  };

  // Componente Portal para mensajes - renderiza fuera del modal
  const MessagePortal = () => {
    return createPortal(
      <MessageContainer 
        messages={messages} 
        onRemoveMessage={removeMessage} 
      />,
      document.body
    );
  };

  return (
    <div className="modal-overlay">
      {/* Portal de mensajes - renderiza en document.body */}
      <MessagePortal />
      
      <div className="modal-content user-management-modal">
        <div className="modal-header">
          <h2>👥 Administración de Usuarios</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="user-management-content">
          {!showAddForm ? (
            <div className="users-table-container">
              {/* Search Bar and Add Button Row */}
              <div className="search-add-row">
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    placeholder="🔍 Buscar usuarios por nombre, email, usuario o rol..."
                    value={searchTerm}
                    onChange={handleSearchChange}
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
                <button 
                  className="add-user-button"
                  onClick={() => setShowAddForm(true)}
                >
                  ➕ Agregar Usuario
                </button>
              </div>

              {error && <div className="error-message desktop-only-message">{error}</div>}
              {success && <div className="success-message desktop-only-message">{success}</div>}

              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nombre</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Token & Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentUsers.map((user, index) => {
                      const globalNumber = (currentPage - 1) * usersPerPage + index + 1;
                      return (
                      <tr key={user.id}>
                        <td>{globalNumber}</td>
                        <td>{user.nombre} {user.apellido}</td>
                        <td>{user.username}</td>
                        <td>
                          <span className={`role-badge ${user.role}`}>
                            {user.role === 'admin' ? '👑 Admin' : 
                             user.role === 'jefe' ? '👔 Jefe de Departamento' :
                             '👤 Usuario'}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="refresh-token-button" 
                              onClick={() => handleRefreshToken(user.id, user.username)} 
                              title="🔄 Refrescar Token de Dispositivo"
                              style={{
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 10px',
                                marginRight: '5px',
                                fontSize: '14px',
                                cursor: 'pointer'
                              }}
                            >
                              🔄
                            </button>
                            <button 
                              className="edit-button" 
                              onClick={() => handleEdit(user)} 
                              title="Editar usuario"
                            >
                              ✏️
                            </button>
                            <button 
                              className="delete-button" 
                              onClick={() => handleDelete(user.id, user.username)} 
                              title="Eliminar usuario"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards Layout */}
              <div className="users-cards-container">
                {currentUsers.map((user, index) => {
                  const globalNumber = (currentPage - 1) * usersPerPage + index + 1;
                  return (
                  <div key={user.id} className="user-card">
                    {/* Mensaje específico del usuario (móvil) */}
                    {userSpecificMessage && userSpecificMessage.userId === user.id && (
                      <div className={`user-card-message user-card-message--${userSpecificMessage.type}`}>
                        {userSpecificMessage.message}
                      </div>
                    )}
                    
                    <div className="user-card-header">
                      <div className="user-card-number">#{globalNumber}</div>
                    </div>
                    
                    <div className="user-card-info">
                      <div className="user-card-field">
                        <div className="user-card-label">Nombre</div>
                        <div className="user-card-value">{user.nombre} {user.apellido}</div>
                      </div>
                      
                      <div className="user-card-field">
                        <div className="user-card-label">Usuario</div>
                        <div className="user-card-value">{user.username}</div>
                      </div>
                    </div>
                    
                    <div className="user-card-actions">
                      <div className="user-card-role">
                        <span className={`role-badge ${user.role}`}>
                          {user.role === 'admin' ? '👑 Admin' : 
                           user.role === 'jefe' ? '👔 Jefe de Departamento' :
                           '👤 Usuario'}
                        </span>
                      </div>
                      
                      <div className="user-card-buttons">
                        <button 
                          className="mobile-action-button mobile-refresh-button" 
                          onClick={() => handleRefreshToken(user.id, user.username)} 
                          title="🔄 Refrescar Token"
                        >
                          🔄
                        </button>
                        <button 
                          className="mobile-action-button mobile-edit-button" 
                          onClick={() => handleEdit(user)} 
                          title="Editar usuario"
                        >
                          ✏️
                        </button>
                        <button 
                          className="mobile-action-button mobile-delete-button" 
                          onClick={() => handleDelete(user.id, user.username)} 
                          title="Eliminar usuario"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination-container">
                  <div className="pagination-controls">
                    <button 
                      className="pagination-button"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      title="Página anterior"
                    >
                      ◀
                    </button>
                    
                    <div className="pagination-info">
                      Página {currentPage} de {totalPages}
                    </div>
                    
                    <button 
                      className="pagination-button"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      title="Página siguiente"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="user-form-container">
              <div className="form-header">
                <h3>{editingUser ? '✏️ Editar Usuario' : '➕ Agregar Usuario'}</h3>
                <button 
                  className="back-button"
                  onClick={resetForm}
                >
                  ← Volver
                </button>
              </div>

              <form onSubmit={handleSubmit} className="user-form">
                <div className="form-group">
                  <label htmlFor="nombre">Nombre:</label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                    placeholder="Ingrese el nombre"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="apellido">Apellido:</label>
                  <input
                    type="text"
                    id="apellido"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                    required
                    placeholder="Ingrese el apellido"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="username">Usuario (para login):</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    placeholder="Ingrese el nombre de usuario"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email:</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="Ingrese el email"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">
                    {editingUser ? 'Nueva Contraseña (opcional):' : 'Contraseña:'}
                  </label>
                  <div className="password-input-container">
                    <div className="password-field-wrapper">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required={!editingUser}
                        placeholder={editingUser ? "Dejar vacío para mantener la actual" : "Mínimo 6 caracteres"}
                        className="password-input"
                      />
                      {editingUser && formData.password && (
                        <button 
                          type="button"
                          className="toggle-password-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPassword ? '🙈' : '👁️'}
                        </button>
                      )}
                    </div>
                    <div className="password-buttons">
                      <button 
                        type="button"
                        className="generate-password-btn"
                        onClick={generateSecurePassword}
                        title="Generar contraseña segura"
                      >
                        {editingUser ? '🔄 Actualizar' : '🎲 Crear'}
                      </button>
                      {formData.password && (
                        <button 
                          type="button"
                          className="copy-password-btn"
                          onClick={() => copyToClipboard(formData.password)}
                          title="Copiar contraseña"
                        >
                          📋 Copiar
                        </button>
                      )}
                    </div>
                  </div>
                  {showPasswordGenerator && generatedPassword && (
                    <div className="generated-password-display">
                      <span className="password-label">Contraseña generada:</span>
                      <span className="generated-password">{generatedPassword}</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="role">Rol:</label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    required
                  >
                    <option value="user">👤 Usuario</option>
                    <option value="jefe">👔 Jefe de Departamento</option>
                    <option value="admin">👑 Administrador</option>
                  </select>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="save-button"
                    disabled={loading}
                  >
                    {loading ? 'Procesando...' : (editingUser ? 'Actualizar' : 'Guardar')}
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

export default UserManagementModal;
