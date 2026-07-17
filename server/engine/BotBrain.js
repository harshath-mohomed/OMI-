import { CONFIG } from '../config.js';

/**
 * AI decision engine for bot players.
 * Implements an intermediate-level strategy for all game decisions.
 */
export class BotBrain {

  /**
   * Selects the best trump suit from the bot's first 4 cards.
   * Strategy: Pick the suit with the most cards; break ties by highest total rank value.
   * @param {Card[]} hand - The bot's first 4 cards
   * @returns {string} The chosen suit
   */
  static chooseTrump(hand) {
    const suitCounts = {};
    const suitValues = {};

    for (const suit of CONFIG.SUITS) {
      suitCounts[suit] = 0;
      suitValues[suit] = 0;
    }

    for (const card of hand) {
      suitCounts[card.suit]++;
      suitValues[card.suit] += card.value;
    }

    let bestSuit = CONFIG.SUITS[0];
    let bestCount = 0;
    let bestValue = 0;

    for (const suit of CONFIG.SUITS) {
      if (suitCounts[suit] > bestCount ||
          (suitCounts[suit] === bestCount && suitValues[suit] > bestValue)) {
        bestSuit = suit;
        bestCount = suitCounts[suit];
        bestValue = suitValues[suit];
      }
    }

    return bestSuit;
  }

  /**
   * Selects the best card to play.
   * @param {Card[]} hand - The bot's current hand
   * @param {string|null} leadSuit - The suit led in this trick (null if bot is leading)
   * @param {string} trumpSuit - The current trump suit
   * @param {Array<{player: object, card: object}>} currentTrick - Cards already played in this trick
   * @param {Player[]} players - All players in the game
   * @param {number} botSeat - This bot's seat number
   * @returns {Card} The card to play
   */
  static chooseCard(hand, leadSuit, trumpSuit, currentTrick, players, botSeat) {
    if (!hand || hand.length === 0) return null;

    // If leading the trick
    if (!leadSuit || currentTrick.length === 0) {
      return BotBrain._chooseLead(hand, trumpSuit);
    }

    // Get playable cards (must follow suit if possible)
    const playable = BotBrain._getPlayableCards(hand, leadSuit);
    if (playable.length === 1) return playable[0];

    const partnerSeat = BotBrain._getPartnerSeat(botSeat);
    const partnerWinning = BotBrain._isPartnerWinning(currentTrick, trumpSuit, partnerSeat);

    // Has cards of the lead suit
    const hasLeadSuit = playable.some(c => c.suit === leadSuit);

    if (hasLeadSuit) {
      return BotBrain._followSuit(playable, leadSuit, trumpSuit, currentTrick, partnerWinning);
    } else {
      // Cannot follow suit — decide whether to trump in or throw away
      return BotBrain._discardOrTrump(playable, trumpSuit, currentTrick, partnerWinning);
    }
  }

  // ═══════════════════════ INTERNAL STRATEGIES ═══════════════════════

  /**
   * Strategy for leading a trick.
   * - If holding 3+ trumps, lead with highest trump to flush
   * - Otherwise lead with highest non-trump card
   */
  static _chooseLead(hand, trumpSuit) {
    const trumpCards = hand.filter(c => c.suit === trumpSuit).sort((a, b) => b.value - a.value);
    const nonTrumpCards = hand.filter(c => c.suit !== trumpSuit).sort((a, b) => b.value - a.value);

    // Flush strategy: lead trump if holding 3+ trumps
    if (trumpCards.length >= 3) {
      return trumpCards[0]; // Highest trump
    }

    // Lead with highest non-trump, or trump if no non-trump cards remain
    if (nonTrumpCards.length > 0) {
      return nonTrumpCards[0];
    }

    return trumpCards[0] || hand[0];
  }

