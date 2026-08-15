import './styles/app.css';

import { LaunchAutomation } from './application/launch-automation';
import { PortfolioService } from './application/portfolio-service';
import { HttpPriceProvider } from './infrastructure/http/price-providers';
import { IndexedDbPortfolioRepository } from './infrastructure/indexeddb/portfolio-repository';
import { BrowserFileTransfer } from './platform/browser/file-transfer';
import { BrowserDiagnosticLog } from './platform/browser/diagnostic-log';
import { BrowserSettingsStore } from './platform/browser/settings-store';
import { ActivePwaScheduler } from './platform/browser/active-pwa-scheduler';
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
  const diagnostics = new BrowserDiagnosticLog();
  const service = new PortfolioService({
    repository: new IndexedDbPortfolioRepository(),
    settings,
    files: new BrowserFileTransfer(),
    diagnostics,
    prices: new HttpPriceProvider({ diagnostics }),
    clock: {
      now: Date.now,
      isoNow: () => new Date().toISOString(),
    },
    ids: { next: nextId },
  });

  try {
    await service.initialize();
    const renderer = new WorthRenderer(service);
    const automation = new LaunchAutomation(service, Date.now, diagnostics);
    const scheduler = new ActivePwaScheduler(
      automation,
      () => service.settings,
      () => renderer.renderAll(),
    );
    const controller = new WorthController(
      service,
      renderer,
      document,
      window,
      () => scheduler.settingsChanged(),
    );
    controller.bind();
    renderer.renderAll();
    scheduler.start();
    document.documentElement.dataset.appReady = 'true';
  } catch (error) {
    console.error(error);
    document.documentElement.dataset.appReady = 'error';
    renderStartupError(document.body, settings.load().language, () =>
      window.location.reload(),
    );
  }
}

void start();
