// src/lang.js
export const translations = {
  en: {
    settingsTitle: "SETTINGS",
    musicOn: "Music On",
    muted: "Muted",
    chatLabel: "Chat",
    selectedTrump: "Selected Trump",
    totalRounds: "Total Rounds Win",
    score: "Score",
    tricks: "Tricks",
    trickWins: "Trick Wins",
    lobbyTitle: "LOBBY",
    teamBlack: "TEAM BLACK",
    teamRed: "TEAM RED",
    waiting: "waiting",
    joinBlack: "Join Black",
    joinRed: "Join Red",
    play: "PLAY",
    multiplayer: "MULTIPLAYER",
    singlePlayer: "SINGLE PLAYER",
    enterPrompt: "Enter your name and room to begin",
    namePlaceholder: "NAME",
    roomPlaceholder: "ROOM CODE",
    black: "BLACK",
    red: "RED",
    matchEnd: "MATCH END",
    roundsWin: "ROUNDS WIN",
    winner: "WINNER:",
    kapothi: "KAPOTHI",
    totalKapothi: "TOTAL",
    draws: "DRAWS",
    mvp: "MVP",
    totalTricksWin: "TOTAL TRICKS WIN",
    totalScoreWin: "total score win",
    rematch: "REMATCH",
    home: "HOME",
    selectTrumpSuit: "Select Trump Suit",
    editMoto: "Edit Moto",
    close: "CLOSE",
    teamJoinRequest: "Team Join Request",
    accept: "Accept",
    reject: "Reject",
    fullcoat: "FULLCOAT",
    continue: "CONTINUE",
    fullcoatPrompt: "can you give me two cards ?",
    halfcoatPrompt: "Do you want to attempt Half Coat?",
    yes: "YES",
    no: "NO",
    selectCards: "Select 2 cards to give",
    confirmExchange: "CONFIRM EXCHANGE",
    full: "FULL",
    pending: "PENDING...",
    opponentPlayer: "opponent player",
    myTeamMate: "my team mate",
  },
  si: {
    settingsTitle: "සැකසුම්",
    musicOn: "සංගීතය ක්‍රියාත්මකයි",
    muted: "නිශ්ශබ්දයි",
    chatLabel: "කතාබස්",
    selectedTrump: "තෝරාගත් තුරුම්පුව",
    totalRounds: "මුළු වට ජයග්‍රහණ",
    score: "කැට",
    tricks: "කොළ ගණන",
    trickWins: "දිනූ වට",
    lobbyTitle: "පොරොත්තු කාමරය",
    teamBlack: "කළු කැට කණ්ඩායම",
    teamRed: "රතු කැට කණ්ඩායම",
    waiting: "පොරොත්තුවෙන්",
    joinBlack: "කළු කැට පිලට",
    joinRed: "රතු කැට පිලට",
    play: "ක්‍රීඩා කරන්න",
    multiplayer: "බහු ක්‍රීඩක",
    singlePlayer: "තනි ක්‍රීඩක",
    enterPrompt: "ආරම්භ කිරීමට ඔබේ නම සහ කාමර කේතය ඇතුළත් කරන්න",
    namePlaceholder: "නම",
    roomPlaceholder: "කාමර කේතය",
    black: "කළු",
    red: "රතු",
    matchEnd: "තරඟය අවසන්",
    roundsWin: "දිනූ වට",
    winner: "ජයග්‍රාහකයා:",
    kapothi: "කපෝතී",
    totalKapothi: "මුළු",
    draws: "සම",
    mvp: "හොඳම ක්‍රීඩකයා",
    totalTricksWin: "මුළු ට්‍රික් ජයග්‍රහණ",
    totalScoreWin: "මුළු ලකුණු",
    rematch: "නැවත තරඟය",
    home: "මුල් පිටුව",
    selectTrumpSuit: "තුරුම්පු සූට් එක තෝරන්න",
    editMoto: "මොටෝ වෙනස් කරන්න",
    close: "වසන්න",
    teamJoinRequest: "කණ්ඩායම් ඉල්ලීම",
    accept: "පිළිගන්න",
    reject: "ප්‍රතික්ෂේප කරන්න",
    fullcoat: "ෆුල්කෝට්",
    continue: "ඉදිරියට",
    fullcoatPrompt: "ඔබට මට කාඩ්පත් දෙකක් දිය හැකිද?",
    halfcoatPrompt: "ඔබට හාෆ්කෝට් කිරීමට අවශ්‍යද?",
    yes: "ඔව්",
    no: "නැත",
    selectCards: "දීමට කාඩ්පත් 2ක් තෝරන්න",
    confirmExchange: "හුවමාරුව තහවුරු කරන්න",
    full: "පිරී ඇත",
    pending: "පොරොත්තුවෙන්...",
    opponentPlayer: "විරුද්ධ ක්‍රීඩකයා",
    myTeamMate: "මගේ කණ්ඩායම් සගයා",
  }
};

export class LanguageEngine {
  static currentLang = localStorage.getItem('game_lang') || 'en';

  static setLanguage(lang) {
    if (translations[lang]) {
      this.currentLang = lang;
      localStorage.setItem('game_lang', lang);
      this.applyTranslations();
    }
  }

  static get(key) {
    return translations[this.currentLang][key] || translations['en'][key] || key;
  }

  static applyTranslations() {
    // 1. Static UI elements using data-translate attributes (innerText)
    document.querySelectorAll('[data-translate]').forEach(el => {
      const key = el.dataset.translate;
      el.innerText = this.get(key);
    });

    // 2. Placeholder attributes using data-translate-placeholder
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
      const key = el.dataset.translatePlaceholder;
      el.placeholder = this.get(key);
    });
  }
}