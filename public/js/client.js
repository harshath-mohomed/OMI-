import { socketConnectionManager } from './socket.js';
import { Renderer } from './renderer.js';
import { AnimationEngine } from './animation.js';
import { AudioManager } from './audio.js';
import { SettingsManager } from './settings.js';

class GameClient {
  constructor() {
    this.socket = socketConnectionManager.initialize();
    this.renderer = new Renderer();
    this.animation = new AnimationEngine();
    AudioManager.init();
    SettingsManager.init(AudioManager);

    this.localState = { seat: null, currentGameState: null };
    this.selectedExchangeCards = [];
    this.motoCatalog = {
      'ceaser': { label: 'Ceaser', icon: '/src/icons/ceaser.svg' },
      'dagger-rose': { label: 'Dagger Rose', icon: '/src/icons/dagger-rose.svg' },
      'diamonds-smile': { label: 'Diamonds Smile', icon: '/src/icons/diamonds-smile.svg' },
      'greek-sphinx': { label: 'Greek Sphinx', icon: '/src/icons/greek-sphinx.svg' },
      'robe': { label: 'Robe', icon: '/src/icons/robe.svg' },
      'robot-golem': { label: 'Robot Golem', icon: '/src/icons/robot-golem.svg' },
      'rocket': { label: 'Rocket', icon: '/src/icons/rocket.svg' },
      'rouge': { label: 'Rouge', icon: '/src/icons/rouge.svg' },
      'shambling-zombie': { label: 'Shambling Zombie', icon: '/src/icons/shambling-zombie.svg' },
      'vampire-dracula': { label: 'Vampire Dracula', icon: '/src/icons/vampire-dracula.svg' },
      'winged-sword': { label: 'Winged Sword', icon: '/src/icons/winged-sword.svg' },
      'wolf-head': { label: 'Wolf Head', icon: '/src/icons/wolf-head.svg' }
    };

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
    SettingsManager.repositionForScreen('game');
  }

  showHomeScreen() {
    document.getElementById('home-screen')?.classList.remove('hidden');
    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('match-end-screen')?.classList.add('hidden');
    document.querySelector('.landing-bg')?.classList.remove('hidden');
    document.querySelector('.landing-overlay')?.classList.remove('hidden');
    SettingsManager.repositionForScreen('home');
  }

  showLobbyScreen() {
    document.getElementById('home-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.remove('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('match-end-screen')?.classList.add('hidden');
    document.querySelector('.landing-bg')?.classList.remove('hidden');
    document.querySelector('.landing-overlay')?.classList.remove('hidden');
    SettingsManager.repositionForScreen('lobby');
  }

  openMotoModal() {
    document.getElementById('moto-modal')?.classList.remove('hidden');
  }

  closeMotoModal() {
    document.getElementById('moto-modal')?.classList.add('hidden');
  }

  selectMoto(motoId) {
    if (!motoId) return;
    this.socket.emit('selectMoto', { motoId });
    this.closeMotoModal();
  }

  updateLobbyMotoPreview(player) {
    const moto = player?.motoId ? this.motoCatalog[player.motoId] : null;
    const iconEl = document.getElementById('lobby-moto-icon');
    const nameEl = document.getElementById('lobby-moto-name');

    if (iconEl) {
      iconEl.src = moto?.icon || '/src/icons/wolf-head.svg';
      iconEl.alt = moto ? moto.label : 'Default moto';
    }

    if (nameEl) {
      nameEl.innerText = moto?.label || 'Wolf Head';
    }
  }

  showMatchEndScreen() {
    document.getElementById('home-screen')?.classList.add('hidden');
    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.add('hidden');
    document.getElementById('match-end-screen')?.classList.remove('hidden');
    document.getElementById('match-end-screen')?.classList.add('flex');
    document.querySelector('.landing-bg')?.classList.add('hidden');
    document.querySelector('.landing-overlay')?.classList.add('hidden');
    SettingsManager.repositionForScreen('matchEnd');
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

    document.getElementById('btn-open-moto')?.addEventListener('click', () => {
      this.openMotoModal();
    });

    document.getElementById('lobby-moto-icon')?.addEventListener('click', () => {
      this.openMotoModal();
    });

    document.getElementById('btn-close-moto')?.addEventListener('click', () => {
      this.closeMotoModal();
    });

    document.getElementById('moto-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'moto-modal') {
        this.closeMotoModal();
      }
    });

