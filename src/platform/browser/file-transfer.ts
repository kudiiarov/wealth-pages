import type { FileTransfer } from '../../application/ports';

interface ObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export class BrowserFileTransfer implements FileTransfer {
  constructor(
    private readonly documentRef: Document = document,
    private readonly urlApi: ObjectUrlApi = URL,
  ) {}

  downloadJson(filename: string, payload: unknown): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = this.urlApi.createObjectURL(blob);
    const anchor = this.documentRef.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    this.documentRef.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => this.urlApi.revokeObjectURL(url), 500);
  }
}
