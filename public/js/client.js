import { socketConnectionManager } from './socket.js';
import { Renderer } from './renderer.js';
import { AnimationEngine } from './animation.js';
import { AudioManager } from './audio.js';

class GameClient {
  constructor() {
    this.socket = socketConnectionManager.initialize();
    this.renderer = new Renderer();
    this.animation = new AnimationEngine();
    AudioManager.init();

    this.localState = { seat: null, currentGameState: null };

    this.bindDOMEvents();
    this.bindSocketEvents();
    this.showHomeScreen();
  }

  showGameScreen() {
    document.getElementById('home-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('match-end-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');
    document.querySelector('.landing-bg')?.classList.add('hidden');
    document.querySelector('.landing-overlay')?.classList.add('hidden');
  }

  showHomeScreen() {
    document.getElementById('home-screen')?.classList.remove('hidden');
    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('match-end-screen')?.classList.add('hidden');
    document.querySelector('.landing-bg')?.classList.remove('hidden');
    document.querySelector('.landing-overlay')?.classList.remove('hidden');
  }

  showLobbyScreen() {
    document.getElementById('home-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.remove('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('match-end-screen')?.classList.add('hidden');
    document.querySelector('.landing-bg')?.classList.remove('hidden');
    document.querySelector('.landing-overlay')?.classList.remove('hidden');
  }

  showMatchEndScreen() {
    document.getElementById('home-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('match-end-screen')?.classList.remove('hidden');
    document.getElementById('match-end-screen')?.classList.add('flex');
    document.querySelector('.landing-bg')?.classList.add('hidden');
    document.querySelector('.landing-overlay')?.classList.add('hidden');
  }

  joinRoom(roomCode) {
    const username = document.getElementById('input-username').value.trim();

    if (!username) return alert('NAME required');

    AudioManager.startBGM();

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

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;

        const text = chatInput.value.trim();
        if (!text) return;

        this.socket.emit('chatMessage', { text });
        chatInput.value = '';
      });
    }

    document.getElementById('btn-me-rematch')?.addEventListener('click', () => {
      this.socket.emit('rematch');
    });

    document.getElementById('btn-me-home')?.addEventListener('click', () => {
      this.socket.emit('returnHome');
      this.showHomeScreen();
    });
  }

  appendChatMessage({ senderId, text, timestamp }) {
    const container = document.getElementById('chat-messages');
    if (!container || !text) return;

    const players = this.localState.currentGameState?.players || [];
    const sender = players.find(p => p.id === senderId);
    const name = sender?.username || 'Player';
    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const line = document.createElement('div');
    line.textContent = time ? `[${time}] ${name}: ${text}` : `${name}: ${text}`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }

  bindSocketEvents() {
    this.socket.on('chatMessage', (payload) => {
      this.appendChatMessage(payload);
    });

    this.socket.on('syncState', (state) => {
      // 1. Capture the old state before we overwrite it
      const previousState = this.localState.currentGameState;
      
      // 2. Overwrite with the fresh incoming state
      this.localState.currentGameState = state;

      // 3. Audio Delta Tracking Engine
      if (previousState) {
        const oldTrick = previousState.currentTrick || [];
        const newTrick = state.currentTrick || [];

        // A card was thrown onto the table
        if (newTrick.length > oldTrick.length) {
          AudioManager.playSFX('cardPlay');
        }

        // The 4th card was played and the server cleared the table
        if (oldTrick.length === 4 && newTrick.length === 0) {
          AudioManager.playSFX('trickWin');
        }

        // The game transition hits the terminal state match end phase
        if (previousState.phase !== 'MATCH_END' && state.phase === 'MATCH_END') {
          AudioManager.stopBGM();
          AudioManager.playSFX('victory');
        }
      }

      // 4. Continue with your standard UI mapping properties
      const playerList = state.players || [];
      const identity = playerList.find(p => p.id === this.socket.id || p.username === document.getElementById('input-username').value.trim());

      if (identity) this.localState.seat = identity.seat;

      if (state.phase === 'LOBBY') {
        this.showLobbyScreen();
        this.renderer.renderLobby(state);
      } else if (state.phase === 'MATCH_END') {
        this.showMatchEndScreen();
        this.renderer.renderMatchEnd(state, this.localState.seat);
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

