// 路由管理系统
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.beforeHooks = [];
    this.afterHooks = [];
  }

  // 定义路由
  route(path, handler, options = {}) {
    this.routes.set(path, {
      handler,
      meta: options.meta || {},
      requiresAuth: options.requiresAuth || false
    });
  }

  // 添加前置守卫
  beforeEach(hook) {
    this.beforeHooks.push(hook);
  }

  // 添加后置守卫
  afterEach(hook) {
    this.afterHooks.push(hook);
  }

  // 导航到指定路由
  async navigate(path, replace = false) {
    // 检查路由是否存在
    if (!this.routes.has(path)) {
      console.error(`路由 "${path}" 不存在`);
      return false;
    }

    const route = this.routes.get(path);

    // 执行前置守卫
    for (const hook of this.beforeHooks) {
      try {
        const result = await hook(path, route, this.currentRoute);
        if (result === false) {
          return false; // 阻止导航
        }
        if (typeof result === 'string') {
          return this.navigate(result); // 重定向到其他路由
        }
      } catch (error) {
        console.error('前置守卫执行失败:', error);
        return false;
      }
    }

    // 检查认证状态
    if (route.requiresAuth && !window.auth.checkAuthStatus()) {
      window.location.hash = '/login';
      return false;
    }

    try {
      // 更新URL
      if (replace) {
        window.history.replaceState(null, null, `#${path}`);
      } else {
        window.history.pushState(null, null, `#${path}`);
      }

      // 执行路由处理器
      await route.handler();

      // 更新当前路由
      const previousRoute = this.currentRoute;
      this.currentRoute = { path, ...route };

      // 更新导航栏状态
      this.updateNavigation(path);

      // 执行后置守卫
      for (const hook of this.afterHooks) {
        try {
          await hook(path, route, previousRoute);
        } catch (error) {
          console.error('后置守卫执行失败:', error);
        }
      }

      return true;
    } catch (error) {
      console.error(`路由 "${path}" 处理失败:`, error);
      return false;
    }
  }

  // 更新导航栏状态
  updateNavigation(currentPath) {
    // 更新导航链接的激活状态
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // 显示/隐藏导航栏
    const navbar = document.getElementById('navbar');
    if (navbar) {
      if (currentPath === '/login' || currentPath === '/register') {
        navbar.classList.add('hidden');
      } else {
        navbar.classList.remove('hidden');
      }
    }
  }

  // 启动路由监听
  start() {
    // 监听浏览器前进后退
    window.addEventListener('popstate', () => {
      const path = window.location.hash.slice(1) || '/';
      this.navigate(path, true);
    });

    // 监听hash变化
    window.addEventListener('hashchange', () => {
      const path = window.location.hash.slice(1) || '/';
      this.navigate(path, true);
    });

    // 处理初始路由
    const initialPath = window.location.hash.slice(1) || '/';
    this.navigate(initialPath, true);
  }

  // 重定向
  redirect(path) {
    return this.navigate(path);
  }

  // 返回上一页
  back() {
    window.history.back();
  }

  // 前进到下一页
  forward() {
    window.history.forward();
  }

  // 获取当前路由信息
  currentRoute() {
    return this.currentRoute;
  }
}

// 创建全局路由实例
window.router = new Router();

// 导出路由
export default window.router;