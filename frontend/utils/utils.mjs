// 通用工具函数

// 消息提示管理
class ToastManager {
  constructor() {
    this.container = document.getElementById('toast');
    this.icon = document.getElementById('toast-icon');
    this.message = document.getElementById('toast-message');
    this.timeout = null;
  }

  show(message, type = 'info', duration = 3000) {
    if (!this.container || !this.icon || !this.message) {
      console.warn('Toast容器未找到');
      return;
    }

    // 清除之前的定时器
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // 设置消息和样式
    this.message.textContent = message;
    this.container.className = `fixed bottom-4 right-4 z-50 toast-${type}`;

    // 设置图标
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    this.icon.textContent = icons[type] || icons.info;
    this.icon.className = `material-icons mr-3 text-${type === 'error' ? 'red' : type === 'success' ? 'green' : type === 'warning' ? 'yellow' : 'blue'}-500`;

    // 显示提示
    this.container.classList.remove('hidden');
    this.container.classList.add('show');

    // 自动隐藏
    if (duration > 0) {
      this.timeout = setTimeout(() => {
        this.hide();
      }, duration);
    }
  }

  hide() {
    if (this.container) {
      this.container.classList.remove('show');
      setTimeout(() => {
        this.container.classList.add('hidden');
      }, 300);
    }
  }

  // 便捷方法
  success(message, duration) {
    this.show(message, 'success', duration);
  }

  error(message, duration) {
    this.show(message, 'error', duration);
  }

  warning(message, duration) {
    this.show(message, 'warning', duration);
  }

  info(message, duration) {
    this.show(message, 'info', duration);
  }
}

// 创建全局Toast实例
window.toast = new ToastManager();

// 模态框管理
class ModalManager {
  constructor() {
    this.modals = new Map();
    this.init();
  }

  init() {
    // 初始化所有模态框
    document.querySelectorAll('[id$="-modal"]').forEach(modal => {
      this.modals.set(modal.id, modal);
    });

    // 点击背景关闭模态框
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-bg')) {
        this.close(e.target.closest('.modal'));
      }
    });

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAll();
      }
    });
  }

  show(modalId) {
    const modal = this.modals.get(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('show');
      document.body.style.overflow = 'hidden'; // 防止背景滚动
      return modal;
    }
    return null;
  }

  hide(modalId) {
    const modal = this.modals.get(modalId);
    if (modal) {
      this.close(modal);
    }
  }

  close(modal) {
    if (modal) {
      modal.classList.remove('show');
      modal.classList.add('hidden');
      document.body.style.overflow = ''; // 恢复滚动
    }
  }

  closeAll() {
    this.modals.forEach(modal => {
      this.close(modal);
    });
  }
}

// 创建全局Modal实例
window.modal = new ModalManager();

// 文件处理工具
class FileHelper {
  // 格式化文件大小
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 获取文件扩展名
  static getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }

  // 检查文件类型
  static isImageFile(file) {
    return file.type.startsWith('image/');
  }

  // 预览图片
  static previewImage(file, callback) {
    if (!this.isImageFile(file)) {
      callback(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      callback(e.target.result);
    };
    reader.onerror = () => {
      callback(null);
    };
    reader.readAsDataURL(file);
  }

  // 下载文件
  static downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// 日期格式化工具
class DateHelper {
  // 格式化日期
  static formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  // 相对时间
  static timeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diff = now - past;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;

    return this.formatDate(date, 'YYYY-MM-DD');
  }
}

// 字符串工具
class StringHelper {
  // 截断文本
  static truncate(text, length, suffix = '...') {
    if (text.length <= length) return text;
    return text.substring(0, length) + suffix;
  }

  // 转义HTML
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // 生成随机ID
  static generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 防抖函数
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 节流函数
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

// DOM操作工具
class DOMHelper {
  // 创建元素
  static createElement(tag, className = '', content = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) element.textContent = content;
    return element;
  }

  // 查找元素
  static find(selector, parent = document) {
    return parent.querySelector(selector);
  }

  // 查找所有元素
  static findAll(selector, parent = document) {
    return parent.querySelectorAll(selector);
  }

  // 添加事件监听
  static on(element, event, handler) {
    if (typeof element === 'string') {
      element = this.find(element);
    }
    if (element) {
      element.addEventListener(event, handler);
    }
  }

  // 移除事件监听
  static off(element, event, handler) {
    if (typeof element === 'string') {
      element = this.find(element);
    }
    if (element) {
      element.removeEventListener(event, handler);
    }
  }

  // 显示元素
  static show(element) {
    if (typeof element === 'string') {
      element = this.find(element);
    }
    if (element) {
      element.classList.remove('hidden');
    }
  }

  // 隐藏元素
  static hide(element) {
    if (typeof element === 'string') {
      element = this.find(element);
    }
    if (element) {
      element.classList.add('hidden');
    }
  }

  // 切换元素显示状态
  static toggle(element) {
    if (typeof element === 'string') {
      element = this.find(element);
    }
    if (element) {
      element.classList.toggle('hidden');
    }
  }
}

// 表单验证工具
class FormHelper {
  // 验证邮箱
  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // 验证密码强度
  static validatePassword(password) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    return {
      isValid: password.length >= minLength,
      length: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers
    };
  }

  // 获取表单数据
  static getFormData(form) {
    const formData = new FormData(form);
    const data = {};
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }
    return data;
  }

  // 设置表单数据
  static setFormData(form, data) {
    Object.keys(data).forEach(key => {
      const field = form.elements[key];
      if (field) {
        field.value = data[key];
      }
    });
  }

  // 清空表单
  static clearForm(form) {
    form.reset();
  }

  // 显示表单错误
  static showFieldError(field, message) {
    field.classList.add('error');

    // 移除之前的错误信息
    const existingError = field.parentNode.querySelector('.form-error');
    if (existingError) {
      existingError.remove();
    }

    // 添加新的错误信息
    const errorElement = document.createElement('div');
    errorElement.className = 'form-error';
    errorElement.textContent = message;
    field.parentNode.appendChild(errorElement);
  }

  // 清除字段错误
  static clearFieldError(field) {
    field.classList.remove('error');
    const errorElement = field.parentNode.querySelector('.form-error');
    if (errorElement) {
      errorElement.remove();
    }
  }

  // 清除所有表单错误
  static clearFormErrors(form) {
    form.querySelectorAll('.error').forEach(field => {
      this.clearFieldError(field);
    });
  }
}

// 导出工具类
export {
  FileHelper,
  DateHelper,
  StringHelper,
  DOMHelper,
  FormHelper
};