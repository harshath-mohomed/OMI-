/** * Client-Side Audio Pipeline Manager 
 * Bypasses rendering lag by running audio triggers asynchronously.
 */
export const AudioManager = {
  bgm: null,
  bgmMuted: false,
  sounds: {},

  init() {
    // 1. Initialize Background Music Loop
    this.bgm = new Audio('/audio/background-theme.mp3');
    this.bgm.loop = true;
    this.bgm.volume = 0.25; // Set ambient volume low so it isn't distracting

    // 2. Restore persisted mute preference
    this.bgmMuted = localStorage.getItem('omi_bgm_muted') === 'true';

    // 3. Pre-cache Short Sound Effects (SFX) into memory buffers
    this.sounds.cardPlay = new Audio('/audio/card-slide.mp3');
    this.sounds.trickWin = new Audio('/audio/trick-win-2.mp3');
    this.sounds.victory = new Audio('/audio/match-victory.mp3');
    this.sounds.roundLoss = new Audio('/audio/round-lose.mp3');
    this.sounds.matchLoss = new Audio('/audio/match-over.mp3');

    // Optimize SFX volume balances
    Object.values(this.sounds).forEach(sound => {
      sound.volume = 0.6;
    });
  },

  startBGM() {
    // Respect stored mute preference — don't auto-play if user muted
    if (this.bgmMuted) return;
    if (this.bgm && this.bgm.paused) {
      this.bgm.play().catch(err => console.log("[AUDIO] Awaiting interaction to play BGM:", err));
    }
  },

  stopBGM() {
    if (this.bgm) this.bgm.pause();
  },

  /** Mute background music only. SFX are never affected. */
  muteBGM() {
    this.bgmMuted = true;
    localStorage.setItem('omi_bgm_muted', 'true');
    if (this.bgm) this.bgm.pause();
  },

  /** Unmute and resume background music. SFX are never affected. */
  unmuteBGM() {
    this.bgmMuted = false;
    localStorage.setItem('omi_bgm_muted', 'false');
    if (this.bgm) {
      this.bgm.play().catch(err => console.log("[AUDIO] Awaiting interaction to play BGM:", err));
    }
  },

  playSFX(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      // Reset sound pointer so it can overlap or re-trigger instantly without delay
      sound.currentTime = 0;
      sound.play().catch(err => console.error(`[AUDIO] SFX ${soundName} play blocked:`, err));
    }
  }
};