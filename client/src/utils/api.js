// Helper para centralizar las llamadas a la API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Función helper para hacer fetch con configuración estándar
export const apiFetch = async (path, options = {}) => {
  const url = `${API_URL}${path}`;
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  return fetch(url, { ...defaultOptions, ...options });
};

// Helper para GET requests
export const apiGet = (path, options = {}) => {
  return apiFetch(path, { method: 'GET', ...options });
};

// Helper para POST requests
export const apiPost = (path, data, options = {}) => {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options
  });
};

// Helper para PUT requests
export const apiPut = (path, data, options = {}) => {
  return apiFetch(path, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options
  });
};

// Helper para DELETE requests
export const apiDelete = (path, options = {}) => {
  return apiFetch(path, { method: 'DELETE', ...options });
};

export default { apiFetch, apiGet, apiPost, apiPut, apiDelete };
