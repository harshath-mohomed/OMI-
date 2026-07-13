/** State-Driven DOM Rendering Pipeline Engine Component. */
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

  renderHand(cards, isYourTurn) {
    this.handContainer.innerHTML = '';

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

  renderLobby(state) {
    const players = state.players || [];
    const seatLabels = [0, 2, 1, 3];

    seatLabels.forEach((seat) => {
      const element = document.getElementById(`lobby-seat-${seat}`);
      if (!element) return;

      const player = players.find((entry) => entry.seat === seat);
      element.innerText = player ? player.username : 'waiting';
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
    const tokensWonRed   = 10 - (matchScores.A ?? 10); // Red drained Black

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

      if (relativePosition === 'bottom') continue;

      if (relativePosition === 'top') {
        labelEl.innerText = player ? player.username : 'my team mate';
      } else {
        labelEl.innerText = player ? player.username : 'opponent player';
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
    
    this.setElementText('me-team-a-name', 'TEAM BLACK');
    this.setElementText('me-team-b-name', 'TEAM RED');

    this.setElementText('me-team-a-tricks', `${stats.totalTricks.A} / ${totalMatchTricks}`);
    this.setElementText('me-team-b-tricks', `${stats.totalTricks.B} / ${totalMatchTricks}`);

    [0, 1, 2, 3].forEach(seat => {
      const p = players.find(player => player.seat === seat);
      const nameEl = document.getElementById(`me-p${seat}-name`);
      if (nameEl) {
        nameEl.innerText = p ? p.username : `Player ${seat+1}`;
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
      this.setElementText('me-winner-name', 'TEAM BLACK');
      if (winnerNameEl) winnerNameEl.style.color = 'var(--cyan)';
    } else if (endData.winnerTeam === 'B') {
      teamBEl?.classList.add('winner');
      teamBEl?.classList.remove('loser');
      teamAEl?.classList.add('loser');
      teamAEl?.classList.remove('winner');
      this.setElementText('me-winner-name', 'TEAM RED');
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
}
