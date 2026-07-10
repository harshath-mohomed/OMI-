import { socketConnectionManager } from './socket.js';
import { Renderer } from './renderer.js';
import { AnimationEngine } from './animation.js';

class GameClient {
  constructor() {
    this.socket = socketConnectionManager.initialize();
    this.renderer = new Renderer();
    this.animation = new AnimationEngine();

    this.localState = { seat: null, currentGameState: null };

    this.bindDOMEvents();
    this.bindSocketEvents();
    this.showHomeScreen();
  }

  showHomeScreen() {
    document.getElementById('home-screen')?.classList.remove('hidden');
    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
  }

  showLobbyScreen() {
    document.getElementById('home-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.remove('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
  }

  showGameScreen() {
    document.getElementById('home-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');
  }

  joinRoom(roomCode) {
    const username = document.getElementById('input-username').value.trim();

    if (!username) return alert('NAME required');

    this.socket.emit('joinRoom', { username, roomCode, asSpectator: false });
  }

  bindDOMEvents() {
    document.getElementById('btn-home-play').addEventListener('click', () => {
      const roomCode = document.getElementById('input-room').value.trim().toUpperCase();
      this.joinRoom(roomCode);
    });

    document.getElementById('input-username').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        document.getElementById('btn-home-play').click();
      }
    });

    document.getElementById('input-room').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        document.getElementById('btn-home-play').click();
      }
    });

    document.querySelectorAll('#trump-modal button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const suit = e.target.dataset.suit;
        this.socket.emit('chooseTrump', { suit });
        document.getElementById('trump-modal').classList.add('hidden');
      });
    });

    document.getElementById('player-hand-container').addEventListener('click', (e) => {
      const targetCard = e.target.closest('[data-card-id]');
      if (!targetCard) return;

      const cardId = targetCard.dataset.cardId;
      this.socket.emit('playCard', { cardId });
    });
  }

  bindSocketEvents() {
    this.socket.on('syncState', (state) => {
      this.localState.currentGameState = state;

      const playerList = state.players || [];
      const identity = playerList.find(p => p.id === this.socket.id || p.username === document.getElementById('input-username').value.trim());

      if (identity) this.localState.seat = identity.seat;

      if (state.phase === 'LOBBY') {
        this.showLobbyScreen();
        this.renderer.renderLobby(state);
      } else {
        this.showGameScreen();
      }

      const isYourTurn = state.activeTurnSeat === this.localState.seat && state.phase === 'PLAYING';
      this.renderer.renderHand(state.yourHand || [], isYourTurn);
      this.renderer.renderTrick(state.currentTrick || [], this.localState.seat);
      this.renderer.updateMetadata(state, this.localState.seat);

      const trumpModal = document.getElementById('trump-modal');
      const chooserSeat = state.trumpChooserId
        ? (state.players || []).find(p => p.id === state.trumpChooserId)?.seat
        : null;

      if (state.phase === 'TRUMP_SELECTION' && chooserSeat === this.localState.seat) {
        trumpModal.classList.remove('hidden');
      } else {
        trumpModal.classList.add('hidden');
      }

      if (state.phase === 'LOBBY' && playerList.length === 4 && this.localState.seat === 0) {
        this.socket.emit('startMatch');
      }
    });
  }
}

new GameClient();
