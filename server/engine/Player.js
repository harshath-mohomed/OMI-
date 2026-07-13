/** Tracks an active player session, game state, and networking handle. */
export class Player {
  /**
   * @param {string} id - Database UUID/ID
   * @param {string} username 
   */
  constructor(id, username) {
    this.id = id;
    this.username = username;
    this.socketId = null;
    this.isDisconnected = false;
    this.hand = [];
    this.seat = null; // Integer index 0-3
    this.motoId = null;
    this.isOut = false;
  }

  /** @returns {boolean} Whether player belongs to Team A (seats 0, 2) or Team B (seats 1, 3) */
  get team() {
    if (this.seat === null || this.seat === undefined) return null;
    return this.seat % 2 === 0 ? 'A' : 'B';
  }

  /**
   * Adds cards to hand
   * @param {Card[]} cards 
   */
  addCards(cards) {
    this.hand.push(...cards);
  }

  /**
   * Verifies and removes card from hand
   * @param {string} cardId 
   * @returns {Card}
   */
  playCard(cardId) {
    const idx = this.hand.findIndex(c => c.id === cardId);
    if (idx === -1) throw new Error('Card not found in player hand.');
    return this.hand.splice(idx, 1)[0];
  }

  /** Clears round transient memory */
  clearHand() {
    this.hand = [];
    this.isOut = false;
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      seat: this.seat,
      team: this.team,
      isDisconnected: this.isDisconnected,
      cardCount: this.hand.length,
      motoId: this.motoId,
      isOut: this.isOut
    };
  }
}