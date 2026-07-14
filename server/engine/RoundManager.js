import { TrickResolver } from './TrickResolver.js';
import { CONFIG } from '../config.js';

/** Handles the live round gameplay loop and trick mechanics. */
export class RoundManager {
  /**
   * @param {Player[]} players 
   * @param {import('./ScoreManager.js').ScoreManager} scoreManager 
   */
  constructor(players, scoreManager) {
    this.players = players;
    this.scoreManager = scoreManager;
    this.trumpSuit = null;
    this.trumpChooser = null;
    this.trumpTeam = null;
    this.currentTrick = []; // Array of { player, card }
    this.activeTurnSeat = null;
    this.leadSuit = null;
    this.tricksPlayed = 0;
  }

  /**
   * Configures initialization state hooks
   * @param {Player} chooser 
   */
  startNewRound(chooser) {
    this.trumpSuit = null;
    this.trumpChooser = chooser;
    this.trumpTeam = chooser.team;
    this.currentTrick = [];
    this.leadSuit = null;
    this.tricksPlayed = 0;
    this.scoreManager.resetRound();
    this.activeTurnSeat = chooser.seat; // Trump selector plays first
  }

  setTrump(suit) {
    if (!CONFIG.SUITS.includes(suit)) {
      throw new Error('Invalid trump suit selected.');
    }
    this.trumpSuit = suit;
  }

  /**
   * Executes a card play transaction
   * @param {Player} player 
   * @param {import('./Card.js').Card} card 
   * @returns {Object} Operation resolution state evaluations
   */
  executePlay(player, card) {
    if (this.currentTrick.length === 0) {
      this.leadSuit = card.suit;
    }

    this.currentTrick.push({ player, card });
    
    const activePlayersCount = this.players.filter(p => !p.isOut).length;
    const isTrickComplete = this.currentTrick.length === activePlayersCount;
    if (!isTrickComplete) {
      let nextSeat = (this.activeTurnSeat + 3) % 4;
      while (this.players.find(p => p.seat === nextSeat).isOut) {
        nextSeat = (nextSeat + 3) % 4;
      }
      this.activeTurnSeat = nextSeat;
    }

    return isTrickComplete;
  }

  resolveTrick() {
    const winner = TrickResolver.resolveTrick(this.currentTrick, this.trumpSuit);
    this.scoreManager.incrementTrick(winner.team, winner.seat);
    this.tricksPlayed++;
    
    const trickResult = {
      winnerId: winner.id,
      winnerSeat: winner.seat,
      winningTeam: winner.team,
      completedTrick: [...this.currentTrick]
    };

    this.currentTrick = [];
    this.leadSuit = null;
    this.activeTurnSeat = winner.seat;

    let guard = 0;
  while (this.players.find(p => p.seat === this.activeTurnSeat)?.isOut && guard++ < 4) {
    this.activeTurnSeat = (this.activeTurnSeat + 1) % 4;
  }
    const isHandComplete = this.tricksPlayed >= CONFIG.TRICKS_PER_HAND;

    return {
      trickResult,
      isHandComplete,
      nextTurnSeat: this.activeTurnSeat
    };
  }
}