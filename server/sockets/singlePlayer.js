import { Player } from '../engine/Player.js';
import { SinglePlayerRoom } from '../engine/SinglePlayerRoom.js';
import { EVENTS } from '../utilities/constants.js';

/**
 * Socket handler for single-player mode.
 * Creates a SinglePlayerRoom with 3 bots and starts immediately.
 */
export function registerSinglePlayerHandlers(io, socket, engine) {
  socket.on(EVENTS.START_SINGLE_PLAYER, async ({ username }) => {
    try {
      if (!username || !username.trim()) {
        socket.emit(EVENTS.ILLEGAL_MOVE, { reason: 'Username is required.' });
        return;
      }

      // Create player via the database repository
      const userData = await engine.playerRepo.findOrCreatePlayer(username.trim());
      const player = new Player(userData.id, userData.username);
      player.socketId = socket.id;

      // Generate a unique room code for single-player
      let code;
      do {
        code = 'SP-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      } while (engine.rooms.has(code));

      // Create SinglePlayerRoom directly (bypass engine.createRoom for correct type)
      const room = new SinglePlayerRoom(code, engine.playerRepo, engine.matchRepo);
      engine.rooms.set(code, room);

      // Join the socket to the room channel
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerId = player.id;

      // Initialize and start the single-player match
      room.initSinglePlayer(player, socket, io);

    } catch (err) {
      console.error('[SinglePlayer] Error starting single-player game:', err);
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });
}
