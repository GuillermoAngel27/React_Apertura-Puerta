import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './UserManagementModal.css';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import useAnimatedMessages from '../hooks/useAnimatedMessages';
import MessageContainer from './MessageContainer';

const UserManagementModal = ({ onClose, onSuccess, currentUser }) => {
  const [users, setUsers] = useState([]);
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
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    username: '',
    email: 'user@taqro.com.mx',
    password: '',
    role: 'user',
    nombre: '',
    apellido: '',
    jefe_id: null
  });

  // Estados para el dropdown de jefes
  const [jefesList, setJefesList] = useState([]);
  const [selectedJefe, setSelectedJefe] = useState(null);

  // Estados para el generador de contraseñas
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPasswordGenerator, setShowPasswordGenerator] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [currentPage, searchTerm]);

  // Cargar lista de jefes cuando se abre el modal
  useEffect(() => {
    if (showAddForm) {
      loadJefesList();
    }
  }, [showAddForm]);

  // Reset page when search term changes
  useEffect(() => {
    if (searchTerm !== '') {
      setCurrentPage(1);
    }
  }, [searchTerm]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        page: currentPage,
        limit: usersPerPage,
        search: searchTerm
      });

      const response = await apiGet(`/api/users?${params}`);

      if (response.ok) {
        const data = await response.json();
        
        // Manejar nueva estructura con paginación
        if (data.users && data.pagination) {
          setUsers(data.users);
          setTotalPages(data.pagination.totalPages);
          setTotalUsers(data.pagination.totalItems);
          
          // Validar que currentPage no exceda totalPages
          if (currentPage > data.pagination.totalPages && data.pagination.totalPages > 0) {
            setCurrentPage(data.pagination.totalPages);
          }
        } else {
          // Fallback para estructura antigua
          setUsers(data);
          const calculatedTotalPages = Math.ceil(data.length / usersPerPage);
          setTotalPages(calculatedTotalPages);
          setTotalUsers(data.length);
          
          // Validar que currentPage no exceda totalPages calculadas
          if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
            setCurrentPage(calculatedTotalPages);
          }
        }
      } else {
        setError('Error al cargar usuarios');
      }
    } catch (error) {
      setError('Error de conexión al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar lista de jefes
  const loadJefesList = async () => {
    try {
      const response = await apiGet('/api/jefes');
      if (response.ok) {
        const jefes = await response.json();
        setJefesList(jefes);
      } else {
        console.error('Error cargando jefes');
      }
    } catch (error) {
      console.error('Error de conexión cargando jefes:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el rol, resetear el jefe seleccionado
    if (name === 'role') {
      setSelectedJefe(null);
      setFormData({
        ...formData,
        [name]: value,
        jefe_id: null
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Función para manejar cambio de jefe seleccionado
  const handleJefeChange = (e) => {
    const jefeId = e.target.value;
    setSelectedJefe(jefeId);
    setFormData({
      ...formData,
      jefe_id: jefeId || null
    });
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: 'user@taqro.com.mx',
      password: '',
      role: 'user',
      nombre: '',
      apellido: '',
      jefe_id: null
    });
    setSelectedJefe(null);
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
      setError('Error al copiar al portapapeles');
    }
  };

  // Los usuarios ya vienen paginados del backend, no necesitamos paginación adicional
  const currentUsers = users;

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages && totalPages > 0) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleEdit = async (user) => {
    try {
      setLoading(true);
      setError('');
      
      // Obtener datos completos del usuario incluyendo contraseña
      const response = await apiGet(`/api/users/${user.id}`);
      
      if (response.ok) {
        const userData = await response.json();
        setEditingUser(userData);
        setFormData({
          username: userData.username,
          email: 'user@taqro.com.mx', // Email fijo por defecto
          password: userData.password, // Cargar contraseña actual
          role: userData.role,
          nombre: userData.nombre || '',
          apellido: userData.apellido || '',
          jefe_id: userData.jefe_id || null
        });
        setSelectedJefe(userData.jefe_id || null);
        setGeneratedPassword('');
        setShowPasswordGenerator(false);
        setShowPassword(false);
        setShowAddForm(true);
      } else {
        setError('Error al cargar datos del usuario');
      }
    } catch (error) {
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
      const response = await apiDelete(`/api/users/${userId}`);

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
      
      
      const response = await apiPost(`/api/refresh-token/${userId}`);

      if (response.ok) {
        const data = await response.json();
              
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
      const userData = {
        username: formData.username,
        email: 'user@taqro.com.mx', // Email fijo para todos los usuarios
        password: formData.password,
        rol: formData.role,
        nombre: formData.nombre,
        apellido: formData.apellido,
        jefe_id: formData.jefe_id
      };

      const response = editingUser 
        ? await apiPut(`/api/users/${editingUser.id}`, userData)
        : await apiPost('/api/register', userData);

      const data = await response.json();

      if (response.ok) {
        // Mostrar mensaje de éxito con información adicional si hay usuarios afectados
        let successMessage = editingUser ? 'Usuario actualizado exitosamente' : 'Usuario registrado exitosamente';
        
        if (data.usuariosAfectados && data.usuariosAfectados > 0) {
          successMessage += ` ${data.usuariosAfectados} usuarios quedaron sin jefe asignado.`;
        }
        
        setSuccess(successMessage);
        
        // Mensaje específico para móvil (solo para actualizaciones)
        if (editingUser) {
          setUserSpecificMessage({
            userId: editingUser.id,
            username: editingUser.username,
            message: `✅ ${successMessage}`,
            type: 'success'
          });
          
          // Limpiar mensaje específico después de 6 segundos (más tiempo para leer el mensaje completo)
          setTimeout(() => setUserSpecificMessage(null), 6000);
        }
        
        loadUsers();
        resetForm();
        setTimeout(() => setSuccess(''), 5000); // Más tiempo para leer el mensaje completo
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
                    placeholder="🔍 Buscar usuarios por nombre, usuario o rol..."
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
              {loading && <div className="loading-message desktop-only-message">⏳ Cargando usuarios...</div>}

              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nombre</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Jefe</th>
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
                          {user.role === 'user' ? (
                            user.jefe_nombre && user.jefe_apellido ? (
                              <span className="jefe-info">
                                {user.jefe_nombre} {user.jefe_apellido}
                                <br />
                                <small>({user.jefe_username})</small>
                              </span>
                            ) : (
                              <span className="no-jefe">Sin jefe asignado</span>
                            )
                          ) : (
                            <span className="no-jefe">-</span>
                          )}
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

                      {user.role === 'user' && (
                        <div className="user-card-field">
                          <div className="user-card-label">Jefe</div>
                          <div className="user-card-value">
                            {user.jefe_nombre && user.jefe_apellido ? (
                              <span className="jefe-info">
                                {user.jefe_nombre} {user.jefe_apellido}
                                <br />
                                <small>({user.jefe_username})</small>
                              </span>
                            ) : (
                              <span className="no-jefe">Sin jefe asignado</span>
                            )}
                          </div>
                        </div>
                      )}
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
                      disabled={currentPage === 1 || loading}
                      title="Página anterior"
                    >
                      ◀
                    </button>
                    
                    <div className="pagination-info">
                      {loading ? (
                        <span>⏳ Cargando...</span>
                      ) : (
                        `Página ${currentPage} de ${totalPages}`
                      )}
                    </div>
                    
                    <button 
                      className="pagination-button"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages || loading}
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

                {/* Dropdown de jefes - solo visible si el rol es 'user' */}
                {formData.role === 'user' && (
                  <div className="form-group">
                    <label htmlFor="jefe_id">Jefe Responsable (opcional):</label>
                    <select
                      id="jefe_id"
                      name="jefe_id"
                      value={selectedJefe || ''}
                      onChange={handleJefeChange}
                      className="form-select"
                    >
                      <option value="">Seleccionar jefe...</option>
                      {jefesList.map(jefe => (
                        <option key={jefe.id} value={jefe.id}>
                          {jefe.nombre} {jefe.apellido} ({jefe.username})
                        </option>
                      ))}
                    </select>
                    {jefesList.length === 0 && (
                      <div className="form-help-text">
                        ℹ️ No hay jefes disponibles. El usuario puede ser creado sin jefe asignado.
                      </div>
                    )}
                  </div>
                )}

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
