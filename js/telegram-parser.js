'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const TELEGRAM_LINK_PATTERN = /^https?:\/\/(?:www\.)?t\.me\/([A-Za-z0-9_]{4,})\/(\d+)(?:[/?#].*)?$/i;
const REQUEST_DELAY_MS = 500;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

class TelegramParserError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'TelegramParserError';
    this.code = code;
  }
}

function parsePostUrl(postUrl) {
  const match = String(postUrl || '').trim().match(TELEGRAM_LINK_PATTERN);
  if (!match) {
    throw new TelegramParserError('INVALID_URL', 'Неверный формат ссылки. Пример: https://t.me/channel/123');
  }
  return { channelName:match[1], messageId:match[2] };
}

function textWithLineBreaks($, element) {
  const copy = element.clone();
  copy.find('br').replaceWith('\n');
  return copy.text().replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function imagesFromPost($, postElement) {
  const imageUrls = [];
  const add = (value) => {
    const url = String(value || '').replace(/&amp;/g, '&').trim();
    if (url && !imageUrls.includes(url)) imageUrls.push(url);
  };

  postElement.find('.tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb').each((_, element) => {
    const style = $(element).attr('style') || '';
    const styleMatch = style.match(/background-image\s*:\s*url\((['"]?)(.*?)\1\)/i);
    if (styleMatch?.[2]) add(styleMatch[2]);
  });
  postElement.find('.tgme_widget_message_photo_wrap img, .tgme_widget_message_video_thumb img, .tgme_widget_message_photo img').each((_, element) => add($(element).attr('src')));
  return imageUrls;
}

// Чистая функция оставлена отдельно, чтобы HTML можно было проверять без сетевых запросов.
function parseTelegramHtml(html, { channelName, messageId }) {
  const $ = cheerio.load(html);
  const postElement = $(`[data-post="${channelName}/${messageId}"]`).first();

  if (!postElement.length) {
    const hasPublicMessages = $('[data-post], .tgme_widget_message').length > 0;
    if (hasPublicMessages) {
      throw new TelegramParserError('POST_NOT_FOUND', 'Пост не найден. Показываются только последние ~20 постов канала');
    }
    throw new TelegramParserError('PREVIEW_UNAVAILABLE', 'Не удалось загрузить пост. Возможно, канал приватный или у него отключено превью');
  }

  const textElement = postElement.find('.tgme_widget_message_text').first();
  const content = textElement.length ? textWithLineBreaks($, textElement) : '';
  const publishedAt = postElement.find('time').first().attr('datetime') || new Date().toISOString();
  const imageUrls = imagesFromPost($, postElement);
  const title = (content.split('\n').find(Boolean) || `Новость из Telegram #${messageId}`).slice(0, 100);

  return {
    title,
    content,
    imageUrl:imageUrls[0] || null,
    imageUrls,
    publishedAt,
    source:`https://t.me/${channelName}/${messageId}`,
    channel:channelName,
    messageId
  };
}

async function waitForRequestSlot() {
  const run = requestQueue.then(async () => {
    const waitMs = Math.max(0, REQUEST_DELAY_MS - (Date.now() - lastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestAt = Date.now();
  });
  requestQueue = run.catch(() => {});
  return run;
}

async function fetchTelegramPost(postUrl) {
  const post = parsePostUrl(postUrl);
  await waitForRequestSlot();

  try {
    // Ссылка с ID даёт Telegram возможность вернуть окно постов вокруг нужного сообщения.
    const previewUrl = `https://t.me/s/${post.channelName}/${post.messageId}`;
    const { data:html } = await axios.get(previewUrl, {
      headers:{ 'User-Agent':USER_AGENT, Accept:'text/html,application/xhtml+xml' },
      timeout:10_000,
      maxRedirects:3,
      responseType:'text',
      validateStatus:(status) => status >= 200 && status < 400
    });
    return parseTelegramHtml(html, post);
  } catch (error) {
    if (error instanceof TelegramParserError) throw error;
    if (error.response?.status === 404) {
      throw new TelegramParserError('POST_NOT_FOUND', 'Пост не найден. Показываются только последние ~20 постов канала', error);
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || axios.isAxiosError(error)) {
      throw new TelegramParserError('NETWORK_ERROR', 'Ошибка соединения. Проверьте интернет и попробуйте снова', error);
    }
    throw error;
  }
}

module.exports = { fetchTelegramPost, parsePostUrl, parseTelegramHtml, TelegramParserError };
