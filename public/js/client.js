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
  }

  bindDOMEvents() {
    document.getElementById('btn-join').addEventListener('click', () => {
      const username = document.getElementById('input-username').value.trim();
      const roomCode = document.getElementById('input-room').value.trim().toUpperCase();
      
      if (!username) return alert('Username required');

      this.socket.emit('joinRoom', { username, roomCode, asSpectator: false });
    });

    // Intercept Modal asset control choices
    document.querySelectorAll('#trump-modal button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const suit = e.target.dataset.suit;
        this.socket.emit('chooseTrump', { suit });
        document.getElementById('trump-modal').classList.add('hidden');
      });
    });

    // Delegated operational play interception triggers
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
      
      // Added data guard fallback (state.players || []) to completely prevent undefined crashes
      const playerList = state.players || [];
      const identity = playerList.find(p => p.id === this.socket.id || p.username === document.getElementById('input-username').value.trim());
      
      if (identity) this.localState.seat = identity.seat;

      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');

      const isYourTurn = state.activeTurnSeat === this.localState.seat && state.phase === 'PLAYING';
      this.renderer.renderHand(state.yourHand || [], isYourTurn);
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

// Initial structural bootstrap execution orchestration allocation call
new GameClient();