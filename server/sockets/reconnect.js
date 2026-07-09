import { EVENTS } from '../utilities/constants.js';

export function registerDisconnectHandlers(io, socket, engine) {
  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = engine.getRoom(roomCode);
    if (!room) return;

    const cleanup = room.removeClient(socket.id);
    if (cleanup) {
      io.to(roomCode).emit(EVENTS.PLAYER_LEFT, {
        playerId: socket.data.playerId,
        role: cleanup.role,
        wasDisconnect: true
      });
    }
  });
}