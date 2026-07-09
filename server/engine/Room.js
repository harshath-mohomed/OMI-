import { MatchManager } from './MatchManager.js';

/** Represents a game room, mapping connections and routing to engines. */
export class Room {
  /**
   * @param {string} code - Room identification code
   * @param {import('../database/PlayerRepository.js').PlayerRepository} playerRepo 
   * @param {import('../database/MatchRepository.js').MatchRepository} matchRepo 
   */
  constructor(code, playerRepo, matchRepo) {
    this.code = code;
    this.playerRepo = playerRepo;
    this.matchRepo = matchRepo;
    this.players = [];       // Max 4 player entries
    this.spectators = [];    // Unlimited spectator slots
    /** @type {MatchManager|null} */
    this.matchManager = null;
  }

  /**
   * Adds a user to the room as a player or spectator.
   * @param {Player} playerInstance 
   * @param {boolean} asSpectator 
   */
  addClient(playerInstance, asSpectator = false) {
    if (asSpectator) {
      this.spectators.push(playerInstance);
      return { role: 'SPECTATOR' };
    }

    const existing = this.players.find(p => p.id === playerInstance.id);
    if (existing) {
      existing.isDisconnected = false;
      existing.socketId = playerInstance.socketId;
      return { role: 'PLAYER', isReconnect: true, seat: existing.seat };
    }

    if (this.players.length >= 4) {
      this.spectators.push(playerInstance);
      return { role: 'SPECTATOR', message: 'Room full. Joined as spectator.' };
    }

    playerInstance.seat = this.players.length;
    this.players.push(playerInstance);
    return { role: 'PLAYER', isReconnect: false, seat: playerInstance.seat };
  }

  removeClient(socketId) {
    const pIdx = this.players.findIndex(p => p.socketId === socketId);
    if (pIdx !== -1) {
      this.players[pIdx].isDisconnected = true;
      return { role: 'PLAYER', player: this.players[pIdx] };
    }

    const sIdx = this.spectators.findIndex(s => s.socketId === socketId);
    if (sIdx !== -1) {
      const spec = this.spectators.splice(sIdx, 1)[0];
      return { role: 'SPECTATOR', player: spec };
    }
    return null;
  }

  startMatch(ioNamespace) {
    if (this.players.length !== 4) throw new Error('Requires exactly 4 players to start.');

    this.matchManager = new MatchManager(this.code, this.players, (evt, data) => {
      ioNamespace.to(this.code).emit(evt, data);
      this.handleStatePersistIntercept(evt, data);
    });

    this.matchManager.initializeMatch();
  }

  /** Optional tracking hooking mechanics intercepts */
  handleStatePersistIntercept(evt, data) {
    if (evt === 'MATCH_COMPLETE_HERO') {
      this.matchRepo.saveMatchResult({
        roomCode: this.code,
        winnerTeam: data.winnerTeam,
        scoreA: data.scores.A,
        scoreB: data.scores.B
      }).catch(err => console.error('Failed storing telemetry values:', err));
    }
  }

  getGameStateForPlayer(playerInstance) {
    // Baseline state that exists whether a match is active or not
    const baseState = {
      phase: this.matchManager ? this.matchManager.phase : 'LOBBY',
      roomCode: this.code,
      players: this.players.map(p => p.toJSON()),
      spectatorCount: this.spectators.length,
      yourHand: playerInstance ? playerInstance.hand.map(c => c.toJSON()) : []
    };

    // If no match is running yet, return just the base lobby info safely
    if (!this.matchManager) {
      return {
        ...baseState,
        dealerSeat: null,
        trumpSuit: null,
        activeTurnSeat: null,
        leadSuit: null,
        matchScores: { A: 0, B: 0 },
        roundTricks: { A: 0, B: 0 },
        currentTrick: []
      };
    }

    // If a match IS running, append active game parameters
    return {
      ...baseState,
      dealerSeat: this.matchManager.dealer.dealerSeat,
      trumpSuit: this.matchManager.roundManager.trumpSuit,
      activeTurnSeat: this.matchManager.roundManager.activeTurnSeat,
      leadSuit: this.matchManager.roundManager.leadSuit,
      matchScores: this.matchManager.scoreManager.matchScores,
      roundTricks: this.matchManager.scoreManager.roundTricks,
      currentTrick: this.matchManager.roundManager.currentTrick.map(t => ({
        seat: t.player.seat,
        card: t.card.toJSON()
      }))
    };
  }
}