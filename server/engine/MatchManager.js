import { CONFIG } from '../config.js';
import { Dealer } from './Dealer.js';
import { ScoreManager } from './ScoreManager.js';
import { RoundManager } from './RoundManager.js';
import { RuleValidator } from './RuleValidator.js';

/** Orchestrates higher-level game state, phase tracking, and coordination wrappers. */
export class MatchManager {
  /**
   * @param {string} roomId 
   * @param {Player[]} players 
   * @param {Function} emitCallback 
   * @param {object} options
   */
  constructor(roomId, players, emitCallback, options = {}) {
    this.roomId = roomId;
    this.players = players; // Array length exactly 4 verified at room level
    this.emitCallback = emitCallback;
    this.isSinglePlayer = options.isSinglePlayer || false;
    this.phase = CONFIG.GAME_PHASES.MATCH_START;

    this.dealer = new Dealer();
    this.scoreManager = new ScoreManager();
    this.roundManager = new RoundManager(this.players, this.scoreManager);
    this.isResolvingTrick = false;

    // Fullcoat state variables
    this.isFullcoatActive = false;
    this.fullcoatDeclarerId = null;
    this.fullcoatPartnerId = null;
    this.fullcoatRequest = null;
    this.fullcoatExchange = null;
    this.fullcoatSummary = null;
    this.fullcoatOpponents = [];        // The two opposing-team players
    this.fullcoatCurrentAskerIndex = 0; // Which opponent is being asked (0 or 1)
    this.fullcoatCurrentAskerId = null; // ID of the player currently seeing FULLCOAT/CONTINUE
    this.fullcoatFailed = false;        // Explicit tracking for Full Count failure state
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
      case CONFIG.GAME_PHASES.FULLCOAT_DECISION:
      case CONFIG.GAME_PHASES.FULLCOAT_EXCHANGE:
      case CONFIG.GAME_PHASES.ROUND_END:
        // Wait for player interactions / timers
        break;
      case CONFIG.GAME_PHASES.FULLCOAT_TRUMP_SELECTION:
        this.promptFullcoatTrumpSelection();
        break;
      case CONFIG.GAME_PHASES.SECOND_DEAL:
        this.executeSecondDeal();
        break;
      case CONFIG.GAME_PHASES.PLAYING:
        this.notifyActiveTurn();
        break;
      case CONFIG.GAME_PHASES.HAND_END:
        this.finishHand();
        break;
      case CONFIG.GAME_PHASES.MATCH_END:
        this.finalizeMatchStats();
        break;
    }
  }

  executeFirstDeal() {
    this.players.forEach(player => {
      player.clearHand();
      player.isOut = false;
    });
    this.isFullcoatActive = false;
    this.fullcoatDeclarerId = null;
    this.fullcoatPartnerId = null;
    this.fullcoatRequest = null;
    this.fullcoatExchange = null;
    this.fullcoatSummary = null;
    this.fullcoatOpponents = [];
    this.fullcoatCurrentAskerIndex = 0;
    this.fullcoatCurrentAskerId = null;
    this.fullcoatFailed = false;

    this.dealer.prepareDeck();
    this.dealer.dealToAll(this.players, CONFIG.CARDS_PER_DEAL);

    const chooserSeat = (this.dealer.dealerSeat + 1) % 4;
    const chooser = this.players.find(p => p.seat === chooserSeat);
    this.roundManager.startNewRound(chooser);

    this.blindTrumpState = {
      status: null,
      revealedCard: null,
      chosenIndex: null
    };

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

  startBlindTrump(playerId) {
    if (this.phase !== CONFIG.GAME_PHASES.TRUMP_SELECTION) throw new Error('Invalid phase.');
    if (this.roundManager.trumpChooser.id !== playerId) throw new Error('Unauthorized action.');
    if (this.blindTrumpState.status !== null) throw new Error('Blind trump already started.');

    this.blindTrumpState.status = 'STARTED';
    this.emitCallback('blindTrumpStarted', {
      chooserId: this.roundManager.trumpChooser.id,
      chooserName: this.roundManager.trumpChooser.username
    });
  }

  revealBlindTrump(playerId, index) {
    if (this.phase !== CONFIG.GAME_PHASES.TRUMP_SELECTION) throw new Error('Invalid phase.');
    if (this.roundManager.trumpChooser.id !== playerId) throw new Error('Unauthorized action.');
    if (this.blindTrumpState.status !== 'STARTED') throw new Error('Blind trump not started.');
    if (index < 0 || index > 3) throw new Error('Invalid card index.');

    // Chooser's second 4 cards are the first 4 cards currently remaining in the deck
    const chooserCards = this.dealer.deck.cards.slice(0, 4);
    const selectedCard = chooserCards[index];
    if (!selectedCard) throw new Error('Selected card not found.');

    this.blindTrumpState.status = 'SELECTED';
    this.blindTrumpState.revealedCard = selectedCard;
    this.blindTrumpState.chosenIndex = index;

    this.roundManager.setTrump(selectedCard.suit);

    this.emitCallback('blindTrumpSelected', {
      revealedCard: selectedCard.toJSON(),
      trumpSuit: selectedCard.suit
    });

    // Determine the OPPOSING team (non-trump team) for Fullcoat decision
    const trumpTeam = this.roundManager.trumpTeam; // 'A' (seats 0,2) or 'B' (seats 1,3)
    const opponentSeats = trumpTeam === 'A' ? [1, 3] : [0, 2];
    this.fullcoatOpponents = opponentSeats.map(seat => this.players.find(p => p.seat === seat));
    this.fullcoatCurrentAskerIndex = 0;
    this.fullcoatCurrentAskerId = this.fullcoatOpponents[0].id;

    this.transitionTo(CONFIG.GAME_PHASES.SECOND_DEAL);
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

    // Determine the OPPOSING team (non-trump team) for Fullcoat decision
    const trumpTeam = this.roundManager.trumpTeam; // 'A' (seats 0,2) or 'B' (seats 1,3)
    const opponentSeats = trumpTeam === 'A' ? [1, 3] : [0, 2];
    this.fullcoatOpponents = opponentSeats.map(seat => this.players.find(p => p.seat === seat));
    this.fullcoatCurrentAskerIndex = 0;
    this.fullcoatCurrentAskerId = this.fullcoatOpponents[0].id;

    this.transitionTo(CONFIG.GAME_PHASES.SECOND_DEAL);
  }

  promptFullcoatTrumpSelection() {
    this.emitCallback('PROMPT_FULLCOAT_TRUMP_SELECTION', {
      declarerId: this.fullcoatDeclarerId
    });
  }

  selectFullcoatTrump(playerId, suit) {
    if (this.phase !== 'FULLCOAT_TRUMP_SELECTION') throw new Error('Invalid phase.');
    if (this.fullcoatDeclarerId !== playerId) throw new Error('Only the Fullcoat declarer can re-select trump.');

    this.roundManager.setTrump(suit);
    this.emitCallback('TRUMP_SUIT_ANNOUNCED', { suit });

    const declarer = this.players.find(p => p.id === this.fullcoatDeclarerId);
    this.roundManager.activeTurnSeat = declarer.seat;
    this.transitionTo(CONFIG.GAME_PHASES.PLAYING);
  }

  executeSecondDeal() {
    this.dealer.dealToAll(this.players, CONFIG.CARDS_PER_DEAL);
    this.emitCallback('SECOND_DEAL_COMPLETED', {});
    
    if (this.isSinglePlayer) {
      this.transitionTo(CONFIG.GAME_PHASES.PLAYING);
    } else {
      this.transitionTo(CONFIG.GAME_PHASES.FULLCOAT_DECISION);
    }
  }

  notifyActiveTurn() {
    let guard = 0;
    while (this.players.find(p => p.seat === this.roundManager.activeTurnSeat)?.isOut && guard++ < 4) {
      this.roundManager.activeTurnSeat = (this.roundManager.activeTurnSeat + 1) % 4;
    }
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
    if (this.isResolvingTrick) {
      this.emitCallback('MOVE_REJECTED', { playerId, reason: 'Wait for current trick to resolve.' });
      return;
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) throw new Error('Unknown player.');
    if (player.seat !== this.roundManager.activeTurnSeat) throw new Error('Action executed out of turn sequence.');

    const targetCard = player.hand.find(c => c.id === cardId);
    if (!targetCard) throw new Error('Target asset payload missing reference.');

    if (!RuleValidator.isValidMove(targetCard, player.hand, this.roundManager.leadSuit)) {
      this.emitCallback('MOVE_REJECTED', { playerId, reason: 'Must follow suit if possible.' });
      return;
    }

    player.playCard(cardId);
    const isTrickComplete = this.roundManager.executePlay(player, targetCard);

    this.emitCallback('CARD_VALIDATED', { playerId, seat: player.seat, card: targetCard });

    if (isTrickComplete) {
      this.isResolvingTrick = true;
      setTimeout(() => {
        const result = this.roundManager.resolveTrick();
        this.emitCallback('TRICK_RESOLVED', result.trickResult);

        if (this.isFullcoatActive) {
          const declarer = this.players.find(p => p.id === this.fullcoatDeclarerId);
          const fullcoatTeam = declarer ? declarer.team : null;
          const trickWinnerTeam = result.trickResult.winningTeam;
          if (fullcoatTeam && trickWinnerTeam !== fullcoatTeam) {
            this.fullcoatFailed = true;
            this.isResolvingTrick = false;
            if (this.phase === CONFIG.GAME_PHASES.PLAYING) {
              this.transitionTo(CONFIG.GAME_PHASES.HAND_END);
            }
            return;
          }
        }

        if (result.isHandComplete) {
          this.isResolvingTrick = false;
          if (this.phase === CONFIG.GAME_PHASES.PLAYING) {
            this.transitionTo(CONFIG.GAME_PHASES.HAND_END);
          }
          return;
        }

        this.isResolvingTrick = false;
        this.notifyActiveTurn();
      }, 1500);
    } else {
      this.notifyActiveTurn();
    }
  }

  finishHand() {
    const declarer = this.players.find(p => p.id === this.fullcoatDeclarerId);
    const fullcoatDeclarerTeam = declarer ? declarer.team : null;
    const SummaryData = this.scoreManager.finalizeHand(
      this.roundManager.trumpTeam,
      this.isFullcoatActive,
      fullcoatDeclarerTeam,
      this.fullcoatFailed
    );

    this.emitCallback('ROUND_OVER_SUMMARY', SummaryData);

    if (this.isFullcoatActive) {
      this.fullcoatSummary = {
        win: SummaryData.isFullcoatWin,
        points: SummaryData.allocatedPoints
      };

      this.transitionTo(CONFIG.GAME_PHASES.ROUND_END);

      setTimeout(() => {
        this.isFullcoatActive = false;
        this.fullcoatSummary = null;

        const matchWinnerTeam = this.scoreManager.checkMatchWinner();
        if (matchWinnerTeam) {
          this.transitionTo(CONFIG.GAME_PHASES.MATCH_END);
        } else {
          this.players.forEach(p => p.clearHand());
          this.dealer.rotateDealer();
          this.transitionTo(CONFIG.GAME_PHASES.FIRST_DEAL);
        }
      }, 5000);
    } else {
      const matchWinnerTeam = this.scoreManager.checkMatchWinner();
      if (matchWinnerTeam) {
        this.transitionTo(CONFIG.GAME_PHASES.MATCH_END);
      } else {
        this.players.forEach(p => p.clearHand());
        this.dealer.rotateDealer();
        this.transitionTo(CONFIG.GAME_PHASES.FIRST_DEAL);
      }
    }
  }

  finalizeMatchStats() {
    const finalWinner = this.scoreManager.checkMatchWinner();
    const stats = this.scoreManager.getMatchEndStats();

    let mvp = null;
    let maxScore = -Infinity;

    this.players.forEach(player => {
      const team = player.team;
      const tricksWon = stats.playerTricks[player.seat] || 0;
      const roundsWon = stats.roundsWon[team] || 0;
      const kapothiDealt = stats.playerKapothiDealt[player.seat] || 0;
      const kapothiReceived = stats.playerKapothiReceived[player.seat] || 0;

      const score = tricksWon * 3 + roundsWon * 2 + kapothiDealt * 1.5 - kapothiReceived;

      if (score > maxScore) {
        maxScore = score;
        mvp = {
          ...player.toJSON(),
          tricks_won: tricksWon,
          kapothi_dealt: kapothiDealt,
          kapothi_received: kapothiReceived,
          is_mvp: true,
          score: score
        };
      }
    });

    this.emitCallback('MATCH_COMPLETE_HERO', {
      winnerTeam: finalWinner,
      scores: this.scoreManager.matchScores,
      stats: stats,
      mvp: mvp
    });
  }
}