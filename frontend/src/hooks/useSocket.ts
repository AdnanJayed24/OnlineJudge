import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Submission } from '../types';

export function useSubmissionSocket(
  submissionId: number | null,
  onUpdate: (sub: Submission) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!submissionId) return;

    const socket = io('http://localhost:3000', { withCredentials: true });
    socketRef.current = socket;

    socket.emit('join:submission', submissionId);
    socket.on('submission:update', onUpdate);

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [submissionId, onUpdate]);
}
