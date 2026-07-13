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
    this.connections = new Map();
    /** @type {MatchManager|null} */
    this.matchManager = null;
    this.lobbyCountdown = null;
    this.countdownInterval = null;
  }

  /**
   * Adds a user to the room as a player or spectator.
   * @param {Player} playerInstance 
   * @param {boolean} asSpectator 
   */
  addClient(playerInstance, asSpectator = false, socket = null) {
    if (asSpectator) {
      this.spectators.push(playerInstance);
      if (socket) this.connections.set(playerInstance.id, socket);
      return { role: 'SPECTATOR' };
    }

    const existing = this.players.find(p => p.id === playerInstance.id);
    if (existing) {
      existing.isDisconnected = false;
      existing.socketId = playerInstance.socketId;
      if (socket) this.connections.set(existing.id, socket);
      return { role: 'PLAYER', isReconnect: true, seat: existing.seat, player: existing };
    }

    if (this.players.length >= 4) {
      this.spectators.push(playerInstance);
      if (socket) this.connections.set(playerInstance.id, socket);
      return { role: 'SPECTATOR', message: 'Room full. Joined as spectator.' };
    }

    playerInstance.seat = this.players.length;
    this.players.push(playerInstance);
    if (socket) this.connections.set(playerInstance.id, socket);
    return { role: 'PLAYER', isReconnect: false, seat: playerInstance.seat, player: playerInstance };
  }

  removeClient(socketId) {
    const pIdx = this.players.findIndex(p => p.socketId === socketId);
    if (pIdx !== -1) {
      this.players[pIdx].isDisconnected = true;
      this.connections.delete(this.players[pIdx].id);
      this.stopLobbyCountdown();
      return { role: 'PLAYER', player: this.players[pIdx] };
    }

    const sIdx = this.spectators.findIndex(s => s.socketId === socketId);
    if (sIdx !== -1) {
      const spec = this.spectators.splice(sIdx, 1)[0];
      this.connections.delete(spec.id);
      return { role: 'SPECTATOR', player: spec };
    }
    return null;
  }

  startMatch(ioNamespace) {
    if (this.players.length !== 4) throw new Error('Requires exactly 4 players to start.');

    this.stopLobbyCountdown();

    this.matchManager = new MatchManager(this.code, this.players, (evt, data) => {
      ioNamespace.to(this.code).emit(evt, data);
      this.handleStatePersistIntercept(evt, data);
      this.broadcastGameState();
    });

    this.matchManager.initializeMatch();
  }

  startLobbyCountdown(ioNamespace) {
    if (this.countdownInterval) return;
    this.lobbyCountdown = 10;
    this.broadcastGameState();

    this.countdownInterval = setInterval(() => {
      const activePlayers = this.players.filter(p => !p.isDisconnected);
      if (this.players.length < 4 || activePlayers.length < 4) {
        this.stopLobbyCountdown();
        this.broadcastGameState();
        return;
      }

      this.lobbyCountdown -= 1;

      if (this.lobbyCountdown <= 0) {
        this.stopLobbyCountdown();
        try {
          this.startMatch(ioNamespace);
        } catch (err) {
          console.error('Error starting match from countdown:', err);
        }
      } else {
        this.broadcastGameState();
      }
    }, 1000);
  }

  stopLobbyCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.lobbyCountdown = null;
  }

  broadcastGameState() {
    for (const participant of [...this.players, ...this.spectators]) {
      const socket = this.connections.get(participant.id);
      if (!socket) continue;
      socket.emit('syncState', this.getGameStateForPlayer(participant));
    }
  }

  /** Optional tracking hooking mechanics intercepts */
  handleStatePersistIntercept(evt, data) {
    if (evt === 'MATCH_COMPLETE_HERO') {
      this.lastMatchEndData = data;
      this.matchRepo.saveMatchResult({
        roomCode: this.code,
        winnerTeam: data.winnerTeam,
        scoreA: data.scores.A,
        scoreB: data.scores.B
      }).catch(err => console.error('Failed storing telemetry values:', err));
    }
  }

  handleRematch(ioNamespace) {
    if (!this.matchManager || this.matchManager.phase !== 'MATCH_END') return;
    this.matchManager = null;
    this.broadcastGameState();
  }

  handleReturnHome(socketId) {
    const cleanup = this.removeClient(socketId);
    if (cleanup) {
      this.broadcastGameState();
    }
  }

  getGameStateForPlayer(playerInstance) {
    // Baseline state that exists whether a match is active or not
    const baseState = {
      phase: this.matchManager ? this.matchManager.phase : 'LOBBY',
      roomCode: this.code,
      players: this.players.map(p => p.toJSON()),
      spectatorCount: this.spectators.length,
      yourHand: playerInstance ? playerInstance.hand.map(c => c.toJSON()) : [],
      lobbyCountdown: this.lobbyCountdown
    };

    // If no match is running yet, return just the base lobby info safely
    if (!this.matchManager) {
      return {
        ...baseState,
        dealerSeat: null,
        trumpSuit: null,
        activeTurnSeat: null,
        leadSuit: null,
        trumpChooserId: null,
        trumpTeam: null,
        matchScores: { A: 10, B: 10 },
        scoringTokens: { A: 10, B: 10 },
        roundTricks: { A: 0, B: 0 },
        roundsWon: { A: 0, B: 0 },
        hangingBonus: 0,
        tricksPlayed: 0,
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
      trumpChooserId: this.matchManager.roundManager.trumpChooser?.id ?? null,
      trumpTeam: this.matchManager.roundManager.trumpTeam,
      matchScores: { ...this.matchManager.scoreManager.matchScores },
      scoringTokens: { ...this.matchManager.scoreManager.matchScores },
      roundTricks: { ...this.matchManager.scoreManager.roundTricks },
      roundsWon: { ...this.matchManager.scoreManager.matchStats.roundsWon },
      hangingBonus: this.matchManager.scoreManager.hangingBonus,
      tricksPlayed: this.matchManager.roundManager.tricksPlayed,
      currentTrick: this.matchManager.roundManager.currentTrick.map(t => ({
        seat: t.player.seat,
        card: t.card.toJSON()
      })),
      matchEndData: this.matchManager.phase === 'MATCH_END' ? this.lastMatchEndData : null
    };
  }
}