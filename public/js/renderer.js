/** State-Driven DOM Rendering Pipeline Engine Component. */
import { LanguageEngine } from './lang.js';

const RANK_VALUES = {
  'A': 8, 'K': 7, 'Q': 6, 'J': 5,
  '10': 4, '9': 3, '8': 2, '7': 1
};

const SUIT_ORDER = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];

export class Renderer {
  constructor() {
    this.handContainer = document.getElementById('player-hand-container');
    this.trickMat = document.getElementById('trick-mat');
    this.suitSymbols = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };
    this.rankNameMap = {
      A: 'ace',
      K: 'king',
      Q: 'queen',
      J: 'jack',
      '10': '10',
      '9': '9',
      '8': '8',
      '7': '7'
    };
    this.suitNameMap = {
      HEARTS: 'hearts',
      DIAMONDS: 'diamonds',
      CLUBS: 'clubs',
      SPADES: 'spades'
    };
    this.handSize = 8;
  }

  setElementText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.innerText = value;
    }
  }

  renderHand(cards, isYourTurn, trumpSuit, selectedExchangeCards = []) {
    this.handContainer.innerHTML = '';

    if (trumpSuit) {
      cards = [...cards].sort((a, b) => {
        const suitOrder = (suit) => suit === trumpSuit ? 0 : 1;
        if (suitOrder(a.suit) !== suitOrder(b.suit)) return suitOrder(a.suit) - suitOrder(b.suit);
        if (a.suit !== b.suit) {
          return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
        }
        return (RANK_VALUES[b.rank] ?? 0) - (RANK_VALUES[a.rank] ?? 0);
      });
    }

    for (let slot = 0; slot < this.handSize; slot += 1) {
      const card = cards[slot];

      if (card) {
        const cardEl = document.createElement('div');
        const isRed = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
        const assetPath = this.getCardAssetPath(card);
        cardEl.className = `hand-slot filled card-element ${isRed ? 'red-suit' : 'black-suit'} ${assetPath ? 'asset-card' : ''}`;
        cardEl.dataset.cardId = card.id;
        cardEl.innerHTML = this.getCardFaceMarkup(card, assetPath);

        if (!isYourTurn) {
          cardEl.classList.add('disabled');
        }

        if (selectedExchangeCards.includes(card.id)) {
          cardEl.classList.add('exchange-selected');
        } else if (selectedExchangeCards.length > 0) {
          cardEl.classList.add('exchange-dimmed');
        }

        this.handContainer.appendChild(cardEl);
      } else {
        const slotEl = document.createElement('div');
        slotEl.className = 'hand-slot';
        slotEl.setAttribute('aria-hidden', 'true');
        this.handContainer.appendChild(slotEl);
      }
    }
  }

  renderTrick(currentTrick, localSeat) {
    if (!this.trickMat) return;

    this.trickMat.innerHTML = '';

    const slotMap = localSeat === null || localSeat === undefined
      ? { 0: 'bottom', 1: 'right', 2: 'top', 3: 'left' }
      : {
        [(localSeat + 0) % 4]: 'bottom',
        [(localSeat + 1) % 4]: 'right',
        [(localSeat + 2) % 4]: 'top',
        [(localSeat + 3) % 4]: 'left'
      };

    const slotStyles = {
      top: 'top-0 left-1/2 -translate-x-1/2',
      right: 'right-0 top-1/2 -translate-y-1/2',
      bottom: 'bottom-0 left-1/2 -translate-x-1/2',
      left: 'left-0 top-1/2 -translate-y-1/2'
    };

    currentTrick.forEach((play) => {
      const slot = slotMap[play.seat] || 'bottom';
      const assetPath = this.getCardAssetPath(play.card);
      const cardEl = document.createElement('div');
      cardEl.className = `card-element trick-card absolute ${slotStyles[slot]} w-14 h-20 rounded-md shadow-lg overflow-hidden bg-white ${assetPath ? 'asset-card' : ''}`;
      cardEl.innerHTML = this.getCardFaceMarkup(play.card, assetPath);
      this.trickMat.appendChild(cardEl);
    });
  }

  getCardFaceMarkup(card, assetPath = this.getCardAssetPath(card)) {
    if (!assetPath) {
      return `
        <div class="text-left text-sm">${card.rank}</div>
        <div class="text-center text-2xl">${this.suitSymbols[card.suit] || ''}</div>
        <div class="text-right text-sm">${card.rank}</div>
      `;
    }

    return `<img src="${assetPath}" alt="${card.rank} of ${card.suit}" class="card-face-asset" draggable="false" />`;
  }

  getCardAssetPath(card) {
    if (!card || !card.rank || !card.suit) return null;

    const rank = this.rankNameMap[card.rank];
    const suit = this.suitNameMap[card.suit];
    if (!rank || !suit) return null;

    const useVariantTwo = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
    const variantSuffix = useVariantTwo ? '2' : '';

    return `/assets/SVG-cards-1.3/${rank}_of_${suit}${variantSuffix}.svg`;
  }

  renderLobby(state, localPlayer) {
    const players = state.players || [];
    const seatLabels = [0, 2, 1, 3];

    seatLabels.forEach((seat) => {
      const element = document.getElementById(`lobby-seat-${seat}`);
      if (!element) return;

      const player = players.find((entry) => entry.seat === seat);
      element.innerText = player ? player.username : LanguageEngine.get('waiting'); 
    });

    this.setElementText('lobby-room-code', state.roomCode ? `ROOM ${state.roomCode}` : 'ROOM ----');

    const countdownEl = document.getElementById('lobby-countdown');
    if (countdownEl) {
      if (typeof state.lobbyCountdown === 'number') {
        countdownEl.innerText = `MATCH STARTS IN ${state.lobbyCountdown}...`;
        countdownEl.classList.remove('hidden');
      } else {
        countdownEl.classList.add('hidden');
      }
    }

    const btnBlack = document.getElementById('btn-join-black');
    const btnRed = document.getElementById('btn-join-red');

    if (btnBlack && btnRed) {
      const teamAPlayers = players.filter(p => [0, 2].includes(p.seat));
      const teamBPlayers = players.filter(p => [1, 3].includes(p.seat));

      const isTeamAFull = teamAPlayers.length >= 2;
      const isTeamBFull = teamBPlayers.length >= 2;

      const hasSeat = localPlayer && localPlayer.seat !== null;
      const currentTeam = localPlayer ? localPlayer.team : null;

      // Handle Black Button
      if (currentTeam === 'A') {
        btnBlack.style.display = 'none';
        btnBlack.disabled = true;
      } else {
        btnBlack.style.display = 'block';
        if (state.pendingTeamRequest && state.pendingTeamRequest.targetTeam === 'A') {
          btnBlack.innerText = LanguageEngine.get('pending');
          btnBlack.disabled = true;
          btnBlack.className = 'join-team-btn play-action pending';
        } else {
          btnBlack.innerText = isTeamAFull ? LanguageEngine.get('full') : LanguageEngine.get('joinBlack');
          btnBlack.disabled = hasSeat;
          btnBlack.className = 'join-team-btn play-action' + (isTeamAFull ? ' full' : '');
        }
      }

      // Handle Red Button
      if (currentTeam === 'B') {
        btnRed.style.display = 'none';
        btnRed.disabled = true;
      } else {
        btnRed.style.display = 'block';
        if (state.pendingTeamRequest && state.pendingTeamRequest.targetTeam === 'B') {
          btnRed.innerText = 'PENDING...';
          btnRed.disabled = true;
          btnRed.className = 'join-team-btn play-action pending';
        } else {
          btnRed.innerText = isTeamBFull ? LanguageEngine.get('full') : LanguageEngine.get('joinRed');
          btnRed.disabled = hasSeat;
          btnRed.className = 'join-team-btn play-action' + (isTeamBFull ? ' full' : '');
        }
      }
    }

    if (localPlayer) {
      const motoNames = {
        'ceaser': 'Ceaser',
        'dagger-rose': 'Dagger Rose',
        'diamonds-smile': 'Diamonds Smile',
        'greek-sphinx': 'Greek Sphinx',
        'robe': 'Robe',
        'robot-golem': 'Robot Golem',
        'rocket': 'Rocket',
        'rouge': 'Rouge',
        'shambling-zombie': 'Shambling Zombie',
        'vampire-dracula': 'Vampire Dracula',
        'winged-sword': 'Winged Sword',
        'wolf-head': 'Wolf Head'
      };

      const motoId = localPlayer.motoId || 'wolf-head';
      this.setElementText('lobby-moto-name', motoNames[motoId] || 'Wolf Head');

      const motoIcon = document.getElementById('lobby-moto-icon');
      if (motoIcon) {
        motoIcon.src = `/src/icons/${motoId}.svg`;
      }
    }
  }

  updateMetadata(state, localSeat) {
    const players = state.players || [];
    const matchScores = state.matchScores || { A: 10, B: 10 };
    const roundTricks = state.roundTricks || { A: 0, B: 0 };
    const localSeatIndex = typeof localSeat === 'number' ? localSeat : null;
    const localTeam = this.getTeamForSeat(localSeatIndex);

    this.setElementText('display-connection-url', window.location.origin);
    this.setElementText('display-room', state.roomCode || 'Waiting...');
    this.setElementText('display-phase', state.phase || 'LOBBY');
    const roundsWon = state.roundsWon || { A: 0, B: 0 };
    const tokensWonA = 10 - (matchScores.B ?? 10);
    const tokensWonB = 10 - (matchScores.A ?? 10);

    const tokensWonBlack = 10 - (matchScores.B ?? 10); // Black drained Red
    const tokensWonRed = 10 - (matchScores.A ?? 10); // Red drained Black

    this.setElementText('score-team-a', `${tokensWonBlack} / ${matchScores.A ?? 10}`); // left panel
    this.setElementText('score-team-b', `${tokensWonRed} / ${matchScores.B ?? 10}`);   // right panel
    this.setElementText('rounds-won-black', roundsWon.A ?? 0);
    this.setElementText('rounds-won-red', roundsWon.B ?? 0);

    this.setElementText('team-a-label', this.formatTeamLabel(players, [0, 2], 'Team Black'));
    this.setElementText('team-b-label', this.formatTeamLabel(players, [1, 3], 'Team Red'));

    const trumpDisplay = state.trumpSuit
      ? this.suitSymbols[state.trumpSuit]
      : '—';
    const trumpEl = document.getElementById('display-trump');
    if (trumpEl) {
      trumpEl.innerText = trumpDisplay;
      if (state.trumpSuit === 'CLUBS' || state.trumpSuit === 'SPADES') {
        trumpEl.style.color = '#000000';
      } else if (state.trumpSuit === 'DIAMONDS' || state.trumpSuit === 'HEARTS') {
        trumpEl.style.color = '#ff0000';
      } else {
        trumpEl.style.color = '';
      }
    }

    this.setElementText('score-tricks-black', `${roundTricks.A ?? 0} / 8`);
    this.setElementText('score-tricks-red', `${roundTricks.B ?? 0} / 8`);

    const localRoundsWon = localTeam ? (roundsWon[localTeam] ?? 0) : (roundsWon.A ?? 0);
    this.setElementText('total-rounds-win', `${localRoundsWon}/10`);

    this.updateTeamStatusBars(state.activeTurnSeat, players);
    this.updateSeatLabels(state, localSeatIndex);

    document.title = state.roomCode ? `OMI - Room ${state.roomCode}` : 'OMI Multiplayer Authorization Arena';
  }

  updateTeamStatusBars(activeTurnSeat, players) {
    const redBar = document.getElementById('status-bar-red');
    const blackBar = document.getElementById('status-bar-black');
    if (!redBar || !blackBar) return;

    redBar.style.opacity = '1';
    blackBar.style.opacity = '1';

    if (typeof activeTurnSeat !== 'number') return;

    const activeTeam = this.getTeamForSeat(activeTurnSeat);
    if (activeTeam === 'B') {
      blackBar.style.opacity = '0.35';
    } else if (activeTeam === 'A') {
      redBar.style.opacity = '0.35';
    }
  }

  updateSeatLabels(state, localSeat) {
    const players = state.players || [];

    for (let seat = 0; seat < 4; seat += 1) {
      const relativePosition = this.getRelativePositionLabel(seat, localSeat);
      const element = document.getElementById(`seat-${relativePosition}`);
      if (!element) continue;

      const labelEl = element.querySelector('.seat-label') || element;
      const player = players.find(p => p.seat === seat);
      const isActive = state.activeTurnSeat === seat;

      element.classList.toggle('active-turn', isActive);

      let overlay = element.querySelector('.sitting-out-overlay');
      if (overlay) {
        overlay.remove();
      }

      if (relativePosition === 'bottom') continue;

      if (relativePosition === 'top') {
        labelEl.innerText = player ? player.username : LanguageEngine.get('myTeamMate');
      } else {
        labelEl.innerText = player ? player.username : LanguageEngine.get('opponentPlayer');
      }
    }
  }

  getTeamForSeat(seat) {
    if (seat === 0 || seat === 2) return 'A';
    if (seat === 1 || seat === 3) return 'B';
    return null;
  }

  formatTeamLabel(players, seats, fallbackLabel) {
    const names = seats
      .map(seat => players.find(player => player.seat === seat)?.username)
      .filter(Boolean);

    return names.length ? names.join(' + ') : fallbackLabel;
  }

  getRelativePositionLabel(targetSeat, localSeat) {
    if (localSeat === null) {
      if (targetSeat === 0) return 'bottom';
      if (targetSeat === 1) return 'right';
      if (targetSeat === 2) return 'top';
      if (targetSeat === 3) return 'left';
    }

    const diff = (targetSeat - localSeat + 4) % 4;
    if (diff === 0) return 'bottom';
    if (diff === 1) return 'right';
    if (diff === 2) return 'top';
    if (diff === 3) return 'left';
  }

  renderMatchEnd(state, localSeat) {
    const endData = state.matchEndData;
    if (!endData) return;

    const stats = endData.stats;
    const mvp = endData.mvp;
    const players = state.players || [];

    const totalMatchTricks = stats.roundsPlayed * 8;

    this.setElementText('me-team-a-name', LanguageEngine.get('teamBlack'));
    this.setElementText('me-team-b-name', LanguageEngine.get('teamRed'));

    this.setElementText('me-team-a-tricks', `${stats.totalTricks.A} / ${totalMatchTricks}`);
    this.setElementText('me-team-b-tricks', `${stats.totalTricks.B} / ${totalMatchTricks}`);

    [0, 1, 2, 3].forEach(seat => {
      const p = players.find(player => player.seat === seat);
      const nameEl = document.getElementById(`me-p${seat}-name`);
      if (nameEl) {
        nameEl.innerText = p ? p.username : `Player ${seat + 1}`;
        if (mvp && p && p.id === mvp.id) {
          nameEl.classList.add('is-mvp');
        } else {
          nameEl.classList.remove('is-mvp');
        }
      }
      this.setElementText(`me-p${seat}-tricks`, `${stats.playerTricks[seat] || 0} / ${totalMatchTricks}`);
    });

    this.setElementText('me-team-a-kapothi', stats.kapothiReceived.A);
    this.setElementText('me-team-b-kapothi', stats.kapothiReceived.B);

    ['me-team-a-kapothi', 'me-team-b-kapothi'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('flash-red');
        void el.offsetWidth;
        el.classList.add('flash-red');
      }
    });

    this.setElementText('me-total-kapothi', stats.kapothiReceived.A + stats.kapothiReceived.B);
    this.setElementText('me-total-draws', stats.draws);

    this.setElementText('me-team-a-rounds', `${stats.roundsWon.A} / ${stats.roundsPlayed}`);
    this.setElementText('me-team-b-rounds', `${stats.roundsWon.B} / ${stats.roundsPlayed}`);

    const teamAEl = document.getElementById('me-team-a-rounds');
    const teamBEl = document.getElementById('me-team-b-rounds');
    const winnerNameEl = document.getElementById('me-winner-name');

    if (endData.winnerTeam === 'A') {
      teamAEl?.classList.add('winner');
      teamAEl?.classList.remove('loser');
      teamBEl?.classList.add('loser');
      teamBEl?.classList.remove('winner');
      this.setElementText('me-winner-name', LanguageEngine.get('teamBlack'));
      if (winnerNameEl) winnerNameEl.style.color = 'var(--cyan)';
    } else if (endData.winnerTeam === 'B') {
      teamBEl?.classList.add('winner');
      teamBEl?.classList.remove('loser');
      teamAEl?.classList.add('loser');
      teamAEl?.classList.remove('winner');
      this.setElementText('me-winner-name', LanguageEngine.get('teamRed'));
      if (winnerNameEl) winnerNameEl.style.color = 'var(--red)';
    } else {
      teamAEl?.classList.remove('winner', 'loser');
      teamBEl?.classList.remove('winner', 'loser');
      this.setElementText('me-winner-name', 'NONE');
    }

    if (mvp) {
      this.setElementText('me-mvp-name', mvp.username);
      this.setElementText('me-mvp-tricks', `${mvp.tricks_won} / ${totalMatchTricks}`);
      this.setElementText('me-mvp-score', `${Math.round(mvp.score * 10) / 10} / 10`);
      this.setElementText('me-mvp-kapothi', mvp.kapothi_dealt);

      const iconEl = document.getElementById('me-mvp-icon');
      if (iconEl) {
        iconEl.src = mvp.avatar_url || '/src/icons/wolf-head.svg';
      }
    }
  }

  renderFullcoat(state, localPlayer, selectedExchangeCards = []) {
    const fullcoatOverlay = document.getElementById('fullcoat-overlay');
    const decisionCard = document.getElementById('fullcoat-decision-card');
    const promptCard = document.getElementById('fullcoat-prompt-card');
    const statusCard = document.getElementById('fullcoat-status-card');
    const statusText = document.getElementById('fullcoat-status-text');
    const exchangeContainer = document.getElementById('fullcoat-exchange-container');
    const confirmBtn = document.getElementById('btn-fullcoat-exchange-confirm');
    const roundModal = document.getElementById('fullcoat-round-modal');

    if (fullcoatOverlay) fullcoatOverlay.classList.add('hidden');
    if (decisionCard) decisionCard.classList.add('hidden');
    if (promptCard) promptCard.classList.add('hidden');
    if (statusCard) statusCard.classList.add('hidden');
    if (exchangeContainer) exchangeContainer.classList.add('hidden');
    if (confirmBtn) confirmBtn.classList.add('hidden');
    if (roundModal) roundModal.classList.add('hidden');

    if (state.phase === 'FULLCOAT_DECISION') {
      if (fullcoatOverlay) fullcoatOverlay.classList.remove('hidden');

      if (!state.fullcoatRequest) {
        const isCurrentAsker = state.fullcoatCurrentAskerId === localPlayer?.id;
        if (isCurrentAsker) {
          if (decisionCard) decisionCard.classList.remove('hidden');
        } else {
          if (statusCard && statusText) {
            const askerName = state.players?.find(p => p.id === state.fullcoatCurrentAskerId)?.username || 'Opponent';
            statusText.innerText = `Waiting for ${askerName} to declare play...`;
            statusCard.classList.remove('hidden');
          }
        }
      } else {
        const isPartner = state.fullcoatRequest.partnerId === localPlayer?.id;
        if (isPartner) {
          if (promptCard) promptCard.classList.remove('hidden');
        } else {
          if (statusCard && statusText) {
            statusText.innerText = `Waiting for ${state.fullcoatRequest.declarerName}'s partner to respond...`;
            statusCard.classList.remove('hidden');
          }
        }
      }
    }

    if (state.phase === 'FULLCOAT_EXCHANGE') {
      const isExchanger = state.isFullcoatActive && (localPlayer?.id === state.fullcoatDeclarerId || localPlayer?.id === state.fullcoatPartnerId);
      if (isExchanger) {
        if (exchangeContainer) exchangeContainer.classList.remove('hidden');
        if (confirmBtn) {
          if (selectedExchangeCards.length === 2 && !state.fullcoatExchange?.confirmed?.[localPlayer?.id]) {
            confirmBtn.classList.remove('hidden');
          } else {
            confirmBtn.classList.add('hidden');
          }
        }
      }

      if (isExchanger && state.fullcoatExchange?.confirmed?.[localPlayer?.id]) {
        if (fullcoatOverlay) {
          fullcoatOverlay.classList.remove('hidden');
          if (statusCard && statusText) {
            statusText.innerText = 'Waiting for other player to confirm exchange...';
            statusCard.classList.remove('hidden');
          }
        }
      } else if (!isExchanger) {
        if (fullcoatOverlay) {
          fullcoatOverlay.classList.remove('hidden');
          if (statusCard && statusText) {
            statusText.innerText = 'Card exchange in progress...';
            statusCard.classList.remove('hidden');
          }
        }
      }
    }
    if (state.phase === 'FULLCOAT_TRUMP_SELECTION') {
      const isDeclarerLocal = localPlayer?.id === state.fullcoatDeclarerId;
      if (!isDeclarerLocal) {
        if (fullcoatOverlay) fullcoatOverlay.classList.remove('hidden');
        if (statusCard && statusText) {
          const declarer = state.players?.find(p => p.id === state.fullcoatDeclarerId);
          statusText.innerText = `Waiting for ${declarer?.username || 'declarer'} to choose trump...`;
          statusCard.classList.remove('hidden');
        }
      }
      // declarer: overlay stays hidden, trump modal renders on top unblocked
    }
    if (state.phase === 'ROUND_END' && state.fullcoatSummary) {
      if (roundModal) {
        const titleEl = document.getElementById('fullcoat-round-title');
        const bodyEl = document.getElementById('fullcoat-round-body');

        const declarer = state.players?.find(p => p.id === state.fullcoatDeclarerId);
        const declarerTeam = declarer?.team;
        const isMyTeamDeclarer = (localPlayer && declarerTeam && localPlayer.team === declarerTeam);
        const points = state.fullcoatSummary.points;

        if (state.fullcoatSummary.win) {
          // Declaring team won all tricks
          if (isMyTeamDeclarer) {
            if (titleEl) { titleEl.innerText = 'FULLCOAT Successful!'; titleEl.style.color = '#00f7ff'; }
            if (bodyEl) { bodyEl.innerText = `+${points} Tokens`; }
          } else {
            if (titleEl) { titleEl.innerText = 'Opponent FULLCOAT Successful.'; titleEl.style.color = '#ff0a0a'; }
            if (bodyEl) { bodyEl.innerText = `-${points} Tokens`; }
          }
        } else {
          // Declaring team lost a trick
          if (isMyTeamDeclarer) {
            if (titleEl) { titleEl.innerText = 'FULLCOAT Failed!'; titleEl.style.color = '#ff0a0a'; }
            if (bodyEl) { bodyEl.innerHTML = `You lost a trick.<br>-${points} Tokens`; }
          } else {
            if (titleEl) { titleEl.innerText = 'Opponent FULLCOAT Failed!'; titleEl.style.color = '#00f7ff'; }
            if (bodyEl) { bodyEl.innerText = `+${points} Tokens`; }
          }
        }
        roundModal.classList.remove('hidden');
      }
    }

    let handOverlay = document.getElementById('hand-sitting-out-overlay');
    if (handOverlay) {
      handOverlay.remove();
    }
  }
}
