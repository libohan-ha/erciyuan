import { DOMHelper } from '../utils/utils.mjs';

class ProfilePage {
  constructor() {
    this.user = null;
    this.albums = [];
    this.dom = {};

    this.albumEditorState = {
      mode: 'create',
      albumId: null,
      cover: { id: null, url: null, title: '' }
    };

    this.coverPickerState = {
      albumId: null,
      mode: 'list',
      images: [],
      selectedId: null
    };
  }

  async init() {
    this.cacheDom();
    this.bindTabs();
    this.bindForms();
    this.bindAlbumActions();

    await Promise.all([
      this.loadUserProfile(),
      this.loadStatistics()
    ]);

    await this.loadAlbums();
  }

  cacheDom() {
    this.dom.usernameDisplay = DOMHelper.find('#username-display');
    this.dom.userDate = DOMHelper.find('#user-date');
    this.dom.avatarImage = DOMHelper.find('#avatar-image');
    this.dom.avatarPlaceholder = DOMHelper.find('#avatar-placeholder');
    this.dom.avatarUpload = DOMHelper.find('#avatar-upload');

    this.dom.totalImages = DOMHelper.find('#total-images-count');
    this.dom.totalAlbums = DOMHelper.find('#total-albums-count');
    this.dom.totalTags = DOMHelper.find('#total-tags-count');

    this.dom.basicForm = DOMHelper.find('#basic-info-form');
    this.dom.usernameInput = DOMHelper.find('#username-input');

    this.dom.passwordForm = DOMHelper.find('#password-form');
    this.dom.currentPassword = DOMHelper.find('#current-password');
    this.dom.newPassword = DOMHelper.find('#new-password');
    this.dom.confirmPassword = DOMHelper.find('#confirm-password');

    this.dom.albumsList = DOMHelper.find('#albums-list');
    this.dom.createAlbumBtn = DOMHelper.find('#create-album-btn');

    this.dom.tabButtons = DOMHelper.findAll('.tab-btn');
    this.dom.tabContents = DOMHelper.findAll('.tab-content');

    this.dom.albumEditorModal = DOMHelper.find('#album-editor-modal');
    this.dom.albumEditorTitle = DOMHelper.find('#album-editor-title');
    this.dom.albumEditorForm = DOMHelper.find('#album-editor-form');
    this.dom.albumNameInput = DOMHelper.find('#album-name-input');
    this.dom.albumDescriptionInput = DOMHelper.find('#album-description-input');
    this.dom.albumEditorCancel = DOMHelper.find('#album-editor-cancel');
    this.dom.albumCoverPreview = DOMHelper.find('#album-cover-preview');
    this.dom.albumCoverImage = DOMHelper.find('#album-cover-image');
    this.dom.albumCoverPlaceholder = DOMHelper.find('#album-cover-placeholder');
    this.dom.albumEditorSetCover = DOMHelper.find('#album-editor-set-cover');
    this.dom.albumEditorClearCover = DOMHelper.find('#album-editor-clear-cover');

    this.dom.albumDeleteModal = DOMHelper.find('#album-delete-modal');
    this.dom.albumDeleteCancel = DOMHelper.find('#album-delete-cancel');
    this.dom.albumDeleteConfirm = DOMHelper.find('#album-delete-confirm');

    this.dom.albumCoverModal = DOMHelper.find('#album-cover-modal');
    this.dom.albumCoverList = DOMHelper.find('#album-cover-list');
    this.dom.albumCoverEmpty = DOMHelper.find('#album-cover-empty');
    this.dom.albumCoverCancel = DOMHelper.find('#album-cover-cancel');
    this.dom.albumCoverConfirm = DOMHelper.find('#album-cover-confirm');
  }

