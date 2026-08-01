// must be imported before html5-qrcode is constructed — it decides which decoder
// to use in the Html5Qrcode constructor, based on `"BarcodeDetector" in window`
import './barcodeDetectorPolyfill';
import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onError?: (message: string) => void;
}

const SCANNER_ELEMENT_ID = 'barcode-scanner-viewport';

/**
 * Size of the region html5-qrcode samples and feeds to the decoder.
 *
 * This is not just an aiming rectangle: setupUi() creates the decode canvas at
 * exactly these dimensions and foreverScan() downscales the cropped camera frame
 * into it, so the qrbox size *is* the decoder's input resolution. At the old
 * 260px an EAN-13 (95 modules) got ~2.7px per module, right at the limit of what
 * is decodable; near-full-width gives ~4px.
 *
 * Height is clamped against the viewfinder because getShadedRegionBounds() throws
 * outright if the box is taller than the video area (landscape, short viewports).
 * The corner-frame overlay in BarcodeScannerPage mirrors these numbers in CSS —
 * they must be kept in sync, or the user aims at a region that is not the one
 * being sampled.
 */
const SCAN_BOX_WIDTH_RATIO = 0.9;
const SCAN_BOX_MAX_WIDTH = 420;
const SCAN_BOX_HEIGHT = 200;
const SCAN_BOX_MAX_HEIGHT_RATIO = 0.6;

export default function BarcodeScanner({ onDetected, onError }: BarcodeScannerProps) {
  // latest callbacks via ref, not effect deps — starting/stopping the camera
  // is expensive and must only happen once per mount, not on every re-render
  // of the parent
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const detectedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      // product barcodes only — this app never scans QR codes, and
      // restricting formats improves detection speed/accuracy
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      verbose: false,
    });

    scanner
      .start(
        // ignored while the videoConstraints below are valid, but start() still
        // requires a truthy value here and falls back to it if they are rejected
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => ({
            width: Math.round(Math.min(viewfinderWidth * SCAN_BOX_WIDTH_RATIO, SCAN_BOX_MAX_WIDTH)),
            height: Math.round(
              Math.min(SCAN_BOX_HEIGHT, viewfinderHeight * SCAN_BOX_MAX_HEIGHT_RATIO),
            ),
          }),
          // without this, every frame that fails to decode is retried a second
          // time against a mirrored canvas. A mirrored EAN-13 is not a valid
          // EAN-13, so that pass can never succeed — it just halves throughput
          disableFlip: true,
          // html5-qrcode's own constraint builder emits nothing but `facingMode`,
          // and iOS then hands back a 640x480 stream by default. `ideal` (not
          // `exact`) so devices that cannot honour it degrade instead of failing
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        (decodedText) => {
          if (detectedRef.current) return;
          detectedRef.current = true;
          onDetectedRef.current(decodedText);
        },
        () => {
          // per-frame "nothing decoded yet" — fires on nearly every frame
          // while the camera looks for a code, not a real error
        },
      )
      .catch((err) => {
        onErrorRef.current?.(err instanceof Error ? err.message : String(err));
      });

    return () => {
      // stop() throws synchronously (not a rejected Promise) if the scanner
      // never finished starting — guard with getState() before calling it,
      // e.g. a fast unmount while getUserMedia() is still pending
      const state = scanner.getState();
      if (
        state !== Html5QrcodeScannerState.SCANNING &&
        state !== Html5QrcodeScannerState.PAUSED
      ) {
        return;
      }
      try {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            // camera may already be stopped — nothing to clean up
          });
      } catch {
        // stop() itself can throw synchronously depending on internal state
      }
    };
  }, []);

  return (
    // absolute inset-0 (not h-full) gives this element a genuinely definite
    // height, not a percentage depending on an auto-height ancestor — needed
    // for the [&_video]:h-full below to actually resolve instead of falling
    // back to 'auto'. html5-qrcode injects a bare <video> here with an inline
    // width but no height; without forcing it full-bleed, the video renders
    // at its own intrinsic aspect ratio, out of sync with the corner-frame
    // overlay.
    // Deliberately NOT object-cover: foreverScan() maps the qrbox back to native
    // video pixels with videoWidth/clientWidth and videoHeight/clientHeight,
    // measured per axis against the *element box*. object-cover crops and offsets
    // the visible image in a way the library has no awareness of, so the region
    // it samples drifts away from what the user sees. Note the UA stylesheet
    // still applies `object-fit: contain` to <video>, so the image is letterboxed
    // inside the stretched box rather than filling it — both stay centred, so
    // aiming is correct, but the sampled extent and the visible extent are not
    // identical on the letterboxed axis.
    // #qr-shaded-region is html5-qrcode's own viewfinder chrome (a dark surround
    // plus white L-corner shaders). CornerFrame in BarcodeScannerPage replaces it
    // with the app's own dark camera UI, so drawing both gave two competing
    // rectangles. They also cannot be aligned reliably: the library sizes that
    // element's borders from the viewfinder height captured once, on the `playing`
    // event, while the element itself stretches with top:0/bottom:0 — if the
    // container shrinks afterwards (iOS toolbar, safe-area settling) the hole ends
    // up shorter than the qrbox we asked for, and sits visibly off from ours.
    <div
      id={SCANNER_ELEMENT_ID}
      className="absolute inset-0 overflow-hidden rounded-[14px] [&_#qr-shaded-region]:hidden [&_video]:h-full [&_video]:w-full"
    />
  );
}
