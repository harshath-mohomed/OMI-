/** Resolves individual tricks based on standard OMI mechanics. */
export class TrickResolver {
  /**
   * Resolves the winner of the current trick.
   * @param {Array<{player: Player, card: Card}>} plays - Sequence array of items in execution order
   * @param {string} trumpSuit - Current dominant trump suit configuration
   * @returns {Player} Winning player instance
   */
  static resolveTrick(plays, trumpSuit) {
    if (!plays || plays.length !== 4) {
      throw new Error('Invalid collection length for resolution execution');
    }

    const leadSuit = plays[0].card.suit;
    let winningPlay = plays[0];

    for (let i = 1; i < plays.length; i++) {
      const current = plays[i];
      const best = winningPlay;

      if (current.card.suit === trumpSuit && best.card.suit !== trumpSuit) {
        winningPlay = current;
      } else if (current.card.suit === trumpSuit && best.card.suit === trumpSuit) {
        if (current.card.value > best.card.value) winningPlay = current;
      } else if (current.card.suit === leadSuit && best.card.suit !== trumpSuit && best.card.suit === leadSuit) {
        if (current.card.value > best.card.value) winningPlay = current;
      }
    }

    return winningPlay.player;
  }
}