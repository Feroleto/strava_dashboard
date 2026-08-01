import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';
import type { FoodListItem } from '@/lib/types';
import BarcodeScanner from './components/BarcodeScanner';

interface BarcodeScannerPageProps {
  onBack: () => void;
  onFound: (food: FoodListItem) => void;
  /** no local/OFF match — hand off to manual cadastro, pre-linked to the code */
  onNotFound: (barcode: string) => void;
}

// L-corner viewfinder frame — a camera UI reads as dark/high-contrast
// regardless of the app's light/dark theme, so this is deliberately not
// token-driven
function CornerFrame() {
  const corner = 'absolute h-7 w-7 border-acc';
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {/* mirrors the qrbox computed in BarcodeScanner.tsx — the box is the region
          actually sampled by the decoder, so these must stay in sync or the user
          aims somewhere other than where the scan happens */}
      <div className="relative h-[200px] max-h-[60%] w-[90%] max-w-[420px]">
        <div className={`${corner} top-0 left-0 rounded-tl-[6px] border-t-[3px] border-l-[3px]`} />
        <div className={`${corner} top-0 right-0 rounded-tr-[6px] border-t-[3px] border-r-[3px]`} />
        <div
          className={`${corner} bottom-0 left-0 rounded-bl-[6px] border-b-[3px] border-l-[3px]`}
        />
        <div
          className={`${corner} right-0 bottom-0 rounded-br-[6px] border-r-[3px] border-b-[3px]`}
        />
        <div className="absolute top-1/2 right-0 left-0 h-[2px] -translate-y-1/2 bg-acc" />
      </div>
    </div>
  );
}

export default function BarcodeScannerPage({
  onBack,
  onFound,
  onNotFound,
}: BarcodeScannerPageProps) {
  const { t } = useTranslation('diet');
  const [status, setStatus] = useState<'scanning' | 'looking-up' | 'error'>('scanning');
  const [error, setError] = useState<string | null>(null);

  const handleDetected = (code: string) => {
    setStatus('looking-up');
    apiFetch(`/foods/barcode/${encodeURIComponent(code)}`)
      .then((res) => {
        if (res.status === 404) {
          onNotFound(code);
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FoodListItem>;
      })
      .then((food) => {
        if (food) onFound(food);
      })
      .catch(() => {
        setStatus('error');
        setError(t('scanner.lookupError'));
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer rounded-[9px] px-3 py-1.5 text-[13px] font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          {t('scanner.cancel')}
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {status === 'scanning' && (
          <>
            <div className="absolute inset-0">
              <BarcodeScanner
                onDetected={handleDetected}
                onError={() => {
                  setStatus('error');
                  setError(t('scanner.cameraError'));
                }}
              />
            </div>
            <CornerFrame />
          </>
        )}

        {status === 'looking-up' && (
          <p className="text-[13px] text-white/70">{t('scanner.lookingUp')}</p>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 px-8 text-center">
            <p className="text-[13px] text-white/80">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStatus('scanning');
              }}
              className="cursor-pointer rounded-[9px] bg-white/10 px-[13px] py-1.5 text-[12.5px] font-medium text-white hover:bg-white/20"
            >
              {t('scanner.retry')}
            </button>
          </div>
        )}
      </div>

      {status === 'scanning' && (
        <p className="px-8 pb-[calc(28px+env(safe-area-inset-bottom))] text-center text-[13px] text-white/70">
          {t('scanner.instructions')}
        </p>
      )}
    </div>
  );
}
