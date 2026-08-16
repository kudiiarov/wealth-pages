import { expect, test, type Page } from '@playwright/test';

async function seedPortfolio(
  page: Page,
  currentTime = Date.now(),
): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await page.evaluate(
    ({ currentTime }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ['accounts', 'assets', 'positions', 'snapshots', 'priceHistory'],
            'readwrite',
          );
          const accounts = transaction.objectStore('accounts');
          const assets = transaction.objectStore('assets');
          const positions = transaction.objectStore('positions');
          const snapshots = transaction.objectStore('snapshots');
          const priceHistory = transaction.objectStore('priceHistory');
          accounts.put({
            id: 'vault',
            name: 'Vault',
            type: 'bank',
            icon: 'V',
            color: '#17181b',
          });
          accounts.put({
            id: 'exchange',
            name: 'Exchange',
            type: 'exchange',
            icon: 'EX',
            color: '#299bc6',
          });
          for (const asset of [
            {
              id: 'btc',
              name: 'Bitcoin',
              code: 'BTC',
              icon: 'B',
              color: '#f5a341',
              price: 100,
              autoUpdateSource: 'coingecko',
              category: 'crypto',
              tags: ['crypto'],
              priceUpdatedAt: currentTime,
            },
            {
              id: 'xaut',
              name: 'Tether Gold',
              code: 'XAUT',
              icon: 'Au',
              color: '#d8a700',
              price: 200,
              autoUpdateSource: 'coingecko',
              category: 'precious-metals',
              tags: ['crypto', 'gold'],
              priceUpdatedAt: currentTime,
            },
            {
              id: 'usd',
              name: 'Dollar',
              code: 'USD',
              icon: '$',
              color: '#5667ff',
              price: 1,
              autoUpdateSource: 'none',
              category: 'cash-currencies',
              tags: ['currency'],
            },
            {
              id: 'eth',
              name: 'Ethereum',
              code: 'ETH',
              icon: 'E',
              color: '#9b63e8',
              price: 50,
              autoUpdateSource: 'coingecko',
              category: 'crypto',
              tags: ['crypto'],
              priceUpdatedAt: currentTime,
            },
            {
              id: 'rub',
              name: 'Ruble',
              code: 'RUB',
              icon: '₽',
              color: '#d76032',
              price: 1 / 86,
              autoUpdateSource: 'frankfurter',
              category: 'cash-currencies',
              tags: ['currency'],
              priceUpdatedAt: currentTime,
            },
          ])
            assets.put(asset);
          for (const position of [
            {
              id: 'btc-vault',
              accountId: 'vault',
              assetId: 'btc',
              quantity: 3,
              comment: '',
            },
            {
              id: 'xaut-vault',
              accountId: 'vault',
              assetId: 'xaut',
              quantity: 1,
              comment: '',
            },
            {
              id: 'usd-vault',
              accountId: 'vault',
              assetId: 'usd',
              quantity: 150,
              comment: '',
            },
            {
              id: 'eth-exchange',
              accountId: 'exchange',
              assetId: 'eth',
              quantity: 1,
              comment: '',
            },
          ])
            positions.put(position);
          snapshots.put({
            id: 'first',
            createdAt: currentTime - 2 * 24 * 60 * 60 * 1_000,
            total: 500.12,
            accounts: [
              { accountId: 'vault', name: 'Vault', total: 460.12 },
              { accountId: 'exchange', name: 'Exchange', total: 40 },
            ],
            assets: [
              { assetId: 'btc', code: 'BTC', value: 240.12, price: 80 },
              { assetId: 'xaut', code: 'XAUT', value: 180, price: 180 },
              { assetId: 'usd', code: 'USD', value: 40, price: 1 },
              { assetId: 'eth', code: 'ETH', value: 40, price: 40 },
            ],
            positions: [
              {
                positionId: 'btc-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'btc',
                assetCode: 'BTC',
                comment: '',
                quantity: 3,
                price: 80,
                value: 240.12,
              },
              {
                positionId: 'xaut-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'xaut',
                assetCode: 'XAUT',
                comment: '',
                quantity: 1,
                price: 180,
                value: 180,
              },
              {
                positionId: 'usd-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'usd',
                assetCode: 'USD',
                comment: '',
                quantity: 40,
                price: 1,
                value: 40,
              },
              {
                positionId: 'eth-exchange',
                accountId: 'exchange',
                accountName: 'Exchange',
                assetId: 'eth',
                assetCode: 'ETH',
                comment: '',
                quantity: 1,
                price: 40,
                value: 40,
              },
            ],
          });
          snapshots.put({
            id: 'second',
            createdAt: currentTime - 24 * 60 * 60 * 1_000,
            total: 620.45,
            accounts: [
              { accountId: 'vault', name: 'Vault', total: 575.45 },
              { accountId: 'exchange', name: 'Exchange', total: 45 },
            ],
            assets: [
              { assetId: 'btc', code: 'BTC', value: 285.45, price: 95 },
              { assetId: 'xaut', code: 'XAUT', value: 195, price: 195 },
              { assetId: 'usd', code: 'USD', value: 95, price: 1 },
              { assetId: 'eth', code: 'ETH', value: 45, price: 45 },
            ],
            positions: [
              {
                positionId: 'btc-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'btc',
                assetCode: 'BTC',
                comment: '',
                quantity: 3,
                price: 95,
                value: 285.45,
              },
              {
                positionId: 'xaut-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'xaut',
                assetCode: 'XAUT',
                comment: '',
                quantity: 1,
                price: 195,
                value: 195,
              },
              {
                positionId: 'usd-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'usd',
                assetCode: 'USD',
                comment: '',
                quantity: 95,
                price: 1,
                value: 95,
              },
              {
                positionId: 'eth-exchange',
                accountId: 'exchange',
                accountName: 'Exchange',
                assetId: 'eth',
                assetCode: 'ETH',
                comment: '',
                quantity: 1,
                price: 45,
                value: 45,
              },
            ],
          });
          for (const [assetId, earlier, later] of [
            ['btc', 80, 95],
            ['xaut', 180, 195],
            ['usd', 1, 1],
            ['eth', 40, 45],
            ['rub', 1 / 80, 1 / 84],
          ] as const) {
            priceHistory.put({
              id: `legacy-price:${assetId}:first`,
              assetId,
              dayKey: 'legacy-first',
              createdAt: currentTime - 2 * 24 * 60 * 60 * 1_000,
              usdPrice: earlier,
            });
            priceHistory.put({
              id: `legacy-price:${assetId}:second`,
              assetId,
              dayKey: 'legacy-second',
              createdAt: currentTime - 24 * 60 * 60 * 1_000,
              usdPrice: later,
            });
          }
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not seed portfolio'));
        };
      }),
    { currentTime },
  );
}

