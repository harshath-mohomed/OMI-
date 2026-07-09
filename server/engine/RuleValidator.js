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
    if (!leadSuit) return true; // Lead player can choose any card
    if (card.suit === leadSuit) return true;

    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    return !hasLeadSuit; // Illegal if player breaks suit while holding matching cards
  }
}