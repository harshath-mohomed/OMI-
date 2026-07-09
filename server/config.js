import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  TARGET_GAME_POINTS: 10,
  TRICKS_TO_WIN_ROUND: 5,
  CARDS_PER_DEAL: 4,
  TOTAL_CARDS_HAND: 8,
  SUITS: ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'],
  RANKS: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'],
  RANK_VALUES: {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'JACK': 11, 'QUEEN': 12, 'KING': 13, 'ACE': 14
  },
  GAME_PHASES: {
    LOBBY: 'LOBBY',
    WAITING_FOR_PLAYERS: 'WAITING_FOR_PLAYERS',
    MATCH_START: 'MATCH_START',
    FIRST_DEAL: 'FIRST_DEAL',
    TRUMP_SELECTION: 'TRUMP_SELECTION',
    SECOND_DEAL: 'SECOND_DEAL',
    PLAYING: 'PLAYING',
    ROUND_END: 'ROUND_END',
    MATCH_END: 'MATCH_END'
  }
};