async function seedCurrencyAwarePerformance(
  page: Page,
  includeHistoricalXautQuote = true,
): Promise<void> {
  const now = Date.now();
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await page.evaluate(
    ({ currentTime, hasHistoricalXautQuote }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ['accounts', 'assets', 'positions', 'snapshots', 'priceHistory'],
            'readwrite',
          );
          const accounts = transaction.objectStore('accounts');
          const assets = transaction.objectStore('assets');
          const positions = transaction.objectStore('positions');
          const snapshots = transaction.objectStore('snapshots');
          const priceHistory = transaction.objectStore('priceHistory');
          accounts.put({
            id: 'vault',
            name: 'Vault',
            type: 'bank',
            icon: 'V',
            color: '#17181b',
          });
          for (const asset of [
            {
              id: 'eur',
              name: 'Euro',
              code: 'EUR',
              icon: '€',
              color: '#5667ff',
              price: 1.089,
              autoUpdateSource: 'none',
              category: 'cash-currencies',
              tags: ['currency'],
            },
            {
              id: 'rub',
              name: 'Ruble',
              code: 'RUB',
              icon: '₽',
              color: '#d76032',
              price: 1.089 / 96.8,
              autoUpdateSource: 'none',
              category: 'cash-currencies',
              tags: ['currency'],
            },
            {
              id: 'xaut',
              name: 'Tether Gold',
              code: 'XAUT',
              icon: 'Au',
              color: '#d8a700',
              price: 2.2,
              autoUpdateSource: 'none',
              category: 'precious-metals',
              tags: ['gold'],
            },
          ]) {
            assets.put(asset);
          }
          positions.put({
            id: 'eur-vault',
            accountId: 'vault',
            assetId: 'eur',
            quantity: 50,
            comment: '',
          });
          snapshots.put({
            id: 'currency-performance',
            createdAt: currentTime - 2 * 24 * 60 * 60 * 1_000,
            total: 55,
            accounts: [{ accountId: 'vault', name: 'Vault', total: 55 }],
            assets: [
              { assetId: 'eur', code: 'EUR', value: 55, price: 1.1 },
              { assetId: 'rub', code: 'RUB', value: 0, price: 1.1 / 96.4904 },
              ...(hasHistoricalXautQuote
                ? [
                    {
                      assetId: 'xaut',
                      code: 'XAUT',
                      value: 0,
                      price: 2,
                    },
                  ]
                : []),
            ],
            positions: [
              {
                positionId: 'eur-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'eur',
                assetCode: 'EUR',
                comment: '',
                quantity: 50,
                price: 1.1,
                value: 55,
              },
            ],
          });
          for (const [assetId, usdPrice] of [
            ['eur', 1.1],
            ['rub', 1.1 / 96.4904],
            ...(hasHistoricalXautQuote ? [['xaut', 2]] : []),
          ]) {
            priceHistory.put({
              id: `currency-performance:${assetId}`,
              assetId,
              dayKey: 'currency-performance',
              createdAt: currentTime - 2 * 24 * 60 * 60 * 1_000,
              usdPrice,
            });
          }
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not seed portfolio'));
        };
      }),
    { currentTime: now, hasHistoricalXautQuote: includeHistoricalXautQuote },
  );
}

test('currency-aware performance preserves selected-currency gains and losses', async ({
  page,
}) => {
  await page.goto('/');
  await seedCurrencyAwarePerformance(page);
  await page.reload();

  const currencies: ReadonlyArray<readonly [string, string, string]> = [
    ['RUB', '15,48', '+0.32%'],
    ['USD', '0.55', '−1.00%'],
    ['EUR', '0', '0.00%'],
    ['XAUT', '2,75', '−10.00%'],
  ];
  for (const [code, money, percent] of currencies) {
    await page.locator('#displayCurrencyBtn').click();
    await page.locator(`[data-currency-code="${code}"]`).click();
    await expect(page.locator('#pnlMoney')).toContainText(money);
    await expect(page.locator('#pnlPercent')).toHaveText(percent);
  }

  await page.locator('#displayCurrencyBtn').click();
  await page.locator('[data-currency-code="USD"]').click();
  await page.locator('.tab[data-nav="assetsView"]').click();
  await expect(
    page.locator('[data-asset-open="eur"] .portfolio-row-value small'),
  ).toHaveText('—');
  await page.locator('#assetsView [data-overview-period-toggle]').click();
  await expect(
    page.locator('[data-asset-open="eur"] .portfolio-row-value small'),
  ).toHaveText('−$0.55 · −1.0%');
});

test('currency-aware performance hides values without a historical quote', async ({
  page,
}) => {
  await page.goto('/');
  await seedCurrencyAwarePerformance(page, false);
  await page.reload();

  await page.locator('#displayCurrencyBtn').click();
  await page.locator('[data-currency-code="XAUT"]').click();
  await expect(page.locator('#pnlMoney')).toHaveText('—');
  await expect(
    page.locator('[data-asset-open="eur"] .portfolio-row-value small'),
  ).toHaveText('—');
});

test('deduplicates canonical and persisted USD currency choices', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  await page.locator('#displayCurrencyBtn').click();
  const displayUsd = page.locator('[data-currency-code="USD"]');
  await expect(displayUsd).toHaveCount(1);
  await expect(displayUsd.locator('strong')).toHaveText('Dollar');
  await expect(displayUsd.locator('.currency-option-icon')).toHaveCSS(
    'background-color',
    'rgb(86, 103, 255)',
  );
  await displayUsd.click();

  await page.locator('[data-rate-asset="btc"]').click();
  await page.locator('#entityDetailMenu').click();
  await page.getByRole('button', { name: 'Изменить цену' }).click();
  const priceUsd = page.locator(
    '#priceForm [name="priceCurrency"] option[value="USD"]',
  );
  await expect(priceUsd).toHaveCount(1);
  await expect(priceUsd).toHaveText('$ USD');
});

