// Authoritative game manager — runs one Sim per room. The Sim class is the
// shared engine in src/shared/, identical to what single-player runs in the
// browser. Every player (including what used to be the "host") is a thin
// client that sends inputs and renders received state.
import { Server as SocketIOServer } from 'socket.io';
import { Sim } from './shared/sim.js';
import { createMap } from './shared/map.js';
import type {
  LobbyPlayer, GameModeConfig, S2C, PlayerInput, ShopItem, SkillType,
} from './shared/types.js';
import { TICK_RATE, GAME_MODE_DEFAULTS } from './shared/types.js';

export class GameManager {
  private sims = new Map<string, Sim>();
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  startGame(roomCode: string, players: LobbyPlayer[], mode?: GameModeConfig): Sim {
    const map = createMap();
    const modeCfg = mode ?? GAME_MODE_DEFAULTS.massacre;

    // Sim emits events (playerKilled, weaponFired, …). Route to the right
    // socket(s): a specific player id, or the whole room.
    const dispatch = (event: string, targetPlayerId: string | null, data: unknown) => {
      if (targetPlayerId) this.io.to(targetPlayerId).emit(event, data);
      else this.io.to(roomCode).emit(event, data);
    };

    const sim = new Sim(players, map, dispatch, modeCfg);
    this.sims.set(roomCode, sim);

    // Tell everyone the game has started + ship the map.
    this.io.to(roomCode).emit('gameStart', { map, mode: modeCfg } satisfies S2C['gameStart']);

    // Bots — keep the in-game economy populated so XP and weapon drops feel
    // the same as solo. Same call solo mode makes.
    sim.addBot('Bot Alfa', 'easy');
    sim.addBot('Bot Beta', 'normal');
    sim.addBot('Bot Gamma', 'normal');

    // One tick + one state broadcast per period. Sim is browser-free so
    // setInterval is fine here.
    const periodMs = 1000 / TICK_RATE;
    const interval = setInterval(() => {
      sim.tick();
      this.io.to(roomCode).emit('gameState', sim.getState() satisfies S2C['gameState']);
    }, periodMs);
    this.intervals.set(roomCode, interval);

    return sim;
  }

  stopGame(roomCode: string): void {
    const interval = this.intervals.get(roomCode);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(roomCode);
    }
    this.sims.delete(roomCode);
  }

  hasGame(roomCode: string): boolean {
    return this.sims.has(roomCode);
  }

  // ── Input routing ────────────────────────────────────────
  setInput(roomCode: string, playerId: string, input: PlayerInput): void {
    this.sims.get(roomCode)?.setInput(playerId, input);
  }
  switchWeapon(roomCode: string, playerId: string, slot: number): void {
    this.sims.get(roomCode)?.switchWeapon(playerId, slot);
  }
  purchase(roomCode: string, playerId: string, item: ShopItem): void {
    this.sims.get(roomCode)?.purchase(playerId, item);
  }
  spendSkill(roomCode: string, playerId: string, skill: SkillType): void {
    this.sims.get(roomCode)?.spendSkillPoint(playerId, skill);
  }
  dropWeapon(roomCode: string, playerId: string): void {
    this.sims.get(roomCode)?.dropCurrent(playerId);
  }
  toggleLock(roomCode: string, playerId: string): void {
    this.sims.get(roomCode)?.toggleLock(playerId);
  }
  swapPickup(roomCode: string, playerId: string): void {
    this.sims.get(roomCode)?.swapPickup(playerId);
  }
  removePlayer(roomCode: string, playerId: string): void {
    this.sims.get(roomCode)?.removePlayer(playerId);
  }
}
