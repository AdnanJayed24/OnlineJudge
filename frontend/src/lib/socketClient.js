import { io } from "socket.io-client";
import { API_BASE_URL } from "./runtimeConfig";

export const socket = io(API_BASE_URL, {
  withCredentials: true,
  autoConnect: false,
});

export function connectSocket() {
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}
