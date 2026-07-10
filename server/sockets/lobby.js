import { Player } from '../engine/Player.js';
import { EVENTS } from '../utilities/constants.js';

export function registerLobbyHandlers(io, socket, engine) {
  socket.on(EVENTS.JOIN_ROOM, async ({ username, roomCode, asSpectator }) => {
    try {
      let room = engine.getRoom(roomCode);
      if (!room && !roomCode) {
        room = engine.createRoom();
      } else if (!room) {
        socket.emit(EVENTS.ILLEGAL_MOVE, { reason: 'Target game room does not exist.' });
        return;
      }

      const userData = await engine.playerRepo.findOrCreatePlayer(username);
      const player = new Player(userData.id, userData.username);
      player.socketId = socket.id;

      const joinResult = room.addClient(player, asSpectator, socket);
      socket.join(room.code);
      
      // Store session context data on the live socket instance
      socket.data.roomCode = room.code;
      socket.data.playerId = joinResult.player ? joinResult.player.id : player.id;

      io.to(room.code).emit(EVENTS.PLAYER_JOINED, {
        roomCode: room.code,
        player: (joinResult.player || player).toJSON(),
        role: joinResult.role,
        isReconnect: joinResult.isReconnect
      });

      // Synchronize state immediately following registration actions for every participant.
      room.broadcastGameState();

    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on(EVENTS.START_MATCH, () => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room) return;
    try {
      room.startMatch(io);
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });
}