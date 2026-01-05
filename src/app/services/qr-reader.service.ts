import { Injectable } from "@angular/core";
import { prepareZXingModule, readBarcodes, ReadResult } from "zxing-wasm";

@Injectable({
  providedIn: 'root',
})
export class QRReaderService {
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    prepareZXingModule({
      overrides: {
        locateFile: (path, prefix) => {
          if (path.endsWith(".wasm")) {
            return '/wasm/zxing_full.wasm';
          }
          return prefix + path;
        },
      },
    });

    this.initialized = true;
  }

  async read(imageData: ImageData): Promise<ReadResult[]> {
    return await readBarcodes(imageData, {
      formats: ['QRCode']
    });
  }
}
