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
   * @param {boolean} isFullcoatActive
   * @param {string|null} fullcoatDeclarerTeam
   * @param {boolean} fullcoatFailed
   * @param {boolean} isHalfcoatActive
   * @param {string|null} halfcoatDeclarerTeam
   * @param {boolean} halfcoatFailed
   * @returns {Object}
   */
  finalizeHand(trumpTeam, isFullcoatActive = false, fullcoatDeclarerTeam = null, fullcoatFailed = false, isHalfcoatActive = false, halfcoatDeclarerTeam = null, halfcoatFailed = false) {
    this.matchStats.roundsPlayed++;
    const teamA = this.roundTricks.A;
    const teamB = this.roundTricks.B;

    // Half Coat scoring path (±3 points, same structure as Fullcoat)
    if (isHalfcoatActive) {
      const declarerTeam = halfcoatDeclarerTeam;
      const opponentTeam = declarerTeam === 'A' ? 'B' : 'A';

      let winningTeam, losingTeam, allocatedPoints, isHalfcoatWin;

      if (!halfcoatFailed) {
        // Half Coat Win: Declarer won all tricks → +3 tokens
        winningTeam = declarerTeam;
        losingTeam = opponentTeam;
        allocatedPoints = Math.min(3, this.matchScores[losingTeam]);
        this.matchScores[losingTeam] -= allocatedPoints;
        isHalfcoatWin = true;
      } else {
        // Half Coat Fail: Declarer lost a trick → -3 tokens from declarer's team
        winningTeam = opponentTeam;
        losingTeam = declarerTeam;
        allocatedPoints = Math.min(3, this.matchScores[losingTeam]);
        this.matchScores[losingTeam] -= allocatedPoints;
        isHalfcoatWin = false;
      }

      this.matchStats.roundsWon[winningTeam]++;

      return {
        winningTeam,
        losingTeam,
        allocatedPoints,
        basePoints: 3,
        bonusPoints: 0,
        isKaputhi: !halfcoatFailed,
        isHanging: false,
        isHalfcoat: true,
        isHalfcoatWin,
        currentMatchScores: { ...this.matchScores }
      };
    }

    if (isFullcoatActive) {
      const declarerTeam = fullcoatDeclarerTeam || (trumpTeam === 'A' ? 'B' : 'A');
      const opponentTeam = declarerTeam === 'A' ? 'B' : 'A';

      let winningTeam, losingTeam, allocatedPoints, isFullcoatWin;

      if (!fullcoatFailed) {
        // Fullcoat Win: Declarer team wins all tricks -> +3 tokens (deduct 3 from opponent score)
        winningTeam = declarerTeam;
        losingTeam = opponentTeam;
        allocatedPoints = Math.min(3, this.matchScores[losingTeam]);
        this.matchScores[losingTeam] -= allocatedPoints;
        isFullcoatWin = true;
      } else {
        // Fullcoat Fail: Declarer loses even 1 trick -> -3 tokens from declarer's team
        winningTeam = opponentTeam;
        losingTeam = declarerTeam;
        allocatedPoints = Math.min(3, this.matchScores[losingTeam]);
        this.matchScores[losingTeam] -= allocatedPoints;
        isFullcoatWin = false;
      }

      this.matchStats.roundsWon[winningTeam]++;

      return {
        winningTeam,
        losingTeam,
        allocatedPoints,
        basePoints: 3,
        bonusPoints: 0,
        isKaputhi: !fullcoatFailed,
        isHanging: false,
        isFullcoat: true,
        isFullcoatWin,
        currentMatchScores: { ...this.matchScores }
      };
    }

    if (teamA === 4 && teamB === 4) {
      this.hangingBonus = 2; // 2 bonus tokens held in reserve
      this.matchStats.draws++;
      return {
        winningTeam: null,
        losingTeam: null,
        allocatedPoints: 0,
        isKaputhi: false,
        isHanging: true,
        hangingBonusCarried: 2,
        currentMatchScores: { ...this.matchScores }
      };
    }

    const winningTeam = teamA > teamB ? 'A' : 'B';
    const losingTeam = winningTeam === 'A' ? 'B' : 'A';
    const winTricks = this.roundTricks[winningTeam];
    const isKaputhi = winTricks === CONFIG.TRICKS_PER_HAND;

    let points = 0;
    const pendingBonus = this.hangingBonus > 0;

    if (isKaputhi) {
      points = 3;
      this.hangingBonus = 0; // bonus is discarded on Kapothi win
    } else {
      if (pendingBonus) {
        points = 2; // 2 tokens, bonus absorbed
        this.hangingBonus = 0;
      } else {
        points = winningTeam === trumpTeam ? 1 : 2;
      }
    }

    const allocatedPoints = Math.min(points, this.matchScores[losingTeam]);

    // Tokens are ONLY deducted from losing team, never added to winning team
    this.matchScores[losingTeam] -= allocatedPoints;

    this.matchStats.roundsWon[winningTeam]++;

    if (isKaputhi) {
      this.matchStats.kapothiReceived[losingTeam]++;

      const winningSeats = winningTeam === 'A' ? [0, 2] : [1, 3];
      const losingSeats = losingTeam === 'A' ? [0, 2] : [1, 3];

      winningSeats.forEach(seat => this.matchStats.playerKapothiDealt[seat]++);
      losingSeats.forEach(seat => this.matchStats.playerKapothiReceived[seat]++);
    }

    // Calculate base and bonus points representation for reporting
    const basePoints = isKaputhi ? 3 : (winningTeam === trumpTeam ? 1 : 2);
    const bonusPoints = (pendingBonus && !isKaputhi && winningTeam === trumpTeam) ? 1 : 0;

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