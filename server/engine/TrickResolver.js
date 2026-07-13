/** Resolves individual tricks based on standard OMI mechanics. */
export class TrickResolver {
  /**
   * Resolves the winner of the current trick.
   * @param {Array<{player: Player, card: Card}>} plays - Sequence array of items in execution order
   * @param {string} trumpSuit - Current dominant trump suit configuration
   * @returns {Player} Winning player instance
   */
  static resolveTrick(plays, trumpSuit) {
    if (!plays || plays.length === 0) {
      throw new Error('Invalid collection length for resolution execution');
    }

    const leadSuit = plays[0].card.suit;
    const trumpPlays = plays.filter(play => play.card.suit === trumpSuit);
    const candidatePlays = trumpPlays.length > 0 ? trumpPlays : plays.filter(play => play.card.suit === leadSuit);

    return candidatePlays.reduce((bestPlay, currentPlay) => {
      if (currentPlay.card.value > bestPlay.card.value) return currentPlay;
      return bestPlay;
    }, candidatePlays[0]).player;
  }
}