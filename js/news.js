(function initNewsModule(root) {
  'use strict';

  const api = root.NewsApi;
  let initialized = false;
  let activeTab = 'telegram';
  let lastFocusedElement = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function card(item) {
    return `<article class="news-card">
      <img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" onerror="this.src='assets/news/default.svg'">
      <div class="news-card-body"><div class="news-meta"><time>${escapeHtml(item.date)}</time><span>${item.source === 'telegram' ? 'Telegram' : 'Редакция'}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>
    </article>`;
  }

  async function render() {
    const grid = document.getElementById('news-grid');
    grid.innerHTML = '<div class="view-loading">Загрузка новостей…</div>';
    const items = await api.list();
    grid.innerHTML = items.length ? items.map(card).join('') : '<div class="empty-state">Новостей пока нет</div>';
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

  function openModal() {
    if (!root.Auth.can('news_manage')) return;
    lastFocusedElement = document.activeElement;
    document.getElementById('news-form').reset();
    document.getElementById('news-form-error').hidden = true;
    document.getElementById('telegram-status').textContent = '';
    document.getElementById('telegram-preview').hidden = true;
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
    const image = document.getElementById('telegram-preview-image');
    image.hidden = !parsed.imageUrl;
    image.src = parsed.imageUrl || '';
    document.getElementById('telegram-preview-title').textContent = parsed.title;
    document.getElementById('telegram-preview-text').textContent = parsed.text;
    const date = new Date(parsed.publishedAt);
    document.getElementById('telegram-preview-date').textContent = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { dateStyle:'medium', timeStyle:'short' }).format(date);
    preview.hidden = false;
  }

  async function loadTelegramPost() {
    if (!root.Auth.can('news_manage')) return showError('Доступ запрещён');
    const button = document.getElementById('parse-telegram');
    if (button.disabled) return;
    const status = document.getElementById('telegram-status');
    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('.telegram-button-label').textContent = 'Загрузка…';
    status.textContent = 'Получаем публичное превью поста…';
    document.getElementById('news-form-error').hidden = true;
    try {
      const parsed = await api.parseTelegram(document.getElementById('telegram-url').value);
      document.getElementById('news-title-input').value = parsed.title;
      document.getElementById('news-text-input').value = parsed.text;
      document.getElementById('news-image-input').value = parsed.imageUrl || '';
      document.getElementById('news-published-at').value = parsed.publishedAt || '';
      document.getElementById('news-source-url').value = parsed.source || '';
      status.textContent = `Пост @${parsed.channel} загружен`;
      renderTelegramPreview(parsed);
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
    document.getElementById('add-news-button').hidden = !root.Auth.can('news_manage');
    document.getElementById('add-news-button').addEventListener('click', openModal);
    document.getElementById('close-news-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-news').addEventListener('click', closeModal);
    document.querySelectorAll('[data-news-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.newsTab)));
    document.getElementById('news-modal').addEventListener('click', (event) => { if (event.target.id === 'news-modal') closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !document.getElementById('news-modal').hidden) closeModal(); });

    document.getElementById('parse-telegram').addEventListener('click', loadTelegramPost);
    document.getElementById('telegram-url').addEventListener('paste', () => root.setTimeout(() => {
      if (document.getElementById('telegram-url').value.trim()) loadTelegramPost();
    }, 0));

    document.getElementById('news-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!root.Auth.can('news_manage')) return showError('Недостаточно прав для публикации');
      const data = new FormData(event.currentTarget);
      if (!String(data.get('title')).trim() || !String(data.get('text')).trim()) return showError('Заполните заголовок и текст');
      await api.create({ title:data.get('title'), text:data.get('text'), imageUrl:data.get('imageUrl'), publishedAt:data.get('publishedAt'), sourceUrl:data.get('sourceUrl'), source:activeTab });
      closeModal();
      await render();
    });
  }

  root.News = { init, render, openModal, closeModal };
})(window);
