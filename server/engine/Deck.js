import { Card } from './Card.js';
import { CONFIG } from '../config.js';

/** Game Deck entity handling shuffling and dealing operations. */
export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  /** Populates the deck with the 32-card OMI play deck. */
  reset() {
    this.cards = [];
    for (const suit of CONFIG.SUITS) {
      for (const rank of CONFIG.RANKS) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  /** Shuffles using the Fisher-Yates algorithm. */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Deals an array of cards.
   * @param {number} count 
   * @returns {Card[]}
   */
  deal(count) {
    if (this.cards.length < count) {
      throw new Error('Not enough cards remaining in deck');
    }
    return this.cards.splice(0, count);
  }
}