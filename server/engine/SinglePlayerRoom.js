import { Room } from './Room.js';
import { BotPlayer } from './BotPlayer.js';
import { BotBrain } from './BotBrain.js';
import { MatchManager } from './MatchManager.js';
import { CONFIG } from '../config.js';

/**
 * Extends Room for single-player mode.
 * Creates 3 bot players alongside 1 human player and auto-resolves
 * all bot decisions (trump selection, card play, fullcoat) with delays.
 */
export class SinglePlayerRoom extends Room {
  /**
   * @param {string} code
   * @param {import('../database/PlayerRepository.js').PlayerRepository} playerRepo
   * @param {import('../database/MatchRepository.js').MatchRepository} matchRepo
   */
  constructor(code, playerRepo, matchRepo) {
    super(code, playerRepo, matchRepo);
    this.isSinglePlayer = true;
    this.humanPlayerId = null;
    this.ioNamespace = null;
    this.botActionTimer = null;
  }

  /**
   * Initializes a single-player game session.
   * @param {Player} humanPlayer - The human player instance
   * @param {object} socket - The human player's socket
   * @param {object} ioNamespace - Socket.IO namespace for emitting
   */
  initSinglePlayer(humanPlayer, socket, ioNamespace) {
    this.ioNamespace = ioNamespace;
    this.humanPlayerId = humanPlayer.id;

    // Seat the human player at seat 0 (Team A)
    humanPlayer.seat = 0;
    this.players.push(humanPlayer);
    this.connections.set(humanPlayer.id, socket);

    // Create and seat 3 bots
    for (let i = 0; i < 3; i++) {
      const bot = new BotPlayer(i);
      bot.seat = i + 1; // Seats 1, 2, 3
      this.players.push(bot);
      // Bots don't have real sockets — no connection entry needed
    }

    // Start the match immediately
    this._startSinglePlayerMatch();
  }

  /**
   * Starts the match with a custom emit callback that intercepts events
   * and triggers bot actions when needed.
   */
  _startSinglePlayerMatch() {
    const seatedActive = this.players.filter(p => p.seat !== null);
    if (seatedActive.length !== 4) {
      throw new Error('SinglePlayerRoom requires exactly 4 players (1 human + 3 bots).');
    }

    this.matchManager = new MatchManager(this.code, this.players, (evt, data) => {
      // Emit to the room (only human will receive via socket)
      this.ioNamespace.to(this.code).emit(evt, data);
      this.handleStatePersistIntercept(evt, data);
      this.broadcastGameState();

      // After each event, check if a bot needs to act
      this._scheduleBotAction();
    });

    this.matchManager.initializeMatch();
  }

  /**
   * Override broadcastGameState to only send to the human player.
   * Bots have no sockets so iterating over all players is safe —
   * the parent implementation already skips missing connections.
   */
  broadcastGameState() {
    super.broadcastGameState();
    this._scheduleBotAction();
  }

  /**
   * Checks if the current game state requires a bot decision and schedules it.
   * Uses a setTimeout to create realistic delay.
   */
  _scheduleBotAction() {
    // Clear any pending bot action to avoid double-firing
    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }

    if (!this.matchManager) return;

    const phase = this.matchManager.phase;
    const delay = 800 + Math.floor(Math.random() * 600); // 800-1400ms

