// Přestřelka — authoritative game server.
//
// One Sim per room runs on this server, emitting state to every player at
// TICK_RATE. The Sim is the shared engine in src/shared/ — the same code
// single-player runs in the browser. Members send inputs; nobody runs a
// local sim. There's no "host" beyond who started the room in the lobby.

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { Lobby } from './lobby.js';
import { GameManager } from './game-manager.js';
import type {
  C2S, S2C, PlayerInput, ShopItem, SkillType, GameModeConfig,
} from './shared/types.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const lobby = new Lobby();
const games = new GameManager(io);

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Lobby ────────────────────────────────────────────────

  socket.on('createRoom', (data: C2S['createRoom']) => {
    const name = (data?.name ?? '').trim().slice(0, 20) || 'Hráč';
    const room = lobby.createRoom(socket.id, name, data?.mode);
    socket.join(room.code);
    socket.emit('roomCreated', room satisfies S2C['roomCreated']);
  });

  socket.on('joinRoom', (data: C2S['joinRoom']) => {
    const code = (data?.code ?? '').trim().toUpperCase();
    const name = (data?.name ?? '').trim().slice(0, 20) || 'Hráč';
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
    if (room) io.to(room.code).emit('roomUpdated', room satisfies S2C['roomUpdated']);
  });

  socket.on('updateRoomSettings', (data: C2S['updateRoomSettings']) => {
    if (!data?.mode) return;
    const room = lobby.setMode(socket.id, data.mode);
    if (room) io.to(room.code).emit('roomUpdated', room satisfies S2C['roomUpdated']);
  });

  socket.on('selectColor', (data: C2S['selectColor']) => {
    if (!data?.color) return;
    const room = lobby.setColor(socket.id, data.color);
    if (room) io.to(room.code).emit('roomUpdated', room satisfies S2C['roomUpdated']);
  });

  socket.on('returnToLobby', () => {
    const code = lobby.getRoomCodeByPlayer(socket.id);
    if (!code) return;
    games.stopGame(code);
    const room = lobby.returnToLobby(code);
    if (room) io.to(code).emit('roomUpdated', room satisfies S2C['roomUpdated']);
  });

  socket.on('startGame', (data?: { mode?: GameModeConfig }) => {
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
    // The mode stored on the room (kept in sync via updateRoomSettings) is
    // authoritative. A mode sent with startGame still wins as a fallback for
    // older clients.
    games.startGame(roomCode, result.players, data?.mode ?? result.mode);
  });

  // ── Gameplay (members → server) ──────────────────────────

  socket.on('input', (input: PlayerInput) => {
    const code = lobby.getRoomCodeByPlayer(socket.id);
    if (code) games.setInput(code, socket.id, input);
  });

  socket.on('switchWeapon', (msg: { slot: number }) => {
    const code = lobby.getRoomCodeByPlayer(socket.id);
    if (code && typeof msg?.slot === 'number') games.switchWeapon(code, socket.id, msg.slot);
  });

  socket.on('purchase', (msg: { item: ShopItem }) => {
    const code = lobby.getRoomCodeByPlayer(socket.id);
    if (code && msg?.item) games.purchase(code, socket.id, msg.item);
  });

  socket.on('spendSkill', (msg: { skill: SkillType }) => {
    const code = lobby.getRoomCodeByPlayer(socket.id);
    if (code && msg?.skill) games.spendSkill(code, socket.id, msg.skill);
  });

  socket.on('dropWeapon', () => {
    const code = lobby.getRoomCodeByPlayer(socket.id);
    if (code) games.dropWeapon(code, socket.id);
  });

  socket.on('toggleLock', () => {
    const code = lobby.getRoomCodeByPlayer(socket.id);
    if (code) games.toggleLock(code, socket.id);
  });

  socket.on('swapPickup', () => {
    const code = lobby.getRoomCodeByPlayer(socket.id);
    if (code) games.swapPickup(code, socket.id);
  });

  socket.on('leaveRoom', () => handleLeave(socket.id));
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    handleLeave(socket.id);
  });

  function handleLeave(playerId: string) {
    const code = lobby.getRoomCodeByPlayer(playerId);
    if (code && games.hasGame(code)) games.removePlayer(code, playerId);

    const result = lobby.leaveRoom(playerId);
    if (!result) return;

    if (result.room) {
      io.to(result.roomCode).emit('roomUpdated', result.room satisfies S2C['roomUpdated']);
    } else {
      // Room emptied — stop its sim if one was running.
      games.stopGame(result.roomCode);
    }
    socket.leave(result.roomCode);
  }
});

httpServer.listen(PORT, () => {
  console.log(`Přestřelka authoritative server running on port ${PORT}`);
});