  /**
   * Strategy for following suit.
   * - If partner is winning: play the lowest card of the lead suit
   * - If opponent is winning: play the highest card to try to overtake
   */
  static _followSuit(playable, leadSuit, trumpSuit, currentTrick, partnerWinning) {
    const leadSuitCards = playable.filter(c => c.suit === leadSuit).sort((a, b) => b.value - a.value);

    if (partnerWinning) {
      // Play low — let partner keep the win
      return leadSuitCards[leadSuitCards.length - 1];
    }

    // Try to beat the current best card
    const currentBest = BotBrain._getCurrentWinningValue(currentTrick, trumpSuit);

    // Only try to win with lead suit cards if no trump has been played
    const hasTrumpBeenPlayed = currentTrick.some(t => t.card.suit === trumpSuit);

    if (!hasTrumpBeenPlayed) {
      // Can we beat the current leader?
      const winners = leadSuitCards.filter(c => c.value > currentBest);
      if (winners.length > 0) {
        // Play the lowest card that wins
        return winners[winners.length - 1];
      }
    }

    // Can't win — dump the lowest
    return leadSuitCards[leadSuitCards.length - 1];
  }

  /**
   * Strategy when bot can't follow suit.
   * - If partner is winning: throw lowest non-trump card
   * - If opponent is winning: trump in with lowest trump that wins
   * - If can't win with trump: throw lowest card
   */
  static _discardOrTrump(playable, trumpSuit, currentTrick, partnerWinning) {
    const trumpCards = playable.filter(c => c.suit === trumpSuit).sort((a, b) => b.value - a.value);
    const nonTrumpCards = playable.filter(c => c.suit !== trumpSuit).sort((a, b) => a.value - b.value);

    if (partnerWinning) {
      // Don't waste a trump — throw lowest non-trump
      if (nonTrumpCards.length > 0) return nonTrumpCards[0];
      // Only trumps left — play lowest
      return trumpCards[trumpCards.length - 1];
    }

    // Opponent is winning — try to trump in
    if (trumpCards.length > 0) {
      const trumpPlaysInTrick = currentTrick.filter(t => t.card.suit === trumpSuit);
      if (trumpPlaysInTrick.length > 0) {
        // There's already a trump in the trick — need to beat it
        const highestTrumpPlayed = Math.max(...trumpPlaysInTrick.map(t => t.card.value));
        const beaters = trumpCards.filter(c => c.value > highestTrumpPlayed);
        if (beaters.length > 0) {
          return beaters[beaters.length - 1]; // Lowest trump that beats existing
        }
        // Can't beat existing trump — dump lowest non-trump
        if (nonTrumpCards.length > 0) return nonTrumpCards[0];
        return trumpCards[trumpCards.length - 1];
      }

      // No trump played yet — play lowest trump to win
      return trumpCards[trumpCards.length - 1];
    }

    // No trumps — throw lowest card
    if (nonTrumpCards.length > 0) return nonTrumpCards[0];
    return playable[0];
  }

  // ═══════════════════════ HELPERS ═══════════════════════

  /**
   * Returns the partner's seat (directly across the table).
   */
  static _getPartnerSeat(seat) {
    return (seat + 2) % 4;
  }

  /**
   * Checks if the partner is currently winning the trick.
   */
  static _isPartnerWinning(currentTrick, trumpSuit, partnerSeat) {
    if (currentTrick.length === 0) return false;

    const leadSuit = currentTrick[0].card.suit;
    const trumpPlays = currentTrick.filter(t => t.card.suit === trumpSuit);
    const candidatePlays = trumpPlays.length > 0
      ? trumpPlays
      : currentTrick.filter(t => t.card.suit === leadSuit);

    const winner = candidatePlays.reduce((best, current) => {
      return current.card.value > best.card.value ? current : best;
    }, candidatePlays[0]);

    return winner.player.seat === partnerSeat;
  }

  /**
   * Gets the value of the currently winning card in the trick.
   */
  static _getCurrentWinningValue(currentTrick, trumpSuit) {
    if (currentTrick.length === 0) return 0;

    const leadSuit = currentTrick[0].card.suit;
    const trumpPlays = currentTrick.filter(t => t.card.suit === trumpSuit);
    const candidatePlays = trumpPlays.length > 0
      ? trumpPlays
      : currentTrick.filter(t => t.card.suit === leadSuit);

    return Math.max(...candidatePlays.map(t => t.card.value));
  }

  /**
   * Returns cards that are legally playable given the lead suit.
   */
  static _getPlayableCards(hand, leadSuit) {
    if (!leadSuit) return [...hand];
    const suitCards = hand.filter(c => c.suit === leadSuit);
    return suitCards.length > 0 ? suitCards : [...hand];
  }
}
