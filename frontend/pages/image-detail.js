import { DOMHelper } from '../utils/utils.js';

export default class ImageDetailPage {
  constructor() {
    this.imageId = sessionStorage.getItem('selected-image-id');
    this.image = null;
    this.albums = [];
    this.dom = {};
    this.editTags = [];
  }

  async init() {
    this.cacheDom();
    this.bindBaseEvents();

    if (!this.imageId) {
      window.toast.error('未找到图片信息');
      window.router.navigate('/');
      return;
    }

    await Promise.all([this.loadImageDetail(), this.loadAlbums()]);
  }

  cacheDom() {
    this.dom.container = DOMHelper.find('#image-detail-container');
    this.dom.loading = DOMHelper.find('#detail-loading');
    this.dom.content = DOMHelper.find('#image-detail-content');

    this.dom.image = DOMHelper.find('#detail-image');
    this.dom.title = DOMHelper.find('#detail-title');
    this.dom.date = DOMHelper.find('#detail-date');
    this.dom.filename = DOMHelper.find('#detail-filename');
    this.dom.description = DOMHelper.find('#detail-description');
    this.dom.tags = DOMHelper.find('#detail-tags');
    this.dom.albumName = DOMHelper.find('#album-name');

    this.dom.backBtn = DOMHelper.find('#back-btn');
    this.dom.editBtn = DOMHelper.find('#edit-image-btn');
    this.dom.deleteBtn = DOMHelper.find('#delete-image-btn');
    this.dom.downloadBtn = DOMHelper.find('#download-btn');
    this.dom.shareBtn = DOMHelper.find('#share-btn');

    this.dom.editModal = DOMHelper.find('#edit-image-modal');
    this.dom.editForm = DOMHelper.find('#edit-image-form');
    this.dom.editTitle = DOMHelper.find('#edit-title');
    this.dom.editDescription = DOMHelper.find('#edit-description');
    this.dom.editTagsInput = DOMHelper.find('#edit-tags-input');
    this.dom.editTagsContainer = DOMHelper.find('#edit-tags-container');
    this.dom.editAddTag = DOMHelper.find('#edit-add-tag');
    this.dom.editAlbumSelect = DOMHelper.find('#edit-album');
    this.dom.editCancel = DOMHelper.find('#cancel-edit');

    this.dom.deleteModal = DOMHelper.find('#delete-confirm-modal');
    this.dom.deleteCancel = DOMHelper.find('#cancel-delete');
    this.dom.deleteConfirm = DOMHelper.find('#confirm-delete');

    // Lightbox elements
    this.dom.lightbox = DOMHelper.find('#image-lightbox');
    this.dom.lightboxImage = DOMHelper.find('#lightbox-image');
    this.dom.lightboxClose = DOMHelper.find('#lightbox-close');
  }

