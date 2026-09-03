/**
 * POS terminal hardware adapters.
 *
 * IMPORTANT: none of these adapters talk to real devices. The keyboard/HID
 * barcode adapter and browser printing are genuinely implemented; WebSerial,
 * WebUSB, ESC/POS and cash-drawer kick are declared interfaces only and must
 * report an honest "not configured" status in the UI.
 */

export type HardwareStatus = "connected" | "configured" | "not_configured" | "not_detected";

export interface HardwareState {
  name: string;
  transport: "keyboard-hid" | "browser-print" | "web-serial" | "web-usb" | "device-bridge" | "none";
  status: HardwareStatus;
  detail: string;
}

/* ----------------------------- Barcode scanner --------------------------- */

export interface BarcodeScannerAdapter {
  initialize(): Promise<HardwareState>;
  listen(onScan: (code: string) => void): () => void;
  disconnect(): void;
  state(): HardwareState;
}

/**
 * Keyboard-wedge adapter: most retail scanners in Ethiopia are HID devices that
 * type the barcode followed by Enter. We buffer fast keystrokes and emit a scan.
 */
class KeyboardBarcodeScanner implements BarcodeScannerAdapter {
  private buffer = "";
  private lastKeyAt = 0;
  private detected = false;

  async initialize() {
    return this.state();
  }

  listen(onScan: (code: string) => void) {
    const handler = (event: KeyboardEvent) => {
      const now = Date.now();
      if (now - this.lastKeyAt > 120) this.buffer = "";
      this.lastKeyAt = now;

      if (event.key === "Enter") {
        if (this.buffer.length >= 6) {
          this.detected = true;
          onScan(this.buffer);
        }
        this.buffer = "";
        return;
      }
      if (event.key.length === 1) this.buffer += event.key;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }

  disconnect() {
    this.buffer = "";
  }

  state(): HardwareState {
    return {
      name: "Keyboard / HID scanner",
      transport: "keyboard-hid",
      status: this.detected ? "connected" : "not_detected",
      detail: this.detected
        ? "Scans received from a keyboard-wedge scanner."
        : "Scan any barcode into the POS search field to detect the device.",
    };
  }
}

export const barcodeScannerService: BarcodeScannerAdapter = new KeyboardBarcodeScanner();

/* -------------------------------- Printer ------------------------------- */

export interface PrinterAdapter {
  printReceipt(elementId: string): Promise<void>;
  printInvoice(elementId: string): Promise<void>;
  testPrint(): Promise<void>;
  state(): HardwareState;
}

class BrowserPrinter implements PrinterAdapter {
  private async printElement(elementId: string) {
    if (typeof window === "undefined") return;
    const node = document.getElementById(elementId);
    if (!node) throw new Error("Nothing to print on this screen.");
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
      .map((el) => el.outerHTML)
      .join("");
    doc.open();
    doc.write(
      `<html><head><title>Print</title>${styles}</head><body class="bg-white">${node.outerHTML}</body></html>`,
    );
    doc.close();
    await new Promise((r) => setTimeout(r, 350));
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1500);
  }

  printReceipt(elementId: string) {
    return this.printElement(elementId);
  }
  printInvoice(elementId: string) {
    return this.printElement(elementId);
  }
  async testPrint() {
    return this.printElement("printer-test-sheet");
  }
  state(): HardwareState {
    return {
      name: "Receipt printer",
      transport: "browser-print",
      status: "configured",
      detail: "Browser printing only. Direct ESC/POS communication is not implemented.",
    };
  }
}

export const printerService: PrinterAdapter = new BrowserPrinter();

/* ------------------------------ Cash drawer ----------------------------- */

export interface CashDrawerAdapter {
  openDrawer(): Promise<never>;
  testDrawer(): Promise<never>;
  state(): HardwareState;
}

class UnconfiguredCashDrawer implements CashDrawerAdapter {
  async openDrawer(): Promise<never> {
    throw new Error(
      "Cash drawer is not configured. A local device bridge (ESC/POS kick) is required and ships in a future release.",
    );
  }
  testDrawer() {
    return this.openDrawer();
  }
  state(): HardwareState {
    return {
      name: "Cash drawer",
      transport: "none",
      status: "not_configured",
      detail: "Requires WebSerial / WebUSB / local device bridge — not implemented yet.",
    };
  }
}

export const cashDrawerService: CashDrawerAdapter = new UnconfiguredCashDrawer();

export const PLANNED_TRANSPORTS = [
  { name: "WebSerial", detail: "Serial ESC/POS printers and drawer kick." },
  { name: "WebUSB", detail: "Direct USB thermal printer access." },
  { name: "ESC/POS command layer", detail: "Raw receipt command generation." },
  { name: "Local Device Bridge", detail: "Desktop agent for legacy hardware." },
];
