(function initNewsApi(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NewsApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function createNewsApi(root) {
  'use strict';

  const STORAGE_KEY = 'cs2-dashboard-news';
  const seed = [
    { id:'news-1', title:'K27 выигрывает CyberX Celebration', date:'18 мая 2025', text:'Финальная серия завершилась со счётом 2:1. Решающий Anubis остался за K27.', imageUrl:'assets/news/final.svg', source:'editorial' },
    { id:'news-2', title:'Обновление турнирного маппула', date:'16 мая 2025', text:'Команды готовятся к обновлённому набору карт и новым тактическим решениям.', imageUrl:'assets/news/maps.svg', source:'editorial' },
    { id:'news-3', title:'Опубликовано расписание плей-офф', date:'12 мая 2025', text:'Организаторы подтвердили даты четвертьфиналов, полуфиналов и гранд-финала.', imageUrl:'assets/news/schedule.svg', source:'editorial' }
  ];

  function storage() {
    try { return root.localStorage; } catch { return null; }
  }

  function read() {
    try {
      const saved = JSON.parse(storage()?.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? saved : seed;
    } catch {
      return seed;
    }
  }

  function write(items) {
    try { storage()?.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* memoryless fallback */ }
  }

  async function list() {
    return read().map((item) => ({ ...item }));
  }

  async function create(payload) {
    const publishedDate = payload.publishedAt ? new Date(payload.publishedAt) : new Date();
    const safeDate = Number.isNaN(publishedDate.getTime()) ? new Date() : publishedDate;
    const item = {
      id:`news-${Date.now()}`,
      title:String(payload.title).trim(),
      text:String(payload.text).trim(),
      imageUrl:String(payload.imageUrl || '').trim() || 'assets/news/default.svg',
      date:new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'long', year:'numeric' }).format(safeDate),
      publishedAt:safeDate.toISOString(),
      source:payload.source || 'manual',
      sourceUrl:String(payload.sourceUrl || '').trim()
    };
    const items = [item, ...read()];
    write(items);
    return { ...item };
  }

  let lastTelegramRequestAt = 0;

  // Клиентский API-слой: HTML Telegram обрабатывается только на Node.js сервере.
  async function parseTelegram(url) {
    if (!root.Auth?.can('news_manage')) throw new Error('Доступ запрещён');
    const normalizedUrl = String(url || '').trim();
    if (!/^https?:\/\/(?:www\.)?t\.me\/[A-Za-z0-9_]{4,}\/\d+(?:[/?#].*)?$/i.test(normalizedUrl)) {
      throw new Error('Неверный формат ссылки. Пример: https://t.me/channel/123');
    }

    const waitMs = Math.max(0, 500 - (Date.now() - lastTelegramRequestAt));
    if (waitMs) await new Promise((resolve) => root.setTimeout(resolve, waitMs));
    lastTelegramRequestAt = Date.now();
    const user = root.Auth.getUser();
    const apiUrl = root.location?.protocol === 'file:'
      ? 'http://127.0.0.1:3000/api/telegram/parse'
      : '/api/telegram/parse';

    let response;
    try {
      response = await root.fetch(apiUrl, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'X-CS2-Role':user.role, 'X-CS2-User':user.id },
        body:JSON.stringify({ url:normalizedUrl })
      });
    } catch {
      throw new Error('Ошибка соединения. Проверьте интернет и попробуйте снова');
    }

    let payload = {};
    try { payload = await response.json(); } catch { /* server returned no JSON */ }
    if (!response.ok) throw new Error(payload.message || 'Не удалось загрузить пост. Возможно, канал приватный или у него отключено превью');
    return { ...payload, text:payload.content || '', sourceType:'telegram' };
  }

  return { list, create, parseTelegram, STORAGE_KEY };
});
