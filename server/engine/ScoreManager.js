import { CONFIG } from '../config.js';

/** Calculates trick counts, hanging bonuses, and score-token transfers. */
export class ScoreManager {
  constructor() {
    this.resetMatch();
  }

  resetMatch() {
    this.matchScores = { A: 10, B: 10 };
    this.hangingBonus = 0;
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
   * Finalizes a hand and transfers score tokens according to OMI rules.
   * @param {string} trumpTeam
   * @returns {Object}
   */
  finalizeHand(trumpTeam) {
    const teamA = this.roundTricks.A;
    const teamB = this.roundTricks.B;

    if (teamA === 4 && teamB === 4) {
      this.hangingBonus = 1;
      return {
        winningTeam: null,
        losingTeam: null,
        allocatedPoints: 0,
        isKaputhi: false,
        isHanging: true,
        hangingBonusCarried: 1,
        currentMatchScores: { ...this.matchScores }
      };
    }

    const winningTeam = teamA > teamB ? 'A' : 'B';
    const losingTeam = winningTeam === 'A' ? 'B' : 'A';
    const winTricks = this.roundTricks[winningTeam];
    const isKaputhi = winTricks === CONFIG.TRICKS_PER_HAND;

    let basePoints = 0;
    if (isKaputhi) {
      basePoints = 3;
    } else if (winTricks >= CONFIG.TRICKS_TO_WIN_SCORE && winTricks <= 7) {
      basePoints = winningTeam === trumpTeam ? 1 : 2;
    }

    const bonusPoints = this.hangingBonus;
    const requestedPoints = basePoints + bonusPoints;
    const allocatedPoints = Math.min(requestedPoints, this.matchScores[losingTeam]);

    this.matchScores[winningTeam] += allocatedPoints;
    this.matchScores[losingTeam] -= allocatedPoints;
    this.hangingBonus = 0;

    return {
      winningTeam,
      losingTeam,
      allocatedPoints,
      basePoints,
      bonusPoints,
      isKaputhi,
      isHanging: false,
      currentMatchScores: { ...this.matchScores }
    };
  }

  /** Checks for a match winner. */
  checkMatchWinner() {
    if (this.matchScores.A === CONFIG.TARGET_GAME_POINTS && this.matchScores.B === 0) return 'A';
    if (this.matchScores.B === CONFIG.TARGET_GAME_POINTS && this.matchScores.A === 0) return 'B';
    return null;
  }
}