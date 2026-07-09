import { Server } from 'socket.io';
import { registerLobbyHandlers } from './sockets/lobby.js';
import { registerGameplayHandlers } from './sockets/gameplay.js';
import { registerChatHandlers } from './sockets/chat.js';
import { registerDisconnectHandlers } from './sockets/reconnect.js';

export function initializeSocketLayer(httpServer, engine) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    registerLobbyHandlers(io, socket, engine);
    registerGameplayHandlers(io, socket, engine);
    registerChatHandlers(io, socket, engine);
    registerDisconnectHandlers(io, socket, engine);
  });

  return io;
}