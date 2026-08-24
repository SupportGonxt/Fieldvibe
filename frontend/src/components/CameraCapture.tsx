/**
 * Camera Capture Component
 * Allows field agent to take photos with camera
 */

import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (imageData: string, file: File) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  aspectRatio?: 'square' | 'landscape' | 'portrait';
}

export default function CameraCapture({
  onCapture,
  onCancel,
  title = 'Take Photo',
  description = 'Position the camera to capture the image',
  aspectRatio = 'landscape',
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      setError(null);
      
      // Stop existing stream
      if (stream) {
        stopCamera();
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError(
        'Unable to access camera. Please ensure camera permissions are enabled and try again.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Downscale to the same 1200px / q0.75 budget compressPhoto() applies on every
    // other capture path. This one was writing the raw sensor frame at q0.9, which is
    // where the multi-megabyte photos in the database came from.
    const MAX_EDGE = 1200;
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = canvas.toDataURL('image/jpeg', 0.75);
    setCapturedImage(imageData);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (!capturedImage || !canvasRef.current) return;

    // Convert data URL to blob and then to file
    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(capturedImage, file);
        stopCamera();
      })
      .catch((err) => {
        console.error('Error processing photo:', err);
        setError('Failed to process photo. Please try again.');
      });
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square';
      case 'portrait':
        return 'aspect-[3/4]';
      case 'landscape':
      default:
        return 'aspect-video';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-gray-300">{description}</p>}
        </div>
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera View / Preview */}
      <div className="flex-1 flex items-center justify-center p-4 bg-black">
        {error && (
          <div className="max-w-md w-full bg-red-900 text-white p-6 rounded-lg">
            <AlertCircle className="w-12 h-12 mx-auto mb-3" />
            <p className="text-center mb-4">{error}</p>
            <button
              onClick={startCamera}
              className="w-full px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        {!error && !capturedImage && (
          <div className={`max-w-4xl w-full ${getAspectRatioClass()} relative`}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover rounded-lg"
              playsInline
              autoPlay
              muted
            />
            {cameraActive && (
              <div className="absolute inset-0 border-4 border-white border-opacity-50 rounded-lg pointer-events-none">
                <div className="absolute top-2 left-2 right-2 h-1 bg-white bg-opacity-30" />
                <div className="absolute bottom-2 left-2 right-2 h-1 bg-white bg-opacity-30" />
              </div>
            )}
          </div>
        )}

        {!error && capturedImage && (
          <div className={`max-w-4xl w-full ${getAspectRatioClass()}`}>
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      {!error && (
        <div className="bg-gray-900 p-6">
          {!capturedImage ? (
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={capturePhoto}
                disabled={!cameraActive}
                className="w-20 h-20 bg-white hover:bg-gray-100 disabled:bg-gray-600 rounded-full flex items-center justify-center border-4 border-gray-300 transition-all disabled:cursor-not-allowed"
              >
                <Camera className="w-10 h-10 text-gray-900" />
              </button>

              <button
                onClick={switchCamera}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold flex items-center"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Flip
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
              <button
                onClick={retakePhoto}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold flex items-center"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Retake
              </button>

              <button
                onClick={confirmPhoto}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center"
              >
                <Check className="w-5 h-5 mr-2" />
                Use Photo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
