/** State-Driven DOM Rendering Pipeline Engine Component. */
export class Renderer {
  constructor() {
    this.handContainer = document.getElementById('player-hand-container');
    this.trickMat = document.getElementById('trick-mat');
    this.suitSymbols = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };
  }

  setElementText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.innerText = value;
    }
  }

  renderHand(cards, isYourTurn) {
    this.handContainer.innerHTML = '';
    cards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = `card-element w-20 h-28 bg-white text-black rounded-lg shadow-md flex flex-col justify-between p-2 font-bold cursor-pointer hover:-translate-y-4 ${
        card.suit === 'HEARTS' || card.suit === 'DIAMONDS' ? 'text-red-600' : 'text-gray-900'
      }`;
      cardEl.dataset.cardId = card.id;

      cardEl.innerHTML = `
        <div class="text-left">${card.rank}</div>
        <div class="text-center text-2xl">${this.suitSymbols[card.suit]}</div>
        <div class="text-right">${card.rank}</div>
      `;

      if (!isYourTurn) {
        cardEl.classList.add('opacity-80', 'pointer-events-none');
      }

      this.handContainer.appendChild(cardEl);
    });
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
      top: 'top-3 left-1/2 -translate-x-1/2',
      right: 'right-3 top-1/2 -translate-y-1/2',
      bottom: 'bottom-3 left-1/2 -translate-x-1/2',
      left: 'left-3 top-1/2 -translate-y-1/2'
    };

    currentTrick.forEach((play) => {
      const slot = slotMap[play.seat] || 'bottom';
      const cardEl = document.createElement('div');
      cardEl.className = `card-element absolute ${slotStyles[slot]} w-14 h-20 bg-white text-black rounded-md shadow-lg flex flex-col justify-between p-2 font-bold ${
        play.card.suit === 'HEARTS' || play.card.suit === 'DIAMONDS' ? 'text-red-600' : 'text-gray-900'
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

    this.setElementText('display-connection-url', window.location.origin);
    this.setElementText('display-room', state.roomCode || 'Waiting...');
    this.setElementText('display-phase', state.phase || 'LOBBY');
    this.setElementText('score-team-a', matchScores.A ?? 10);
    this.setElementText('score-team-b', matchScores.B ?? 10);
    this.setElementText('team-a-label', this.formatTeamLabel(players, [0, 2], 'Team A'));
    this.setElementText('team-b-label', this.formatTeamLabel(players, [1, 3], 'Team B'));
    this.setElementText('display-trump', state.trumpSuit ? `${this.suitSymbols[state.trumpSuit]} ${state.trumpSuit}` : 'None');

    const localSeatIndex = typeof localSeat === 'number' ? localSeat : null;
    for (let seat = 0; seat < 4; seat += 1) {
      const relativePosition = this.getRelativePositionLabel(seat, localSeatIndex);
      const element = document.getElementById(`seat-${relativePosition}`);
      if (!element) continue;

      const player = players.find(p => p.seat === seat);
      const turnTag = state.activeTurnSeat === seat ? ' (Turn)' : '';
      element.innerText = player ? `${player.username}${turnTag}` : `Seat ${seat} open`;
    }

    document.title = state.roomCode ? `OMI - Room ${state.roomCode}` : 'OMI Multiplayer Authorization Arena';
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
