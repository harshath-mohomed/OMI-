/** Validates legal/illegal move configurations under runtime contexts. */
export class RuleValidator {
  /**
   * Evaluates legality of a selected card play
   * @param {Card} card - Selected structural entity
   * @param {Card[]} hand - Complete active player inventory
   * @param {string|null} leadSuit - First card suit parameter for active round
   * @returns {boolean}
   */
  static isValidMove(card, hand, leadSuit) {
    if (!card || !hand) return false;
    if (!leadSuit) return true;
    if (card.suit === leadSuit) return true;

    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    return !hasLeadSuit;
  }
}