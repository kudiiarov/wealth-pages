import { expect, test } from '@playwright/test';

test('creates and persists a portfolio, snapshot, and backup', async ({
  page,
}) => {
  await page.goto('/');

  await page.locator('.tab[data-nav="positionsView"]').click();
  await page.locator('[data-portfolio-add]').click();
  await page
    .locator('#actionMenuItems')
    .getByText('Счёт', { exact: true })
    .click();
  await page.locator('#accountForm [name="name"]').fill('Основной счёт');
  await page
    .locator('#accountForm')
    .getByRole('button', { name: 'Создать счёт' })
    .click();
  await page.locator('[data-portfolio-mode="accounts"]').click();
  await expect(page.locator('#positionsList')).toContainText('Основной счёт');

  await page.locator('[data-portfolio-add]').click();
  await page
    .locator('#actionMenuItems')
    .getByText('Актив', { exact: true })
    .click();
  await page.locator('#assetForm [name="name"]').fill('Доллар');
  await page.locator('#assetForm [name="code"]').fill('USD');
  await page.locator('#assetForm [name="price"]').fill('1');
  await page
    .locator('#assetForm [name="category"]')
    .selectOption('cash-currencies');
  await page
    .locator('#assetForm .taxonomy-tag')
    .filter({ hasText: 'Валюты' })
    .click();
  await page.locator('#assetForm [name="customTags"]').fill('Резерв');
  await page
    .locator('#assetForm')
    .getByRole('button', { name: 'Создать актив' })
    .click();

  await page.locator('[data-portfolio-add]').click();
  await page
    .locator('#actionMenuItems')
    .getByText('Позиция', { exact: true })
    .click();
  await page.locator('#positionForm [name="quantity"]').fill('100');
  await page.locator('#positionForm [name="comment"]').fill('Резерв');
  await page
    .locator('#positionForm')
    .getByRole('button', { name: 'Сохранить' })
    .click();

  await expect(page.locator('#homeTitle')).toHaveText('$100.00');
  await page.locator('[data-portfolio-mode="assets"]').click();
  await expect(page.locator('#positionsList')).toContainText('Доллар');
  await expect(page.locator('#positionsList')).toContainText('Деньги и валюты');
  await page
    .locator('#positionsList .portfolio-explorer-group')
    .filter({ hasText: 'Доллар' })
    .locator('.portfolio-row')
    .click();
  await page
    .locator('#positionsList .portfolio-explorer-group')
    .filter({ hasText: 'Доллар' })
    .locator('.portfolio-position-row')
    .click();
  await page
    .locator('#actionMenuItems')
    .getByText('Изменить позицию', { exact: true })
    .click();
  await page.locator('#positionForm [name="comment"]').fill('Резерв обновлён');
  await page
    .locator('#positionForm')
    .getByRole('button', { name: 'Сохранить' })
    .click();
  await page.locator('#positionsList .portfolio-position-row').click();
  await page
    .locator('#actionMenuItems')
    .getByText('Изменить позицию', { exact: true })
    .click();
  await expect(page.locator('#positionForm [name="comment"]')).toHaveValue(
    'Резерв обновлён',
  );
  await page.locator('[data-close="positionModal"]').click();
  await page.locator('#portfolioSearch').fill('USD');
  await expect(page.locator('#positionsList .portfolio-row')).toHaveCount(1);
  await page.locator('#portfolioSearch').fill('');
  await page.locator('[data-portfolio-filter="currency"]').click();
  await expect(page.locator('#positionsList')).toContainText('Доллар');
  await expect(page.locator('[data-portfolio-filter="Резерв"]')).toBeVisible();
  await page.locator('#portfolioSearch').fill('BTC');
  await page.locator('[data-nav="homeView"]').click();
  await expect(page.locator('#categoryAllocationList')).toContainText(
    'Деньги и валюты',
  );
  await page
    .locator('#categoryAllocationList [data-category-filter="cash-currencies"]')
    .click();
  await expect(page.locator('#portfolioSearch')).toHaveValue('');
  await expect(page.locator('#positionsList')).toContainText('Доллар');
  await page.locator('.tab[data-nav="homeView"]').click();
  await page.locator('#privacyToggle').click();
  await expect(page.locator('#homeTitle')).toHaveText('••••');
  await page.reload();
  await expect(page.locator('#homeTitle')).toHaveText('••••');
  await page.locator('#privacyToggle').click();
  await expect(page.locator('#homeTitle')).toHaveText('$100.00');
  await page.locator('[data-nav="historyView"]').click();
  await page.locator('#saveSnapshotBtnHistory').click();
  await expect(page.locator('#toast')).toContainText('Снимок');

  await page.reload();
  await expect(page.locator('#homeTitle')).toHaveText('$100.00');
  await page.locator('.tab[data-nav="positionsView"]').click();
  await page.locator('[data-portfolio-mode="accounts"]').click();
  await expect(page.locator('#positionsList')).toContainText('Основной счёт');

  const accountGroup = page
    .locator('#positionsList .portfolio-explorer-group')
    .filter({ hasText: 'Основной счёт' });
  await accountGroup.locator('.portfolio-row').click();
  await expect(accountGroup.locator('.portfolio-position-icon')).toHaveText(
    'USD',
  );
  await expect(accountGroup.locator('.portfolio-position-row')).toContainText(
    '100 USD',
  );
  await expect(
    accountGroup.locator('.portfolio-position-row'),
  ).not.toContainText('$100.00');

  await page.locator('#settingsShortcut').click();
  await page.locator('#refreshPricesBtn').click();
  await expect(page.locator('#toast')).toContainText(
    'Нет активов с доступным автоматическим источником цены',
  );
  await page.locator('#diagnosticsBtn').click();
  await expect(page.locator('#diagnosticsModal')).toBeVisible();
  await expect(page.locator('#diagnosticsModal')).toContainText(
    'Журнал событий',
  );
  await expect(page.locator('#diagnosticsList')).toContainText(
    'prices.refresh.completed',
  );
  await expect(page.locator('#copyDiagnosticsBtn')).toBeVisible();
  await page.locator('#clearDiagnosticsBtn').click();
  await expect(page.locator('#diagnosticsList')).toContainText(
    'Событий пока нет',
  );
  await page.locator('[data-close="diagnosticsModal"]').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^worth-backup-.*\.json$/);

  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();
  if (!backupPath) throw new Error('Browser did not save the backup');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#resetBtn').click();
  await expect(page.locator('#homeTitle')).toHaveText('$0.00');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#importInput').setInputFiles(backupPath);
  await expect(page.locator('#homeTitle')).toHaveText('$100.00');
  await page.locator('.tab[data-nav="positionsView"]').click();
  await page.locator('[data-portfolio-mode="accounts"]').click();
  await expect(page.locator('#positionsList')).toContainText('Основной счёт');

  await page.locator('[data-portfolio-mode="assets"]').click();
  const restoredDollar = page
    .locator('#positionsList .portfolio-explorer-group')
    .filter({ hasText: 'Доллар' });
  if (
    (await restoredDollar
      .locator('.portfolio-row')
      .getAttribute('aria-expanded')) === 'false'
  ) {
    await restoredDollar.locator('.portfolio-row').click();
  }
  await restoredDollar.locator('.portfolio-position-row').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('#actionMenuItems')
    .getByText('Удалить позицию', { exact: true })
    .click();
  await page.locator('.tab[data-nav="homeView"]').click();
  await expect(page.locator('#homeTitle')).toHaveText('$0.00');

  await page.locator('#settingsShortcut').click();
  await page.locator('[data-lang-choice="en"]').click();
  await expect(page.locator('[data-i18n="totalBalance"]')).toHaveText(
    'Total balance',
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#homePeriods')).toHaveAttribute(
    'aria-label',
    'Performance period',
  );
  await expect(page.locator('#portfolioAdd')).toHaveAttribute(
    'aria-label',
    'Add to portfolio',
  );
});

