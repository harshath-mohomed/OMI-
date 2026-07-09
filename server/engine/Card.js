import { CONFIG } from '../config.js';

/** Represents an immutable playing card. */
export class Card {
  /**
   * @param {string} suit - The suit of the card.
   * @param {string} rank - The rank of the card.
   */
  constructor(suit, rank) {
    if (!CONFIG.SUITS.includes(suit) || !CONFIG.RANKS.includes(rank)) {
      throw new Error(`Invalid Card: ${rank} of ${suit}`);
    }
    this.suit = suit;
    this.rank = rank;
    this.value = CONFIG.RANK_VALUES[rank];
  }

  /** @returns {string} Unique string identifier */
  get id() {
    return `${this.rank}_OF_${this.suit}`;
  }

  toJSON() {
    return { suit: this.suit, rank: this.rank, id: this.id };
  }
}