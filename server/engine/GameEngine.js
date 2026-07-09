import { Room } from './Room.js';

/** Core system manager controlling structural creation, state indexing, and cross-room routing. */
export class GameEngine {
  /**
   * @param {import('../database/PlayerRepository.js').PlayerRepository} playerRepo 
   * @param {import('../database/MatchRepository.js').MatchRepository} matchRepo 
   */
  constructor(playerRepo, matchRepo) {
    this.playerRepo = playerRepo;
    this.matchRepo = matchRepo;
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  /** Creates an isolated game room. */
  createRoom() {
    let code;
    do {
      code = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (this.rooms.has(code));

    const room = new Room(code, this.playerRepo, this.matchRepo);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code ? code.toUpperCase() : '');
  }

  destroyRoom(code) {
    this.rooms.delete(code.toUpperCase());
  }
}