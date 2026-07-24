'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, AlertCircle, Crosshair } from 'lucide-react';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isTargetedMode, setIsTargetedMode] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsInitializing(true);
    const html5QrcodeScanner = new Html5Qrcode("qr-reader");
    scannerRef.current = html5QrcodeScanner;

    const startScanner = async () => {
      try {
        const config: any = { fps: 30 };
        if (isTargetedMode) {
          config.qrbox = (viewfinderWidth: number, viewfinderHeight: number) => {
            return {
              width: Math.min(300, viewfinderWidth * 0.8),
              height: 100
            };
          };
        }

        await html5QrcodeScanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (html5QrcodeScanner) {
              html5QrcodeScanner.stop().catch(console.error);
            }
            if (isMounted) onResult(decodedText);
          },
          (errorMessage) => {
            // Ignore scan failures (happens every frame it doesn't see a code)
          }
        );
        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setIsInitializing(false);
          setError("Failed to access camera. Please ensure you have granted camera permissions.");
          console.error("Camera error:", err);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
          html5QrcodeScanner.clear();
        }).catch(console.error);
      }
    };
  }, [onResult, isTargetedMode]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full min-h-[300px] bg-black rounded-lg overflow-hidden border border-[var(--hairline)] flex items-center justify-center">
        {isInitializing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80 z-10">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm font-medium">Starting Camera...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-black p-6 text-center z-10">
            <AlertCircle className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
        <div id="qr-reader" className="w-full h-full" />
      </div>
      <div className="flex gap-2">
        <button 
          type="button" 
          onClick={() => setIsTargetedMode(!isTargetedMode)}
          className={`flex-1 py-2 border rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            isTargetedMode 
              ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' 
              : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)] hover:bg-gray-50'
          }`}
        >
          <Crosshair className="w-4 h-4" />
          {isTargetedMode ? 'Targeted: ON' : 'Targeted Mode'}
        </button>
        <button 
          type="button" 
          onClick={onClose}
          className="flex-1 py-2 bg-[var(--surface)] border border-[var(--hairline)] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors text-[var(--ink)]"
        >
          Cancel Scan
        </button>
      </div>
    </div>
  );
}
