import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

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
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          // camera may already be stopped/never started (start() rejected) —
          // nothing to clean up in that case
        });
    };
  }, []);

  return <div id={SCANNER_ELEMENT_ID} className="w-full overflow-hidden rounded-[14px]" />;
}