  bindBaseEvents() {
    if (this.dom.backBtn) {
      DOMHelper.on(this.dom.backBtn, 'click', () => window.router.back());
    }

    if (this.dom.editBtn) {
      DOMHelper.on(this.dom.editBtn, 'click', () => this.openEditModal());
    }

    if (this.dom.deleteBtn) {
      DOMHelper.on(this.dom.deleteBtn, 'click', () => this.openDeleteModal());
    }

    if (this.dom.downloadBtn) {
      DOMHelper.on(this.dom.downloadBtn, 'click', () => this.downloadImage());
    }

    if (this.dom.shareBtn) {
      DOMHelper.on(this.dom.shareBtn, 'click', () => this.shareImage());
    }

    if (this.dom.editAddTag) {
      DOMHelper.on(this.dom.editAddTag, 'click', () => this.addEditTag());
    }

    if (this.dom.editTagsInput) {
      DOMHelper.on(this.dom.editTagsInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.addEditTag();
        }
      });
    }

    if (this.dom.editForm) {
      DOMHelper.on(this.dom.editForm, 'submit', (event) => {
        event.preventDefault();
        this.submitEditForm();
      });
    }

    if (this.dom.editCancel) {
      DOMHelper.on(this.dom.editCancel, 'click', () => this.closeEditModal());
    }

    if (this.dom.deleteCancel) {
      DOMHelper.on(this.dom.deleteCancel, 'click', () => this.closeDeleteModal());
    }

    if (this.dom.deleteConfirm) {
      DOMHelper.on(this.dom.deleteConfirm, 'click', () => this.deleteImage());
    }

    // Lightbox events
    if (this.dom.image) {
      DOMHelper.on(this.dom.image, 'click', () => this.openLightbox());
    }

    if (this.dom.lightbox) {
      DOMHelper.on(this.dom.lightbox, 'click', (e) => {
        if (e.target === this.dom.lightbox || e.target === this.dom.lightboxClose || e.target.closest('#lightbox-close')) {
          this.closeLightbox();
        }
      });
    }

    // ESC key to close lightbox
    this.escHandler = (e) => {
      if (e.key === 'Escape' && this.dom.lightbox && !this.dom.lightbox.classList.contains('hidden')) {
        this.closeLightbox();
      }
    };
    document.addEventListener('keydown', this.escHandler);
  }

  async loadImageDetail() {
    try {
      const response = await window.api.images.getDetail(this.imageId);
      if (!response?.success) {
        throw new Error(response?.message || '加载图片详情失败');
      }

      this.image = response.data?.image;
      this.renderImageDetail();
    } catch (error) {
      console.error('Failed to fetch image detail:', error);
      window.toast.error(error.message || '加载图片详情失败');
      this.showErrorState();
    }
  }

  async loadAlbums() {
    try {
      const response = await window.api.albums.getList({ page: 1, limit: 100 });
      if (response?.success) {
        this.albums = response.data?.albums ?? [];
        this.populateAlbumSelect();
      }
    } catch (error) {
      console.warn('Failed to load album list:', error);
    }
  }

  renderImageDetail() {
    if (!this.image || !this.dom.content) return;

    this.dom.loading?.classList.add('hidden');
    this.dom.content.classList.remove('hidden');

    const { title, description, tags, url, createdAt, originalName, albumId } = this.image;

    if (this.dom.image) {
      this.dom.image.src = url;
      this.dom.image.alt = title || '图片';
    }

    if (this.dom.title) {
      this.dom.title.textContent = title || '未命名图片';
    }

    if (this.dom.date) {
      this.dom.date.textContent = createdAt ? new Date(createdAt).toLocaleString() : '';
    }

    if (this.dom.filename) {
      this.dom.filename.textContent = originalName || '';
    }

    if (this.dom.description) {
      this.dom.description.textContent = description || '暂无描述';
    }

    if (this.dom.tags) {
      this.dom.tags.innerHTML = '';
      if (Array.isArray(tags) && tags.length) {
        tags.forEach((tag) => {
          const chip = DOMHelper.createElement('span', 'px-2 py-1 text-xs bg-indigo-50 text-primary rounded-full');
          chip.textContent = tag;
          this.dom.tags.appendChild(chip);
        });
      } else {
        this.dom.tags.textContent = '暂无标签';
      }
    }

    if (this.dom.albumName) {
      // 后端返回 album 对象，兼容旧的 albumId.name 格式
      const albumName = this.image.album?.name || albumId?.name;
      if (albumName) {
        this.dom.albumName.textContent = albumName;
      } else {
        this.dom.albumName.textContent = '未分类';
      }
    }

    this.prefillEditForm();
  }

  populateAlbumSelect() {
    if (!this.dom.editAlbumSelect) return;

    // 兼容 PostgreSQL (album.id) 和 MongoDB (albumId._id / albumId)
    const currentValue = this.image?.album?.id || this.image?.albumId?._id || this.image?.albumId || '';
    this.dom.editAlbumSelect.innerHTML = '<option value="">未分类</option>';

    this.albums.forEach((album) => {
      const option = DOMHelper.createElement('option');
      option.value = album.id || album._id;
      option.textContent = album.name || '未命名相册';
      if (option.value === currentValue) {
        option.selected = true;
      }
      this.dom.editAlbumSelect.appendChild(option);
    });
  }

  prefillEditForm() {
    if (!this.image) return;

    const { title, description, tags, album, albumId } = this.image;

    if (this.dom.editTitle) {
      this.dom.editTitle.value = title || '';
    }

    if (this.dom.editDescription) {
      this.dom.editDescription.value = description || '';
    }

    this.editTags = Array.isArray(tags) ? [...tags] : [];
    this.renderEditTags();

    if (this.dom.editAlbumSelect) {
      // 兼容 PostgreSQL (album.id) 和 MongoDB (albumId._id / albumId)
      const value = album?.id || albumId?._id || albumId || '';
      this.dom.editAlbumSelect.value = value;
    }
  }

  renderEditTags() {
    if (!this.dom.editTagsContainer) return;
    this.dom.editTagsContainer.innerHTML = '';

    if (!this.editTags.length) {
      this.dom.editTagsContainer.innerHTML = '<span class="text-xs text-gray-500">暂无标签</span>';
      return;
    }

    const fragment = document.createDocumentFragment();
    this.editTags.forEach((tag) => {
      const pill = DOMHelper.createElement('span', 'inline-flex items-center bg-indigo-50 text-primary px-3 py-1 rounded-full text-sm');
      pill.textContent = tag;
      const remove = DOMHelper.createElement('button', 'material-icons text-sm text-primary ml-2');
      remove.type = 'button';
      remove.textContent = 'close';
      DOMHelper.on(remove, 'click', () => {
        this.editTags = this.editTags.filter((item) => item !== tag);
        this.renderEditTags();
      });
      pill.appendChild(remove);
      fragment.appendChild(pill);
    });

    this.dom.editTagsContainer.appendChild(fragment);
  }

  addEditTag() {
    if (!this.dom.editTagsInput) return;
    const value = this.dom.editTagsInput.value.trim();
    if (!value) return;

    if (this.editTags.includes(value)) {
      window.toast.info('标签已存在');
      this.dom.editTagsInput.value = '';
      return;
    }

    this.editTags.push(value);
    this.dom.editTagsInput.value = '';
    this.renderEditTags();
  }

  openEditModal() {
    if (this.dom.editModal) {
      this.dom.editModal.classList.remove('hidden');
      this.prefillEditForm();
    }
  }

  closeEditModal() {
    if (this.dom.editModal) {
      this.dom.editModal.classList.add('hidden');
    }
  }

  async submitEditForm() {
    if (!this.dom.editForm || !this.image) return;

    const payload = {
      title: this.dom.editTitle?.value.trim(),
      description: this.dom.editDescription?.value.trim(),
      tags: this.editTags,
      albumId: this.dom.editAlbumSelect?.value || null
    };

    if (!payload.title) {
      window.toast.warning('图片标题不能为空');
      return;
    }

    try {
      const response = await window.api.images.update(this.imageId, payload);
      if (!response?.success) {
        throw new Error(response?.message || '更新失败');
      }

      this.image = response.data?.image || this.image;
      window.toast.success('图片信息已更新');
      this.renderImageDetail();
      this.closeEditModal();
    } catch (error) {
      console.error('Failed to update image:', error);
      window.toast.error(error.message || '更新失败，请重试');
    }
  }

  openDeleteModal() {
    if (this.dom.deleteModal) {
      this.dom.deleteModal.classList.remove('hidden');
    }
  }

  closeDeleteModal() {
    if (this.dom.deleteModal) {
      this.dom.deleteModal.classList.add('hidden');
    }
  }

  async deleteImage() {
    try {
      await window.api.images.delete(this.imageId);
      window.toast.success('图片已删除');
      this.closeDeleteModal();
      window.router.navigate('/');
    } catch (error) {
      console.error('Failed to delete image:', error);
      window.toast.error(error.message || '删除失败，请重试');
    }
  }

  downloadImage() {
    if (!this.image?.url) return;
    const link = document.createElement('a');
    link.href = this.image.url;
    link.download = this.image.originalName || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  shareImage() {
    if (!this.image?.url) return;
    const absoluteUrl = new URL(this.image.url, window.location.origin).href;
    navigator.clipboard?.writeText(absoluteUrl)
      .then(() => window.toast.success('图片链接已复制到剪贴板'))
      .catch(() => window.toast.info(`图片链接：${absoluteUrl}`));
  }

  showErrorState() {
    if (this.dom.loading) {
      this.dom.loading.innerHTML = '<span class="text-red-500">加载失败，请返回重试。</span>';
    }
  }

  openLightbox() {
    if (!this.image?.url || !this.dom.lightbox || !this.dom.lightboxImage) return;
    this.dom.lightboxImage.src = this.image.url;
    this.dom.lightboxImage.alt = this.image.title || '';
    this.dom.lightbox.classList.remove('hidden');
    this.dom.lightbox.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    if (!this.dom.lightbox) return;
    this.dom.lightbox.classList.add('hidden');
    this.dom.lightbox.classList.remove('flex');
    document.body.style.overflow = '';
  }
}
