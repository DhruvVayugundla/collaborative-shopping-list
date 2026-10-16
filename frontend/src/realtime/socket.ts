import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";

/** One shared connection; the httpOnly auth cookie is sent with the handshake. */
export const socket: Socket = io({ autoConnect: false, withCredentials: true });

function subscribe(onChange: () => void) {
  socket.on("connect", onChange);
  socket.on("disconnect", onChange);
  return () => {
    socket.off("connect", onChange);
    socket.off("disconnect", onChange);
  };
}

export const useSocketConnected = () => useSyncExternalStore(subscribe, () => socket.connected);
