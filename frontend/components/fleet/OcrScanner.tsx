'use client';

import React, { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { Loader2, AlertCircle, Camera, WifiOff, Cloud } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface OcrScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export function OcrScanner({ onResult, onClose }: OcrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [showFallbackMsg, setShowFallbackMsg] = useState(false);

  useEffect(() => {
    // Check if we previously had a cloud error or user preference
    const savedMode = localStorage.getItem('fleetman_ocr_mode');
    if (savedMode === 'offline') {
      setIsOfflineMode(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        if (isMounted) {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(console.error);
              setIsInitializing(false);
            };
          }
        } else {
          // Cleanup if unmounted before stream resolves
          mediaStream.getTracks().forEach(track => track.stop());
        }
      } catch (err: any) {
        if (isMounted) {
          setIsInitializing(false);
          setError("Failed to access camera. Please ensure you have granted permissions.");
          console.error("Camera error:", err);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
    };
  }, []); // Run once on mount

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Calculate crop box (targeting the center of the video, matching the UI reticle roughly)
    const cropWidth = video.videoWidth * 0.75;
    const cropHeight = video.videoHeight * 0.35; // 35% of video height
    const cropX = (video.videoWidth - cropWidth) / 2;
    const cropY = (video.videoHeight - cropHeight) / 2;
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    // Draw the current video frame to the canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError("Failed to process image.");
      setIsProcessing(false);
      return;
    }
    
    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    // Get image data as base64
    const imageData = canvas.toDataURL('image/jpeg');
    
    const processOffline = async () => {
      try {
        const result = await Tesseract.recognize(
          imageData,
          'eng',
          { logger: m => console.log(m) }
        );
        return (result.data.text || '').trim();
      } catch (err) {
        console.error("Local OCR failed", err);
        return null;
      }
    };

    try {
      let text = '';
      
      if (isOfflineMode) {
        text = await processOffline() || '';
      } else {
        try {
          const response = await apiFetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
          });
          
          if (!response.ok) {
            throw new Error('Cloud API Error');
          }
          
          const result = await response.json();
          text = (result.text || '').trim();
        } catch (cloudErr) {
          console.warn("Cloud OCR failed, falling back to local Tesseract", cloudErr);
          setShowFallbackMsg(true);
          // Automatically switch to offline mode and cache it so we don't keep hitting the error
          setIsOfflineMode(true);
          localStorage.setItem('fleetman_ocr_mode', 'offline');
          text = await processOffline() || '';
        }
      }
      
      if (text) {
        // Format text to add spacing (replace newlines/extra whitespace with ' - ')
        const formattedText = text.replace(/[\r\n]+/g, ' - ').replace(/\s{2,}/g, ' ');
        
        // Stop stream before passing result
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        onResult(formattedText);
      } else {
        setError("Could not read any text. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("OCR processing failed. Please try again.");
    } finally {
      setIsProcessing(false);
      setShowFallbackMsg(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full min-h-[300px] bg-black rounded-lg overflow-hidden border border-[var(--hairline)] flex items-center justify-center">
        {isInitializing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80 z-10">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm font-medium">Starting Camera...</span>
          </div>
        )}
        
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80 z-20">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm font-medium text-center px-4">
              {showFallbackMsg ? (
                <>Cloud failed.<br/>Falling back to local offline mode...</>
              ) : (
                <>Processing text...<br/>This may take a few seconds.</>
              )}
            </span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-black p-6 text-center z-10">
            <AlertCircle className="w-8 h-8 mb-2" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
        
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover" 
          playsInline
          autoPlay
          muted
        />
        
        {/* Targeting reticle */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-3/4 h-24 border-2 border-[var(--signal)] rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
          </div>
        </div>
        
        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      
      <div className="flex items-center justify-between px-2 bg-gray-50 rounded-lg p-3 border border-[var(--hairline)]">
        <div className="flex items-center gap-2">
          {isOfflineMode ? <WifiOff className="w-4 h-4 text-[var(--steel)]" /> : <Cloud className="w-4 h-4 text-blue-500" />}
          <span className="text-sm font-medium text-[var(--ink)]">Force Offline Mode</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={isOfflineMode} 
            onChange={(e) => {
              const offline = e.target.checked;
              setIsOfflineMode(offline);
              localStorage.setItem('fleetman_ocr_mode', offline ? 'offline' : 'cloud');
            }} 
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--signal)]"></div>
        </label>
      </div>
      
      <button 
        type="button" 
        onClick={handleCapture}
        disabled={isInitializing || isProcessing}
        className="w-full py-3 bg-[var(--signal)] border border-transparent rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors text-white flex items-center justify-center gap-2"
      >
        <Camera className="w-5 h-5" />
        {isProcessing ? 'Reading Text...' : 'Capture & Read'}
      </button>

      <button 
        type="button" 
        onClick={onClose}
        disabled={isProcessing}
        className="w-full py-2 bg-[var(--surface)] border border-[var(--hairline)] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors text-[var(--ink)]"
      >
        Cancel Scan
      </button>
    </div>
  );
}