    document.querySelectorAll('.moto-tile').forEach((button) => {
      button.addEventListener('click', (event) => {
        const motoId = event.currentTarget.dataset.moto;
        this.selectMoto(motoId);
      });
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

      const gameState = this.localState.currentGameState;
      const isExchanger = gameState && gameState.isFullcoatActive &&
                          (this.localState.player &&
                           (this.localState.player.id === gameState.fullcoatDeclarerId ||
                            this.localState.player.id === gameState.fullcoatPartnerId));

      if (gameState && gameState.phase === 'FULLCOAT_EXCHANGE' && isExchanger) {
        const idx = this.selectedExchangeCards.indexOf(cardId);
        if (idx !== -1) {
          this.selectedExchangeCards.splice(idx, 1);
        } else if (this.selectedExchangeCards.length < 2) {
          this.selectedExchangeCards.push(cardId);
        }

        this.renderer.renderHand(gameState.yourHand || [], true, gameState.trumpSuit, this.selectedExchangeCards);

        const confirmBtn = document.getElementById('btn-fullcoat-exchange-confirm');
        if (confirmBtn) {
          if (this.selectedExchangeCards.length === 2) {
            confirmBtn.classList.remove('hidden');
          } else {
            confirmBtn.classList.add('hidden');
          }
        }
        return;
      }

      this.socket.emit('playCard', { cardId });
    });

    document.getElementById('btn-fullcoat-declare')?.addEventListener('click', () => {
      this.socket.emit('declareFullcoat', { action: 'fullcoat' });
    });

    document.getElementById('btn-fullcoat-continue')?.addEventListener('click', () => {
      this.socket.emit('declareFullcoat', { action: 'continue' });
    });

    document.getElementById('btn-fullcoat-yes')?.addEventListener('click', () => {
      this.socket.emit('respondFullcoatRequest', { accept: true });
    });

    document.getElementById('btn-fullcoat-no')?.addEventListener('click', () => {
      this.socket.emit('respondFullcoatRequest', { accept: false });
    });

