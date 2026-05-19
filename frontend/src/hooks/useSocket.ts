import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Submission } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL as string;

export function useSubmissionSocket(
  submissionId: number | null,
  onUpdate: (sub: Submission) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!submissionId) return;

    const socket = io(WS_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.emit('join:submission', submissionId);
    socket.on('submission:update', onUpdate);

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [submissionId, onUpdate]);
}