test('currency-aware performance inspects normalized Home and History values', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  await page.locator('#displayCurrencyBtn').click();
  await page.locator('[data-currency-code="RUB"]').click();
  await page.locator('#homeChart').focus();
  await expect(page.locator('#homeChartTooltip strong')).toHaveText(
    '60 200,00 ₽',
  );

  await page.locator('[data-nav="historyView"]').click();
  await page.locator('#historyChart').focus();
  await expect(page.locator('#historyChartTooltip strong')).toHaveText(
    '52 080,00 ₽',
  );
});

test('keeps self currency price history flat', async ({ page }) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  await page.locator('#displayCurrencyBtn').click();
  await page.locator('[data-currency-code="RUB"]').click();
  await page.goto('/#/assets/rub');

  await expect(
    page.locator('#entityDetailHero > .detail-hero-main > strong'),
  ).toHaveText('1 ₽');
  await expect(page.locator('#entityDetailPriceChange')).toContainText('0 ₽');
  await expect(page.locator('#entityDetailPriceChange')).toContainText('0.0%');
});

test('uses the asset header precision in the price chart tooltip', async ({
  page,
}) => {
  const now = Date.now();
  await page.goto('/');
  await seedPortfolio(page, now);
  await page.evaluate(
    ({ currentTime }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ['assets', 'priceHistory'],
            'readwrite',
          );
          transaction.objectStore('assets').put({
            id: 'cny',
            name: 'Chinese Yuan',
            code: 'CNY',
            icon: '¥',
            color: '#ff4015',
            price: 0.148359,
            autoUpdateSource: 'none',
          });
          for (const [dayKey, createdAt, usdPrice] of [
            ['2026-08-15', currentTime - 86_400_000, 0.1484],
            ['2026-08-16', currentTime, 0.148359],
          ] as const) {
            transaction.objectStore('priceHistory').put({
              id: `cny:${dayKey}`,
              assetId: 'cny',
              dayKey,
              createdAt,
              usdPrice,
            });
          }
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not seed CNY'));
        };
      }),
    { currentTime: now },
  );
  await page.reload();
  await page.goto('/#/assets/cny');

  await expect(
    page.locator('#entityDetailHero > .detail-hero-main > strong'),
  ).toHaveText('$0.1484');
  await page.locator('#entityDetailChart').focus();
  await expect(page.locator('#entityDetailChartTooltip strong')).toHaveText(
    '$0.1484',
  );
});

