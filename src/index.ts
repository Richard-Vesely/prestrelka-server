// Přestřelka — host-authoritative relay server.
//
// The server handles only lobby logistics + event relay. The actual game
// simulation runs on the host's browser; the server's job is to:
//
//   1. Manage rooms (create, join, ready, leave, start, host re-assignment).
//   2. Tell the host when to spin up its local simulation (`beginAsHost`).
//   3. Forward host → all-members events (gameState, gameStart, weaponFired,
//      damageDealt, etc.) via the `hostBroadcast` channel.
//   4. Forward member → host events (input, purchase, switchWeapon, …) so the
//      host's sim can incorporate them.
//
// All game-logic types/constants/files (game.ts, game-manager.ts, map.ts) are
// no longer imported — the host drives everything. They remain in the repo
// for now as historical reference but can be deleted.

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { Lobby } from './lobby.js';
import type { C2S, S2C } from './types.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const lobby = new Lobby();

// Events members can fire that should be routed through to the host.
// (Lobby events are handled directly above, never forwarded.)
const MEMBER_TO_HOST_EVENTS = [
  'input', 'purchase', 'switchWeapon', 'spendSkill', 'dropWeapon',
] as const;

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Lobby ────────────────────────────────────────────────

  socket.on('createRoom', (data: C2S['createRoom']) => {
    const name = (data?.name ?? '').trim().slice(0, 20) || 'Hráč';
    const room = lobby.createRoom(socket.id, name);
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

  socket.on('startGame', (data?: { mode?: unknown }) => {
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
    // Tell the host (only) to spin up its sim. The host's client will then
    // emit `gameStart` (with the map) via hostBroadcast, which the server
    // relays to all members.
    io.to(socket.id).emit('beginAsHost', { players: result.players, mode: data?.mode });
  });

  socket.on('leaveRoom', () => handleLeave(socket.id));
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    handleLeave(socket.id);
  });

  // ── Host → members relay ────────────────────────────────
  // Host wraps the sim's emitCallback into hostBroadcast events.
  // target === null  → broadcast to all room members EXCEPT the host
  // target === <id>  → forward to that one player (skipped if it's the host)
  socket.on('hostBroadcast', (data: { event: string; target?: string | null; payload?: unknown }) => {
    const room = lobby.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    const event = data?.event;
    if (typeof event !== 'string') return;
    const target = data.target ?? null;
    if (target) {
      if (target === room.hostId) return; // host already saw it locally
      io.to(target).emit(event, data.payload);
    } else {
      // socket.to(room) emits to room members EXCEPT this socket — exactly
      // what we want (host already handled the event locally).
      socket.to(room.code).emit(event, data.payload);
    }
  });

  // ── Members → host relay ────────────────────────────────
  // Member input flows to the host's sim. We bundle the original event name
  // + sender id so the host can route it.
  for (const event of MEMBER_TO_HOST_EVENTS) {
    socket.on(event, (payload: unknown) => {
      const room = lobby.getRoomByPlayer(socket.id);
      if (!room) return;
      if (socket.id === room.hostId) return; // host calls into the sim directly
      io.to(room.hostId).emit('memberInput', { event, fromId: socket.id, data: payload });
    });
  }

  function handleLeave(playerId: string) {
    const result = lobby.leaveRoom(playerId);
    if (result?.room) {
      io.to(result.roomCode).emit('roomUpdated', result.room satisfies S2C['roomUpdated']);
      // Tell the host so they can remove the dropped player from the sim.
      io.to(result.room.hostId).emit('memberLeft', { fromId: playerId });
    }
    if (result) socket.leave(result.roomCode);
  }
});

httpServer.listen(PORT, () => {
  console.log(`🎯 Přestřelka relay running on port ${PORT}`);
});