  bindTabs() {
    this.dom.tabButtons?.forEach((button) => {
      DOMHelper.on(button, 'click', () => {
        const tabId = button.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    if (!this.dom.tabButtons || !this.dom.tabContents) return;

    this.dom.tabButtons.forEach((button) => {
      const isActive = button.getAttribute('data-tab') === tabId;
      button.classList.toggle('active', isActive);
      button.classList.toggle('text-primary', isActive);
      button.classList.toggle('border-primary', isActive);
      button.classList.toggle('text-gray-500', !isActive);
    });

    this.dom.tabContents.forEach((content) => {
      content.classList.toggle('hidden', content.id !== `${tabId}-tab`);
    });
  }

  bindForms() {
    if (this.dom.basicForm) {
      DOMHelper.on(this.dom.basicForm, 'submit', async (event) => {
        event.preventDefault();
        await this.updateBasicInfo();
      });
    }

    if (this.dom.passwordForm) {
      DOMHelper.on(this.dom.passwordForm, 'submit', async (event) => {
        event.preventDefault();
        await this.updatePassword();
      });
    }

    if (this.dom.avatarUpload) {
      DOMHelper.on(this.dom.avatarUpload, 'change', (event) => {
        const file = event.target.files?.[0];
        if (file) this.updateAvatar(file);
      });
    }

    if (this.dom.albumEditorForm) {
      DOMHelper.on(this.dom.albumEditorForm, 'submit', async (event) => {
        event.preventDefault();
        await this.submitAlbumForm();
      });
    }

    DOMHelper.on(this.dom.albumEditorCancel, 'click', () => this.closeAlbumEditor());
    DOMHelper.on(this.dom.albumEditorSetCover, 'click', () => this.handleCoverPickerFromEditor());
    DOMHelper.on(this.dom.albumEditorClearCover, 'click', () => {
      this.albumEditorState.cover = { id: null, url: null, title: '' };
      this.renderAlbumEditorCover();
    });

    DOMHelper.on(this.dom.albumDeleteCancel, 'click', () => this.closeDeleteAlbumModal());
    DOMHelper.on(this.dom.albumDeleteConfirm, 'click', () => this.confirmDeleteAlbum());

    DOMHelper.on(this.dom.albumCoverCancel, 'click', () => this.closeCoverPicker());
    DOMHelper.on(this.dom.albumCoverConfirm, 'click', () => this.confirmCoverSelection());
  }

  bindAlbumActions() {
    DOMHelper.on(this.dom.createAlbumBtn, 'click', () => this.openCreateAlbumModal());

    DOMHelper.on(this.dom.albumsList, 'click', (event) => {
      const button = event.target.closest('[data-album-action]');
      if (!button) return;

      const albumId = button.getAttribute('data-album-id');
      const album = this.findAlbumById(albumId);
      if (!album) {
        window.toast.error('未找到相册');
        return;
      }

      switch (button.getAttribute('data-album-action')) {
        case 'view':
          this.viewAlbum(album);
          break;
        case 'edit':
          this.openEditAlbumModal(album);
          break;
        case 'delete':
          this.openDeleteAlbumModal(album);
          break;
        case 'set-cover':
          if (!album.imageCount) {
            window.toast.info('这个相册还没有图片');
            return;
          }
          this.openCoverPicker(album, 'list');
          break;
        default:
          break;
      }
    });
  }

  async loadUserProfile() {
    try {
      const response = await window.api.users.getCurrentUser();
      if (!response?.success) throw new Error(response?.message || '获取个人信息失败');
      this.user = response.data?.user ?? null;
      this.renderUserProfile();
    } catch (error) {
      console.error('Failed to load user profile:', error);
      window.toast.error('获取个人信息失败');
    }
  }

  renderUserProfile() {
    if (!this.user) return;
    const { username, avatarUrl, createdAt } = this.user;

    if (this.dom.usernameDisplay) this.dom.usernameDisplay.textContent = username || '未命名用户';
    if (this.dom.usernameInput) this.dom.usernameInput.value = username || '';

    if (this.dom.userDate && createdAt) {
      const date = new Date(createdAt);
      this.dom.userDate.textContent = `注册时间：${date.toLocaleDateString()}`;
    }

    if (avatarUrl) {
      this.dom.avatarImage?.classList.remove('hidden');
      if (this.dom.avatarImage) this.dom.avatarImage.src = avatarUrl;
      this.dom.avatarPlaceholder?.classList.add('hidden');
    } else {
      this.dom.avatarImage?.classList.add('hidden');
      this.dom.avatarPlaceholder?.classList.remove('hidden');
    }
  }

  async loadStatistics() {
    try {
      const [imagesResp, tagsResp, albumsResp] = await Promise.all([
        window.api.images.getList({ page: 1, limit: 1 }),
        window.api.images.getAllTags(),
        window.api.albums.getList({ page: 1, limit: 1 })
      ]);

      const totalImages = imagesResp?.data?.pagination?.total ?? 0;
      const totalTags = tagsResp?.data?.tags?.length ?? 0;
      const totalAlbums = albumsResp?.data?.pagination?.total ?? (albumsResp?.data?.albums?.length ?? 0);

      if (this.dom.totalImages) this.dom.totalImages.textContent = totalImages;
      if (this.dom.totalTags) this.dom.totalTags.textContent = totalTags;
      if (this.dom.totalAlbums) this.dom.totalAlbums.textContent = totalAlbums;
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  async loadAlbums() {
    if (!this.dom.albumsList) return;

    try {
      const response = await window.api.albums.getList({ page: 1, limit: 100, sortBy: 'updatedAt', sortOrder: 'desc' });
      if (!response?.success) throw new Error(response?.message || '获取相册失败');

      this.albums = response.data?.albums ?? [];
      this.renderAlbums();
    } catch (error) {
      console.error('Failed to load albums:', error);
      this.dom.albumsList.innerHTML = '<p class="text-sm text-red-500">获取相册失败，请稍后重试。</p>';
    }
  }

  transformAlbum(album) {
    if (!album) return null;

    const cover = album.coverImageId || {};
    return {
      id: album.id || album._id,
      name: album.name || '未命名相册',
      description: album.description || '',
      imageCount: album.imageCount ?? 0,
      createdAt: album.createdAt ? new Date(album.createdAt) : null,
      updatedAt: album.updatedAt ? new Date(album.updatedAt) : null,
      coverImageId: cover._id || cover.id || cover || null,
      coverUrl: cover.url || null,
      coverTitle: cover.title || ''
    };
  }

  renderAlbums() {
    if (!this.dom.albumsList) return;

    if (!this.albums.length) {
      this.dom.albumsList.innerHTML = '<p class="text-sm text-gray-500">暂时还没有相册，先创建一个吧～</p>';
      return;
    }

    const fragment = document.createDocumentFragment();

    this.albums.forEach((rawAlbum) => {
      const album = this.transformAlbum(rawAlbum);
      if (!album) return;

      const card = DOMHelper.createElement('article', 'bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow');
      const layout = DOMHelper.createElement('div', 'flex gap-4');

      const coverWrapper = DOMHelper.createElement('div', 'w-28 h-28 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100 flex items-center justify-center');
      if (album.coverUrl) {
        const img = DOMHelper.createElement('img', 'w-full h-full object-cover');
        img.src = album.coverUrl;
        img.alt = album.coverTitle || `${album.name} 封面`;
        img.loading = 'lazy';
        coverWrapper.appendChild(img);
      } else {
        const placeholder = DOMHelper.createElement('div', 'flex flex-col items-center justify-center text-xs text-gray-400 gap-1');
        placeholder.appendChild(DOMHelper.createElement('span', 'material-icons text-2xl text-gray-300', 'folder'));
        placeholder.appendChild(DOMHelper.createElement('span', '', '暂无封面'));
        coverWrapper.appendChild(placeholder);
      }

      const info = DOMHelper.createElement('div', 'flex-1 flex flex-col gap-3');
      const header = DOMHelper.createElement('div', 'flex items-start justify-between gap-2');
      const title = DOMHelper.createElement('h5', 'text-lg font-semibold text-gray-900', album.name);
      const badge = DOMHelper.createElement('span', 'inline-flex items-center px-2 py-1 text-xs rounded-full bg-indigo-50 text-primary', `${album.imageCount} 张`);
      header.appendChild(title);
      header.appendChild(badge);

      const desc = DOMHelper.createElement('p', 'text-sm text-gray-500', album.description || '暂无描述');
      const meta = DOMHelper.createElement('p', 'text-xs text-gray-400');
      const created = album.createdAt ? album.createdAt.toLocaleDateString() : '未知';
      const updated = album.updatedAt ? album.updatedAt.toLocaleString() : '未知';
      meta.textContent = `创建于 ${created} · 更新于 ${updated}`;

      const actions = DOMHelper.createElement('div', 'flex flex-wrap gap-2 pt-2 border-t border-gray-100 mt-auto');
      actions.appendChild(this.createAlbumActionButton('查看', 'view', album.id));
      actions.appendChild(this.createAlbumActionButton(album.coverUrl ? '更换封面' : '设置封面', 'set-cover', album.id, 'border-blue-200 text-blue-600 hover:bg-blue-50'));
      actions.appendChild(this.createAlbumActionButton('编辑', 'edit', album.id, 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'));
      actions.appendChild(this.createAlbumActionButton('删除', 'delete', album.id, 'border-red-200 text-red-600 hover:bg-red-50'));

      info.appendChild(header);
      info.appendChild(desc);
      info.appendChild(meta);
      info.appendChild(actions);

      layout.appendChild(coverWrapper);
      layout.appendChild(info);
      card.appendChild(layout);

      fragment.appendChild(card);
    });

    this.dom.albumsList.innerHTML = '';
    this.dom.albumsList.appendChild(fragment);
  }

  createAlbumActionButton(label, action, albumId, extraClass = 'border border-gray-300 hover:bg-gray-50') {
    const button = DOMHelper.createElement('button', `px-3 py-1 text-xs rounded-lg ${extraClass}`);
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('data-album-action', action);
    button.setAttribute('data-album-id', albumId);
    return button;
  }

  findAlbumById(id) {
    if (!id) return null;
    return this.albums.find((item) => (item.id || item._id) === id);
  }

  openCreateAlbumModal() {
    this.albumEditorState = {
      mode: 'create',
      albumId: null,
      cover: { id: null, url: null, title: '' }
    };
    this.prefillAlbumEditor();
    this.openAlbumEditor();
  }

  openEditAlbumModal(album) {
    const normalized = this.transformAlbum(album);
    this.albumEditorState = {
      mode: 'edit',
      albumId: normalized.id,
      cover: { id: normalized.coverImageId || null, url: normalized.coverUrl || null, title: normalized.coverTitle || '' }
    };
    this.prefillAlbumEditor(normalized);
    this.openAlbumEditor();
  }

  prefillAlbumEditor(album = null) {
    if (this.dom.albumEditorTitle) this.dom.albumEditorTitle.textContent = album ? '编辑相册' : '新建相册';
    if (this.dom.albumNameInput) this.dom.albumNameInput.value = album?.name || '';
    if (this.dom.albumDescriptionInput) this.dom.albumDescriptionInput.value = album?.description || '';
    if (this.dom.albumEditorSetCover) this.dom.albumEditorSetCover.disabled = !album;
    this.renderAlbumEditorCover();
  }

  renderAlbumEditorCover() {
    const { url, title } = this.albumEditorState.cover;
    if (!this.dom.albumCoverImage || !this.dom.albumCoverPlaceholder) return;

    if (url) {
      this.dom.albumCoverImage.src = url;
      this.dom.albumCoverImage.alt = title || '相册封面';
      this.dom.albumCoverImage.classList.remove('hidden');
      this.dom.albumCoverPlaceholder.classList.add('hidden');
    } else {
      this.dom.albumCoverImage.src = '';
      this.dom.albumCoverImage.alt = '';
      this.dom.albumCoverImage.classList.add('hidden');
      this.dom.albumCoverPlaceholder.classList.remove('hidden');
    }
  }

  openAlbumEditor() {
    this.dom.albumEditorModal?.classList.remove('hidden');
  }

  closeAlbumEditor() {
    this.dom.albumEditorModal?.classList.add('hidden');
  }

  openDeleteAlbumModal(album) {
    this.albumEditorState.albumId = album.id || album._id;
    this.dom.albumDeleteModal?.classList.remove('hidden');
  }

  closeDeleteAlbumModal() {
    this.dom.albumDeleteModal?.classList.add('hidden');
  }

  async submitAlbumForm() {
    const name = this.dom.albumNameInput?.value.trim();
    const description = this.dom.albumDescriptionInput?.value.trim() || '';
    if (!name) {
      window.toast.warning('相册名称不能为空');
      return;
    }

    try {
      let response;
      if (this.albumEditorState.mode === 'edit' && this.albumEditorState.albumId) {
        response = await window.api.albums.update(this.albumEditorState.albumId, {
          name,
          description,
          coverImageId: this.albumEditorState.cover.id ?? null
        });
      } else {
        response = await window.api.albums.create({ name, description });
      }

      if (!response?.success) throw new Error(response?.message || '保存失败');

      window.toast.success(this.albumEditorState.mode === 'edit' ? '相册已更新' : '相册创建成功');
      this.closeAlbumEditor();
      await this.loadAlbums();
      await this.loadStatistics();
    } catch (error) {
      console.error('Failed to save album:', error);
      window.toast.error(error.message || '保存失败');
    }
  }

  async confirmDeleteAlbum() {
    if (!this.albumEditorState.albumId) return;
    try {
      const response = await window.api.albums.delete(this.albumEditorState.albumId);
      if (!response?.success) throw new Error(response?.message || '删除失败');
      window.toast.success('相册已删除');
      this.closeDeleteAlbumModal();
      await this.loadAlbums();
      await this.loadStatistics();
    } catch (error) {
      console.error('Failed to delete album:', error);
      window.toast.error(error.message || '删除失败');
    }
  }

  viewAlbum(album) {
    if (!album) return;
    const albumId = album.id || album._id;
    sessionStorage.setItem('gallery-default-album', albumId);
    window.router.navigate('/');
  }

  handleCoverPickerFromEditor() {
    if (this.albumEditorState.mode === 'create') {
      window.toast.info('请先保存相册后再设置封面');
      return;
    }
    const album = this.findAlbumById(this.albumEditorState.albumId);
    if (!album || !album.imageCount) {
      window.toast.info('这个相册还没有图片');
      return;
    }
    this.openCoverPicker(album, 'editor');
  }

  openCoverPicker(album, mode = 'list') {
    this.coverPickerState = {
      albumId: album.id || album._id,
      mode,
      images: [],
      selectedId: album.coverImageId || album.cover?.id || null
    };
    this.loadCoverPickerImages();
    this.dom.albumCoverModal?.classList.remove('hidden');
  }

  closeCoverPicker() {
    this.dom.albumCoverModal?.classList.add('hidden');
    this.coverPickerState = { albumId: null, mode: 'list', images: [], selectedId: null };
  }

  async loadCoverPickerImages() {
    const albumId = this.coverPickerState.albumId;
    if (!albumId) return;

    try {
      if (this.dom.albumCoverList) {
        this.dom.albumCoverList.innerHTML = '<p class="text-sm text-gray-500">加载中…</p>';
      }

      const response = await window.api.albums.getImages(albumId, {
        page: 1,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      if (!response?.success) throw new Error(response?.message || '获取图片失败');

      this.coverPickerState.images = response.data?.images ?? [];
      this.renderCoverPickerImages();
    } catch (error) {
      console.error('Failed to load album images:', error);
      if (this.dom.albumCoverList) {
        this.dom.albumCoverList.innerHTML = '<p class="text-sm text-red-500">获取图片失败</p>';
      }
    }
  }

  renderCoverPickerImages() {
    const { images, selectedId } = this.coverPickerState;
    if (!this.dom.albumCoverList) return;

    if (!images.length) {
      this.dom.albumCoverEmpty?.classList.remove('hidden');
      this.dom.albumCoverList.innerHTML = '';
      return;
    }

    this.dom.albumCoverEmpty?.classList.add('hidden');

    const fragment = document.createDocumentFragment();
    images.forEach((image) => {
      const button = DOMHelper.createElement('button', 'relative overflow-hidden rounded-lg border border-gray-200 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary');
      button.type = 'button';
      button.dataset.imageId = image._id;

      const img = DOMHelper.createElement('img', 'w-full h-32 object-cover');
      img.src = image.url;
      img.alt = image.title || '图片';
      img.loading = 'lazy';
      button.appendChild(img);

      if (selectedId && selectedId === image._id) {
        button.classList.add('border-primary', 'ring-2', 'ring-primary');
      }

      DOMHelper.on(button, 'click', () => {
        this.coverPickerState.selectedId = image._id;
        this.renderCoverPickerImages();
      });

      fragment.appendChild(button);
    });

    this.dom.albumCoverList.innerHTML = '';
    this.dom.albumCoverList.appendChild(fragment);
  }

  async confirmCoverSelection() {
    const { albumId, mode, selectedId, images } = this.coverPickerState;
    if (!albumId) {
      this.closeCoverPicker();
      return;
    }

    if (!selectedId) {
      window.toast.warning('请先选择一张图片');
      return;
    }

    if (mode === 'editor') {
      const image = images.find((img) => img._id === selectedId);
      this.albumEditorState.cover = {
        id: selectedId,
        url: image?.url || null,
        title: image?.title || ''
      };
      this.renderAlbumEditorCover();
      this.closeCoverPicker();
      return;
    }

    try {
      const response = await window.api.albums.setCover(albumId, selectedId);
      if (!response?.success) throw new Error(response?.message || '设置封面失败');
      window.toast.success('封面已更新');
      this.closeCoverPicker();
      await this.loadAlbums();
    } catch (error) {
      console.error('Failed to set cover:', error);
      window.toast.error(error.message || '设置封面失败');
    }
  }

  async updateBasicInfo() {
    if (!this.dom.usernameInput || !this.user) return;
    const username = this.dom.usernameInput.value.trim();
    if (!username) {
      window.toast.warning('用户名不能为空');
      return;
    }

    try {
      const response = await window.api.users.updateProfile({ username });
      if (!response?.success) throw new Error(response?.message || '更新失败');
      this.user.username = username;
      this.renderUserProfile();
      window.toast.success('基本信息已更新');
    } catch (error) {
      console.error('Failed to update profile:', error);
      window.toast.error(error.message || '更新失败');
    }
  }

  async updatePassword() {
    if (!this.dom.passwordForm) return;
    const currentPassword = this.dom.currentPassword?.value || '';
    const newPassword = this.dom.newPassword?.value || '';
    const confirmPassword = this.dom.confirmPassword?.value || '';

    if (!currentPassword || !newPassword) {
      window.toast.warning('请填写完整的密码信息');
      return;
    }

    if (newPassword !== confirmPassword) {
      window.toast.warning('两次输入的新密码不一致');
      return;
    }

    try {
      const payload = {
        username: this.user?.username || this.dom.usernameInput?.value || '',
        currentPassword,
        newPassword
      };
      const response = await window.api.users.updateProfile(payload);
      if (!response?.success) throw new Error(response?.message || '修改密码失败');

      this.dom.passwordForm.reset();
      window.toast.success('密码修改成功');
    } catch (error) {
      console.error('Failed to update password:', error);
      window.toast.error(error.message || '修改密码失败');
    }
  }

  async updateAvatar(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await window.api.users.uploadAvatar(formData);
      if (!response?.success) throw new Error(response?.message || '头像上传失败');
      this.user.avatarUrl = response.data?.avatarUrl;
      this.renderUserProfile();
      window.toast.success('头像更新成功');
    } catch (error) {
      console.error('Failed to update avatar:', error);
      window.toast.error(error.message || '头像上传失败');
    } finally {
      if (this.dom.avatarUpload) this.dom.avatarUpload.value = '';
    }
  }
}

export default ProfilePage;

window.profilePage = new ProfilePage();
