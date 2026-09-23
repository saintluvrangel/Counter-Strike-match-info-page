'use strict';

const assert = require('node:assert/strict');
const { parsePostUrl, parseTelegramHtml, TelegramParserError } = require('../js/telegram-parser.js');

assert.deepEqual(parsePostUrl('https://t.me/cs2_channel/123'), { channelName:'cs2_channel', messageId:'123' });
assert.throws(() => parsePostUrl('https://example.com/post'), (error) => error instanceof TelegramParserError && error.code === 'INVALID_URL');

const html = `<!doctype html><html><body>
  <div class="tgme_widget_message" data-post="cs2_channel/123">
    <div class="tgme_widget_message_text">Первый заголовок<br>Вторая строка новости</div>
    <a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn.example/news.jpg?x=1&amp;y=2')"></a>
    <time datetime="2026-09-20T12:30:00+00:00"></time>
  </div>
</body></html>`;
const parsed = parseTelegramHtml(html, { channelName:'cs2_channel', messageId:'123' });
assert.equal(parsed.title, 'Первый заголовок');
assert.equal(parsed.content, 'Первый заголовок\nВторая строка новости');
assert.equal(parsed.imageUrl, 'https://cdn.example/news.jpg?x=1&y=2');
assert.equal(parsed.publishedAt, '2026-09-20T12:30:00+00:00');

assert.throws(
  () => parseTelegramHtml('<div class="tgme_widget_message" data-post="cs2_channel/124"></div>', { channelName:'cs2_channel', messageId:'123' }),
  (error) => error.code === 'POST_NOT_FOUND'
);
assert.throws(
  () => parseTelegramHtml('<html><body>Channel unavailable</body></html>', { channelName:'cs2_channel', messageId:'123' }),
  (error) => error.code === 'PREVIEW_UNAVAILABLE'
);

console.log('telegram parser tests passed');
