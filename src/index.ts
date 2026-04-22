import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { Lobby } from './lobby.js';
import { GameManager } from './game-manager.js';
import type { C2S, S2C, PlayerInput, ShopItem } from './types.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const lobby = new Lobby();
const gameManager = new GameManager(io);

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Lobby events ───────────────────────────────────────

  socket.on('createRoom', (data: C2S['createRoom']) => {
    const name = (data.name ?? '').trim().slice(0, 20) || 'Hráč';
    const room = lobby.createRoom(socket.id, name);
    socket.join(room.code);
    socket.emit('roomCreated', room satisfies S2C['roomCreated']);
  });

  socket.on('joinRoom', (data: C2S['joinRoom']) => {
    const code = (data.code ?? '').trim().toUpperCase();
    const name = (data.name ?? '').trim().slice(0, 20) || 'Hráč';

    if (!code) {
      socket.emit('error', { message: 'Zadej kód místnosti' } satisfies S2C['error']);
      return;
    }

    const room = lobby.joinRoom(code, socket.id, name);
    if (!room) {
      socket.emit('error', { message: 'Místnost nenalezena nebo je plná' } satisfies S2C['error']);
      return;
    }

    socket.join(room.code);
    socket.emit('roomJoined', room satisfies S2C['roomJoined']);
    socket.to(room.code).emit('roomUpdated', room satisfies S2C['roomUpdated']);
  });

  socket.on('playerReady', () => {
    const room = lobby.setReady(socket.id);
    if (room) {
      io.to(room.code).emit('roomUpdated', room satisfies S2C['roomUpdated']);
    }
  });

  socket.on('startGame', () => {
    const roomCode = lobby.getRoomCodeByPlayer(socket.id);
    if (!roomCode) {
      socket.emit('error', { message: 'Nejsi v žádné místnosti' } satisfies S2C['error']);
      return;
    }

    const result = lobby.startGame(roomCode, socket.id);
    if (!result) {
      socket.emit('error', { message: 'Nemůžeš spustit hru' } satisfies S2C['error']);
      return;
    }

    gameManager.startGame(roomCode, result.players);
  });

  socket.on('leaveRoom', () => {
    handleLeave(socket.id);
  });

  // ── Game events ────────────────────────────────────────

  socket.on('input', (data: PlayerInput) => {
    const roomCode = lobby.getRoomCodeByPlayer(socket.id);
    if (!roomCode) return;
    const game = gameManager.getGame(roomCode);
    if (!game) return;
    game.setInput(socket.id, data);
  });

  socket.on('purchase', (data: C2S['purchase']) => {
    const roomCode = lobby.getRoomCodeByPlayer(socket.id);
    if (!roomCode) return;
    const game = gameManager.getGame(roomCode);
    if (!game) return;
    game.purchase(socket.id, data.item);
  });

  socket.on('switchWeapon', (data: C2S['switchWeapon']) => {
    const roomCode = lobby.getRoomCodeByPlayer(socket.id);
    if (!roomCode) return;
    const game = gameManager.getGame(roomCode);
    if (!game) return;
    game.switchWeapon(socket.id, data.slot);
  });

  // ── Disconnect ─────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    handleLeave(socket.id);
  });

  function handleLeave(playerId: string) {
    const roomCode = lobby.getRoomCodeByPlayer(playerId);

    // Remove from active game
    if (roomCode) {
      const game = gameManager.getGame(roomCode);
      if (game) {
        game.removePlayer(playerId);
        if (!game.hasPlayers()) {
          gameManager.stopGame(roomCode);
        }
      }
    }

    // Remove from lobby
    const result = lobby.leaveRoom(playerId);
    if (result && result.room) {
      io.to(result.roomCode).emit('roomUpdated', result.room satisfies S2C['roomUpdated']);
    }

    if (roomCode) {
      socket.leave(roomCode);
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`🎯 Přestřelka server running on port ${PORT}`);
});
