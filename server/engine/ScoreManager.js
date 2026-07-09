import { CONFIG } from '../config.js';

/** Calculates ongoing trick accumulations, structural matching, and adjustments. */
export class ScoreManager {
  constructor() {
    this.matchScores = { A: 0, B: 0 };
    this.roundTricks = { A: 0, B: 0 };
  }

  resetMatch() {
    this.matchScores = { A: 0, B: 0 };
    this.resetRound();
  }

  resetRound() {
    this.roundTricks = { A: 0, B: 0 };
  }

  incrementTrick(team) {
    this.roundTricks[team]++;
    return this.roundTricks;
  }

  /**
   * Checks if a team has reached 5 tricks to end the round.
   * @returns {string|null} Winning team token identification or null
   */
  checkRoundWinner() {
    if (this.roundTricks.A >= CONFIG.TRICKS_TO_WIN_ROUND) return 'A';
    if (this.roundTricks.B >= CONFIG.TRICKS_TO_WIN_ROUND) return 'B';
    return null;
  }

  /**
   * Finalizes score tallies and allocates match scaling indicators.
   * @param {string} winningTeam 
   * @returns {Object} Final calculation state data maps
   */
  finalizeRoundPoints(winningTeam) {
    const losingTeam = winningTeam === 'A' ? 'B' : 'A';
    const winTricks = this.roundTricks[winningTeam];
    const loseTricks = this.roundTricks[losingTeam];

    let allocatedPoints = 0;
    let isKaputhi = false;

    if (winTricks === 8) {
      allocatedPoints = 3; // Structural maximum sweep definition
      isKaputhi = true;
    } else if (winTricks > loseTricks) {
      allocatedPoints = 1;
    }

    this.matchScores[winningTeam] += allocatedPoints;

    return {
      winningTeam,
      allocatedPoints,
      isKaputhi,
      currentMatchScores: { ...this.matchScores }
    };
  }

  /** Checks for a match winner. */
  checkMatchWinner() {
    if (this.matchScores.A >= CONFIG.TARGET_GAME_POINTS) return 'A';
    if (this.matchScores.B >= CONFIG.TARGET_GAME_POINTS) return 'B';
    return null;
  }
}