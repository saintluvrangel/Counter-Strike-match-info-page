# CS match UI

Одностраничный макет матча Counter-Strike с картами и игровыми данными.

## Структура

```text
css/style.css                  — общие стили и адаптивность
js/services/auth-api.js        — mock API авторизации (граница будущего backend)
js/services/matches-api.js     — mock API каталога матчей
js/services/news-api.js        — mock API новостей и Telegram-парсинга
js/auth.js                     — сессия, роли и проверка прав
js/config/radar-config.js      — overview-параметры карт
js/data/match-data.js          — данные текущего матча
js/data/hltv-match-data.js     — каталог реальных матчей, составы, карты и HLTV-ассеты
js/data/mock-map-coordinates.js — mock-маршруты T/CT для каждой radar-карты
lib/liquipedia.js              — клиент открытого MediaWiki API, очередь и кэш
lib/mediawiki-matches.js       — разбор таблиц матчей из ответа API
lib/analytics.js               — нормализация и расчёт аналитики
types/analytics.ts             — TypeScript-контракты аналитики
js/components/minimap.js       — преобразование координат и маркеры
js/views/match-view.js         — компоненты и состояние экрана матча
js/views/analytics-view.js     — отдельный экран аналитики матча
js/matches.js                  — каталог, detail-routing и аналитика внутри матча
js/news.js                     — лента и редактор новостей
js/telegram-parser.js          — серверный парсер публичных Telegram preview
js/gsi-generator.js            — генератор CS2 GSI KeyValues-конфига
js/main.js                     — запуск, защищённый hash-routing и RBAC-навигация
server.js                      — статический HTTP-сервер и endpoint /api/telegram/parse
tests/minimap.test.js          — тест преобразования координат
tests/auth-gsi.test.js         — тесты mock-сессии и генератора конфига
tests/content.test.js          — тесты каталога матчей и news API
```

## Тестовые аккаунты

```text
root@cs2.com  / root   — полный доступ
admin@cs2.com / admin  — матчи, аналитика, редактирование и GSI
media@cs2.com / media  — матчи, аналитика и управление новостями
```

Сессия хранится в `sessionStorage`. `AuthApi` изолирует mock-реализацию и может быть заменён реальными HTTP-запросами без изменения UI/RBAC-контроллера.

## Проверка

```powershell
node tests/minimap.test.js
node tests/auth-gsi.test.js
node tests/content.test.js
node tests/telegram-parser.test.js
```

## Запуск с Telegram-парсером

```powershell
npm install
npm start
```

Если в окружении используется pnpm, эквивалентные команды — `pnpm install` и `pnpm start`. Откройте `http://127.0.0.1:3000`. Парсинг выполняется на сервере через публичные страницы `t.me/s/...`; Bot API, MTProto, API-ключи и номер телефона не используются.

## Маршруты

```text
#matches          — каталог матчей
#match/{id}       — детальный дашборд
#match/{id}/analytics — аналитика матча
#news             — новости
#gsi              — GSI/API-настройки для root и admin
```

## Liquipedia analytics

Ключ и заявка не нужны: сервер обращается к `https://liquipedia.net/counterstrike/api.php` через `action=query` и `action=parse`. Контакт для User-Agent по умолчанию — URL проекта из `package.json`; при необходимости задайте `LIQUIPEDIA_CONTACT` в `.env`. Браузер обращается только к `/api/matches/{id}/analytics`. Ответы кэшируются в `.private-data/liquipedia-mediawiki-cache` минимум на час. Очередь выдерживает интервал 2 секунды между запросами и 30 секунд между `action=parse` (первое открытие двух ещё не кэшированных страниц может занять более 30 секунд).

Из открытой таблицы `/Matches` берутся дата, соперник, счёт, результат и турнир. Отдельных ссылок на каждый матч, Rating 2.x, K/D, ADR и KAST в этой таблице нет; интерфейс не подставляет их из другого источника. Оценка шансов использует явные веса: 50% последние 10 матчей (с весом свежести), 25% очные встречи, 15% рейтинг, 10% форма на турнире; отсутствующие показатели исключаются, остальные веса нормализуются. Это эвристическая оценка, не букмекерский коэффициент.

Radar assets and overview configuration were extracted from the locally installed game with [Source 2 Viewer](https://s2v.app) ([ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat)).

Каталог содержит матчи StarLadder StarSeries Fall 2026 и восстановленный пример Nuclear TigeRES — K27 с составами, картами, результатами, логотипами и player bodyshots. Для Dust2, Inferno, Anubis, Mirage, Nuke и Cache подключены отдельные mock-маршруты: по пять траекторий для T и CT. Модуль можно заменить источником demo parser/GSI без изменения компонента карты.