test('creates entities and opens their dedicated detail screens', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-nav="accountsView"]').click();
  await page.locator('#accountAdd').click();
  await page.locator('#accountForm [name="name"]').fill('Основной счёт');
  await page
    .locator('#accountForm')
    .getByRole('button', { name: 'Создать счёт' })
    .click();
  await expect(page.locator('#accountsList')).toContainText('Основной счёт');

  await page.locator('.tab[data-nav="assetsView"]').click();
  await page.locator('#assetAdd').click();
  await page.locator('#assetForm [name="name"]').fill('Доллар');
  await page.locator('#assetForm [name="code"]').fill('USD');
  await page.locator('#assetForm [name="price"]').fill('1');
  await page
    .locator('#assetForm [name="category"]')
    .selectOption('value:cash-currencies');
  await page
    .locator('#assetForm')
    .getByRole('button', { name: 'Создать актив' })
    .click();

  await page.locator('#assetsList [data-asset-open]').click();
  await expect(page).toHaveURL(/#\/assets\//);
  await expect(page.locator('#entityDetailTitle')).toHaveText('Доллар');
  await expect(page.locator('.tab-bar')).toBeHidden();
  await page.locator('[data-detail-add-position]').click();
  await expect(page.locator('#positionForm [name="assetId"]')).not.toHaveValue(
    '',
  );
  await page.locator('#positionForm [name="quantity"]').fill('140.67');
  await page
    .locator('#positionForm')
    .getByRole('button', { name: 'Сохранить' })
    .click();
  await expect(page.locator('#entityRelatedList')).toContainText(
    'Основной счёт',
  );
  await expect(page.locator('#entityRelatedList')).toContainText('140,67 USD');

  await page.locator('#entityRelatedList [data-position-open]').click();
  await page.locator('[data-position-account-link]').click();
  await expect(page).toHaveURL(/#\/accounts\//);
  await expect(page.locator('#entityDetailTitle')).toHaveText('Основной счёт');
  await expect(page.locator('#entityRelatedList')).toContainText('Доллар');
  await page.locator('[data-detail-back]').click();
  await expect(page).toHaveURL(/#\/assets\//);
  await page.locator('[data-detail-back]').click();
  await expect(page).toHaveURL(/#\/assets$/);
  await expect(page.locator('.tab-bar')).toBeVisible();

  await page.locator('[data-nav="historyView"]').click();
  await expect(page.locator('#historyScope')).toHaveCount(0);
  await page.locator('#saveSnapshotBtnHistory').click();
  await expect(page.locator('#historyList .list-card')).toHaveCount(1);
  await expect(page.locator('#historyList .history-row')).toHaveCount(1);
  const historyMenuBox = await page
    .locator('#historyList [data-snapshot-menu]')
    .boundingBox();
  expect(historyMenuBox?.width).toBeGreaterThanOrEqual(44);
  expect(historyMenuBox?.height).toBeGreaterThanOrEqual(44);
});

test('shows and persists configurable asset pairs that open asset details', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  await expect(page.locator('#portfolioRates .rate-row')).toHaveCount(3);
  const configureBox = await page.locator('#configureRatesBtn').boundingBox();
  expect(configureBox?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('#portfolioRates')).toContainText('Bitcoin');
  await expect(page.locator('#portfolioRates')).toContainText('Tether Gold');
  await expect(page.locator('#portfolioRates')).toContainText('Dollar');
  await expect(page.locator('[data-rate-asset="btc"]')).not.toContainText(
    'BTC',
  );
  await expect(
    page.locator('[data-rate-asset="btc"] .rate-status'),
  ).not.toContainText('Цена актуальна');
  await expect(
    page.locator('[data-rate-asset="btc"] .rate-status .freshness-dot'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-rate-asset="btc"] .rate-status small'),
  ).not.toBeEmpty();
  await expect(page.locator('.exposure-section')).toHaveCount(0);
  const configureStyle = await page
    .locator('#configureRatesBtn')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(configureStyle).toBe('rgba(0, 0, 0, 0)');

  await page.locator('[data-rate-asset="btc"]').click();
  await expect(page).toHaveURL(/#\/assets\/btc$/);
  await expect(page.locator('#entityDetailTitle')).toHaveText('Bitcoin');
  await expect(page.locator('#entityDetailHero')).toContainText('$100.00');
  await expect(page.locator('#entityDetailHero')).not.toContainText(
    'Цена актуальна',
  );
  await page.locator('#entityRelatedList [data-position-open]').first().click();
  await page.locator('[data-position-account-link]').click();
  await expect(page).toHaveURL(/#\/accounts\/vault$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/assets\/btc$/);
  await page.locator('[data-detail-back]').click();
  await expect(page).toHaveURL(/#\/home$/);

  await page.locator('#configureRatesBtn').click();
  const dollarPair = page.locator('.rate-pair-row').filter({
    has: page.locator('[name="rateSource"] option:checked', {
      hasText: 'Dollar',
    }),
  });
  await dollarPair.locator('[name="rateQuote"]').selectOption('rub');
  await page
    .locator('#rateSelectionForm')
    .getByRole('button', { name: 'Сохранить' })
    .click();
  await expect(
    page.locator('[data-rate-asset="usd"] .rate-value'),
  ).toContainText('86');
  await expect(
    page.locator('[data-rate-asset="usd"] .rate-value'),
  ).toContainText('₽');
  await page.reload();
  await expect(
    page.locator('[data-rate-asset="usd"] .rate-value'),
  ).toContainText('86');

  const tabMetrics = await page.locator('.tab-bar').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(tabMetrics.scrollWidth).toBeLessThanOrEqual(tabMetrics.clientWidth);

  await page.locator('#settingsShortcut').click();
  await page.locator('[data-lang-choice="en"]').click();
  await page.locator('[data-nav="homeView"]').click();
  await expect(page.locator('[data-i18n="rates"]')).toHaveText('Rates');
  await expect(
    page.locator('[data-rate-asset="btc"] .rate-status'),
  ).not.toContainText('Price current');
  await page.locator('[data-rate-asset="btc"]').click();
  await expect(page.locator('#entityDetailMenu')).toHaveAttribute(
    'aria-label',
    'Actions',
  );

  await page.goto('/#/assets/rub');
  await expect(page.locator('#entityDetailHero')).toContainText('$0.0116');

  await page.goto('/#/assets/missing');
  await expect(page).toHaveURL(/#\/assets$/);
  await expect(page.locator('#assetsView')).toHaveClass(/active/);
});

test('aligns the Rates and Portfolio structure section gaps', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  const gaps = await page.evaluate(() => {
    const ratesTitle = document.querySelector('.section-heading-row h2');
    const ratesList = document.querySelector('#portfolioRates');
    const structureSection = Array.from(
      document.querySelectorAll('.home-insight-section'),
    ).find((section) => section.querySelector('.structure-panel'));
    const structureTitle = structureSection?.querySelector('h2');
    const structurePanel = structureSection?.querySelector('.structure-panel');
    if (!ratesTitle || !ratesList || !structureTitle || !structurePanel) {
      throw new Error('Missing Home sections');
    }
    return {
      rates:
        ratesList.getBoundingClientRect().top -
        ratesTitle.getBoundingClientRect().bottom,
      structure:
        structurePanel.getBoundingClientRect().top -
        structureTitle.getBoundingClientRect().bottom,
    };
  });
  expect(gaps.rates).toBe(10);
  expect(gaps.rates).toBe(gaps.structure);
});

test('keeps system actions neutral', async ({ page }) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  const systemActionColors = await page
    .locator('#configureRatesBtn, .structure-link')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).color),
    );
  expect(systemActionColors).not.toContain('rgb(86, 103, 255)');

  await page.locator('#displayCurrencyBtn').click();
  const selectedCurrency = page.locator('.currency-option.selected');
  await expect(selectedCurrency).toBeVisible();
  expect(
    await selectedCurrency.evaluate(
      (element) => getComputedStyle(element).boxShadow,
    ),
  ).not.toContain('rgb(86, 103, 255)');
  await expect(selectedCurrency.locator('b')).not.toHaveCSS(
    'color',
    'rgb(86, 103, 255)',
  );
  await page.locator('#currencyModal [data-close]').click();

  await page.locator('#configureRatesBtn').click();
  await expect(page.locator('.rate-pair-add')).not.toHaveCSS(
    'color',
    'rgb(86, 103, 255)',
  );
  await page.locator('#rateSelectionModal [data-close]').click();

  const dormantSystemStyles = await page.evaluate(() => ({
    cancel: getComputedStyle(document.querySelector('.action-cancel')!).color,
    text: getComputedStyle(document.querySelector('.text-button')!).color,
  }));
  expect(Object.values(dormantSystemStyles)).not.toContain('rgb(86, 103, 255)');
});

test('uses neutral focus rings in forms', async ({ page }) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  await page.locator('.tab[data-nav="assetsView"]').click();
  await page.locator('#assetAdd').click();
  const assetName = page.locator('#assetForm [name="name"]');
  await assetName.focus();
  expect(
    await assetName.evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toContain('86, 103, 255');
});

test('freshness and asset headings stay aligned and code-free', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  const rateStatus = page.locator('[data-rate-asset="btc"] .rate-status');
  await expect(rateStatus.locator('.freshness-dot')).toHaveCount(1);
  await expect(rateStatus).toHaveCSS('justify-content', 'flex-start');
  const verticalCenters = await rateStatus.evaluate((status) => {
    const dot = status.querySelector<HTMLElement>('.freshness-dot');
    const text = status.querySelector<HTMLElement>('small');
    if (!dot || !text) throw new Error('Missing freshness content');
    const dotBox = dot.getBoundingClientRect();
    const textBox = text.getBoundingClientRect();
    return {
      dot: dotBox.top + dotBox.height / 2,
      text: textBox.top + textBox.height / 2,
    };
  });
  expect(
    Math.abs(verticalCenters.dot - verticalCenters.text),
  ).toBeLessThanOrEqual(1);

  await page.locator('.tab[data-nav="assetsView"]').click();
  const assetHeading = page.locator(
    '[data-asset-open="btc"] .portfolio-row-main strong',
  );
  await expect(assetHeading).toHaveText('Bitcoin');
  await expect(assetHeading.locator('em')).toHaveCount(0);
});

