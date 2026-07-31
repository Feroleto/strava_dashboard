import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onError?: (message: string) => void;
}

const SCANNER_ELEMENT_ID = 'barcode-scanner-viewport';

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
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 160 } },
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
    // width but no height; without object-cover forcing it full-bleed, the
    // video renders at its own intrinsic aspect ratio, out of sync with the
    // corner-frame overlay
    <div
      id={SCANNER_ELEMENT_ID}
      className="absolute inset-0 overflow-hidden rounded-[14px] [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
    />
  );
}
