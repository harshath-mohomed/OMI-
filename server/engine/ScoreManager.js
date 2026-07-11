import { CONFIG } from '../config.js';

/** Calculates trick counts, hanging bonuses, and score-token transfers. */
export class ScoreManager {
  constructor() {
    this.resetMatch();
  }

  resetMatch() {
    this.matchScores = { A: 10, B: 10 };
    this.hangingBonus = 0;
    this.matchStats = {
      roundsPlayed: 0,
      roundsWon: { A: 0, B: 0 },
      totalTricks: { A: 0, B: 0 },
      kapothiReceived: { A: 0, B: 0 },
      playerTricks: { 0: 0, 1: 0, 2: 0, 3: 0 },
      playerKapothiDealt: { 0: 0, 1: 0, 2: 0, 3: 0 },
      playerKapothiReceived: { 0: 0, 1: 0, 2: 0, 3: 0 },
      draws: 0
    };
    this.resetRound();
  }

  resetRound() {
    this.roundTricks = { A: 0, B: 0 };
  }

  incrementTrick(team, seat) {
    this.roundTricks[team]++;
    this.matchStats.totalTricks[team]++;
    if (seat !== undefined && this.matchStats.playerTricks[seat] !== undefined) {
      this.matchStats.playerTricks[seat]++;
    }
    return this.roundTricks;
  }

  /**
   * Finalizes a hand and transfers score tokens according to OMI rules.
   * @param {string} trumpTeam
   * @returns {Object}
   */
  finalizeHand(trumpTeam) {
    this.matchStats.roundsPlayed++;
    const teamA = this.roundTricks.A;
    const teamB = this.roundTricks.B;

    if (teamA === 4 && teamB === 4) {
      this.hangingBonus = 1;
      this.matchStats.draws++;
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
    
    this.matchStats.roundsWon[winningTeam]++;

    if (isKaputhi) {
      this.matchStats.kapothiReceived[losingTeam]++;
      
      const winningSeats = winningTeam === 'A' ? [0, 2] : [1, 3];
      const losingSeats = losingTeam === 'A' ? [0, 2] : [1, 3];
      
      winningSeats.forEach(seat => this.matchStats.playerKapothiDealt[seat]++);
      losingSeats.forEach(seat => this.matchStats.playerKapothiReceived[seat]++);
    }

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
    if (this.matchScores.B === 0) return 'A';
    if (this.matchScores.A === 0) return 'B';
    return null;
  }
  
  getMatchEndStats() {
    return this.matchStats;
  }
}