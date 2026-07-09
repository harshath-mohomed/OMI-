import { Deck } from './Deck.js';

/** Manages dealer positional shifting and distribution actions. */
export class Dealer {
  constructor() {
    this.deck = new Deck();
    this.dealerSeat = null;
  }

  /** Selects starting dealer position randomly */
  initializeFirstDealer() {
    this.dealerSeat = Math.floor(Math.random() * 4);
    return this.dealerSeat;
  }

  /** Rotates the dealer position clockwise */
  rotateDealer() {
    this.dealerSeat = (this.dealerSeat + 1) % 4;
    return this.dealerSeat;
  }

  prepareDeck() {
    this.deck.reset();
    this.deck.shuffle();
  }

  /**
   * Deals cards to designated target structure
   * @param {Player[]} players - Sequence ordered by array indexing
   * @param {number} count - Amount to distribute
   */
  dealToAll(players, count) {
    // Clockwise execution sequence starting from the position next to the dealer
    for (let i = 1; i <= 4; i++) {
      const targetSeat = (this.dealerSeat + i) % 4;
      const targetPlayer = players.find(p => p.seat === targetSeat);
      if (targetPlayer) {
        targetPlayer.addCards(this.deck.deal(count));
      }
    }
  }
}