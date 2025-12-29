import { DOMHelper } from '../utils/utils.js';

const PAGE_SIZE = 20;

export default class GalleryPage {
  constructor() {
    this.images = [];
    this.tags = [];
    this.albums = [];

    this.filters = {
      search: '',
      tag: null,
      albumId: null,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };

    this.pagination = {
      current: 1,
      pages: 1,
      total: 0
    };

    this.dom = {};
    this.searchDelayId = null;
  }

  async init() {
    const storedAlbumFilter = sessionStorage.getItem('gallery-default-album');
    const storedTagFilter = sessionStorage.getItem('gallery-default-tag');
    const storedSearch = sessionStorage.getItem('gallery-default-search');

    if (storedAlbumFilter) {
      this.filters.albumId = storedAlbumFilter;
      sessionStorage.removeItem('gallery-default-album');
    }

    if (storedTagFilter) {
      this.filters.tag = storedTagFilter;
      sessionStorage.removeItem('gallery-default-tag');
    }

    if (storedSearch) {
      this.filters.search = storedSearch;
      sessionStorage.removeItem('gallery-default-search');
    }

    this.cacheDom();

    if (storedSearch && this.dom.searchInput) {
      this.dom.searchInput.value = storedSearch;
    }

    this.bindEvents();

    await this.loadReferenceData();
    await this.loadImages();
  }

  cacheDom() {
    this.dom.container = DOMHelper.find('#gallery-container');
    this.dom.pagination = DOMHelper.find('#pagination');
    this.dom.searchInput = DOMHelper.find('#search-input');
    this.dom.sortSelect = DOMHelper.find('#sort-select');
    this.dom.activeFilters = DOMHelper.find('#active-filters');
    this.dom.activeFilterList = DOMHelper.find('#filter-tags');
    this.dom.totalImages = DOMHelper.find('#total-images');

    this.dom.tagCloud = DOMHelper.find('#tag-cloud');
    this.dom.albumList = DOMHelper.find('#album-list');

    this.dom.tagsModal = DOMHelper.find('#tags-modal');
    this.dom.tagsList = DOMHelper.find('#tags-list');
    this.dom.tagsConfirm = DOMHelper.find('#tags-modal-confirm');
    this.dom.tagsCancel = DOMHelper.find('#tags-modal-cancel');

    this.dom.albumsModal = DOMHelper.find('#albums-modal');
    this.dom.albumsList = DOMHelper.find('#albums-filter-list');
    this.dom.albumsConfirm = DOMHelper.find('#albums-modal-confirm');
    this.dom.albumsCancel = DOMHelper.find('#albums-modal-cancel');

    this.dom.tagsButton = DOMHelper.find('#filter-tags-btn');
    this.dom.albumsButton = DOMHelper.find('#filter-album-btn');
  }

