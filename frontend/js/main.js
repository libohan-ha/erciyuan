import '../utils/api.js';
import '../utils/auth.js';
import '../utils/router.js';
import '../utils/utils.js';

class App {
  constructor() {
    this.currentPage = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      console.log('App booting...');
      this.showLoading();

      await window.auth.init();
      this.setupRouteGuards();
      this.setupAuthEvents();
      this.setupGlobalEvents();
      this.setupNavbarEvents();

      this.defineRoutes();
      window.router.start();

      this.isInitialized = true;
      console.log('App booted successfully');
      this.hideLoading();
    } catch (error) {
      console.error('App failed to start:', error);
      this.showError('Application failed to start. Please refresh and try again.');
    }
  }

  setupRouteGuards() {
    window.router.beforeEach(async (path, route, previousRoute) => {
      console.log('Routing:', previousRoute?.path || 'start', '->', path);

      if (route.requiresAuth && !window.auth.checkAuthStatus()) {
        window.toast.warning('Please sign in first');
        return '/login';
      }

      if ((path === '/login' || path === '/register') && window.auth.checkAuthStatus()) {
        return '/';
      }

      return true;
    });

    window.router.afterEach((path) => {
      const titles = {
        '/': 'Gallery - Anime Collection',
        '/login': 'Sign In - Anime Collection',
        '/register': 'Register - Anime Collection',
        '/upload': 'Upload Image - Anime Collection',
        '/profile': 'Profile - Anime Collection',
        '/image-detail': 'Image Detail - Anime Collection'
      };

      document.title = titles[path] || 'Anime Collection Portal';
    });
  }

  setupAuthEvents() {
    window.auth.on('login-success', (user) => {
      console.log('User logged in:', user.username);
      window.toast.success(`Welcome back, ${user.username}!`);
      window.router.navigate('/');
    });

    window.auth.on('login-error', (message) => {
      console.error('Login failed:', message);
      window.toast.error(message || 'Login failed. Please try again.');
    });

    window.auth.on('register-success', (user) => {
      console.log('User registered:', user.username);
      window.toast.success(`Registration successful, ${user.username}!`);
      window.router.navigate('/');
    });

    window.auth.on('register-error', (message) => {
      console.error('Registration failed:', message);
      window.toast.error(message || 'Registration failed. Please try again.');
    });

    window.auth.on('logout', () => {
      console.log('User signed out');
      window.toast.success('Signed out successfully');
      window.router.navigate('/login');
    });

    window.auth.on('user-updated', (user) => {
      console.log('User updated profile:', user.username);
      window.toast.success('Profile updated');
    });
  }

  setupGlobalEvents() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      window.toast.error('Unexpected error. Please refresh the page.');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      window.toast.error('Request failed. Please try again.');
    });

    window.addEventListener('online', () => {
      console.log('Network online');
      window.toast.success('Network reconnected');
    });

    window.addEventListener('offline', () => {
      console.log('Network offline');
      window.toast.warning('Network connection lost. Please check your connection.');
    });
  }

  setupNavbarEvents() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          await window.auth.logout();
        } catch (error) {
          console.error('Logout failed:', error);
          window.toast.error('Sign-out failed. Please try again.');
        }
      });
    }
  }

  defineRoutes() {
    window.router.route('/', async () => {
      await this.loadPage('gallery');
    }, { requiresAuth: true });

    window.router.route('/login', async () => {
      await this.loadPage('login');
    });

    window.router.route('/register', async () => {
      await this.loadPage('register');
    });

    window.router.route('/upload', async () => {
      await this.loadPage('upload');
    }, { requiresAuth: true });

    window.router.route('/profile', async () => {
      await this.loadPage('profile');
    }, { requiresAuth: true });

    window.router.route('/image-detail', async () => {
      await this.loadPage('image-detail');
    }, { requiresAuth: true });

    window.router.route('/404', async () => {
      this.show404Page();
    });
  }

  async loadPage(pageName) {
    try {
      console.log(`Loading page: ${pageName}`);

      if (this.currentPage && this.currentPage.destroy) {
        this.currentPage.destroy();
      }

      const mainContent = document.getElementById('main-content');
      mainContent.innerHTML = '';

      const pageHtml = await this.fetchPageTemplate(pageName);
      mainContent.innerHTML = pageHtml;

      const pageModule = await import(`../pages/${pageName}.js`);
      const PageClass = pageModule.default;

      this.currentPage = new PageClass();

      if (this.currentPage.init) {
        await this.currentPage.init();
      }

      mainContent.classList.add('fade-in');
    } catch (error) {
      console.error(`Failed to load page (${pageName}):`, error);

      if (error.message.includes('Failed to fetch')) {
        window.toast.error('Failed to load page resources. Please check your network.');
      } else {
        window.toast.error('Failed to load the page. Please try again.');
      }

      this.show404Page();
    }
  }

  async fetchPageTemplate(pageName) {
    const response = await fetch(`frontend/pages/${pageName}.html`);
    if (!response.ok) {
      throw new Error(`Failed to fetch page template: ${pageName}`);
    }
    return await response.text();
  }

  show404Page() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center">
          <div class="text-9xl font-bold text-gray-300">404</div>
          <h1 class="text-3xl font-bold text-gray-900 mt-4 mb-2">Page Not Found</h1>
          <p class="text-gray-600 mb-6">The page you are looking for does not exist or has been moved.</p>
          <button onclick="window.router.navigate('/')" class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">
            Back to Home
          </button>
        </div>
      </div>
    `;
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

  showError(message) {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center max-w-md mx-auto p-6">
          <div class="text-6xl text-red-500 mb-4">!</div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Application Failed to Start</h1>
          <p class="text-gray-600 mb-6">${message}</p>
          <button onclick="window.location.reload()" class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}

window.app = new App();

document.addEventListener('DOMContentLoaded', async () => {
  await window.app.init();
});

export default window.app;
