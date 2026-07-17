import { EVENTS } from '../utilities/constants.js';

export function registerGameplayHandlers(io, socket, engine) {
  socket.on(EVENTS.CHOOSE_TRUMP, ({ suit }) => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    try {
      if (room.matchManager.phase === 'FULLCOAT_TRUMP_SELECTION') {
        room.matchManager.selectFullcoatTrump(socket.data.playerId, suit);
      } else if (room.matchManager.phase === 'HALFCOAT_TRUMP_SELECTION') {
        room.matchManager.selectHalfcoatTrump(socket.data.playerId, suit);
      } else {
        room.matchManager.selectTrump(socket.data.playerId, suit);
      }
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on('declareFullcoat', ({ action }) => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    const matchManager = room.matchManager;
    try {
      if (matchManager.phase !== 'FULLCOAT_DECISION') {
        throw new Error('Invalid phase for declaring Fullcoat.');
      }
      if (matchManager.fullcoatCurrentAskerId !== socket.data.playerId) {
        throw new Error('It is not your turn to decide on Fullcoat.');
      }

      if (action === 'continue') {
        if (matchManager.fullcoatCurrentAskerIndex === 0 && matchManager.fullcoatOpponents.length > 1) {
          matchManager.fullcoatCurrentAskerIndex = 1;
          matchManager.fullcoatCurrentAskerId = matchManager.fullcoatOpponents[1].id;
          room.broadcastGameState();
        } else {
          matchManager.transitionTo('PLAYING');
        }
      } else if (action === 'fullcoat') {
        const declarer = matchManager.players.find(p => p.id === socket.data.playerId);
        const partner = matchManager.fullcoatOpponents.find(p => p.id !== socket.data.playerId);
        
        matchManager.fullcoatRequest = {
          declarerId: declarer.id,
          declarerName: declarer.username,
          partnerId: partner.id
        };
        room.broadcastGameState();
      } else {
        throw new Error('Invalid Fullcoat action.');
      }
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on('respondFullcoatRequest', ({ accept }) => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    const matchManager = room.matchManager;
    try {
      if (matchManager.phase !== 'FULLCOAT_DECISION' || !matchManager.fullcoatRequest) {
        throw new Error('No active Fullcoat request to respond to.');
      }
      if (matchManager.fullcoatRequest.partnerId !== socket.data.playerId) {
        throw new Error('Only the partner can respond to the Fullcoat request.');
      }

      if (!accept) {
        io.to(room.code).emit('fullcoat_rejected', { declarerName: matchManager.fullcoatRequest.declarerName });
        matchManager.fullcoatRequest = null;
        matchManager.transitionTo('PLAYING');
      } else {
        matchManager.isFullcoatActive = true;
        matchManager.fullcoatDeclarerId = matchManager.fullcoatRequest.declarerId;
        matchManager.fullcoatPartnerId = matchManager.fullcoatRequest.partnerId;
        matchManager.fullcoatExchange = {
          confirmed: {}
        };
        matchManager.transitionTo('FULLCOAT_EXCHANGE');
      }
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on('confirmFullcoatExchange', ({ cardIds }) => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    const matchManager = room.matchManager;
    try {
      if (matchManager.phase !== 'FULLCOAT_EXCHANGE' || !matchManager.fullcoatExchange) {
        throw new Error('Not in Fullcoat card exchange phase.');
      }
      const playerId = socket.data.playerId;
      if (playerId !== matchManager.fullcoatDeclarerId && playerId !== matchManager.fullcoatPartnerId) {
        throw new Error('You are not authorized to participate in the card exchange.');
      }
      if (!Array.isArray(cardIds) || cardIds.length !== 2) {
        throw new Error('Must select exactly 2 cards.');
      }

      const player = matchManager.players.find(p => p.id === playerId);
      const hasAllCards = cardIds.every(id => player.hand.some(c => c.id === id));
      if (!hasAllCards) {
        throw new Error('One or more cards not found in hand.');
      }

      matchManager.fullcoatExchange.confirmed[playerId] = cardIds;

      const declarerId = matchManager.fullcoatDeclarerId;
      const partnerId = matchManager.fullcoatPartnerId;
      const dConfirmed = matchManager.fullcoatExchange.confirmed[declarerId];
      const pConfirmed = matchManager.fullcoatExchange.confirmed[partnerId];

      if (dConfirmed && pConfirmed) {
        const declarer = matchManager.players.find(p => p.id === declarerId);
        const partner = matchManager.players.find(p => p.id === partnerId);

        const dCards = dConfirmed.map(id => declarer.hand.find(c => c.id === id));
        const pCards = pConfirmed.map(id => partner.hand.find(c => c.id === id));

        declarer.hand = declarer.hand.filter(c => !dConfirmed.includes(c.id));
        partner.hand = partner.hand.filter(c => !pConfirmed.includes(c.id));

        declarer.addCards(pCards);
        partner.addCards(dCards);

        partner.clearHand();
        partner.isOut = true;

        matchManager.fullcoatRequest = null;
        matchManager.fullcoatExchange = null;

        io.to(room.code).emit('fullcoat_exchange_done');
        matchManager.transitionTo('FULLCOAT_TRUMP_SELECTION');
      } else {
        room.broadcastGameState();
      }
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on('chooseBlindTrump', () => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    try {
      room.matchManager.startBlindTrump(socket.data.playerId);
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on('selectBlindTrumpCard', ({ index }) => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    try {
      room.matchManager.revealBlindTrump(socket.data.playerId, index);
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on('declareHalfcoat', () => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    try {
      room.matchManager.declareHalfcoat(socket.data.playerId);
      room.broadcastGameState();
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on('declineHalfcoat', () => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;
    try {
      room.matchManager.declineHalfcoat(socket.data.playerId);
      room.broadcastGameState();
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on(EVENTS.PLAY_CARD, ({ cardId }) => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room || !room.matchManager) return;

    try {
      room.matchManager.handleCardPlay(socket.data.playerId, cardId);
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on(EVENTS.REMATCH, () => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room) return;
    try {
      room.handleRematch(io);
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });

  socket.on(EVENTS.RETURN_HOME, () => {
    const room = engine.getRoom(socket.data.roomCode);
    if (!room) return;
    try {
      room.handleReturnHome(socket.id);
      socket.leave(room.code);
      socket.data.roomCode = null;
      socket.data.playerId = null;
    } catch (err) {
      socket.emit(EVENTS.ILLEGAL_MOVE, { reason: err.message });
    }
  });
}