import { Server as SocketIOServer } from 'socket.io';
import { Game } from './game.js';
import { createMap } from './map.js';
import type { LobbyPlayer, GameState, S2C } from './types.js';
import { TICK_RATE } from './types.js';

export class GameManager {
  private games = new Map<string, Game>();
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  startGame(roomCode: string, players: LobbyPlayer[]): Game {
    const map = createMap();
    const game = new Game(roomCode, players, map, this.handleGameEvent.bind(this));
    this.games.set(roomCode, game);

    // Broadcast map to all players
    for (const p of players) {
      this.io.to(p.id).emit('gameStart', { map } satisfies S2C['gameStart']);
    }

    // Start game loop
    const interval = setInterval(() => {
      const state = game.tick();
      this.io.to(roomCode).emit('gameState', state satisfies S2C['gameState']);

      // Stop if no players left
      if (!game.hasPlayers()) {
        this.stopGame(roomCode);
      }
    }, 1000 / TICK_RATE);

    this.intervals.set(roomCode, interval);
    return game;
  }

  stopGame(roomCode: string): void {
    const interval = this.intervals.get(roomCode);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(roomCode);
    }
    this.games.delete(roomCode);
  }

  getGame(roomCode: string): Game | undefined {
    return this.games.get(roomCode);
  }

  hasGame(roomCode: string): boolean {
    return this.games.has(roomCode);
  }

  // Route game events to the appropriate socket(s)
  private handleGameEvent(event: string, roomCode: string, targetPlayerId: string | null, data: unknown): void {
    if (targetPlayerId) {
      // Send to specific player
      this.io.to(targetPlayerId).emit(event, data);
    } else {
      // Broadcast to room
      this.io.to(roomCode).emit(event, data);
    }
  }
}
