import { expect, test } from '@playwright/test';

test('creates and persists a portfolio, snapshot, and backup', async ({
  page,
}) => {
  await page.goto('/');

  await page.locator('[data-open="accountModal"]').first().click();
  await page.locator('#accountForm [name="name"]').fill('Основной счёт');
  await page
    .locator('#accountForm')
    .getByRole('button', { name: 'Создать счёт' })
    .click();
  await expect(page.locator('#accountsList')).toContainText('Основной счёт');

  await page.locator('[data-open="assetModal"]').first().click();
  await page.locator('#assetForm [name="name"]').fill('Доллар');
  await page.locator('#assetForm [name="code"]').fill('USD');
  await page.locator('#assetForm [name="price"]').fill('1');
  await page
    .locator('#assetForm')
    .getByRole('button', { name: 'Создать актив' })
    .click();

  await page.locator('[data-open="positionModal"]').first().click();
  await page.locator('#positionForm [name="quantity"]').fill('100');
  await page.locator('#positionForm [name="comment"]').fill('Резерв');
  await page
    .locator('#positionForm')
    .getByRole('button', { name: 'Сохранить' })
    .click();

  await expect(page.locator('#homeTitle')).toHaveText('$100.00');
  await page.locator('#saveSnapshotBtn').click();
  await expect(page.locator('#toast')).toContainText('Снимок');

  await page.reload();
  await expect(page.locator('#homeTitle')).toHaveText('$100.00');
  await expect(page.locator('#accountsList')).toContainText('Основной счёт');

  await page.locator('#settingsShortcut').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^worth-backup-.*\.json$/);
});