test('shows exact portfolio values while inspecting both charts', async ({
  page,
}) => {
  await page.goto('/');
  const now = Date.now();
  await page.evaluate(
    ({ currentTime }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('worth-local-portfolio', 1);
        request.onerror = () =>
          reject(request.error ?? new Error('Could not open portfolio'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ['accounts', 'assets', 'positions', 'snapshots'],
            'readwrite',
          );
          transaction.objectStore('accounts').put({
            id: 'account',
            name: 'Vault',
            type: 'bank',
            icon: 'V',
            color: '#17181b',
          });
          transaction.objectStore('assets').put({
            id: 'usd',
            name: 'Dollar',
            code: 'USD',
            icon: '$',
            color: '#5667ff',
            price: 1,
            autoUpdateSource: 'none',
            category: 'cash-currencies',
            tags: ['currency'],
          });
          transaction.objectStore('positions').put({
            id: 'position',
            accountId: 'account',
            assetId: 'usd',
            quantity: 123.45,
            comment: '',
          });
          transaction.objectStore('snapshots').put({
            id: 'first',
            createdAt: currentTime - 7_200_000,
            total: 100.12,
          });
          transaction.objectStore('snapshots').put({
            id: 'second',
            createdAt: currentTime - 3_600_000,
            total: 123.45,
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not seed portfolio'));
        };
      }),
    { currentTime: now },
  );
  await page.reload();

  const homeCanvas = page.locator('#homeChart');
  const homeBox = await homeCanvas.boundingBox();
  if (!homeBox) throw new Error('Home chart is not visible');
  await page.mouse.move(homeBox.x + 6, homeBox.y + homeBox.height / 2);
  await expect(page.locator('#homeChartTooltip')).toBeVisible();
  await expect(page.locator('#homeChartTooltip')).toContainText('$100.12');

  await page.locator('[data-nav="historyView"]').click();
  const historyCanvas = page.locator('#historyChart');
  const historyBox = await historyCanvas.boundingBox();
  if (!historyBox) throw new Error('History chart is not visible');
  await page.mouse.move(
    historyBox.x + historyBox.width - 10,
    historyBox.y + historyBox.height / 2,
  );
  await expect(page.locator('#historyChartTooltip')).toBeVisible();
  await expect(page.locator('#historyChartTooltip')).toContainText('$123.45');
});
