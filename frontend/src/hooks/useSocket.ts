import { useEffect, useRef } from 'react';
import type { Submission } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL as string;

export function useSubmissionSocket(
  submissionId: number | null,
  onUpdate: (sub: Submission) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!submissionId) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', submissionId }));
    };

    ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        if (type === 'update') onUpdate(data as Submission);
      } catch { /* ignore malformed messages */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [submissionId, onUpdate]);
}
