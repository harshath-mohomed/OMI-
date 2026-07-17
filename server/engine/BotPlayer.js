import { Player } from './Player.js';

const BOT_NAMES = ['Dinuka 🤖', 'Kasun 🤖', 'Nuwan 🤖'];

/**
 * Virtual bot player that extends the base Player class.
 * Bots are server-side only — they have no real socket connection.
 */
export class BotPlayer extends Player {
  /**
   * @param {number} index - Bot index (0, 1, or 2)
   */
  constructor(index) {
    const id = `bot-${index}-${Date.now()}`;
    const username = BOT_NAMES[index] || `Bot ${index + 1} 🤖`;
    super(id, username);
    this.isBot = true;
    this.socketId = `bot-socket-${index}`;
    this.isDisconnected = false;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      isBot: true
    };
  }
}
