import './styles/app.css';

import { PortfolioService } from './application/portfolio-service';
import { HttpPriceProvider } from './infrastructure/http/price-providers';
import { IndexedDbPortfolioRepository } from './infrastructure/indexeddb/portfolio-repository';
import { BrowserFileTransfer } from './platform/browser/file-transfer';
import { BrowserSettingsStore } from './platform/browser/settings-store';
import { WorthController } from './ui/events';
import { WorthRenderer } from './ui/render';
import { renderStartupError } from './ui/startup-error';

function nextId(): string {
  return (
    crypto.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

async function start(): Promise<void> {
  const settings = new BrowserSettingsStore();
  const service = new PortfolioService({
    repository: new IndexedDbPortfolioRepository(),
    settings,
    files: new BrowserFileTransfer(),
    prices: new HttpPriceProvider(),
    clock: {
      now: Date.now,
      isoNow: () => new Date().toISOString(),
    },
    ids: { next: nextId },
  });

  try {
    await service.initialize();
    const renderer = new WorthRenderer(service);
    const controller = new WorthController(service, renderer);
    controller.bind();
    renderer.renderAll();

    if (service.settings.autoRefreshOnLaunch) {
      await service.refreshPrices();
      renderer.renderAll();
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        void navigator.serviceWorker
          .register(`${import.meta.env.BASE_URL}sw.js`)
          .catch((error: unknown) =>
            console.warn('Service worker registration failed', error),
          );
      });
    }
  } catch (error) {
    console.error(error);
    renderStartupError(document.body, settings.load().language, () =>
      window.location.reload(),
    );
  }
}

void start();