test('uses one shared overview period action and omits Assets update time', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();
  await page.locator('.tab[data-nav="assetsView"]').click();

  await expect(page.locator('#assetFreshness')).toHaveCount(0);
  await expect(page.locator('#assetsView [data-overview-period]')).toHaveCount(
    0,
  );
  const assetsPeriod = page.locator(
    '#assetsView [data-overview-period-toggle]',
  );
  await expect(assetsPeriod).toHaveCount(1);
  await expect(assetsPeriod).toHaveText('24h');
  const periodBox = await assetsPeriod.boundingBox();
  expect(periodBox?.width).toBeGreaterThanOrEqual(44);
  expect(periodBox?.height).toBeGreaterThanOrEqual(44);
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value small'),
  ).toHaveText('+$15.00 · +5.3%');

  await assetsPeriod.click();
  await expect(assetsPeriod).toHaveText('Всё время');
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value small'),
  ).toHaveText('+$60.00 · +25.0%');

  await page.locator('.tab[data-nav="accountsView"]').click();
  const accountsPeriod = page.locator(
    '#accountsView [data-overview-period-toggle]',
  );
  await expect(accountsPeriod).toHaveCount(1);
  await expect(accountsPeriod).toHaveText('Всё время');
  await expect(
    page.locator('[data-account-open="exchange"] .portfolio-row-value small'),
  ).toHaveText('+$10.00 · +25.0%');

  await accountsPeriod.click();
  await expect(accountsPeriod).toHaveText('24h');
  await expect(
    page.locator('[data-account-open="exchange"] .portfolio-row-value small'),
  ).toHaveText('+$5.00 · +11.1%');
});

test('localizes static accessibility labels in English', async ({ page }) => {
  await page.goto('/');
  await page.locator('#settingsShortcut').click();
  await page.locator('[data-lang-choice="en"]').click();

  await expect(page.locator('#settingsShortcut')).toHaveAttribute(
    'aria-label',
    'Settings',
  );
  await expect(page.locator('#settingsShortcut')).toHaveAttribute(
    'title',
    'Settings',
  );
  await expect(page.locator('#detailPeriods')).toHaveAttribute(
    'aria-label',
    'Price period',
  );
  await expect(
    page.locator('[data-theme-choice="light"]').locator('..'),
  ).toHaveAttribute('aria-label', 'Application theme');
  await expect(page.locator('#priceRefreshIntervalMinutes')).toHaveAttribute(
    'aria-label',
    'Price refresh interval',
  );
  await expect(page.locator('#snapshotIntervalMinutes')).toHaveAttribute(
    'aria-label',
    'Snapshot interval',
  );
  await expect(page.locator('.tab-bar')).toHaveAttribute(
    'aria-label',
    'Navigation',
  );
});

test('matches the approved asset detail hierarchy and header actions', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();
  await page.locator('[data-rate-asset="btc"]').click();

  await expect(
    page.locator('.detail-nav [data-detail-add-position="asset:btc"]'),
  ).toHaveCount(1);
  await expect(page.locator('#entityDetailActions')).toHaveCount(0);
  await expect(page.locator('#entityDetailHero')).toContainText('Bitcoin');
  await expect(page.locator('#entityDetailHero')).toContainText('$100.00');
  await expect(page.locator('#entityDetailPriceChange')).toContainText(
    '+$20.00',
  );
  await expect(page.locator('#entityDetailPriceChange')).toContainText(
    '+25.0%',
  );
  await expect(page.locator('#entityDetailFreshness')).not.toContainText(
    'Цена актуальна',
  );
  await expect(
    page.locator('#entityDetailFreshness .freshness-dot'),
  ).toHaveCount(1);
  await expect(page.locator('#entityDetailFreshness small')).not.toBeEmpty();
  const freshnessWhiteSpace = await page
    .locator('#entityDetailFreshness')
    .evaluate((element) => getComputedStyle(element).whiteSpace);
  expect(freshnessWhiteSpace).toBe('nowrap');
  await expect(page.locator('[data-detail-period]')).toHaveCount(5);
  await page.locator('[data-detail-period="1d"]').click();
  await expect(page.locator('[data-detail-period="1d"]')).toHaveClass(/active/);
  const chartHasCardSurface = await page
    .locator('#entityDetailChartSection')
    .evaluate((element) => element.classList.contains('surface'));
  expect(chartHasCardSurface).toBe(false);
  const chartRadius = await page
    .locator('#entityDetailChart')
    .evaluate((element) => getComputedStyle(element).borderRadius);
  expect(chartRadius).toBe('0px');
  await expect(
    page.locator('#entityDetailMetadata #entityRelatedList'),
  ).toHaveCount(1);
  await expect(page.locator('#entityDetailMetadata')).toContainText(
    '42.9% портфеля',
  );
  await expect(
    page.locator('#entityRelatedList [data-position-open="btc-vault"]'),
  ).toContainText('$300.00');
  await expect(
    page.locator('#entityRelatedList [data-position-open="btc-vault"]'),
  ).toContainText('+$60.00');
  await page
    .locator('#entityRelatedList [data-position-open="btc-vault"]')
    .click();
  await expect(page.locator('#positionModal')).toBeVisible();
  await expect(page.locator('[data-position-asset-link]')).toContainText(
    'Bitcoin',
  );
  await expect(page.locator('[data-position-account-link]')).toContainText(
    'Vault',
  );
  await page.locator('#positionForm [name="quantity"]').fill('4');
  await page
    .locator('#positionForm')
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('#positionModal')).not.toBeVisible();
  await expect(page).toHaveURL(/#\/assets\/btc$/);
  await expect(
    page.locator('#entityRelatedList [data-position-open="btc-vault"]'),
  ).toContainText('$400.00');
  await page
    .locator('.detail-nav [data-detail-add-position="asset:btc"]')
    .click();
  await expect(page.locator('#positionForm [name="assetId"]')).toHaveValue(
    'btc',
  );
});

test('compacts account detail and shows position all-time performance', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();
  await page.goto('/#/accounts/vault');

  const hero = page.locator('#entityDetailHero');
  await expect(hero).toContainText('Vault');
  await expect(hero).not.toContainText('Банк');
  await expect(hero).toContainText('за всё время');
  const bitcoin = page.locator(
    '#entityRelatedList [data-position-open="btc-vault"]',
  );
  await expect(bitcoin).toContainText('$300.00');
  await expect(bitcoin.locator('b small')).toHaveText('+$60.00 · +25.0%');

  for (const id of ['entityDetailAdd', 'entityDetailMenu']) {
    const button = page.locator(`#${id}`);
    const geometry = await button.evaluate((element) => {
      const icon = element.querySelector('svg');
      if (!icon) throw new Error('Missing action icon');
      const buttonBox = element.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      return {
        width: buttonBox.width,
        height: buttonBox.height,
        centerDeltaX: Math.abs(
          buttonBox.left +
            buttonBox.width / 2 -
            (iconBox.left + iconBox.width / 2),
        ),
        centerDeltaY: Math.abs(
          buttonBox.top +
            buttonBox.height / 2 -
            (iconBox.top + iconBox.height / 2),
        ),
      };
    });
    expect(geometry.width).toBe(48);
    expect(geometry.height).toBe(48);
    expect(geometry.centerDeltaX).toBeLessThanOrEqual(0.5);
    expect(geometry.centerDeltaY).toBeLessThanOrEqual(0.5);
    await expect(button).toHaveCSS('border-radius', '50%');
  }

  await bitcoin.click();
  await expect(page.locator('#positionModal')).toBeVisible();
});

