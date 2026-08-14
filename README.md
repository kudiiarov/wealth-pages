# Worth — локальный трекер портфеля

Mobile-first PWA для личных финансов. Сервер и регистрация не нужны: финансовые данные хранятся в IndexedDB браузера.

## Что есть
- счета: наличные, банк, биржа, криптокошелёк, долг, другое;
- активы с ручной ценой в RUB;
- один актив может находиться на нескольких счетах;
- позиции и количества, включая отрицательные значения;
- общий баланс и распределение активов;
- массовое обновление цен и количеств;
- ручные снимки портфеля;
- график истории;
- экспорт и импорт JSON;
- PWA/service worker для установки на Home Screen и офлайн-запуска после первой загрузки.

## Проверки сборки
- `node --check app.js`
- `node --check core.js`
- `node tests.js` — 11 assertions для расчётов и backup validation
- статическая проверка всех ссылок на файлы и 33 DOM id, используемых приложением

## Локальный запуск
```bash
python3 -m http.server 8080
```
Открыть `http://localhost:8080`.

## GitHub Pages
Загрузить содержимое этой папки в корень репозитория. Settings → Pages → Deploy from a branch → main / root.

На iPhone открыть HTTPS-адрес Pages в Safari → Поделиться → На экран «Домой».

Важно: удаление данных Safari/сайта удалит IndexedDB. Делайте Export перед очисткой браузера или переносом телефона.


## Базовая валюта
Все цены активов и итоговые суммы считаются в USD ($).


## Версия 1.1
- Уникальный `code` для активов (`symbol` мигрируется автоматически)
- Иконки и цвета для активов и счетов
- Иконка актива 1–5 символов с адаптивным размером
- RUB-эквивалент общего баланса по активу с `code = RUB`
- JSON export schema version 3; старые backup-файлы поддерживаются


## 1.6-final
- Точная версия приложения отображается в настройках.
- Глобальная валюта отображения: USD или любой актив с ненулевой USD-ценой.
- Выбор валюты применяется ко всем вкладкам и истории.
- Счета на главной раскрываются по нажатию и показывают активы внутри.
- Убран RUB-подбаланс и режим скрытия сумм.
- График истории получил числовую ось, сетку, точки и подписи значений.
- Верхняя правая кнопка открывает настройки.
- Светлая/тёмная тема сохраняется локально.

## 1.7-final
- График: компактная шкала K/M/B и динамический левый отступ.
- Позиции: необязательный comment; старые данные получают пустую строку.
- Активы раскрываются по клику, как счета.
- JSON schema version 5.


## 1.8-final
- Комментарии показываются в раскрытых позициях внутри счетов на главной.
- В настройки возвращены экспорт JSON, импорт JSON и полное удаление локальных данных.
- Настройки убраны из нижней навигации и открываются только верхней кнопкой.
- JSON schema version 6; старые backup-файлы совместимы.


## 1.9-final
- В раскрытом счёте комментарий позиции теперь стоит справа от кода: `CNY • На машину`.
- Быстрая кнопка «История» убрана с главного экрана; история остаётся в нижнем меню.
- Массовое обновление переделано в мобильные карточки по активам: цена отдельно, остатки по счетам отдельно.
- Кнопка сохранения массового обновления закреплена внизу формы.
- JSON schema version 7; обратная совместимость сохранена.

## 2.0-final
- История теперь по конкретным позициям, не по счетам.
- Новые snapshots содержат positions[] с идентификатором позиции, счетом, активом, количеством, ценой, комментарием и стоимостью.
- Общая история старых snapshots остается совместимой; история позиции начинается с snapshots 2.0-final.
- Массовое обновление после сохранения закрывает панель и показывает подтверждение.
- Добавлены русский и английский интерфейсы, язык сохраняется локально.
- JSON schema version 8.


## 2.0.1-final
- Multiple positions with the same asset are now allowed inside the same account.
- `accountId + assetId` is no longer treated as unique.
- Creating a position always creates a new `positionId`.
- Editing updates only the selected position by its existing `positionId`.
- Position-level history remains independent for each position.
- JSON schema version 9; old backups remain compatible.


## 2.1-final
- Added “Refresh asset prices” to Settings and each asset action menu.
- Fiat prices use Frankfurter latest rates with USD base; stored asset price is USD per 1 asset unit.
- Supported crypto codes use CoinGecko keyless simple price API.
- Unknown asset codes are skipped rather than guessed.
- Automatic updates persist `priceSource` and `priceUpdatedAt` in the asset JSON automatically.
- Completed additional EN localization, including the display-currency selector and dynamic option labels.
- JSON schema version 10; old backups remain compatible.
