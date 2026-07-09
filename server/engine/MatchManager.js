import { CONFIG } from '../config.js';
import { Dealer } from './Dealer.js';
import { ScoreManager } from './ScoreManager.js';
import { RoundManager } from './RoundManager.js';

/** Orchestrates higher-level game state, phase tracking, and coordination wrappers. */
export class MatchManager {
  /**
   * @param {string} roomId 
   * @param {Player[]} players 
   * @param {Function} emitCallback 
   */
  constructor(roomId, players, emitCallback) {
    this.roomId = roomId;
    this.players = players; // Array length exactly 4 verified at room level
    this.emitCallback = emitCallback;
    this.phase = CONFIG.GAME_PHASES.MATCH_START;
    
    this.dealer = new Dealer();
    this.scoreManager = new ScoreManager();
    this.roundManager = new RoundManager(this.players, this.scoreManager);
  }

  initializeMatch() {
    this.scoreManager.resetMatch();
    const dealerSeat = this.dealer.initializeFirstDealer();
    this.transitionTo(CONFIG.GAME_PHASES.FIRST_DEAL);
    return dealerSeat;
  }

  /** Finite State Machine driver */
  transitionTo(newPhase) {
    this.phase = newPhase;
    this.emitCallback('PHASE_CHANGED', { phase: this.phase });
    this.processPhaseActions();
  }

  processPhaseActions() {
    switch (this.phase) {
      case CONFIG.GAME_PHASES.FIRST_DEAL:
        this.executeFirstDeal();
        break;
      case CONFIG.GAME_PHASES.TRUMP_SELECTION:
        this.promptTrumpSelection();
        break;
      case CONFIG.GAME_PHASES.SECOND_DEAL:
        this.executeSecondDeal();
        break;
      case CONFIG.GAME_PHASES.PLAYING:
        this.notifyActiveTurn();
        break;
      case CONFIG.GAME_PHASES.ROUND_END:
        this.evaluateRoundTransition();
        break;
      case CONFIG.GAME_PHASES.MATCH_END:
        this.finalizeMatchStats();
        break;
    }
  }

  executeFirstDeal() {
    this.dealer.prepareDeck();
    this.dealer.dealToAll(this.players, CONFIG.CARDS_PER_DEAL);

    const chooserSeat = (this.dealer.dealerSeat + 1) % 4;
    const chooser = this.players.find(p => p.seat === chooserSeat);
    this.roundManager.startNewRound(chooser);

    this.emitCallback('FIRST_DEAL_COMPLETED', {
      dealerSeat: this.dealer.dealerSeat,
      chooserId: chooser.id
    });

    this.transitionTo(CONFIG.GAME_PHASES.TRUMP_SELECTION);
  }

  promptTrumpSelection() {
    this.emitCallback('PROMPT_TRUMP_SELECTION', {
      chooserId: this.roundManager.trumpChooser.id,
      chooserSeat: this.roundManager.trumpChooser.seat
    });
  }

  /**
   * @param {string} playerId 
   * @param {string} suit 
   */
  selectTrump(playerId, suit) {
    if (this.phase !== CONFIG.GAME_PHASES.TRUMP_SELECTION) throw new Error('Invalid phase invocation.');
    if (this.roundManager.trumpChooser.id !== playerId) throw new Error('Unauthorized action target request.');

    this.roundManager.setTrump(suit);
    this.emitCallback('TRUMP_SUIT_ANNOUNCED', { suit });
    this.transitionTo(CONFIG.GAME_PHASES.SECOND_DEAL);
  }

  executeSecondDeal() {
    this.dealer.dealToAll(this.players, CONFIG.CARDS_PER_DEAL);
    this.emitCallback('SECOND_DEAL_COMPLETED', {});
    this.transitionTo(CONFIG.GAME_PHASES.PLAYING);
  }

  notifyActiveTurn() {
    const activePlayer = this.players.find(p => p.seat === this.roundManager.activeTurnSeat);
    this.emitCallback('YOUR_TURN_NOTIFICATION', {
      playerId: activePlayer.id,
      seat: activePlayer.seat,
      leadSuit: this.roundManager.leadSuit
    });
  }

  /**
   * Action transaction point for client card execution
   * @param {string} playerId 
   * @param {string} cardId 
   */
  handleCardPlay(playerId, cardId) {
    if (this.phase !== CONFIG.GAME_PHASES.PLAYING) throw new Error('Illegal card play context.');

    const player = this.players.find(p => p.id === playerId);
    if (player.seat !== this.roundManager.activeTurnSeat) throw new Error('Action executed out of turn sequence.');

    const targetCard = player.hand.find(c => c.id === cardId);
    if (!targetCard) throw new Error('Target asset payload missing reference.');

    // Enforce matching ruleset validations
    import('./RuleValidator.js').then(({ RuleValidator }) => {
      if (!RuleValidator.isValidMove(targetCard, player.hand, this.roundManager.leadSuit)) {
        this.emitCallback('MOVE_REJECTED', { playerId, reason: 'Must follow suit if possible.' });
        return;
      }

      // Execute transaction mutations safely
      player.playCard(cardId);
      this.emitCallback('CARD_VALIDATED', { playerId, seat: player.seat, card: targetCard });

      const result = this.roundManager.executePlay(player, targetCard);

      if (result.isTrickComplete) {
        this.emitCallback('TRICK_RESOLVED', result.trickResult);
        
        const roundWinnerTeam = this.scoreManager.checkRoundWinner();
        if (roundWinnerTeam) {
          this.transitionTo(CONFIG.GAME_PHASES.ROUND_END);
          return;
        }
      }

      this.notifyActiveTurn();
    });
  }

  evaluateRoundTransition() {
    const roundWinnerTeam = this.scoreManager.checkRoundWinner();
    const SummaryData = this.scoreManager.finalizeRoundPoints(roundWinnerTeam);

    this.emitCallback('ROUND_OVER_SUMMARY', SummaryData);

    const matchWinnerTeam = this.scoreManager.checkMatchWinner();
    if (matchWinnerTeam) {
      this.transitionTo(CONFIG.GAME_PHASES.MATCH_END);
    } else {
      // Clear data structures before the next round
      this.players.forEach(p => p.clearHand());
      this.dealer.rotateDealer();
      this.transitionTo(CONFIG.GAME_PHASES.FIRST_DEAL);
    }
  }

  finalizeMatchStats() {
    const finalWinner = this.scoreManager.checkMatchWinner();
    this.emitCallback('MATCH_COMPLETE_HERO', {
      winnerTeam: finalWinner,
      scores: this.scoreManager.matchScores
    });
  }
}