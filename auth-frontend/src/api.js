// API Base URL - Your backend is running on port 3000
// Your React app should run on port 3001 (as per CLIENT_ORIGIN in your .env)
// Updated: Removed /api since your backend routes are directly at root level
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Enhanced API fetch function with better error handling and token management
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get token from localStorage
  const token = localStorage.getItem('authToken');
  
  // Default headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
  
  // Merge with provided headers
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // Handle token expiration
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      // You might want to redirect to login page here
      window.location.href = '/login';
      return;
    }
    
    return response;
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
};

// Specific API functions
export const authAPI = {
  login: async (credentials) => {
    return apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  
  register: async (userData) => {
    return apiFetch('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },
  
  verifyToken: async () => {
    return apiFetch('/verify-token', {
      method: 'GET',
    });
  },
  
  logout: async () => {
    return apiFetch('/logout', {
      method: 'POST',
    });
  },
  
  refreshToken: async () => {
    return apiFetch('/refresh-token', {
      method: 'POST',
    });
  },
};

// User-related API functions
export const userAPI = {
  getProfile: async () => {
    return apiFetch('/user/profile');
  },
  
  updateProfile: async (profileData) => {
    return apiFetch('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },
};

// Generic API error handler
export const handleAPIError = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response;
};