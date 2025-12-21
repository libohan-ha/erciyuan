import { DOMHelper, FormHelper } from '../utils/utils.js';

export default class UploadPage {
  constructor() {
    this.dom = {};
    this.selectedFile = null;
    this.tags = [];
  }

  async init() {
    this.cacheDom();
    this.bindEvents();
    await this.loadAlbums();
  }

  cacheDom() {
    this.dom.form = DOMHelper.find('#upload-form');
    this.dom.dropZone = DOMHelper.find('#drop-zone');
    this.dom.fileInput = DOMHelper.find('#file-input');
    this.dom.previewContainer = DOMHelper.find('#preview-container');
    this.dom.previewImage = DOMHelper.find('#preview-image');
    this.dom.removeImage = DOMHelper.find('#remove-image');
    this.dom.title = DOMHelper.find('#title');
    this.dom.description = DOMHelper.find('#description');
    this.dom.album = DOMHelper.find('#album');
    this.dom.tagsInput = DOMHelper.find('#tags-input');
    this.dom.addTag = DOMHelper.find('#add-tag');
    this.dom.tagsContainer = DOMHelper.find('#tags-container');
    this.dom.progressPanel = DOMHelper.find('#upload-progress');
    this.dom.progressBar = DOMHelper.find('#progress-bar');
    this.dom.progressText = DOMHelper.find('#progress-text');
    this.dom.progressStatus = DOMHelper.find('#upload-status');
  }

  bindEvents() {
    if (this.dom.dropZone) {
      DOMHelper.on(this.dom.dropZone, 'click', () => this.dom.fileInput?.click());
      DOMHelper.on(this.dom.dropZone, 'dragover', (event) => {
        event.preventDefault();
        this.dom.dropZone.classList.add('border-primary');
      });
      DOMHelper.on(this.dom.dropZone, 'dragleave', () => {
        this.dom.dropZone.classList.remove('border-primary');
      });
      DOMHelper.on(this.dom.dropZone, 'drop', (event) => {
        event.preventDefault();
        this.dom.dropZone.classList.remove('border-primary');
        const file = event.dataTransfer?.files?.[0];
        if (file) {
          this.setFile(file);
        }
      });
    }

    if (this.dom.fileInput) {
      DOMHelper.on(this.dom.fileInput, 'change', (event) => {
        const file = event.target.files?.[0];
        if (file) {
          this.setFile(file);
        }
      });
    }

    if (this.dom.removeImage) {
      DOMHelper.on(this.dom.removeImage, 'click', () => {
        this.clearFile();
      });
    }

    if (this.dom.addTag) {
      DOMHelper.on(this.dom.addTag, 'click', () => this.addTag());
    }

    if (this.dom.tagsInput) {
      DOMHelper.on(this.dom.tagsInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.addTag();
        }
      });
    }

    if (this.dom.form) {
      DOMHelper.on(this.dom.form, 'submit', async (event) => {
        event.preventDefault();
        await this.handleSubmit();
      });
    }
  }

  async loadAlbums() {
    if (!this.dom.album) return;
    try {
      const response = await window.api.albums.getList({ page: 1, limit: 100 });
      if (!response?.success) {
        throw new Error();
      }
      const albums = response.data?.albums ?? [];
      albums.forEach((album) => {
        const option = DOMHelper.createElement('option');
        option.value = album.id || album._id;
        option.textContent = album.name || '未命名相册';
        this.dom.album.appendChild(option);
      });
    } catch (error) {
      console.warn('加载相册列表失败:', error);
    }
  }

  setFile(file) {
    this.selectedFile = file;
    if (this.dom.previewImage) {
      this.dom.previewImage.src = URL.createObjectURL(file);
      this.dom.previewImage.classList.remove('hidden');
    }
    if (this.dom.previewContainer) {
      this.dom.previewContainer.classList.remove('hidden');
    }
    if (this.dom.dropZone) {
      this.dom.dropZone.classList.add('border-primary');
    }
  }

  clearFile() {
    this.selectedFile = null;
    if (this.dom.fileInput) {
      this.dom.fileInput.value = '';
    }
    if (this.dom.previewImage) {
      this.dom.previewImage.src = '';
      this.dom.previewImage.classList.add('hidden');
    }
    if (this.dom.previewContainer) {
      this.dom.previewContainer.classList.add('hidden');
    }
    if (this.dom.dropZone) {
      this.dom.dropZone.classList.remove('border-primary');
    }
  }

  addTag() {
    if (!this.dom.tagsInput) return;
    const value = this.dom.tagsInput.value.trim();
    if (!value) return;

    if (this.tags.includes(value)) {
      window.toast.info('标签已存在');
      this.dom.tagsInput.value = '';
      return;
    }

    this.tags.push(value);
    this.dom.tagsInput.value = '';
    this.renderTags();
  }

  removeTag(tag) {
    this.tags = this.tags.filter((item) => item !== tag);
    this.renderTags();
  }

  renderTags() {
    if (!this.dom.tagsContainer) return;
    this.dom.tagsContainer.innerHTML = '';
    if (!this.tags.length) return;

    const fragment = document.createDocumentFragment();
    this.tags.forEach((tag) => {
      const pill = DOMHelper.createElement('span', 'inline-flex items-center px-3 py-1 bg-indigo-50 text-primary rounded-full text-sm');
      pill.textContent = tag;
      const remove = DOMHelper.createElement('button', 'material-icons text-sm text-primary ml-2');
      remove.type = 'button';
      remove.textContent = 'close';
      DOMHelper.on(remove, 'click', () => this.removeTag(tag));
      pill.appendChild(remove);
      fragment.appendChild(pill);
    });
    this.dom.tagsContainer.appendChild(fragment);
  }

  async handleSubmit() {
    if (!this.dom.form) return;
    FormHelper.clearFormErrors(this.dom.form);

    if (!this.selectedFile) {
      window.toast.warning('请选择要上传的图片');
      return;
    }

    const title = this.dom.title?.value.trim();
    if (!title) {
      window.toast.warning('图片标题是必填项');
      return;
    }

    const formData = new FormData();
    formData.append('image', this.selectedFile);
    formData.append('title', title);
    formData.append('description', this.dom.description?.value.trim() || '');
    formData.append('albumId', this.dom.album?.value || '');
    if (this.tags.length) {
      formData.append('tags', this.tags.join(','));
    }

    try {
      this.showProgress();
      const response = await window.api.images.upload(formData);
      if (!response?.success) {
        throw new Error(response?.message || '上传失败');
      }

      window.toast.success('图片上传成功');
      this.resetForm();
      window.router.navigate('/');
    } catch (error) {
      console.error('上传失败:', error);
      window.toast.error(error.message || '上传失败，请重试');
    } finally {
      this.hideProgress();
    }
  }

  showProgress() {
    if (this.dom.progressPanel) {
      this.dom.progressPanel.classList.remove('hidden');
    }
    if (this.dom.progressBar) {
      this.dom.progressBar.style.width = '100%';
    }
    if (this.dom.progressText) {
      this.dom.progressText.textContent = '100%';
    }
    if (this.dom.progressStatus) {
      this.dom.progressStatus.textContent = '正在上传...';
    }
  }

  hideProgress() {
    if (this.dom.progressPanel) {
      this.dom.progressPanel.classList.add('hidden');
    }
  }

  resetForm() {
    if (this.dom.form) {
      this.dom.form.reset();
    }
    this.clearFile();
    this.tags = [];
    this.renderTags();
  }
}