    if (phase === CONFIG.GAME_PHASES.TRUMP_SELECTION) {
      this._scheduleTrumpSelection(delay);
    } else if (phase === CONFIG.GAME_PHASES.FULLCOAT_DECISION) {
      this._scheduleFullcoatDecision(delay);
    } else if (phase === CONFIG.GAME_PHASES.PLAYING) {
      this._scheduleCardPlay(delay);
    }
  }

  /**
   * If the trump chooser is a bot, auto-select trump.
   */
  _scheduleTrumpSelection(delay) {
    const chooser = this.matchManager.roundManager.trumpChooser;
    if (!chooser || !chooser.isBot) return;

    // Check if blind trump is already in progress
    if (this.matchManager.blindTrumpState && this.matchManager.blindTrumpState.status !== null) return;

    this.botActionTimer = setTimeout(() => {
      try {
        if (this.matchManager.phase !== CONFIG.GAME_PHASES.TRUMP_SELECTION) return;
        const suit = BotBrain.chooseTrump(chooser.hand);
        this.matchManager.selectTrump(chooser.id, suit);
      } catch (err) {
        console.error(`[BOT] Trump selection error for ${chooser.username}:`, err.message);
      }
    }, delay);
  }

  /**
   * If the current fullcoat asker is a bot, auto-choose "continue".
   */
  _scheduleFullcoatDecision(delay) {
    if (!this.matchManager.fullcoatCurrentAskerId) return;

    const currentAsker = this.players.find(p => p.id === this.matchManager.fullcoatCurrentAskerId);
    if (!currentAsker || !currentAsker.isBot) return;

    // If there's a pending fullcoat request for a bot partner, auto-reject
    if (this.matchManager.fullcoatRequest) {
      const partnerId = this.matchManager.fullcoatRequest.partnerId;
      const partner = this.players.find(p => p.id === partnerId);
      if (partner && partner.isBot) {
        this.botActionTimer = setTimeout(() => {
          try {
            if (this.matchManager.phase !== CONFIG.GAME_PHASES.FULLCOAT_DECISION) return;
            // Simulate rejecting fullcoat (bots never play fullcoat)
            const declarerName = this.matchManager.fullcoatRequest.declarerName;
            this.ioNamespace.to(this.code).emit('fullcoat_rejected', { declarerName });
            this.matchManager.fullcoatRequest = null;
            this.matchManager.transitionTo(CONFIG.GAME_PHASES.PLAYING);
          } catch (err) {
            console.error(`[BOT] Fullcoat response error:`, err.message);
          }
        }, delay);
        return;
      }
      return; // Human partner needs to respond
    }

    this.botActionTimer = setTimeout(() => {
      try {
        if (this.matchManager.phase !== CONFIG.GAME_PHASES.FULLCOAT_DECISION) return;

        // Bot always chooses "continue"
        const askerIndex = this.matchManager.fullcoatCurrentAskerIndex;
        if (askerIndex === 0 && this.matchManager.fullcoatOpponents.length > 1) {
          // Move to next opponent
          this.matchManager.fullcoatCurrentAskerIndex = 1;
          this.matchManager.fullcoatCurrentAskerId = this.matchManager.fullcoatOpponents[1].id;
          this.broadcastGameState();
          // Schedule the next bot's decision if they're also a bot
          this._scheduleBotAction();
        } else {
          // All opponents have chosen "continue" — proceed to playing
          this.matchManager.transitionTo(CONFIG.GAME_PHASES.PLAYING);
        }
      } catch (err) {
        console.error(`[BOT] Fullcoat decision error:`, err.message);
      }
    }, delay);
  }

  /**
   * If the active turn belongs to a bot, auto-play a card.
   */
  _scheduleCardPlay(delay) {
    if (this.matchManager.isResolvingTrick) return;

    const activeSeat = this.matchManager.roundManager.activeTurnSeat;
    const activePlayer = this.players.find(p => p.seat === activeSeat);
    if (!activePlayer || !activePlayer.isBot) return;

    this.botActionTimer = setTimeout(() => {
      try {
        if (this.matchManager.phase !== CONFIG.GAME_PHASES.PLAYING) return;
        if (this.matchManager.isResolvingTrick) return;

        // Double-check it's still this bot's turn
        const currentActiveSeat = this.matchManager.roundManager.activeTurnSeat;
        const currentPlayer = this.players.find(p => p.seat === currentActiveSeat);
        if (!currentPlayer || !currentPlayer.isBot) return;

        const card = BotBrain.chooseCard(
          currentPlayer.hand,
          this.matchManager.roundManager.leadSuit,
          this.matchManager.roundManager.trumpSuit,
          this.matchManager.roundManager.currentTrick,
          this.players,
          currentPlayer.seat
        );

        if (card) {
          this.matchManager.handleCardPlay(currentPlayer.id, card.id);
        }
      } catch (err) {
        console.error(`[BOT] Card play error for seat ${activeSeat}:`, err.message);
      }
    }, delay);
  }

  /**
   * Handle rematch in single-player mode.
   * Resets and starts a new match with the same bots.
   */
  handleRematch(ioNamespace) {
    if (!this.matchManager || this.matchManager.phase !== 'MATCH_END') return;

    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }

    this.matchManager = null;

    // Clear all hands
    this.players.forEach(p => p.clearHand());

    // Restart match
    this.ioNamespace = ioNamespace;
    this._startSinglePlayerMatch();
  }

  /**
   * Clean up bot timers on room destruction.
   */
  handleReturnHome(socketId) {
    if (this.botActionTimer) {
      clearTimeout(this.botActionTimer);
      this.botActionTimer = null;
    }
    super.handleReturnHome(socketId);
  }
}
