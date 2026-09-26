(function initNewsModule(root) {
  'use strict';

  const api = root.NewsApi;
  const MAX_IMAGES = 10;
  let initialized = false;
  let activeTab = 'telegram';
  let pendingDeleteId = null;
  let lastFocusedElement = null;
  let uploadedImages = [];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function imagesOf(item) {
    if (Array.isArray(item.imageUrls)) return item.imageUrls.filter(Boolean);
    return item.imageUrl ? [item.imageUrl] : [];
  }

  function card(item) {
    const images = imagesOf(item);
    const deletable = root.Auth.can('news_manage') && !root.Auth.isPreviewMode();
    return `<article class="news-card" data-news-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Открыть новость: ${escapeHtml(item.title)}">
      ${deletable ? `<button class="news-delete admin-only" type="button" data-delete-news="${escapeHtml(item.id)}" aria-label="Удалить новость">🗑</button>` : ''}
      ${images.length ? `<div class="news-card-media"><img src="${escapeHtml(images[0])}" alt="" loading="lazy" onerror="this.closest('.news-card-media').hidden=true">${images.length > 1 ? `<span class="media-count" aria-label="Изображений: ${images.length}">1 / ${images.length}</span>` : ''}</div>` : ''}
      <div class="news-card-body"><div class="news-meta"><time>${escapeHtml(item.date || '')}</time><span>${item.source === 'telegram' ? 'Telegram' : 'Редакция'}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>
    </article>`;
  }

  function galleryMarkup(images) {
    if (!images.length) return '';
    const thumbnails = images.length > 1 ? `<div class="gallery-thumbnails" role="tablist" aria-label="Изображения новости">${images.map((url, index) => `<button type="button" data-gallery-index="${index}" aria-label="Показать изображение ${index + 1}" aria-selected="${index === 0}"><img src="${escapeHtml(url)}" alt=""></button>`).join('')}</div>` : '';
    return `<div class="news-gallery" data-gallery data-current="0">
      <div class="gallery-stage"><img class="news-detail-image" data-gallery-image src="${escapeHtml(images[0])}" alt="Изображение 1 из ${images.length}">
        ${images.length > 1 ? `<button class="gallery-arrow previous" type="button" data-gallery-step="-1" aria-label="Предыдущее изображение">‹</button><button class="gallery-arrow next" type="button" data-gallery-step="1" aria-label="Следующее изображение">›</button><span class="gallery-counter" data-gallery-counter>1 / ${images.length}</span>` : ''}
      </div>${thumbnails}
    </div>`;
  }

  async function render() {
    const grid = document.getElementById('news-grid');
    grid.innerHTML = '<div class="view-loading">Загрузка новостей…</div>';
    try {
      const items = await api.list();
      grid.innerHTML = items.length ? items.map(card).join('') : '<div class="empty-state">Новостей пока нет</div>';
    } catch {
      grid.innerHTML = '<div class="empty-state">Не удалось загрузить новости</div>';
    }
  }

  async function renderFullNews(id) {
    const item = (await api.list()).find((news) => String(news.id) === String(id));
    if (!item) return;
    lastFocusedElement = document.activeElement;
    const date = item.publishedAt ? new Date(item.publishedAt) : null;
    const dateText = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('ru-RU', { dateStyle:'long', timeStyle:'short' }).format(date) : item.date || '';
    document.getElementById('news-detail-content').innerHTML = `${galleryMarkup(imagesOf(item))}<div class="news-detail-body"><div class="news-meta"><time>${escapeHtml(dateText)}</time><span>${item.source === 'telegram' ? 'Telegram' : 'Редакция'}</span></div><h2 id="news-detail-title">${escapeHtml(item.title)}</h2><div class="news-full-text">${escapeHtml(item.text).replace(/\n/g, '<br>')}</div>${item.sourceUrl ? `<a class="telegram-source" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Читать в Telegram ↗</a>` : ''}</div>`;
    document.getElementById('news-detail-modal').hidden = false;
    document.body.classList.add('modal-open');
  }

  function updateGallery(gallery, nextIndex) {
    const thumbnails = [...gallery.querySelectorAll('[data-gallery-index]')];
    const total = Math.max(thumbnails.length, 1);
    const index = (nextIndex + total) % total;
    const selected = thumbnails[index];
    const image = gallery.querySelector('[data-gallery-image]');
    if (selected) image.src = selected.querySelector('img').src;
    image.alt = `Изображение ${index + 1} из ${total}`;
    gallery.dataset.current = String(index);
    const counter = gallery.querySelector('[data-gallery-counter]');
    if (counter) counter.textContent = `${index + 1} / ${total}`;
    thumbnails.forEach((button, buttonIndex) => button.setAttribute('aria-selected', String(buttonIndex === index)));
  }

  function closeDetail() {
    document.getElementById('news-detail-modal').hidden = true;
    document.body.classList.remove('modal-open');
    lastFocusedElement?.focus();
  }

  async function deleteNews(id) {
    if (!root.Auth.can('news_manage') || root.Auth.isPreviewMode()) return;
    await api.remove(id);
    document.querySelectorAll('.news-card').forEach((node) => {
      if (node.dataset.newsId === String(id)) {
        node.classList.add('removing');
        root.setTimeout(() => node.remove(), 260);
      }
    });
    await root.Home?.render();
  }

  function confirmDelete(id) {
    if (!root.Auth.can('news_manage') || root.Auth.isPreviewMode()) return;
    pendingDeleteId = id;
    document.getElementById('delete-confirm-modal').hidden = false;
    document.getElementById('cancel-delete').focus();
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('[data-news-tab]').forEach((button) => {
      const selected = button.dataset.newsTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.getElementById('telegram-pane').hidden = tab !== 'telegram';
    document.getElementById('manual-pane').hidden = tab !== 'manual';
  }

  function remoteImages() {
    return String(document.getElementById('news-image-input').value || '').split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
  }

  function renderMediaPreview() {
    const images = [...remoteImages(), ...uploadedImages];
    const preview = document.getElementById('news-media-preview');
    preview.hidden = !images.length;
    preview.innerHTML = images.map((url, index) => `<figure><img src="${escapeHtml(url)}" alt="Изображение ${index + 1}"><button type="button" data-remove-draft-image="${index}" aria-label="Удалить изображение ${index + 1}">×</button></figure>`).join('');
  }

  function openModal() {
    if (!root.Auth.can('news_manage') || root.Auth.isPreviewMode()) return;
    lastFocusedElement = document.activeElement;
    uploadedImages = [];
    document.getElementById('news-form').reset();
    document.getElementById('news-form-error').hidden = true;
    document.getElementById('telegram-status').textContent = '';
    document.getElementById('telegram-preview').hidden = true;
    document.getElementById('news-media-preview').hidden = true;
    setTab('telegram');
    document.getElementById('news-modal').hidden = false;
    document.body.classList.add('modal-open');
    document.getElementById('telegram-url').focus();
  }

  function closeModal() {
    document.getElementById('news-modal').hidden = true;
    document.body.classList.remove('modal-open');
    lastFocusedElement?.focus();
  }

  function showError(message) {
    const error = document.getElementById('news-form-error');
    error.textContent = message;
    error.hidden = false;
  }

  function renderTelegramPreview(parsed) {
    const preview = document.getElementById('telegram-preview');
    const images = Array.isArray(parsed.imageUrls) ? parsed.imageUrls : parsed.imageUrl ? [parsed.imageUrl] : [];
    document.getElementById('telegram-preview-images').innerHTML = images.map((url, index) => `<img src="${escapeHtml(url)}" alt="Изображение ${index + 1} из ${images.length}" referrerpolicy="no-referrer">`).join('');
    document.getElementById('telegram-preview-title').textContent = parsed.title;
    document.getElementById('telegram-preview-text').textContent = parsed.text;
    const date = new Date(parsed.publishedAt);
    document.getElementById('telegram-preview-date').textContent = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { dateStyle:'medium', timeStyle:'short' }).format(date);
    preview.hidden = false;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error(`${file.name}: выбранный файл не является изображением`));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Не удалось прочитать ${file.name}`));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error(`Не удалось обработать ${file.name}`));
        image.onload = () => {
          const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/webp', 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function addLocalImages(files) {
    const remaining = MAX_IMAGES - uploadedImages.length - remoteImages().length;
    if (remaining <= 0) return showError(`Можно добавить не более ${MAX_IMAGES} изображений`);
    try {
      const converted = await Promise.all([...files].slice(0, remaining).map(fileToDataUrl));
      uploadedImages.push(...converted);
      renderMediaPreview();
      if (files.length > remaining) showError(`Добавлены первые ${remaining} изображений из ${files.length}`);
    } catch (error) {
      showError(error.message);
    }
  }

  async function loadTelegramPost() {
    if (!root.Auth.can('news_manage') || root.Auth.isPreviewMode()) return showError('Доступ запрещён');
    const button = document.getElementById('parse-telegram');
    const status = document.getElementById('telegram-status');
    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('.telegram-button-label').textContent = 'Загрузка…';
    status.textContent = 'Получаем публичное превью поста…';
    document.getElementById('news-form-error').hidden = true;
    try {
      const parsed = await api.parseTelegram(document.getElementById('telegram-url').value);
      const images = Array.isArray(parsed.imageUrls) ? parsed.imageUrls : parsed.imageUrl ? [parsed.imageUrl] : [];
      document.getElementById('news-title-input').value = parsed.title;
      document.getElementById('news-text-input').value = parsed.text;
      document.getElementById('news-image-input').value = images.join('\n');
      document.getElementById('news-published-at').value = parsed.publishedAt || '';
      document.getElementById('news-source-url').value = parsed.source || document.getElementById('telegram-url').value;
      status.textContent = `Пост @${parsed.channel} загружен · изображений: ${images.length}`;
      renderTelegramPreview(parsed);
      renderMediaPreview();
    } catch (error) {
      status.textContent = '';
      document.getElementById('telegram-preview').hidden = true;
      showError(error.message);
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
      button.querySelector('.telegram-button-label').textContent = 'Загрузить';
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    document.getElementById('add-news-button').addEventListener('click', openModal);
    document.getElementById('close-news-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-news').addEventListener('click', closeModal);
    document.querySelectorAll('[data-news-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.newsTab)));
    document.getElementById('news-modal').addEventListener('click', (event) => { if (event.target.id === 'news-modal') closeModal(); });
    document.querySelector('.detail-close').addEventListener('click', closeDetail);
    document.getElementById('news-detail-modal').addEventListener('click', (event) => {
      if (event.target.id === 'news-detail-modal') return closeDetail();
      const gallery = event.target.closest('[data-gallery]');
      if (!gallery) return;
      const step = event.target.closest('[data-gallery-step]');
      const thumbnail = event.target.closest('[data-gallery-index]');
      if (step) updateGallery(gallery, Number(gallery.dataset.current || 0) + Number(step.dataset.galleryStep));
      if (thumbnail) updateGallery(gallery, Number(thumbnail.dataset.galleryIndex));
    });
    document.getElementById('cancel-delete').addEventListener('click', () => { document.getElementById('delete-confirm-modal').hidden = true; pendingDeleteId = null; });
    document.getElementById('confirm-delete').addEventListener('click', async () => { document.getElementById('delete-confirm-modal').hidden = true; if (pendingDeleteId) await deleteNews(pendingDeleteId); pendingDeleteId = null; });
    for (const grid of [document.getElementById('news-grid'), document.getElementById('home-news-grid')]) {
      grid.addEventListener('click', (event) => { const remove = event.target.closest('[data-delete-news]'); if (remove) { event.stopPropagation(); confirmDelete(remove.dataset.deleteNews); return; } const cardNode = event.target.closest('[data-news-id]'); if (cardNode) renderFullNews(cardNode.dataset.newsId); });
      grid.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.news-card')) { event.preventDefault(); renderFullNews(event.target.dataset.newsId); } });
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { if (!document.getElementById('news-modal').hidden) closeModal(); if (!document.getElementById('news-detail-modal').hidden) closeDetail(); document.getElementById('delete-confirm-modal').hidden = true; }
      const gallery = document.querySelector('#news-detail-modal:not([hidden]) [data-gallery]');
      if (gallery && ['ArrowLeft', 'ArrowRight'].includes(event.key)) updateGallery(gallery, Number(gallery.dataset.current || 0) + (event.key === 'ArrowRight' ? 1 : -1));
    });
    document.getElementById('parse-telegram').addEventListener('click', loadTelegramPost);
    document.getElementById('telegram-url').addEventListener('paste', () => root.setTimeout(() => { if (document.getElementById('telegram-url').value.trim()) loadTelegramPost(); }, 0));
    document.getElementById('news-image-input').addEventListener('input', renderMediaPreview);
    document.getElementById('news-image-files').addEventListener('change', async (event) => {
      await addLocalImages(event.target.files);
      event.target.value = '';
    });
    document.getElementById('news-media-preview').addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-draft-image]');
      if (!remove) return;
      const urls = remoteImages();
      const index = Number(remove.dataset.removeDraftImage);
      if (index < urls.length) {
        urls.splice(index, 1);
        document.getElementById('news-image-input').value = urls.join('\n');
      } else uploadedImages.splice(index - urls.length, 1);
      renderMediaPreview();
    });
    document.getElementById('news-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!root.Auth.can('news_manage') || root.Auth.isPreviewMode()) return showError('Недостаточно прав для публикации');
      const data = new FormData(event.currentTarget);
      if (!String(data.get('title')).trim() || !String(data.get('text')).trim()) return showError('Заполните заголовок и текст');
      const imageUrls = [...new Set([...remoteImages(), ...uploadedImages])].slice(0, MAX_IMAGES);
      try {
        await api.create({ title:data.get('title'), text:data.get('text'), imageUrls, publishedAt:data.get('publishedAt'), sourceUrl:data.get('sourceUrl'), source:activeTab === 'telegram' ? 'telegram' : 'editorial' });
        closeModal();
        await render();
        await root.Home?.render();
      } catch (error) {
        showError(error.message);
      }
    });
  }

  root.News = { init, render, card, renderFullNews, deleteNews, confirmDelete, openModal, closeModal };
})(window);
