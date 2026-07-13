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
    this.pendingTeamRequests = new Map(); // key: requestingPlayerId, value: { targetTeam, responses: Map, timeout }
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

    playerInstance.seat = null; // Assigned manually via requestTeamJoin
    this.players.push(playerInstance);
    if (socket) this.connections.set(playerInstance.id, socket);
    return { role: 'PLAYER', isReconnect: false, seat: playerInstance.seat, player: playerInstance };
  }

  removeClient(socketId) {
    const pIdx = this.players.findIndex(p => p.socketId === socketId);
    if (pIdx !== -1) {
      const player = this.players[pIdx];
      player.isDisconnected = true;
      this.connections.delete(player.id);
      this.cancelPendingRequests(player.id);
      this.stopLobbyCountdown();
      return { role: 'PLAYER', player: player };
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
    const seatedActive = this.players.filter(p => p.seat !== null && !p.isDisconnected);
    if (seatedActive.length !== 4) throw new Error('Requires exactly 4 seated players to start.');

    this.cancelAllPendingRequests();
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
      const seatedPlayers = this.players.filter(p => p.seat !== null);
      const activeSeated = seatedPlayers.filter(p => !p.isDisconnected);
      if (seatedPlayers.length < 4 || activeSeated.length < 4) {
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
      lobbyCountdown: this.lobbyCountdown,
      pendingTeamRequest: playerInstance && this.pendingTeamRequests.has(playerInstance.id) ? {
        targetTeam: this.pendingTeamRequests.get(playerInstance.id).targetTeam
      } : null
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
        currentTrick: [],
        isFullcoatActive: false,
        fullcoatDeclarerId: null,
        fullcoatPartnerId: null,
        fullcoatRequest: null,
        fullcoatExchange: null,
        fullcoatSummary: null
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
      matchEndData: this.matchManager.phase === 'MATCH_END' ? this.lastMatchEndData : null,
      isFullcoatActive: this.matchManager.isFullcoatActive,
      fullcoatDeclarerId: this.matchManager.fullcoatDeclarerId,
      fullcoatPartnerId: this.matchManager.fullcoatPartnerId,
      fullcoatRequest: this.matchManager.fullcoatRequest,
      fullcoatExchange: this.matchManager.fullcoatExchange,
      fullcoatSummary: this.matchManager.fullcoatSummary
    };
  }

  requestTeamJoin(playerId, team) {
    if (this.matchManager) {
      return { success: false, reason: 'Game has already started.' };
    }

    const requester = this.players.find(p => p.id === playerId);
    if (!requester) {
      return { success: false, reason: 'Player not found in room.' };
    }

    const targetSeats = team === 'A' ? [0, 2] : [1, 3];
    const originalSeat = requester.seat;

    if (originalSeat !== null && targetSeats.includes(originalSeat)) {
      return { success: false, reason: 'You are already on this team.' };
    }

    const teamPlayers = this.players.filter(p => targetSeats.includes(p.seat));

    if (teamPlayers.length < 2) {
      const occupiedSeats = teamPlayers.map(p => p.seat);
      const emptySeat = targetSeats.find(s => !occupiedSeats.includes(s));
      
      requester.seat = emptySeat;
      this.cancelPendingRequests(playerId);
      this.broadcastGameState();
      return { success: true };
    } else {
      this.cancelPendingRequests(playerId);

      const request = {
        targetTeam: team,
        responses: new Map(),
        timeout: setTimeout(() => {
          this.handleRequestTimeout(playerId);
        }, 30000)
      };

      this.pendingTeamRequests.set(playerId, request);

      teamPlayers.forEach(p => {
        const socket = this.connections.get(p.id);
        if (socket) {
          socket.emit('teamJoinRequest', {
            requestingPlayerId: playerId,
            requestingPlayerName: requester.username,
            targetTeam: team
          });
        }
      });

      this.broadcastGameState();
      return { success: true, pending: true };
    }
  }

  respondToTeamJoinRequest(responderId, requestingPlayerId, accept) {
    const request = this.pendingTeamRequests.get(requestingPlayerId);
    if (!request) return;

    const requester = this.players.find(p => p.id === requestingPlayerId);
    if (!requester) {
      this.cancelPendingRequests(requestingPlayerId);
      return;
    }

    const responder = this.players.find(p => p.id === responderId);
    if (!responder) return;

    if (accept) {
      const otherTeam = request.targetTeam === 'A' ? 'B' : 'A';
      const otherSeats = otherTeam === 'A' ? [0, 2] : [1, 3];
      const otherTeamPlayers = this.players.filter(p => otherSeats.includes(p.seat));

      if (otherTeamPlayers.length >= 2) {
        const reqSocket = this.connections.get(requestingPlayerId);
        if (reqSocket) {
          reqSocket.emit('teamJoinRejected', { reason: 'Switch failed: the other team is full.' });
        }
        const respSocket = this.connections.get(responderId);
        if (respSocket) {
          respSocket.emit('illegalMove', { reason: 'Cannot switch: the other team is full.' });
        }
        this.cancelPendingRequests(requestingPlayerId);
        this.broadcastGameState();
        return;
      }

      const occupiedSeats = otherTeamPlayers.map(p => p.seat);
      const emptySeat = otherSeats.find(s => !occupiedSeats.includes(s));

      const oldResponderSeat = responder.seat;
      responder.seat = emptySeat;
      requester.seat = oldResponderSeat;

      const reqSocket = this.connections.get(requestingPlayerId);
      if (reqSocket) {
        reqSocket.emit('teamJoinAccepted', { team: request.targetTeam, seat: requester.seat });
      }

      this.cancelPendingRequests(requestingPlayerId);
      this.broadcastGameState();
    } else {
      request.responses.set(responderId, false);

      const targetSeats = request.targetTeam === 'A' ? [0, 2] : [1, 3];
      const teamPlayers = this.players.filter(p => targetSeats.includes(p.seat));
      
      const activeResponders = teamPlayers.filter(p => !p.isDisconnected);
      const allRejected = activeResponders.every(p => request.responses.get(p.id) === false);

      if (allRejected) {
        const reqSocket = this.connections.get(requestingPlayerId);
        if (reqSocket) {
          reqSocket.emit('teamJoinRejected', { reason: 'Your request was rejected. Please join the other team.' });
        }
        this.cancelPendingRequests(requestingPlayerId);
        this.broadcastGameState();
      }
    }
  }

  handleRequestTimeout(requestingPlayerId) {
    const request = this.pendingTeamRequests.get(requestingPlayerId);
    if (!request) return;

    const reqSocket = this.connections.get(requestingPlayerId);
    if (reqSocket) {
      reqSocket.emit('teamJoinRejected', { reason: 'Request timed out. Please try again or join another team.' });
    }
    this.cancelPendingRequests(requestingPlayerId);
    this.broadcastGameState();
  }

  cancelPendingRequests(playerId) {
    const request = this.pendingTeamRequests.get(playerId);
    if (request) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      this.pendingTeamRequests.delete(playerId);
    }

    for (const [reqId, req] of this.pendingTeamRequests.entries()) {
      const targetSeats = req.targetTeam === 'A' ? [0, 2] : [1, 3];
      const teamPlayers = this.players.filter(p => targetSeats.includes(p.seat));
      if (teamPlayers.some(p => p.id === playerId)) {
        const reqSocket = this.connections.get(reqId);
        if (reqSocket) {
          reqSocket.emit('teamJoinRejected', { reason: 'Team configuration changed. Request cancelled.' });
        }
        if (req.timeout) {
          clearTimeout(req.timeout);
        }
        this.pendingTeamRequests.delete(reqId);
      }
    }
  }

  cancelAllPendingRequests() {
    for (const request of this.pendingTeamRequests.values()) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
    }
    this.pendingTeamRequests.clear();
  }
}