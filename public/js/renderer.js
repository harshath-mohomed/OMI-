/** State-Driven DOM Rendering Pipeline Engine Component. */
export class Renderer {
  constructor() {
    this.handContainer = document.getElementById('player-hand-container');
    this.trickMat = document.getElementById('trick-mat');
    this.suitSymbols = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };
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
        cardEl.className = `hand-slot filled card-element ${isRed ? 'red-suit' : 'black-suit'}`;
        cardEl.dataset.cardId = card.id;
        cardEl.innerHTML = `
          <div class="text-left text-sm">${card.rank}</div>
          <div class="text-center text-2xl">${this.suitSymbols[card.suit]}</div>
          <div class="text-right text-sm">${card.rank}</div>
        `;

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
      const isRed = play.card.suit === 'HEARTS' || play.card.suit === 'DIAMONDS';
      const cardEl = document.createElement('div');
      cardEl.className = `card-element absolute ${slotStyles[slot]} w-14 h-20 bg-white rounded-md shadow-lg flex flex-col justify-between p-2 font-bold ${
        isRed ? 'text-red-600' : 'text-gray-900'
      }`;
      cardEl.innerHTML = `
        <div class="text-left text-xs">${play.card.rank}</div>
        <div class="text-center text-lg">${this.suitSymbols[play.card.suit]}</div>
        <div class="text-right text-xs">${play.card.rank}</div>
      `;
      this.trickMat.appendChild(cardEl);
    });
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
    this.setElementText('score-team-a', matchScores.A ?? 10);
    this.setElementText('score-team-b', matchScores.B ?? 10);
    this.setElementText('team-a-label', this.formatTeamLabel(players, [0, 2], 'Team Black'));
    this.setElementText('team-b-label', this.formatTeamLabel(players, [1, 3], 'Team Red'));

    const trumpDisplay = state.trumpSuit
      ? this.suitSymbols[state.trumpSuit]
      : '—';
    this.setElementText('display-trump', trumpDisplay);

    this.setElementText('score-tricks-black', `${roundTricks.A ?? 0} / 8`);
    this.setElementText('score-tricks-red', `${roundTricks.B ?? 0} / 8`);

    const roundsWon = localTeam
      ? Math.max(0, 10 - (matchScores[localTeam === 'A' ? 'B' : 'A'] ?? 10))
      : Math.max(0, 10 - Math.min(matchScores.A ?? 10, matchScores.B ?? 10));
    this.setElementText('total-rounds-win', `${roundsWon}/10`);

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
}