  bindEvents() {
    if (this.dom.searchInput) {
      DOMHelper.on(this.dom.searchInput, 'input', (event) => {
        this.handleSearchInput(event.target.value);
      });

      DOMHelper.on(this.dom.searchInput, 'keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.applySearch(event.target.value);
        }
      });
    }

    if (this.dom.sortSelect) {
      DOMHelper.on(this.dom.sortSelect, 'change', (event) => {
        const [sortBy, sortOrder] = event.target.value.split('-');
        this.filters.sortBy = sortBy;
        this.filters.sortOrder = sortOrder;
        this.pagination.current = 1;
        this.loadImages();
      });
    }

    if (this.dom.tagsButton) {
      DOMHelper.on(this.dom.tagsButton, 'click', () => this.openTagsModal());
    }

    if (this.dom.albumsButton) {
      DOMHelper.on(this.dom.albumsButton, 'click', () => this.openAlbumsModal());
    }

    if (this.dom.tagsCancel) {
      DOMHelper.on(this.dom.tagsCancel, 'click', () => this.closeTagsModal());
    }

    if (this.dom.tagsConfirm) {
      DOMHelper.on(this.dom.tagsConfirm, 'click', () => this.applyTagFilter());
    }

    if (this.dom.albumsCancel) {
      DOMHelper.on(this.dom.albumsCancel, 'click', () => this.closeAlbumsModal());
    }

    if (this.dom.albumsConfirm) {
      DOMHelper.on(this.dom.albumsConfirm, 'click', () => this.applyAlbumFilter());
    }

    DOMHelper.on(document, 'click', (event) => {
      if (event.target === this.dom.tagsModal) {
        this.closeTagsModal();
      }
      if (event.target === this.dom.albumsModal) {
        this.closeAlbumsModal();
      }
    });
  }

  async loadReferenceData() {
    try {
      const [tagsResponse, albumsResponse] = await Promise.all([
        window.api.images.getAllTags(),
        window.api.albums.getList({ page: 1, limit: 100 })
      ]);

      if (tagsResponse?.success) {
        this.tags = tagsResponse.data?.tags ?? [];
        this.renderTagOptions();
        this.renderTagCloud();
      }

      if (albumsResponse?.success) {
        this.albums = albumsResponse.data?.albums ?? [];
        this.renderAlbumOptions();
        this.renderAlbumList();
      }
    } catch (error) {
      console.error('Failed to load tag/album data:', error);
      window.toast.error('无法加载筛选数据，请稍后重试');
      this.renderTagCloud(true);
      this.renderAlbumList(true);
    }
  }

  async loadImages(page = this.pagination.current) {
    try {
      this.setLoading(true);
      const params = {
        page,
        limit: PAGE_SIZE,
        sortBy: this.filters.sortBy,
        sortOrder: this.filters.sortOrder
      };

      if (this.filters.search) {
        params.search = this.filters.search;
      }
      if (this.filters.tag) {
        params.tag = this.filters.tag;
      }
      if (this.filters.albumId) {
        params.albumId = this.filters.albumId;
      }

      const response = await window.api.images.getList(params);
      if (!response?.success) {
        throw new Error(response?.message || '加载图片失败');
      }

      const { images = [], pagination = {} } = response.data || {};
      this.images = images;
      this.pagination = {
        current: pagination.current || page,
        pages: pagination.pages || 1,
        total: pagination.total || images.length
      };

      if (this.dom.totalImages) {
        this.dom.totalImages.textContent = this.pagination.total;
      }

      if (!images.length) {
        this.renderEmptyState();
        this.renderPagination();
        return;
      }

      this.renderImages();
      this.renderPagination();
    } catch (error) {
      console.error('Failed to load images:', error);
      window.toast.error(error.message || '加载图片失败');
      this.renderErrorState();
    } finally {
      this.setLoading(false);
      this.updateActiveFilters();
    }
  }

  handleSearchInput(value) {
    const trimmed = value.trim();
    if (this.searchDelayId) {
      clearTimeout(this.searchDelayId);
    }

    this.searchDelayId = setTimeout(() => {
      if (trimmed !== this.filters.search) {
        this.applySearch(trimmed);
      }
    }, 300);
  }

  applySearch(value) {
    const trimmed = value.trim();
    if (trimmed === this.filters.search && this.pagination.current === 1) {
      return;
    }

    this.filters.search = trimmed;
    this.pagination.current = 1;
    this.loadImages();
  }

  setLoading(isLoading) {
    if (!this.dom.container) return;

    if (isLoading) {
      this.dom.container.classList.add('opacity-60');
      this.dom.container.classList.add('pointer-events-none');
    } else {
      this.dom.container.classList.remove('opacity-60');
      this.dom.container.classList.remove('pointer-events-none');
    }
  }

  renderEmptyState() {
    if (!this.dom.container) return;

    this.dom.container.innerHTML = `
      <div class="col-span-full text-center py-12 text-gray-500">
        <i class="material-icons text-6xl mb-4 text-gray-300">photo_library</i>
        <p class="text-lg font-medium">还没有图片</p>
        <p class="text-sm mt-2">去上传页面添加第一张二次元图片吧！</p>
        <a href="#/upload" class="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
          <i class="material-icons align-middle mr-1" style="font-size: 18px;">upload</i>
          上传图片
        </a>
      </div>
    `;
  }

  renderErrorState() {
    if (!this.dom.container) return;
    this.dom.container.innerHTML = `
      <div class="col-span-full text-center py-10 text-red-500">
        <i class="material-icons text-5xl mb-3">error_outline</i>
        <p class="text-lg font-semibold">图片列表加载失败</p>
        <p class="text-sm text-gray-500 mt-2">请稍后重试或检查网络连接。</p>
      </div>
    `;
  }

  renderImages() {
    if (!this.dom.container) return;
    this.dom.container.innerHTML = '';

    const fragment = document.createDocumentFragment();

    this.images.forEach((image) => {
      const card = DOMHelper.createElement('article', 'image-card h-full flex flex-col');

      const imgWrapper = DOMHelper.createElement('div', 'image-card-cover relative overflow-hidden');
      const img = DOMHelper.createElement('img');
      img.src = image.url;
      img.alt = image.title || '图片';
      img.loading = 'lazy';
      imgWrapper.appendChild(img);

      const overlay = DOMHelper.createElement('div', 'image-card-overlay');
      const title = DOMHelper.createElement('div', 'image-card-title', image.title || '未命名图片');
      const meta = DOMHelper.createElement('div', 'image-card-meta');
      const readableDate = image.createdAt ? new Date(image.createdAt).toLocaleDateString() : '';
      const albumName = typeof image.albumId === 'object' ? image.albumId?.name : null;
      meta.textContent = [readableDate, albumName].filter(Boolean).join(' · ');
      overlay.appendChild(title);
      overlay.appendChild(meta);

      imgWrapper.appendChild(overlay);
      card.appendChild(imgWrapper);

      const info = DOMHelper.createElement('div', 'p-4 flex-1 flex flex-col gap-3');
      const description = DOMHelper.createElement('p', 'text-sm text-gray-600 text-truncate-2', image.description || '暂无描述');
      info.appendChild(description);

      if (Array.isArray(image.tags) && image.tags.length) {
        const tagContainer = DOMHelper.createElement('div', 'flex flex-wrap gap-2');
        image.tags.slice(0, 4).forEach((tag) => {
          const chip = DOMHelper.createElement('span', 'tag text-xs');
          chip.textContent = tag;
          DOMHelper.on(chip, 'click', (event) => {
            event.stopPropagation();
            this.filters.tag = tag;
            this.pagination.current = 1;
            this.closeTagsModal();
            this.loadImages();
          });
          tagContainer.appendChild(chip);
        });
        info.appendChild(tagContainer);
      }

      card.appendChild(info);

      DOMHelper.on(card, 'click', () => this.openImageDetail(image));
      fragment.appendChild(card);
    });

    this.dom.container.appendChild(fragment);
  }

  openImageDetail(image) {
    const imageId = image?.id || image?._id;
    if (!imageId) return;
    sessionStorage.setItem('selected-image-id', imageId);
    window.router.navigate('/image-detail');
  }

  renderPagination() {
    if (!this.dom.pagination) return;

    const { pages, current } = this.pagination;
    if (!pages || pages <= 1) {
      this.dom.pagination.innerHTML = '';
      return;
    }

    const wrapper = DOMHelper.createElement('div', 'inline-flex items-center gap-1');

    wrapper.appendChild(this.createPaginationButton('上一页', current - 1, current === 1));

    const maxButtons = 5;
    let start = Math.max(1, current - Math.floor(maxButtons / 2));
    let end = Math.min(pages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let page = start; page <= end; page += 1) {
      wrapper.appendChild(this.createPaginationButton(page, page, false, page === current));
    }

    wrapper.appendChild(this.createPaginationButton('下一页', current + 1, current === pages));

    this.dom.pagination.innerHTML = '';
    this.dom.pagination.appendChild(wrapper);
  }

  createPaginationButton(label, page, disabled = false, active = false) {
    const button = DOMHelper.createElement('button', 'px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors');
    button.textContent = label;
    button.disabled = disabled;

    if (active) {
      button.classList.add('bg-primary', 'text-white', 'border-primary');
    }

    if (!disabled && typeof page === 'number') {
      DOMHelper.on(button, 'click', () => this.changePage(page));
    } else if (!disabled && label === '上一页') {
      DOMHelper.on(button, 'click', () => this.changePage(this.pagination.current - 1));
    } else if (!disabled && label === '下一页') {
      DOMHelper.on(button, 'click', () => this.changePage(this.pagination.current + 1));
    }

    return button;
  }

  changePage(page) {
    if (page < 1 || page > this.pagination.pages || page === this.pagination.current) {
      return;
    }
    this.pagination.current = page;
    this.loadImages(page);
  }

  updateActiveFilters() {
    if (!this.dom.activeFilters || !this.dom.activeFilterList) return;

    const activeItems = [];

    if (this.filters.search) {
      activeItems.push({ type: 'search', label: `关键词：${this.filters.search}` });
    }

    if (this.filters.tag) {
      activeItems.push({ type: 'tag', label: `标签：${this.filters.tag}` });
    }

    if (this.filters.albumId) {
      const album = this.albums.find((item) => (item.id || item._id) === this.filters.albumId);
      const albumName = album?.name || '已删除相册';
      activeItems.push({ type: 'album', label: `相册：${albumName}` });
    }

    if (!activeItems.length) {
      this.dom.activeFilters.classList.add('hidden');
      this.dom.activeFilterList.innerHTML = '';
      return;
    }

    this.dom.activeFilters.classList.remove('hidden');
    this.dom.activeFilterList.innerHTML = '';

    const fragment = document.createDocumentFragment();

    activeItems.forEach((item) => {
      const chip = DOMHelper.createElement('span', 'inline-flex items-center bg-indigo-50 text-primary px-3 py-1 rounded-full text-sm');
      const label = DOMHelper.createElement('span', 'mr-2', item.label);
      const remove = DOMHelper.createElement('button', 'material-icons text-sm text-primary');
      remove.type = 'button';
      remove.textContent = 'close';
      DOMHelper.on(remove, 'click', () => this.clearFilter(item.type));
      chip.appendChild(label);
      chip.appendChild(remove);
      fragment.appendChild(chip);
    });

    this.dom.activeFilterList.appendChild(fragment);
  }

  clearFilter(type) {
    switch (type) {
      case 'search':
        this.clearSearchFilter();
        break;
      case 'tag':
        this.clearTagFilter();
        break;
      case 'album':
        this.clearAlbumFilter();
        break;
      default:
        break;
    }
  }

  clearSearchFilter() {
    this.filters.search = '';
    if (this.dom.searchInput) {
      this.dom.searchInput.value = '';
    }
    this.pagination.current = 1;
    this.loadImages();
  }

  clearTagFilter() {
    this.filters.tag = null;
    this.pagination.current = 1;
    this.loadImages();
  }

  clearAlbumFilter() {
    this.filters.albumId = null;
    this.pagination.current = 1;
    this.loadImages();
  }

  renderTagOptions() {
    if (!this.dom.tagsList) return;

    if (!this.tags.length) {
      this.dom.tagsList.innerHTML = '<p class="text-sm text-gray-500">暂无标签数据</p>';
      return;
    }

    const fragment = document.createDocumentFragment();

    const allOption = DOMHelper.createElement('label', 'flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 cursor-pointer');
    const allInput = DOMHelper.createElement('input');
    allInput.type = 'radio';
    allInput.name = 'tag-filter';
    allInput.value = '';
    allInput.checked = !this.filters.tag;
    allOption.appendChild(allInput);
    allOption.appendChild(DOMHelper.createElement('span', 'text-sm text-gray-700', '全部标签'));
    fragment.appendChild(allOption);

    this.tags.forEach((tag) => {
      const option = DOMHelper.createElement('label', 'flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 cursor-pointer');
      const input = DOMHelper.createElement('input');
      input.type = 'radio';
      input.name = 'tag-filter';
      input.value = tag.name;
      input.checked = this.filters.tag === tag.name;
      const text = DOMHelper.createElement('span', 'text-sm text-gray-700', tag.name);
      const count = DOMHelper.createElement('span', 'text-xs text-gray-400', tag.count ? `×${tag.count}` : '');
      option.appendChild(input);
      option.appendChild(text);
      option.appendChild(count);
      fragment.appendChild(option);
    });

    this.dom.tagsList.innerHTML = '';
    this.dom.tagsList.appendChild(fragment);
  }

  renderTagCloud(error = false) {
    if (!this.dom.tagCloud) return;

    if (error) {
      this.dom.tagCloud.innerHTML = '<span class="text-sm text-red-500">标签加载失败</span>';
      return;
    }

    if (!this.tags.length) {
      this.dom.tagCloud.innerHTML = '<span class="text-sm text-gray-500">暂无标签</span>';
      return;
    }

    this.dom.tagCloud.innerHTML = '';
    const fragment = document.createDocumentFragment();

    this.tags.forEach((tag) => {
      const pill = DOMHelper.createElement('button', 'tag');
      pill.type = 'button';
      pill.textContent = `${tag.name}${tag.count ? ` (${tag.count})` : ''}`;
      if (this.filters.tag === tag.name) {
        pill.classList.add('active');
      }
      DOMHelper.on(pill, 'click', () => {
        this.filters.tag = this.filters.tag === tag.name ? null : tag.name;
        this.pagination.current = 1;
        this.loadImages();
      });
      fragment.appendChild(pill);
    });

    this.dom.tagCloud.appendChild(fragment);
  }

  renderAlbumOptions() {
    if (!this.dom.albumsList) return;

    const fragment = document.createDocumentFragment();

    const allOption = DOMHelper.createElement('label', 'flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 cursor-pointer');
    const allInput = DOMHelper.createElement('input');
    allInput.type = 'radio';
    allInput.name = 'album-filter';
    allInput.value = '';
    allInput.checked = !this.filters.albumId;
    allOption.appendChild(allInput);
    allOption.appendChild(DOMHelper.createElement('span', 'text-sm text-gray-700', '全部相册'));
    fragment.appendChild(allOption);

    this.albums.forEach((album) => {
      const option = DOMHelper.createElement('label', 'flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 cursor-pointer');
      const input = DOMHelper.createElement('input');
      input.type = 'radio';
      input.name = 'album-filter';
      input.value = album.id || album._id;
      input.checked = this.filters.albumId === (album.id || album._id);
      const text = DOMHelper.createElement('span', 'text-sm text-gray-700', album.name || '未命名相册');
      const count = DOMHelper.createElement('span', 'text-xs text-gray-400', `${album.imageCount ?? 0} 张`);
      option.appendChild(input);
      option.appendChild(text);
      option.appendChild(count);
      fragment.appendChild(option);
    });

    this.dom.albumsList.innerHTML = '';
    this.dom.albumsList.appendChild(fragment);
  }

  renderAlbumList(error = false) {
    if (!this.dom.albumList) return;

    if (error) {
      this.dom.albumList.innerHTML = '<span class="text-sm text-red-500">相册加载失败</span>';
      return;
    }

    if (!this.albums.length) {
      this.dom.albumList.innerHTML = '<span class="text-sm text-gray-500">暂无相册</span>';
      return;
    }

    this.dom.albumList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    this.albums.forEach((album) => {
      const item = DOMHelper.createElement('button', 'w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between text-sm');
      item.type = 'button';
      item.textContent = album.name || '未命名相册';
      if (this.filters.albumId === (album.id || album._id)) {
        item.classList.add('bg-indigo-50', 'text-primary');
      }
      const count = DOMHelper.createElement('span', 'text-xs text-gray-400', `${album.imageCount ?? 0} 张`);
      item.appendChild(count);
      DOMHelper.on(item, 'click', () => {
        this.filters.albumId = this.filters.albumId === (album.id || album._id) ? null : (album.id || album._id);
        this.pagination.current = 1;
        this.loadImages();
      });
      fragment.appendChild(item);
    });

    this.dom.albumList.appendChild(fragment);
  }

  openTagsModal() {
    if (!this.dom.tagsModal) return;
    this.renderTagOptions();
    this.dom.tagsModal.classList.remove('hidden');
  }

  closeTagsModal() {
    this.dom.tagsModal?.classList.add('hidden');
  }

  applyTagFilter() {
    const selected = this.dom.tagsList?.querySelector('input[name="tag-filter"]:checked');
    this.filters.tag = selected?.value ? selected.value : null;
    this.pagination.current = 1;
    this.closeTagsModal();
    this.loadImages();
  }

  openAlbumsModal() {
    if (!this.dom.albumsModal) return;
    this.renderAlbumOptions();
    this.dom.albumsModal.classList.remove('hidden');
  }

  closeAlbumsModal() {
    this.dom.albumsModal?.classList.add('hidden');
  }

  applyAlbumFilter() {
    const selected = this.dom.albumsList?.querySelector('input[name="album-filter"]:checked');
    this.filters.albumId = selected?.value ? selected.value : null;
    this.pagination.current = 1;
    this.closeAlbumsModal();
    this.loadImages();
  }
}