test('keeps account position performance honest across display states', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();
  await page.goto('/#/accounts/vault');

  const bitcoinPnl = () =>
    page.locator('#entityRelatedList [data-position-open="btc-vault"] b small');
  await expect(bitcoinPnl()).toHaveText('+$60.00 · +25.0%');

  await page.locator('[data-detail-back]').click();
  await page.locator('#displayCurrencyBtn').click();
  await page.locator('[data-currency-code="RUB"]').click();
  await page.locator('[data-account-open="vault"]').click();
  await expect(bitcoinPnl()).toHaveText('+6 600 ₽ · +34.4%');

  await page.locator('[data-detail-back]').click();
  await page.locator('#settingsShortcut').click();
  await page.locator('[data-lang-choice="en"]').click();
  await page.locator('.tab[data-nav="accountsView"]').click();
  await page.locator('[data-account-open="vault"]').click();
  await expect(page.locator('#entityDetailHero')).toContainText('all time');
  await expect(bitcoinPnl()).toContainText('%');

  await page.locator('[data-detail-back]').click();
  await page.locator('.tab[data-nav="homeView"]').click();
  await page.locator('#privacyToggle').click();
  await page.locator('.tab[data-nav="accountsView"]').click();
  await page.locator('[data-account-open="vault"]').click();
  await expect(bitcoinPnl()).toContainText('•••• ·');
  await expect(bitcoinPnl()).toContainText('%');

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('snapshots', 'readwrite');
          transaction.objectStore('snapshots').clear();
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not clear snapshots'));
        };
      }),
  );
  await page.reload();
  await expect(bitcoinPnl()).toHaveText('—');
});

test('summarizes the four largest assets and accounts without search controls', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ['accounts', 'assets', 'positions'],
            'readwrite',
          );
          for (let index = 1; index <= 4; index += 1) {
            transaction.objectStore('accounts').put({
              id: `extra-account-${index}`,
              name: `Extra account ${index}`,
              type: 'bank',
              icon: String(index),
              color: `hsl(${index * 45} 60% 48%)`,
            });
            transaction.objectStore('assets').put({
              id: `extra-asset-${index}`,
              name: `Extra asset ${index}`,
              code: `E${index}`,
              icon: String(index),
              color: `hsl(${index * 45} 60% 48%)`,
              price: 1,
              autoUpdateSource: 'none',
              category: 'other',
              tags: [],
            });
            transaction.objectStore('positions').put({
              id: `extra-position-${index}`,
              accountId: `extra-account-${index}`,
              assetId: `extra-asset-${index}`,
              quantity: 10 + index,
              comment: '',
            });
          }
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not extend seed'));
        };
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
      }),
  );
  await page.reload();

  await page.locator('.tab[data-nav="assetsView"]').click();
  await expect(page.locator('#assetSearch')).toHaveCount(0);
  await expect(page.locator('#portfolioFilters')).toHaveCount(0);
  await expect(
    page.locator('#assetAllocationList .compact-allocation-key'),
  ).toHaveCount(5);
  await expect(page.locator('#assetAllocationList')).toContainText('Другое');
  await expect(page.locator('#assetsList .portfolio-row')).toHaveCount(9);
  const assetAllocationOrder = await page.evaluate(() => ({
    metricsBottom: document
      .querySelector('#assetAllocationSummary .allocation-metrics')!
      .getBoundingClientRect().bottom,
    barTop: document
      .getElementById('assetAllocationBar')!
      .getBoundingClientRect().top,
  }));
  expect(assetAllocationOrder.metricsBottom).toBeLessThan(
    assetAllocationOrder.barTop,
  );

  await page.locator('[data-nav="accountsView"]').click();
  await expect(page.locator('#accountSearch')).toHaveCount(0);
  await expect(page.locator('#accountAllocationTotal')).toContainText(
    '$750.00',
  );
  await expect(page.locator('#accountAllocationCount')).toContainText(
    '6 счетов',
  );
  await expect(
    page.locator('#accountAllocationList .compact-allocation-key'),
  ).toHaveCount(5);
  await expect(page.locator('#accountAllocationList')).toContainText(
    'Остальные 2 счёта',
  );
  await expect(page.locator('#accountAllocationSummary')).toHaveClass(
    /surface/,
  );
  const allocationRadius = await page
    .locator('#accountAllocationSummary')
    .evaluate((element) => getComputedStyle(element).borderRadius);
  expect(allocationRadius).toBe('20px');
  await expect(page.locator('#allAccountsTitle')).toHaveText('Все счета');
  await expect(page.locator('#accountsList > .portfolio-row')).toHaveCount(6);
  await expect(page.locator('#accountsList .holding-summary')).toHaveCount(0);
  const listSurfaces = await page.evaluate(() => {
    const asset = document.querySelector<HTMLElement>(
      '#assetsList > .portfolio-row',
    )!;
    const account = document.querySelector<HTMLElement>(
      '#accountsList > .portfolio-row',
    )!;
    const accountsList = document.getElementById('accountsList')!;
    return {
      assetRadius: getComputedStyle(asset).borderRadius,
      accountRadius: getComputedStyle(account).borderRadius,
      accountsGap: getComputedStyle(accountsList).gap,
      accountsTopBorder: getComputedStyle(accountsList).borderTopWidth,
      accountHeight: account.getBoundingClientRect().height,
      accountIcon: account
        .querySelector<HTMLElement>('.portfolio-row-icon')!
        .getBoundingClientRect().width,
      accountName: Number.parseFloat(
        getComputedStyle(
          account.querySelector<HTMLElement>('.portfolio-row-main strong')!,
        ).fontSize,
      ),
      accountValue: Number.parseFloat(
        getComputedStyle(
          account.querySelector<HTMLElement>('.portfolio-row-value strong')!,
        ).fontSize,
      ),
    };
  });
  expect(listSurfaces.accountRadius).toBe(listSurfaces.assetRadius);
  expect(listSurfaces.accountsGap).not.toBe('0px');
  expect(listSurfaces.accountsTopBorder).toBe('0px');
  expect(listSurfaces.accountHeight).toBeGreaterThanOrEqual(68);
  expect(listSurfaces.accountHeight).toBeLessThanOrEqual(72);
  expect(listSurfaces.accountIcon).toBe(46);
  expect(listSurfaces.accountName).toBe(16);
  expect(listSurfaces.accountValue).toBe(15);

  const accountLayout = await page.evaluate(() => ({
    overline: document
      .querySelector('#accountsView .overline')!
      .getBoundingClientRect().top,
    add: document.getElementById('accountAdd')!.getBoundingClientRect().top,
    metrics: document
      .getElementById('accountAllocationTotal')!
      .getBoundingClientRect().top,
    allocation: document
      .getElementById('accountAllocationSummary')!
      .getBoundingClientRect().top,
    listTitle: document
      .getElementById('allAccountsTitle')!
      .getBoundingClientRect().top,
  }));
  expect(Math.abs(accountLayout.add - accountLayout.overline)).toBeLessThan(20);
  expect(accountLayout.metrics).toBeGreaterThan(accountLayout.allocation);
  expect(accountLayout.allocation).toBeLessThan(accountLayout.listTitle);
  const accountAllocationOrder = await page.evaluate(() => ({
    metricsBottom: document
      .querySelector('#accountAllocationSummary .allocation-metrics')!
      .getBoundingClientRect().bottom,
    barTop: document
      .getElementById('accountAllocationBar')!
      .getBoundingClientRect().top,
  }));
  expect(accountAllocationOrder.metricsBottom).toBeLessThan(
    accountAllocationOrder.barTop,
  );
});

