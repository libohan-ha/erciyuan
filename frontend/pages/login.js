// Login page controller
import { FormHelper, DOMHelper } from '../utils/utils.js';

export default class LoginPage {
  constructor() {
    this.form = null;
    this.isLoading = false;
  }

  async init() {
    console.log('Initializing login page…');

    this.form = DOMHelper.find('#login-form');
    if (!this.form) {
      console.error('Login form not found in template.');
      return;
    }

    this.bindEvents();
    this.setupValidation();

    const usernameInput = DOMHelper.find('#username');
    if (usernameInput) {
      usernameInput.focus();
    }
  }

  bindEvents() {
    if (!this.form) return;

    DOMHelper.on(this.form, 'submit', (event) => {
      event.preventDefault();
      this.handleLogin();
    });

    const inputs = this.form.querySelectorAll('input');
    inputs.forEach((input) => {
      DOMHelper.on(input, 'input', () => {
        FormHelper.clearFieldError(input);
      });
    });

    DOMHelper.on(document, 'keydown', (event) => {
      if (event.key === 'Enter' && !this.isLoading) {
        this.handleLogin();
      }
    });
  }

  setupValidation() {
    if (!this.form) return;

    const usernameInput = DOMHelper.find('#username');
    if (usernameInput) {
      DOMHelper.on(usernameInput, 'blur', () => {
        const value = usernameInput.value.trim();
        if (!value) {
          FormHelper.showFieldError(usernameInput, '请输入用户名');
        } else if (value.length < 3) {
          FormHelper.showFieldError(usernameInput, '用户名至少需要 3 个字符');
        }
      });
    }

    const passwordInput = DOMHelper.find('#password');
    if (passwordInput) {
      DOMHelper.on(passwordInput, 'blur', () => {
        const value = passwordInput.value.trim();
        if (!value) {
          FormHelper.showFieldError(passwordInput, '请输入密码');
        } else if (value.length < 6) {
          FormHelper.showFieldError(passwordInput, '密码至少需要 6 个字符');
        }
      });
    }
  }

  async handleLogin() {
    if (this.isLoading || !this.form) return;

    FormHelper.clearFormErrors(this.form);

    const formData = FormHelper.getFormData(this.form);
    const { username = '', password = '' } = formData;

    const validation = this.validateForm(username, password);
    if (!validation.isValid) {
      if (validation.errors.username) {
        FormHelper.showFieldError(DOMHelper.find('#username'), validation.errors.username);
      }
      if (validation.errors.password) {
        FormHelper.showFieldError(DOMHelper.find('#password'), validation.errors.password);
      }
      return;
    }

    try {
      this.setLoading(true);

      await window.auth.login({
        username: username.trim(),
        password: password.trim()
      });
      // success handling is managed by auth manager events
    } catch (error) {
      console.error('Login failed:', error);

      let message = '登录失败，请稍后重试';
      const errorText = error?.message || '';
      if (errorText.includes('用户名或密码错误')) {
        message = '用户名或密码错误';
      } else if (errorText.includes('用户不存在')) {
        message = '用户不存在，请先注册';
      } else if (errorText.toLowerCase().includes('network')) {
        message = '网络异常，请检查您的网络连接';
      }

      window.toast.error(message);

      const usernameInput = DOMHelper.find('#username');
      if (usernameInput) {
        usernameInput.focus();
      }
    } finally {
      this.setLoading(false);
    }
  }

  validateForm(username, password) {
    const errors = {};
    let isValid = true;

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername) {
      errors.username = '请输入用户名';
      isValid = false;
    } else if (trimmedUsername.length < 3) {
      errors.username = '用户名至少需要 3 个字符';
      isValid = false;
    }

    if (!trimmedPassword) {
      errors.password = '请输入密码';
      isValid = false;
    } else if (trimmedPassword.length < 6) {
      errors.password = '密码至少需要 6 个字符';
      isValid = false;
    }

    return { isValid, errors };
  }

  setLoading(loading) {
    this.isLoading = loading;

    const submitButton = DOMHelper.find('button[type="submit"]', this.form);
    if (!submitButton) return;

    if (loading) {
      submitButton.disabled = true;
      submitButton.innerHTML = `
        <div class="flex items-center">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          登录中...
        </div>
      `;
    } else {
      submitButton.disabled = false;
      submitButton.innerHTML = `
        <span class="absolute left-0 inset-y-0 flex items-center pl-3">
          <i class="material-icons text-gray-300 group-hover:text-gray-400" style="font-size: 20px;">lock</i>
        </span>
        登录
      `;
    }
  }

  destroy() {
    console.log('Disposing login page');

    if (this.form) {
      this.form = null;
    }
    this.isLoading = false;
  }
}
