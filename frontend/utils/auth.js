// 认证管理模块
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
  }

  // 初始化认证状态
  async init() {
    const token = localStorage.getItem('authToken');

    if (token) {
      try {
        // 验证Token有效性
        const response = await window.api.auth.verify();

        if (response.success) {
          this.currentUser = response.data.user;
          this.isAuthenticated = true;

          // 触发登录成功事件
          this.emit('login-success', this.currentUser);
        } else {
          // Token无效，清除本地存储
          this.logout();
        }
      } catch (error) {
        console.error('Token验证失败:', error);
        this.logout();
      }
    }

    return this.isAuthenticated;
  }

  // 用户登录
  async login(credentials) {
    try {
      const response = await window.api.auth.login(credentials);

      if (response.success) {
        const { user, token } = response.data;

        // 保存认证信息
        localStorage.setItem('authToken', token);
        window.api.setAuthToken(token);

        this.currentUser = user;
        this.isAuthenticated = true;

        // 触发登录成功事件
        this.emit('login-success', user);

        return { success: true, user };
      } else {
        throw new Error(response.message || '登录失败');
      }
    } catch (error) {
      // 触发登录失败事件
      this.emit('login-error', error.message);
      throw error;
    }
  }

  // 用户注册
  async register(userData) {
    try {
      const response = await window.api.auth.register(userData);

      if (response.success) {
        const { user, token } = response.data;

        // 保存认证信息
        localStorage.setItem('authToken', token);
        window.api.setAuthToken(token);

        this.currentUser = user;
        this.isAuthenticated = true;

        // 触发注册成功事件
        this.emit('register-success', user);

        return { success: true, user };
      } else {
        throw new Error(response.message || '注册失败');
      }
    } catch (error) {
      // 触发注册失败事件
      this.emit('register-error', error.message);
      throw error;
    }
  }

  // 用户登出
  async logout() {
    try {
      // 调用后端登出接口
      await window.api.auth.logout();
    } catch (error) {
      console.error('后端登出失败:', error);
    } finally {
      // 清除本地认证信息
      localStorage.removeItem('authToken');
      window.api.removeAuthToken();

      this.currentUser = null;
      this.isAuthenticated = false;

      // 触发登出事件
      this.emit('logout');
    }
  }

  // 检查登录状态
  checkAuthStatus() {
    return this.isAuthenticated;
  }

  // 获取当前用户
  getCurrentUser() {
    return this.currentUser;
  }

  // 更新用户信息
  updateUser(userData) {
    this.currentUser = { ...this.currentUser, ...userData };
    this.emit('user-updated', this.currentUser);
  }

  // 检查是否需要登录
  requireAuth() {
    if (!this.isAuthenticated) {
      window.location.hash = '/login';
      return false;
    }
    return true;
  }

  // 事件系统
  on(event, callback) {
    if (!this.events) {
      this.events = {};
    }
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event, callback) {
    if (!this.events || !this.events[event]) {
      return;
    }
    const index = this.events[event].indexOf(callback);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.events || !this.events[event]) {
      return;
    }
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`事件 ${event} 的回调执行失败:`, error);
      }
    });
  }
}

// 创建全局认证管理器实例
window.auth = new AuthManager();

// 导出认证管理器
export default window.auth;