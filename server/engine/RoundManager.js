import { TrickResolver } from './TrickResolver.js';

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
    this.currentTrick = [];
    this.leadSuit = null;
    this.tricksPlayed = 0;
    this.scoreManager.resetRound();
    this.activeTurnSeat = chooser.seat; // Trump selector plays first
  }

  setTrump(suit) {
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
    
    const isTrickComplete = this.currentTrick.length === 4;
    let trickResult = null;

    if (isTrickComplete) {
      const winner = TrickResolver.resolveTrick(this.currentTrick, this.trumpSuit);
      this.scoreManager.incrementTrick(winner.team);
      this.tricksPlayed++;
      
      trickResult = {
        winnerId: winner.id,
        winnerSeat: winner.seat,
        winningTeam: winner.team,
        completedTrick: [...this.currentTrick]
      };

      this.currentTrick = [];
      this.leadSuit = null;
      this.activeTurnSeat = winner.seat; // Trick winner acts next
    } else {
      this.activeTurnSeat = (this.activeTurnSeat + 1) % 4;
    }

    return {
      isTrickComplete,
      trickResult,
      nextTurnSeat: this.activeTurnSeat
    };
  }
}