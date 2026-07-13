import { EVENTS } from '../utilities/constants.js';

export function registerTeamSelectionHandlers(io, socket, engine) {
  socket.on(EVENTS.REQUEST_TEAM_JOIN, ({ team }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = engine.getRoom(roomCode);
    if (!room) return;

    const playerId = socket.data.playerId;
    const result = room.requestTeamJoin(playerId, team);
    if (result && !result.success) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: result.reason });
    }
  });

  socket.on(EVENTS.RESPOND_TEAM_JOIN, ({ requestingPlayerId, accept }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = engine.getRoom(roomCode);
    if (!room) return;

    const responderId = socket.data.playerId;
    room.respondToTeamJoinRequest(responderId, requestingPlayerId, accept);
  });
}