    document.getElementById('btn-fullcoat-exchange-confirm')?.addEventListener('click', () => {
      if (this.selectedExchangeCards.length === 2) {
        this.socket.emit('confirmFullcoatExchange', { cardIds: this.selectedExchangeCards });
        document.getElementById('btn-fullcoat-exchange-confirm')?.classList.add('hidden');
      }
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

    document.getElementById('btn-join-black')?.addEventListener('click', () => {
      this.socket.emit('requestTeamJoin', { team: 'A' });
    });

    document.getElementById('btn-join-red')?.addEventListener('click', () => {
      this.socket.emit('requestTeamJoin', { team: 'B' });
    });

    document.getElementById('btn-accept-request')?.addEventListener('click', () => {
      if (this.currentRequestingPlayerId) {
        this.socket.emit('respondTeamJoinRequest', { requestingPlayerId: this.currentRequestingPlayerId, accept: true });
        document.getElementById('team-request-modal')?.classList.add('hidden');
        this.currentRequestingPlayerId = null;
      }
    });

    document.getElementById('btn-reject-request')?.addEventListener('click', () => {
      if (this.currentRequestingPlayerId) {
        this.socket.emit('respondTeamJoinRequest', { requestingPlayerId: this.currentRequestingPlayerId, accept: false });
        document.getElementById('team-request-modal')?.classList.add('hidden');
        this.currentRequestingPlayerId = null;
      }
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

    this.socket.on('fullcoat_rejected', ({ declarerName }) => {
      this.appendChatMessage({
        senderId: 'system',
        text: `${declarerName}'s Fullcoat request was rejected by partner. Game continues.`,
        timestamp: Date.now()
      });
    });

    this.socket.on('teamJoinRequest', ({ requestingPlayerId, requestingPlayerName, targetTeam }) => {
      this.currentRequestingPlayerId = requestingPlayerId;
      const msgEl = document.getElementById('team-request-message');
      if (msgEl) {
        msgEl.innerText = `${requestingPlayerName} wants to join your team. Would you like to switch to the other team?`;
      }
      document.getElementById('team-request-modal')?.classList.remove('hidden');
    });

    this.socket.on('teamJoinAccepted', ({ team, seat }) => {
      document.getElementById('team-request-modal')?.classList.add('hidden');
      this.currentRequestingPlayerId = null;
    });

    this.socket.on('teamJoinRejected', ({ reason }) => {
      alert(reason);
      document.getElementById('team-request-modal')?.classList.add('hidden');
      this.currentRequestingPlayerId = null;
    });

    this.socket.on('syncState', (state) => {
      // Hide request modal if the requesting player is no longer in the room or if we are not in LOBBY phase
      if (this.currentRequestingPlayerId) {
        const stillInRoom = (state.players || []).some(p => p.id === this.currentRequestingPlayerId);
        if (!stillInRoom || state.phase !== 'LOBBY') {
          document.getElementById('team-request-modal')?.classList.add('hidden');
          this.currentRequestingPlayerId = null;
        }
      }
      // 1. Capture the old state before we overwrite it
      const previousState = this.localState.currentGameState;
      
      // 2. Overwrite with the fresh incoming state
      this.localState.currentGameState = state;

      // 3. Audio Delta Tracking Engine
      if (previousState) {
        const oldTrick = previousState.currentTrick || [];
        const newTrick = state.currentTrick || [];
        const oldTricks = previousState.roundTricks || { A: 0, B: 0 };
        const newTricks = state.roundTricks || { A: 0, B: 0 };

        // Determine this local player's team based on their seat configuration
        // Team A: Seats 0 & 2 | Team B: Seats 1 & 3
        const mySeat = this.localState.seat;
        const myTeam = (mySeat === 0 || mySeat === 2) ? 'A' : ((mySeat === 1 || mySeat === 3) ? 'B' : null);

        // ─────────────── CARD / TRICK TRACKING ───────────────
        // A card was thrown onto the table trick mat
        if (newTrick.length > oldTrick.length) {
          AudioManager.playSFX('cardPlay');
        }

        // The 4th card was played and the server cleared the table buffer
        if (oldTrick.length === 4 && newTrick.length === 0) {
          AudioManager.playSFX('trickWin');
        }

        // ─────────────── ROUND WIN / LOSS TRACKING ───────────────
        // A team reached exactly 5 tricks (Won the current round)
        if ((oldTricks.A < 5 && newTricks.A === 5) || (oldTricks.B < 5 && newTricks.B === 5)) {
          const winningTeam = newTricks.A === 5 ? 'A' : 'B';
          
          if (myTeam === winningTeam) {
            AudioManager.playSFX('roundWin');
          } else {
            AudioManager.playSFX('roundLoss'); // ◄ Plays for the team that lost the round
          }
        }

        // ─────────────── OVERALL MATCH WIN / LOSS TRACKING ───────────────
        // The game transition hits the terminal state match end phase
        if (previousState.phase !== 'MATCH_END' && state.phase === 'MATCH_END') {
          AudioManager.stopBGM();

          const finalScores = state.matchScores || { A: 10, B: 10 };
          
          // Under countdown rules, the team that reaches 0 tokens loses,
          // so the team with more tokens remaining wins the match.
          const matchWinningTeam = finalScores.A > finalScores.B ? 'A' : 'B';

          if (myTeam === matchWinningTeam) {
            AudioManager.playSFX('victory');     // ◄ Overall Match Winner Fanfare
          } else {
            AudioManager.playSFX('matchLoss');   // ◄ Overall Match Loser Audio Track
          }
        }
      }

      // 4. Continue with your standard UI mapping properties
      const playerList = state.players || [];
      const identity = playerList.find(p => p.id === this.socket.id || p.username === document.getElementById('input-username').value.trim());

      if (identity) {
        this.localState.seat = identity.seat;
        this.localState.player = identity;
      }

      if (state.phase === 'LOBBY') {
        this.showLobbyScreen();
        this.renderer.renderLobby(state, this.localState.player);
        this.updateLobbyMotoPreview(this.localState.player);
      } else if (state.phase === 'MATCH_END') {
        this.showMatchEndScreen();
        this.renderer.renderMatchEnd(state, this.localState.seat);
      } else {
        this.showGameScreen();
      }

      if (state.phase !== 'FULLCOAT_EXCHANGE') {
        this.selectedExchangeCards = [];
      }

      const isExchanger = state.isFullcoatActive &&
                          (this.localState.player &&
                           (this.localState.player.id === state.fullcoatDeclarerId ||
                            this.localState.player.id === state.fullcoatPartnerId));

      const isHandInteractable = (state.activeTurnSeat === this.localState.seat && state.phase === 'PLAYING') ||
                                 (state.phase === 'FULLCOAT_EXCHANGE' && isExchanger);

      this.renderer.renderHand(state.yourHand || [], isHandInteractable, state.trumpSuit, this.selectedExchangeCards);
      this.renderer.renderTrick(state.currentTrick || [], this.localState.seat);
      this.renderer.updateMetadata(state, this.localState.seat);
      this.renderer.renderFullcoat(state, this.localState.player, this.selectedExchangeCards);

      const trumpModal = document.getElementById('trump-modal');
      const chooserSeat = state.trumpChooserId
        ? (state.players || []).find(p => p.id === state.trumpChooserId)?.seat
        : null;

      if (state.phase === 'TRUMP_SELECTION' && chooserSeat === this.localState.seat) {
        trumpModal.classList.remove('hidden');
      } else {
        trumpModal.classList.add('hidden');
      }

      // Removed auto startMatch emission as match start is now countdown-driven from the server
    });
  }
}

new GameClient();

