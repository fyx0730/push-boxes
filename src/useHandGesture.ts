import { useState, useEffect, useRef } from 'react';

// Declare global MediaPipe types
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

interface HandGestureConfig {
  onResults: (results: any) => void;
  enabled: boolean;
}

export const useHandGesture = ({
  onResults,
  enabled,
}: HandGestureConfig) => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  
  // State refs to avoid dependency cycles in effects
  const isInitializedRef = useRef<boolean>(false);
  const isCleaningUpRef = useRef<boolean>(false);
  const onResultsRef = useRef(onResults);

  // Update ref when callback changes
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  useEffect(() => {
    // If disabled, cleanup
    if (!enabled) {
      cleanup();
      return;
    }

    // Check for scripts
    if (!window.Hands || !window.Camera) {
      setError('MediaPipe scripts not loaded. Please check your internet connection.');
      return;
    }

    if (isInitializedRef.current || isCleaningUpRef.current) return;

    const initializeMediaPipe = async () => {
      try {
        const video = document.createElement('video');
        video.style.display = 'none'; // We will draw to canvas, so hide raw video
        video.autoplay = true;
        video.playsInline = true;
        // Important: Append to body or it might not play in some browsers, 
        // but for cleaning we usually remove it. 
        // We'll keep it detached or append to a hidden container if needed.
        // For now, keeping it created but not appended works with camera_utils in most cases,
        // but appending is safer for permission prompts visibility if needed (though usually browser handles it).
        document.body.appendChild(video);
        videoRef.current = video;

        const hands = new window.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0, // Use Lite model for performance
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results: any) => {
          if (!isInitializedRef.current) return;
          setIsActive(results.multiHandLandmarks && results.multiHandLandmarks.length > 0);
          if (onResultsRef.current) onResultsRef.current(results);
        });

        handsRef.current = hands;

        const camera = new window.Camera(video, {
          onFrame: async () => {
            if (isInitializedRef.current && handsRef.current && !isCleaningUpRef.current) {
              try {
                await handsRef.current.send({ image: video });
              } catch (e) {
                console.warn("MediaPipe send error", e);
              }
            }
          },
          width: 640,
          height: 480
        });

        cameraRef.current = camera;
        
        await camera.start();
        isInitializedRef.current = true;
        setError(null);

      } catch (err) {
        console.error('Error initializing MediaPipe:', err);
        setError('Failed to initialize camera or hand tracking.');
        cleanup();
      }
    };

    initializeMediaPipe();

    return () => {
      cleanup();
    };
  }, [enabled]);

  const cleanup = () => {
    isCleaningUpRef.current = true;
    isInitializedRef.current = false;
    setIsActive(false);
    
    if (cameraRef.current) {
      try { cameraRef.current.stop(); } catch (e) {}
      cameraRef.current = null;
    }
    
    if (handsRef.current) {
      try { handsRef.current.close(); } catch (e) {}
      handsRef.current = null;
    }

    if (videoRef.current && videoRef.current.parentNode) {
      videoRef.current.parentNode.removeChild(videoRef.current);
    }
    videoRef.current = null;
    
    isCleaningUpRef.current = false;
  };

  return { isActive, error };
};

