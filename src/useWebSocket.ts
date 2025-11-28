import { useState, useEffect, useRef, useCallback } from 'react';

type MoveHandler = (dx: number, dy: number) => void;
type ActionHandler = () => void;

export const useWebSocket = (
  onMove: MoveHandler,
  onUndo: ActionHandler,
  onReset: ActionHandler
) => {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [url, setUrl] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback((wsUrl: string) => {
    // 避免重复连接
    if (wsRef.current?.readyState === WebSocket.OPEN && url === wsUrl) return;

    // 清理旧连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    setUrl(wsUrl);
    setStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus('connected');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setStatus('disconnected');
        wsRef.current = null;
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };

      ws.onmessage = (event) => {
        const cmd = event.data?.trim().toUpperCase();
        console.log('Received command:', cmd);

        switch (cmd) {
          case 'UP': onMove(0, -1); break;
          case 'DOWN': onMove(0, 1); break;
          case 'LEFT': onMove(-1, 0); break;
          case 'RIGHT': onMove(1, 0); break;
          case 'UNDO': onUndo(); break;
          case 'RESET': onReset(); break;
          default: break;
        }
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      setStatus('disconnected');
    }
  }, [onMove, onUndo, onReset, url]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
    setUrl('');
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return { status, connect, disconnect, currentUrl: url };
};

