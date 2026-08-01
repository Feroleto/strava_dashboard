import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill';
// Vite copies the binary into /assets with a content hash, so it is served from
// our own origin and satisfies `connect-src 'self'` in client/vercel.json
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

// html5-qrcode picks its decoder in the Html5Qrcode *constructor*, via
// `"BarcodeDetector" in window` (BarcodeDetectorDelegate.isSupported). Chromium
// answers yes and gets the native, GPU-backed detector; WebKit answers no and
// silently falls back to the bundled ZXing JS port with TRY_HARDER off, which
// cannot read an EAN-13 off the small canvas the library hands it. Since every
// browser on iOS is WebKit, that made the scanner work on Android and never
// decode anything on iPhone.
//
// Registering ZXing-C++ (WebAssembly) as `window.BarcodeDetector` puts Safari on
// the exact same code path Android already uses. The guard is load-bearing: where
// a native implementation exists it is both faster and free, so we leave it alone
// and never pay the ~1MB wasm download.
if (!('BarcodeDetector' in globalThis)) {
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
    // start fetching/compiling now rather than on the first frame — this runs
    // while the camera permission prompt is still up, so the wasm is usually
    // ready by the time there is anything to decode
    fireImmediately: true,
  }).catch(() => {
    // nothing useful to do here: a failed load just means detect() rejects every
    // frame, which html5-qrcode already treats as "no code in view"
  });

  (globalThis as unknown as { BarcodeDetector: typeof BarcodeDetector }).BarcodeDetector =
    BarcodeDetector;
}