test('overview period updates row performance without changing totals or allocation', async ({
  page,
}) => {
  const fixedNow = new Date(2026, 7, 15, 12, 0, 0, 0).getTime();
  await page.clock.setFixedTime(fixedNow);
  await page.goto('/');
  await seedPortfolio(page, fixedNow);
  await page.evaluate(
    ({ currentTime }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('snapshots', 'readwrite');
          transaction.objectStore('snapshots').put({
            id: 'today-is-not-a-baseline',
            createdAt: currentTime,
            total: 9_999,
            accounts: [
              { accountId: 'vault', name: 'Vault', total: 9_000 },
              { accountId: 'exchange', name: 'Exchange', total: 999 },
            ],
            assets: [
              { assetId: 'btc', code: 'BTC', value: 3, price: 1 },
              { assetId: 'xaut', code: 'XAUT', value: 1, price: 1 },
              { assetId: 'usd', code: 'USD', value: 150, price: 1 },
              { assetId: 'eth', code: 'ETH', value: 1, price: 1 },
            ],
            positions: [
              {
                positionId: 'btc-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'btc',
                assetCode: 'BTC',
                comment: '',
                quantity: 3,
                price: 1,
                value: 3,
              },
              {
                positionId: 'xaut-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'xaut',
                assetCode: 'XAUT',
                comment: '',
                quantity: 1,
                price: 1,
                value: 1,
              },
              {
                positionId: 'usd-vault',
                accountId: 'vault',
                accountName: 'Vault',
                assetId: 'usd',
                assetCode: 'USD',
                comment: '',
                quantity: 150,
                price: 1,
                value: 150,
              },
              {
                positionId: 'eth-exchange',
                accountId: 'exchange',
                accountName: 'Exchange',
                assetId: 'eth',
                assetCode: 'ETH',
                comment: '',
                quantity: 1,
                price: 1,
                value: 1,
              },
            ],
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not save snapshot'));
        };
      }),
    { currentTime: fixedNow - 60 * 60 * 1_000 },
  );
  await page.reload();
  await page.locator('.tab[data-nav="assetsView"]').click();

  const overviewSummaries = await page.evaluate(() => {
    const summary = (totalId: string, barId: string) => ({
      total: document.getElementById(totalId)!.textContent,
      widths: Array.from(
        document.querySelectorAll<HTMLElement>(`#${barId} span`),
        ({ style }) => style.width,
      ),
    });
    return {
      assets: summary('assetAllocationTotal', 'assetAllocationBar'),
      accounts: summary('accountAllocationTotal', 'accountAllocationBar'),
    };
  });
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value small'),
  ).toHaveText('+$15.00 · +5.3%');
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value strong'),
  ).toHaveText('$300.00');

  await page.locator('#assetsView [data-overview-period-toggle]').click();
  await expect(
    page.locator('#assetsView [data-overview-period-toggle]'),
  ).toHaveText('Всё время');
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value small'),
  ).toHaveText('+$60.00 · +25.0%');
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value strong'),
  ).toHaveText('$300.00');
  await expect(page.locator('#assetAllocationTotal')).toHaveText(
    overviewSummaries.assets.total ?? '',
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>('#assetAllocationBar span'),
          ({ style }) => style.width,
        ),
      ),
    )
    .toEqual(overviewSummaries.assets.widths);

  await page.locator('.tab[data-nav="accountsView"]').click();
  await expect(
    page.locator('#accountsView [data-overview-period-toggle]'),
  ).toHaveText('Всё время');
  await expect(
    page.locator('[data-account-open="exchange"] .portfolio-row-value small'),
  ).toHaveText('+$10.00 · +25.0%');
  await expect(
    page.locator('[data-account-open="exchange"] .portfolio-row-value strong'),
  ).toHaveText('$50.00');
  await expect(page.locator('#accountAllocationTotal')).toHaveText(
    overviewSummaries.accounts.total ?? '',
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>('#accountAllocationBar span'),
          ({ style }) => style.width,
        ),
      ),
    )
    .toEqual(overviewSummaries.accounts.widths);

  await page.locator('[data-nav="homeView"]').click();
  await page.locator('#privacyToggle').click();
  await page.locator('[data-nav="accountsView"]').click();
  await expect(
    page.locator('[data-account-open="exchange"] .portfolio-row-value small'),
  ).toHaveText('•••• · +25.0%');
});

