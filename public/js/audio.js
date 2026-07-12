/** * Client-Side Audio Pipeline Manager 
 * Bypasses rendering lag by running audio triggers asynchronously.
 */
export const AudioManager = {
  bgm: null,
  sounds: {},

  init() {
    // 1. Initialize Background Music Loop
    this.bgm = new Audio('/audio/background-theme.mp3');
    this.bgm.loop = true;
    this.bgm.volume = 0.25; // Set ambient volume low so it isn't distracting

    // 2. Pre-cache Short Sound Effects (SFX) into memory buffers
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
    if (this.bgm && this.bgm.paused) {
      this.bgm.play().catch(err => console.log("[AUDIO] Awaiting interaction to play BGM:", err));
    }
  },

  stopBGM() {
    if (this.bgm) this.bgm.pause();
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