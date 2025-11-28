import React, { useEffect, useRef, useState } from 'react';
import { useHandGesture } from './useHandGesture';

interface ARControlsProps {
  onMove: (dx: number, dy: number) => void;
  onUndo: () => void;
  onPrevLevel: () => void;
  onNextLevel: () => void;
  enabled: boolean;
  onClose: () => void;
}

type ActionType = 'move' | 'undo' | 'prev' | 'next';

interface ButtonConfig {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  action: ActionType;
  dx?: number;
  dy?: number;
  color: string;
  bgColor: string;
}

export const ARControls: React.FC<ARControlsProps> = ({ 
  onMove, 
  onUndo, 
  onPrevLevel, 
  onNextLevel,
  enabled, 
  onClose 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Starting Camera...');
  const lastFistStateRef = useRef<boolean>(false);
  const activeButtonsRef = useRef<Set<string>>(new Set());
  
  // Buttons configuration (Normalized coordinates 0-1)
  // Layout: 
  // Left side: Navigation & Utils
  // Right side: D-Pad for movement
  const buttons: Record<string, ButtonConfig> = {
    // Navigation (Left)
    undo: { 
      x: 0.05, y: 0.15, w: 0.25, h: 0.18, 
      label: '↶ 撤销', 
      action: 'undo', 
      color: 'rgba(255, 200, 0, 0.8)', 
      bgColor: 'rgba(255, 200, 0, 0.2)' 
    },
    prev: { 
      x: 0.05, y: 0.41, w: 0.25, h: 0.18, 
      label: '⏮ 上一关', 
      action: 'prev', 
      color: 'rgba(0, 255, 150, 0.8)', 
      bgColor: 'rgba(0, 255, 150, 0.2)' 
    },
    next: { 
      x: 0.05, y: 0.67, w: 0.25, h: 0.18, 
      label: '⏭ 下一关', 
      action: 'next', 
      color: 'rgba(0, 255, 150, 0.8)', 
      bgColor: 'rgba(0, 255, 150, 0.2)' 
    },

    // D-Pad (Right)
    up: { 
      x: 0.68, y: 0.15, w: 0.14, h: 0.18, 
      label: '↑', 
      action: 'move', dx: 0, dy: -1, 
      color: 'rgba(0, 150, 255, 0.8)', 
      bgColor: 'rgba(0, 150, 255, 0.2)' 
    },
    down: { 
      x: 0.68, y: 0.67, w: 0.14, h: 0.18, 
      label: '↓', 
      action: 'move', dx: 0, dy: 1, 
      color: 'rgba(0, 150, 255, 0.8)', 
      bgColor: 'rgba(0, 150, 255, 0.2)' 
    },
    left: { 
      x: 0.52, y: 0.41, w: 0.14, h: 0.18, 
      label: '←', 
      action: 'move', dx: -1, dy: 0, 
      color: 'rgba(0, 150, 255, 0.8)', 
      bgColor: 'rgba(0, 150, 255, 0.2)' 
    },
    right: { 
      x: 0.84, y: 0.41, w: 0.14, h: 0.18, 
      label: '→', 
      action: 'move', dx: 1, dy: 0, 
      color: 'rgba(0, 150, 255, 0.8)', 
      bgColor: 'rgba(0, 150, 255, 0.2)' 
    },
  };

  const { isActive, error } = useHandGesture({
    enabled,
    onResults: (results) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Setup canvas sizing
      canvas.width = results.image.width;
      canvas.height = results.image.height;

      // 1. Draw Camera Feed
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Mirror the image
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // 2. Draw Virtual Buttons
      Object.entries(buttons).forEach(([key, btn]) => {
        const bx = btn.x * canvas.width;
        const by = btn.y * canvas.height;
        const bw = btn.w * canvas.width;
        const bh = btn.h * canvas.height;

        const isActive = activeButtonsRef.current.has(key);

        // Background
        ctx.fillStyle = isActive ? btn.color : btn.bgColor;
        // Rounded rect simulation (simplification)
        ctx.fillRect(bx, by, bw, bh);
        
        // Border
        ctx.strokeStyle = btn.color;
        ctx.lineWidth = isActive ? 4 : 2;
        ctx.strokeRect(bx, by, bw, bh);

        // Text
        ctx.fillStyle = 'white';
        ctx.font = isActive ? 'bold 28px Arial' : 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(btn.label, bx + bw / 2, by + bh / 2);
        ctx.shadowBlur = 0;
      });

      // 3. Hand Logic
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Draw Hand Connectors
        if (window.drawConnectors && window.drawLandmarks) {
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            
            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {color: 'rgba(0, 255, 0, 0.5)', lineWidth: 2});
            window.drawLandmarks(ctx, landmarks, {color: 'rgba(255, 0, 0, 0.5)', lineWidth: 1, radius: 3});
            ctx.restore();
        }

        // Interaction Logic: Fist Detection
        // Use Middle Finger MCP (9) as the stable center of the palm for cursor
        const palmCenter = landmarks[9];
        const visualCursorX = 1 - palmCenter.x; // Mirror
        const visualCursorY = palmCenter.y;
        
        const wrist = landmarks[0];

        const isFingerFolded = (tipIdx: number, mcpIdx: number) => {
            const tip = landmarks[tipIdx];
            const mcp = landmarks[mcpIdx]; 
            const dTip = (tip.x - wrist.x)**2 + (tip.y - wrist.y)**2;
            const dMcp = (mcp.x - wrist.x)**2 + (mcp.y - wrist.y)**2;
            return dTip < dMcp * 1.2;
        };

        const fingersFolded = [
            isFingerFolded(8, 5),   // Index
            isFingerFolded(12, 9),  // Middle
            isFingerFolded(16, 13), // Ring
            isFingerFolded(20, 17)  // Pinky
        ].filter(Boolean).length;

        const isFist = fingersFolded >= 3; 

        // Draw visual cursor
        ctx.beginPath();
        ctx.arc(visualCursorX * canvas.width, visualCursorY * canvas.height, 15, 0, 2 * Math.PI);
        ctx.fillStyle = isFist ? 'yellow' : 'cyan'; 
        ctx.shadowColor = isFist ? 'orange' : 'blue';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Hover detection for styling
        activeButtonsRef.current.clear();
        Object.entries(buttons).forEach(([key, btn]) => {
           if (
            visualCursorX >= btn.x &&
            visualCursorX <= btn.x + btn.w &&
            visualCursorY >= btn.y &&
            visualCursorY <= btn.y + btn.h
          ) {
            activeButtonsRef.current.add(key);
          }
        });

        // Trigger Logic: Rising Edge of Fist (Open -> Fist)
        if (isFist && !lastFistStateRef.current) {
            const now = Date.now();
            // Small cooldown to prevent double triggers
            if (now - (canvasRef.current as any).lastTriggerTime > 300 || !(canvasRef.current as any).lastTriggerTime) {
                 Object.entries(buttons).forEach(([key, btn]) => {
                  if (activeButtonsRef.current.has(key)) {
                    // Execute Action
                    switch (btn.action) {
                      case 'move':
                        if (btn.dx !== undefined && btn.dy !== undefined) onMove(btn.dx, btn.dy);
                        break;
                      case 'undo':
                        onUndo();
                        break;
                      case 'prev':
                        onPrevLevel();
                        break;
                      case 'next':
                        onNextLevel();
                        break;
                    }
                    (canvasRef.current as any).lastTriggerTime = now;
                  }
                });
            }
        }
        
        lastFistStateRef.current = isFist;
      }
    }
  });

  useEffect(() => {
    if (error) setStatus(error);
    else if (isActive) setStatus('Hand Detected - Open Hand to Move, Fist to Click');
    else setStatus('Waiting for hand...');
  }, [isActive, error]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-center bg-black/90 rounded-lg border border-gray-700 shadow-2xl p-2 w-[320px] sm:w-[420px] transition-all duration-300">
      <div className="relative w-full bg-black rounded overflow-hidden">
        <canvas 
          ref={canvasRef} 
          className="block w-full h-auto"
        />
        
        {/* Status Badge */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md pointer-events-none">
          {status}
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-500 text-white p-1.5 rounded-full shadow-lg transition-colors"
          title="关闭摄像头"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="mt-2 text-white text-center w-full">
        <p className="text-xs text-gray-400">将光标悬停按钮上，<span className="text-yellow-400 font-bold">握拳</span>触发</p>
      </div>
    </div>
  );
};
