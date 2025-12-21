// Register page controller
import { FormHelper, DOMHelper } from '../utils/utils.js';

export default class RegisterPage {
  constructor() {
    this.form = null;
    this.isLoading = false;
  }

  async init() {
    console.log('Initializing register page…');

    this.form = DOMHelper.find('#register-form');
    if (!this.form) {
      console.error('Register form not found in template.');
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
      this.handleRegister();
    });

    const inputs = this.form.querySelectorAll('input');
    inputs.forEach((input) => {
      DOMHelper.on(input, 'input', () => {
        FormHelper.clearFieldError(input);
        if (input.id === 'confirmPassword') {
          this.validatePasswordConfirm();
        }
      });
    });

    const passwordInput = DOMHelper.find('#password');
    if (passwordInput) {
      DOMHelper.on(passwordInput, 'input', () => {
        this.checkPasswordStrength();
      });
    }

    DOMHelper.on(document, 'keydown', (event) => {
      if (event.key === 'Enter' && !this.isLoading) {
        this.handleRegister();
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
        } else if (value.length > 30) {
          FormHelper.showFieldError(usernameInput, '用户名不能超过 30 个字符');
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

    const confirmPasswordInput = DOMHelper.find('#confirmPassword');
    if (confirmPasswordInput) {
      DOMHelper.on(confirmPasswordInput, 'blur', () => {
        this.validatePasswordConfirm();
      });
    }
  }

  validatePasswordConfirm() {
    const passwordInput = DOMHelper.find('#password');
    const confirmPasswordInput = DOMHelper.find('#confirmPassword');

    if (!passwordInput || !confirmPasswordInput) {
      return false;
    }

    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (!confirmPassword) {
      FormHelper.showFieldError(confirmPasswordInput, '请确认密码');
      return false;
    }

    if (password !== confirmPassword) {
      FormHelper.showFieldError(confirmPasswordInput, '两次输入的密码不一致');
      return false;
    }

    FormHelper.clearFieldError(confirmPasswordInput);
    return true;
  }

  checkPasswordStrength() {
    const passwordInput = DOMHelper.find('#password');
    if (!passwordInput) return;

    const hint = DOMHelper.find('#password-strength');
    if (!hint) return;

    const value = passwordInput.value.trim();
    const rules = FormHelper.validatePassword(value);

    hint.innerHTML = `
      <div class="text-sm text-gray-600">
        <div>密码要求：</div>
        <ul class="list-disc pl-6 space-y-1 mt-1">
          <li class="${rules.length ? 'text-green-600' : 'text-gray-500'}">至少 6 个字符</li>
          <li class="${rules.hasUpperCase ? 'text-green-600' : 'text-gray-500'}">包含大写字母</li>
          <li class="${rules.hasLowerCase ? 'text-green-600' : 'text-gray-500'}">包含小写字母</li>
          <li class="${rules.hasNumbers ? 'text-green-600' : 'text-gray-500'}">包含数字</li>
        </ul>
      </div>
    `;
  }

  async handleRegister() {
    if (this.isLoading || !this.form) return;

    FormHelper.clearFormErrors(this.form);

    const formData = FormHelper.getFormData(this.form);
    const { username = '', password = '', confirmPassword = '' } = formData;

    const validation = this.validateForm(username, password, confirmPassword);
    if (!validation.isValid) {
      Object.entries(validation.errors).forEach(([key, message]) => {
        const field = DOMHelper.find(`#${key}`);
        if (field) {
          FormHelper.showFieldError(field, message);
        }
      });
      return;
    }

    try {
      this.setLoading(true);

      await window.auth.register({
        username: username.trim(),
        password: password.trim()
      });
      // auth manager handles success redirect
    } catch (error) {
      console.error('Registration failed:', error);

      let message = '注册失败，请稍后重试';
      const errorText = error?.message || '';
      if (errorText.includes('用户名已存在')) {
        message = '用户名已存在，请使用其他用户名';
      } else if (errorText.toLowerCase().includes('network')) {
        message = '网络异常，请检查您的网络连接';
      }

      window.toast.error(message);
    } finally {
      this.setLoading(false);
    }
  }

  validateForm(username, password, confirmPassword) {
    const errors = {};
    let isValid = true;

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedUsername) {
      errors.username = '请输入用户名';
      isValid = false;
    } else if (trimmedUsername.length < 3) {
      errors.username = '用户名至少需要 3 个字符';
      isValid = false;
    } else if (trimmedUsername.length > 30) {
      errors.username = '用户名不能超过 30 个字符';
      isValid = false;
    }

    if (!trimmedPassword) {
      errors.password = '请输入密码';
      isValid = false;
    } else if (trimmedPassword.length < 6) {
      errors.password = '密码至少需要 6 个字符';
      isValid = false;
    }

    if (!trimmedConfirm) {
      errors.confirmPassword = '请确认密码';
      isValid = false;
    } else if (trimmedPassword !== trimmedConfirm) {
      errors.confirmPassword = '两次输入的密码不一致';
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
          注册中...
        </div>
      `;
    } else {
      submitButton.disabled = false;
      submitButton.innerHTML = `
        <span class="absolute left-0 inset-y-0 flex items-center pl-3">
          <i class="material-icons text-gray-300 group-hover:text-gray-400" style="font-size: 20px;">person_add</i>
        </span>
        注册
      `;
    }
  }

  destroy() {
    console.log('Disposing register page');
    this.form = null;
    this.isLoading = false;
  }
}
