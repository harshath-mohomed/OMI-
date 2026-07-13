import { EVENTS } from '../utilities/constants.js';

export function registerGameplayHandlers(io, socket, engine) {
  socket.on(EVENTS.CHOOSE_TRUMP, ({ suit }) => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    try {
      room.matchManager.selectTrump(socket.data.playerId, suit);
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on(EVENTS.PLAY_CARD, ({ cardId }) => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    try {
      room.matchManager.handleCardPlay(socket.data.playerId, cardId);
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on(EVENTS.REMATCH, () => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room) return;
    try {
      room.handleRematch(io);
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on(EVENTS.RETURN_HOME, () => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room) return;
    try {
      room.handleReturnHome(socket.id);
      socket.leave(room.code);
      socket.data.roomCode = null;
      socket.data.playerId = null;
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });
}