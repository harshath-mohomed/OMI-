import { EVENTS } from '../utilities/constants.js';

export function registerChatHandlers(io, socket, engine) {
  socket.on(EVENTS.CHAT_MESSAGE, ({ text }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.CHAT_MESSAGE, {
      senderId: socket.data.playerId,
      text: text,
      timestamp: new Date().toISOString()
    });
  });
}