test('keeps Home, overview rows, and entity detail performance periods independent', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  await expect(page.locator('#pnlMoney')).toHaveText('+$90.00');
  await expect(page.locator('#pnlPercent')).toHaveText('+14.75%');
  await page.locator('[data-home-period="1d"]').click();
  await expect(page.locator('#pnlMoney')).toHaveText('+$25.00');
  await expect(page.locator('#pnlPercent')).toHaveText('+3.70%');

  await page.locator('.tab[data-nav="assetsView"]').click();
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value small'),
  ).toHaveText('+$15.00 · +5.3%');
  await page.locator('#assetsView [data-overview-period-toggle]').click();
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value small'),
  ).toHaveText('+$60.00 · +25.0%');

  await page.locator('[data-nav="homeView"]').click();
  await expect(page.locator('[data-home-period="1d"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#pnlMoney')).toHaveText('+$25.00');
  await expect(page.locator('#pnlPercent')).toHaveText('+3.70%');
  await page.locator('[data-home-period="all"]').click();

  await page.locator('.tab[data-nav="assetsView"]').click();
  await expect(
    page.locator('#assetsView [data-overview-period-toggle]'),
  ).toHaveText('Всё время');
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value small'),
  ).toHaveText('+$60.00 · +25.0%');
  await page.locator('[data-asset-open="btc"]').click();
  await expect(page.locator('#entityHoldingSummary')).toContainText('+$60.00');
  await expect(page.locator('#entityHoldingSummary')).toContainText('+25.0%');

  await page.locator('[data-detail-back]').click();
  await page.locator('.tab[data-nav="accountsView"]').click();
  await expect(
    page.locator('[data-account-open="exchange"] .portfolio-row-value small'),
  ).toHaveText('+$10.00 · +25.0%');
  await page.locator('[data-account-open="exchange"]').click();
  await expect(
    page.locator('#entityDetailHero > .detail-hero-main > small'),
  ).toContainText('+$10.00 · +25.0%');
});

test('overview period shows a dash when no eligible 24 hour baseline exists', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('snapshots', 'readwrite');
          transaction.objectStore('snapshots').clear();
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not clear snapshots'));
        };
      }),
  );
  await page.reload();
  await page.locator('.tab[data-nav="assetsView"]').click();
  await expect(
    page.locator('#assetsView [data-overview-period-toggle]'),
  ).toHaveText('24h');
  await expect(
    page.locator('[data-asset-open="btc"] .portfolio-row-value small'),
  ).toHaveText('—');
});

test('requires two historical prices before drawing an asset chart', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('priceHistory', 'readwrite');
          const prices = transaction.objectStore('priceHistory');
          const firstPrice = prices.get('legacy-price:btc:first');
          firstPrice.onsuccess = () => {
            prices.clear();
            prices.put(firstPrice.result);
          };
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not update history'));
        };
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
      }),
  );
  const priceCount = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 2);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('priceHistory', 'readonly');
          const count = transaction.objectStore('priceHistory').count();
          count.onsuccess = () => {
            database.close();
            resolve(count.result);
          };
          count.onerror = () =>
            reject(count.error ?? new Error('Could not count prices'));
        };
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
      }),
  );
  expect(priceCount).toBe(1);
  await page.reload();
  await page.locator('.tab[data-nav="assetsView"]').click();
  await page.locator('[data-asset-open="btc"]').click();
  await expect(page.locator('#entityDetailEmpty')).toBeVisible();
});

test('inspects exact portfolio and entity history with pointer, touch, and keyboard', async ({
  page,
}) => {
  await page.goto('/');
  await seedPortfolio(page);
  await page.reload();

  const homeCanvas = page.locator('#homeChart');
  await homeCanvas.focus();
  await expect(page.locator('#homeChartTooltip')).toContainText('$700.00');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#homeChartTooltip')).toContainText('$620.00');

  await page.locator('[data-rate-asset="btc"]').click();
  const detailCanvas = page.locator('#entityDetailChart');
  await expect(page.locator('#entityDetailHero')).toContainText('$100.00');
  await expect(page.locator('#entityDetailHero')).not.toContainText(
    'Цена актуальна',
  );
  await expect(page.locator('#entityDetailMetadata')).toContainText(
    'Ваш портфель',
  );
  await expect(page.locator('#entityDetailMetadata')).toContainText('42.9%');
  await detailCanvas.focus();
  await expect(page.locator('#entityDetailChartTooltip')).toContainText(
    '$95.00',
  );
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#entityDetailChartTooltip')).toContainText(
    '$80.00',
  );
  const detailBox = await detailCanvas.boundingBox();
  if (!detailBox) throw new Error('Detail chart is not visible');
  await detailCanvas.dispatchEvent('pointermove', {
    pointerId: 7,
    pointerType: 'touch',
    buttons: 1,
    clientX: detailBox.x + 6,
    clientY: detailBox.y + detailBox.height / 2,
  });
  await expect(page.locator('#entityDetailChartTooltip')).toContainText(
    '$80.00',
  );
  await detailCanvas.dispatchEvent('pointercancel', {
    pointerId: 7,
    pointerType: 'touch',
  });
  await expect(page.locator('#entityDetailChartTooltip')).toBeHidden();

  await page.locator('#entityRelatedList [data-position-open]').first().click();
  await page.locator('[data-position-account-link]').click();
  await expect(page).toHaveURL(/#\/accounts\/vault$/);
  await expect(page.locator('#entityDetailChartSection')).toBeHidden();
  await expect(page.locator('#entityDetailHero')).toContainText('$650.00');
  await expect(page.locator('#entityRelatedList')).toContainText('Bitcoin');
  await page.locator('[data-detail-back]').click();

  await page.locator('[data-detail-back]').click();
  await page.locator('[data-nav="historyView"]').click();
  await expect(page.locator('#historyScope')).toHaveCount(0);
  const historyCanvas = page.locator('#historyChart');
  const historyBox = await historyCanvas.boundingBox();
  if (!historyBox) throw new Error('History chart is not visible');
  await page.mouse.move(
    historyBox.x + historyBox.width - 10,
    historyBox.y + historyBox.height / 2,
  );
  await expect(page.locator('#historyChartTooltip')).toContainText('$620.00');
  await expect(page.locator('#historyChartTooltip')).toContainText(
    'Vault • +55USD • +$55',
  );
  await historyCanvas.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#historyChartTooltip')).toContainText('$500.00');

  await page.locator('[data-nav="homeView"]').click();
  await page.locator('#privacyToggle').click();
  await expect(
    page.locator('[data-rate-asset="btc"] .rate-value'),
  ).toContainText('••••');
});
