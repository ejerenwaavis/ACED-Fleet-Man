'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;
    scannerRef.current = new Html5Qrcode("qr-reader");

    const startScanner = async () => {
      try {
        await scannerRef.current?.start(
          { facingMode: "environment" },
          { fps: 30 },
          (decodedText) => {
            if (scannerRef.current) {
              scannerRef.current.stop().catch(console.error);
            }
            onResult(decodedText);
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
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onResult]);

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
      <button 
        type="button" 
        onClick={onClose}
        className="w-full py-2 bg-[var(--surface)] border border-[var(--hairline)] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors text-[var(--ink)]"
      >
        Cancel Scan
      </button>
    </div>
  );
}
