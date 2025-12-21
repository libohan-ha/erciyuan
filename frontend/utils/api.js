// API client wrapper
class ApiClient {
  constructor() {
    const configuredBaseURL = window.__API_BASE_URL__;
    const origin = window.location?.origin || '';
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    const fallbackBaseURL = normalizedOrigin ? `${normalizedOrigin}/api` : '/api';
    const chosenBaseURL = configuredBaseURL || fallbackBaseURL;
    this.baseURL = chosenBaseURL.endsWith('/') ? chosenBaseURL.slice(0, -1) : chosenBaseURL;
  }

  getAuthToken() {
    return localStorage.getItem('authToken');
  }

  setAuthToken(token) {
    if (token) {
      localStorage.setItem('authToken', token);
    }
  }

  removeAuthToken() {
    localStorage.removeItem('authToken');
  }

  buildQuery(params = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item === undefined || item === null || item === '') {
            return;
          }
          searchParams.append(key, String(item));
        });
        return;
      }

      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getAuthToken();

    const { headers: optionHeaders = {}, ...restOptions } = options;

    const headers = {
      'Content-Type': 'application/json',
      ...optionHeaders
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const config = {
      method: restOptions.method || 'GET',
      ...restOptions,
      headers
    };

    if (config.body && typeof config.body === 'object' && config.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    let response;
    let data;

    try {
      this.showLoading();
      response = await fetch(url, config);

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = text ? { message: text } : null;
      }

      if (!response.ok) {
        const errorMessage = data?.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.hideLoading();
    }
  }

  async get(endpoint, params = {}) {
    const query = this.buildQuery(params);
    return this.request(`${endpoint}${query}`);
  }

  async post(endpoint, data = {}, config = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
      ...config
    });
  }

  async put(endpoint, data = {}, config = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
      ...config
    });
  }

  async delete(endpoint, config = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...config
    });
  }

  async upload(endpoint, formData, config = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {},
      ...config
    });
  }

  showLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.classList.remove('hidden');
    }
  }

  hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.classList.add('hidden');
    }
  }

  handleError(error) {
    console.error('API error:', error);

    let message = 'Operation failed, please try again.';

    if (error?.message) {
      message = error.message;
    }

    const lowerMessage = error.message?.toLowerCase() || '';

    if (lowerMessage.includes('401') || lowerMessage.includes('auth')) {
      message = 'Authentication required, please sign in again.';
      setTimeout(() => {
        window.location.hash = '/login';
      }, 1500);
    } else if (lowerMessage.includes('403')) {
      message = 'Permission denied.';
    } else if (lowerMessage.includes('404')) {
      message = 'Resource not found.';
    } else if (lowerMessage.includes('409')) {
      message = 'Conflict detected, please adjust and retry.';
    } else if (lowerMessage.includes('500')) {
      message = 'Server error, please try later.';
    }

    window.toast?.error(message);
  }

  auth = {
    register: (userData) => this.post('/auth/register', userData),
    login: (credentials) => this.post('/auth/login', credentials),
    verify: () => this.get('/auth/verify'),
    logout: () => this.post('/auth/logout')
  };

  users = {
    getCurrentUser: () => this.get('/users/me'),
    updateProfile: (userData) => this.put('/users/me', userData),
    uploadAvatar: (formData) => this.upload('/users/me/avatar', formData),
    deleteAvatar: () => this.delete('/users/me/avatar')
  };

  images = {
    getList: (params = {}) => this.get('/images', params),
    getDetail: (id) => this.get(`/images/${id}`),
    upload: (formData) => this.upload('/images', formData),
    update: (id, imageData) => this.put(`/images/${id}`, imageData),
    delete: (id) => this.delete(`/images/${id}`),
    getAllTags: () => this.get('/images/tags/all'),
    move: ({ imageIds, targetAlbumId = null }) => this.post('/images/bulk/move', { imageIds, targetAlbumId })
  };

  albums = {
    getList: (params = {}) => this.get('/albums', params),
    getDetail: (id) => this.get(`/albums/${id}`),
    create: (albumData) => this.post('/albums', albumData),
    update: (id, albumData) => this.put(`/albums/${id}`, albumData),
    delete: (id) => this.delete(`/albums/${id}`),
    getImages: (id, params = {}) => this.get(`/albums/${id}/images`, params),
    setCover: (id, imageId = null) => this.post(`/albums/${id}/cover`, { imageId })
  };
}

window.api = new ApiClient();
export default window.api;
