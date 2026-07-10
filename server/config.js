import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  HOST: process.env.HOST || '0.0.0.0',
  PORT: process.env.PORT || 3000,
  TARGET_GAME_POINTS: 10,
  TRICKS_PER_HAND: 8,
  TRICKS_TO_WIN_SCORE: 5,
  CARDS_PER_DEAL: 4,
  TOTAL_CARDS_HAND: 8,
  PLAYING_RANKS: ['A', 'K', 'Q', 'J', '10', '9', '8', '7'],
  SUITS: ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'],
  RANKS: ['A', 'K', 'Q', 'J', '10', '9', '8', '7'],
  RANK_VALUES: {
    'A': 8,
    'K': 7,
    'Q': 6,
    'J': 5,
    '10': 4,
    '9': 3,
    '8': 2,
    '7': 1
  },
  GAME_PHASES: {
    LOBBY: 'LOBBY',
    WAITING_FOR_PLAYERS: 'WAITING_FOR_PLAYERS',
    MATCH_START: 'MATCH_START',
    FIRST_DEAL: 'FIRST_DEAL',
    TRUMP_SELECTION: 'TRUMP_SELECTION',
    SECOND_DEAL: 'SECOND_DEAL',
    PLAYING: 'PLAYING',
    HAND_END: 'HAND_END',
    ROUND_END: 'ROUND_END',
    MATCH_END: 'MATCH_END'
  }
};