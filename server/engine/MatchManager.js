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

    // Halfcoat state variables
    this.isHalfcoatActive = false;
    this.halfcoatDeclarerId = null;
    this.halfcoatFailed = false;
    this.halfcoatSummary = null;
    this.halfcoatCountdown = null;
    this.halfcoatCountdownTimer = null;
    this.halfcoatDecliners = new Set();
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
      case CONFIG.GAME_PHASES.HALFCOAT_DECISION:
        this.startHalfcoatCountdown();
        break;
      case CONFIG.GAME_PHASES.HALFCOAT_TRUMP_SELECTION:
        // Wait for declarer to pick new trump
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

    // Reset halfcoat state
    this.isHalfcoatActive = false;
    this.halfcoatDeclarerId = null;
    this.halfcoatFailed = false;
    this.halfcoatSummary = null;
    this.halfcoatCountdown = null;
    if (this.halfcoatCountdownTimer) {
      clearInterval(this.halfcoatCountdownTimer);
      this.halfcoatCountdownTimer = null;
    }
    this.halfcoatDecliners = new Set();

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

    // Determine the OPPOSING team (non-trump team) for Fullcoat/Halfcoat decisions
    const trumpTeam = this.roundManager.trumpTeam; // 'A' (seats 0,2) or 'B' (seats 1,3)
    const opponentSeats = trumpTeam === 'A' ? [1, 3] : [0, 2];
    this.fullcoatOpponents = opponentSeats.map(seat => this.players.find(p => p.seat === seat));
    this.fullcoatCurrentAskerIndex = 0;
    this.fullcoatCurrentAskerId = this.fullcoatOpponents[0].id;

    this.transitionTo(CONFIG.GAME_PHASES.HALFCOAT_DECISION);
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

    // Determine the OPPOSING team (non-trump team) for Fullcoat/Halfcoat decisions
    const trumpTeam = this.roundManager.trumpTeam; // 'A' (seats 0,2) or 'B' (seats 1,3)
    const opponentSeats = trumpTeam === 'A' ? [1, 3] : [0, 2];
    this.fullcoatOpponents = opponentSeats.map(seat => this.players.find(p => p.seat === seat));
    this.fullcoatCurrentAskerIndex = 0;
    this.fullcoatCurrentAskerId = this.fullcoatOpponents[0].id;

    this.transitionTo(CONFIG.GAME_PHASES.HALFCOAT_DECISION);
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

  // ── Half Coat Methods ──

  /** Starts 5-second countdown for opponents to declare Half Coat */
  startHalfcoatCountdown() {
    this.halfcoatCountdown = 5;
    this.emitCallback('HALFCOAT_COUNTDOWN_START', { countdown: this.halfcoatCountdown });

    this.halfcoatCountdownTimer = setInterval(() => {
      this.halfcoatCountdown -= 1;
      this.emitCallback('HALFCOAT_COUNTDOWN_TICK', { countdown: this.halfcoatCountdown });

      if (this.halfcoatCountdown <= 0) {
        this.clearHalfcoatCountdown();
        // No Half Coat declared — continue to normal flow
        this.transitionTo(CONFIG.GAME_PHASES.SECOND_DEAL);
      }
    }, 1000);
  }

  /** Clears the Half Coat countdown timer */
  clearHalfcoatCountdown() {
    if (this.halfcoatCountdownTimer) {
      clearInterval(this.halfcoatCountdownTimer);
      this.halfcoatCountdownTimer = null;
    }
    this.halfcoatCountdown = null;
  }

  /** An opponent player declines to declare Half Coat */
  declineHalfcoat(playerId) {
    if (this.phase !== CONFIG.GAME_PHASES.HALFCOAT_DECISION) return;
    this.halfcoatDecliners.add(playerId);
    
    // If all opponents have declined, skip the rest of the countdown
    if (this.halfcoatDecliners.size >= this.fullcoatOpponents.length) {
      this.clearHalfcoatCountdown();
      this.transitionTo(CONFIG.GAME_PHASES.SECOND_DEAL);
    }
  }

  /**
   * An opponent attempts to declare Half Coat.
   * Validates Condition 1: hand must have at least 2 different suits.
   * @param {string} playerId
   */
  declareHalfcoat(playerId) {
    if (this.phase !== CONFIG.GAME_PHASES.HALFCOAT_DECISION) {
      throw new Error('Invalid phase for Half Coat declaration.');
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found.');

    // Only opponents (non-trump team) can declare
    const trumpTeam = this.roundManager.trumpTeam;
    if (player.team === trumpTeam) {
      throw new Error('Only opponent players can declare Half Coat.');
    }

    // Condition 1: Must have at least 2 different suits in hand
    const suits = new Set(player.hand.map(c => c.suit));
    if (suits.size < 2) {
      throw new Error('Half Coat requires at least 2 different suits in your hand.');
    }

    // Stop the countdown — this player is declaring
    this.clearHalfcoatCountdown();
    this.halfcoatDeclarerId = playerId;

    this.emitCallback('HALFCOAT_DECLARED', {
      declarerId: playerId,
      declarerName: player.username
    });

    // Transition to trump selection for the declarer
    this.transitionTo(CONFIG.GAME_PHASES.HALFCOAT_TRUMP_SELECTION);
  }

  /**
   * Half Coat declarer selects a new trump suit.
   * Validates Condition 2: at least one card of chosen suit must exist in the trump team's hands.
   * @param {string} playerId
   * @param {string} suit
   */
  selectHalfcoatTrump(playerId, suit) {
    if (this.phase !== CONFIG.GAME_PHASES.HALFCOAT_TRUMP_SELECTION) {
      throw new Error('Invalid phase for Half Coat trump selection.');
    }
    if (this.halfcoatDeclarerId !== playerId) {
      throw new Error('Only the Half Coat declarer can select trump.');
    }

    // Validate suit
    if (!CONFIG.SUITS.includes(suit)) {
      throw new Error('Invalid suit selected.');
    }

    // Condition 2: At least one card of chosen suit must exist in the trump team's hands
    const trumpTeam = this.roundManager.trumpTeam;
    const trumpTeamSeats = trumpTeam === 'A' ? [0, 2] : [1, 3];
    const trumpTeamPlayers = trumpTeamSeats.map(seat => this.players.find(p => p.seat === seat));
    const hasChosenSuit = trumpTeamPlayers.some(p =>
      p.hand.some(c => c.suit === suit)
    );

    if (!hasChosenSuit) {
      throw new Error('Invalid Half Coat: the opposing team has no cards of the chosen suit. Choose another suit.');
    }

    // Half Coat is valid — activate it
    this.isHalfcoatActive = true;
    this.roundManager.tricksPerHand = 4;
    this.roundManager.setTrump(suit);
    this.emitCallback('TRUMP_SUIT_ANNOUNCED', { suit });

    // The declarer plays alone; their teammate is out
    const declarer = this.players.find(p => p.id === playerId);
    const declarerTeamSeats = declarer.team === 'A' ? [0, 2] : [1, 3];
    const partner = this.players.find(p =>
      declarerTeamSeats.includes(p.seat) && p.id !== playerId
    );
    if (partner) {
      partner.clearHand();
      partner.isOut = true;
    }

    // Declarer leads first
    this.roundManager.activeTurnSeat = declarer.seat;

    this.emitCallback('HALFCOAT_ACTIVATED', {
      declarerId: playerId,
      declarerName: declarer.username,
      trumpSuit: suit,
      partnerOutId: partner ? partner.id : null
    });

    this.transitionTo(CONFIG.GAME_PHASES.PLAYING);
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

        if (this.isHalfcoatActive) {
          const declarer = this.players.find(p => p.id === this.halfcoatDeclarerId);
          const halfcoatTeam = declarer ? declarer.team : null;
          const trickWinnerTeam = result.trickResult.winningTeam;
          if (halfcoatTeam && trickWinnerTeam !== halfcoatTeam) {
            this.halfcoatFailed = true;
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
    // Half Coat scoring path
    if (this.isHalfcoatActive) {
      const halfcoatDeclarer = this.players.find(p => p.id === this.halfcoatDeclarerId);
      const halfcoatDeclarerTeam = halfcoatDeclarer ? halfcoatDeclarer.team : null;
      const SummaryData = this.scoreManager.finalizeHand(
        this.roundManager.trumpTeam,
        false,   // isFullcoatActive
        null,    // fullcoatDeclarerTeam
        false,   // fullcoatFailed
        true,    // isHalfcoatActive
        halfcoatDeclarerTeam,
        this.halfcoatFailed
      );

      this.emitCallback('ROUND_OVER_SUMMARY', SummaryData);

      this.halfcoatSummary = {
        win: SummaryData.isHalfcoatWin,
        points: SummaryData.allocatedPoints
      };

      this.transitionTo(CONFIG.GAME_PHASES.ROUND_END);

      setTimeout(() => {
        this.isHalfcoatActive = false;
        this.halfcoatSummary = null;

        const matchWinnerTeam = this.scoreManager.checkMatchWinner();
        if (matchWinnerTeam) {
          this.transitionTo(CONFIG.GAME_PHASES.MATCH_END);
        } else {
          this.players.forEach(p => p.clearHand());
          this.dealer.rotateDealer();
          this.transitionTo(CONFIG.GAME_PHASES.FIRST_DEAL);
        }
      }, 5000);
      return;
    }

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