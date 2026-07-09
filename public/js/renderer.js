/** State-Driven DOM Rendering Pipeline Engine Component. */
export class Renderer {
  constructor() {
    this.handContainer = document.getElementById('player-hand-container');
    this.suitSymbols = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };
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

  updateMetadata(state, localSeat) {
    document.getElementById('display-room').innerText = state.roomCode || '----';
    document.getElementById('score-team-a').innerText = state.matchScores.A;
    document.getElementById('score-team-b').innerText = state.matchScores.B;
    document.getElementById('display-trump').innerText = state.trumpSuit ? `${this.suitSymbols[state.trumpSuit]} ${state.trumpSuit}` : 'None';

    // Map global positional assignments mapping onto contextual viewport indices
    state.players.forEach(p => {
      const relativePosition = this.getRelativePositionLabel(p.seat, localSeat);
      const element = document.getElementById(`seat-${relativePosition}`);
      if (element) {
        element.innerText = `${p.username} ${state.activeTurnSeat === p.seat ? '(Turn)' : ''}`;
      }
    });
  }

  getRelativePositionLabel(targetSeat, localSeat) {
    const diff = (targetSeat - localSeat + 4) % 4;
    if (diff === 0) return 'bottom';
    if (diff === 1) return 'right';
    if (diff === 2) return 'top';
    if (diff === 3) return 'left';
  }
}