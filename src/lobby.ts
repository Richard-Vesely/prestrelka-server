import type { RoomInfo, LobbyPlayer, GameModeConfig } from './shared/types.js';
import { GAME_MODE_DEFAULTS, LOBBY_PLAYER_COLORS } from './shared/types.js';

interface Room {
  code: string;
  hostId: string;
  players: Map<string, LobbyPlayer>;
  maxPlayers: number;
  started: boolean;
  mode: GameModeConfig;
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O to avoid confusion

export class Lobby {
  private rooms = new Map<string, Room>();
  private playerToRoom = new Map<string, string>(); // playerId → roomCode

  private generateCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < 3; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not generate unique room code');
  }

  // Pick the first color from LOBBY_PLAYER_COLORS that no one in the room has
  // claimed yet. Falls back to a random hex once all 10 are taken.
  private pickFreeColor(room: Room): string {
    const taken = new Set<string>();
    for (const p of room.players.values()) taken.add(p.color);
    for (const c of LOBBY_PLAYER_COLORS) if (!taken.has(c)) return c;
    return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  createRoom(hostId: string, hostName: string, initialMode?: GameModeConfig): RoomInfo {
    // Leave any existing room first
    this.leaveRoom(hostId);

    const code = this.generateCode();
    const room: Room = {
      code,
      hostId,
      players: new Map(),
      maxPlayers: 10,
      started: false,
      mode: initialMode ?? GAME_MODE_DEFAULTS.massacre,
    };
    const host: LobbyPlayer = { id: hostId, name: hostName, ready: false, color: this.pickFreeColor(room) };
    room.players.set(hostId, host);
    this.rooms.set(code, room);
    this.playerToRoom.set(hostId, code);
    return this.toRoomInfo(room);
  }

  joinRoom(code: string, playerId: string, playerName: string): RoomInfo | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    if (room.started) return null;
    if (room.players.size >= room.maxPlayers) return null;

    // Leave any existing room first
    this.leaveRoom(playerId);

    const player: LobbyPlayer = { id: playerId, name: playerName, ready: false, color: this.pickFreeColor(room) };
    room.players.set(playerId, player);
    this.playerToRoom.set(playerId, code);
    return this.toRoomInfo(room);
  }

  leaveRoom(playerId: string): { roomCode: string; room: RoomInfo | null } | null {
    const code = this.playerToRoom.get(playerId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) {
      this.playerToRoom.delete(playerId);
      return null;
    }

    room.players.delete(playerId);
    this.playerToRoom.delete(playerId);

    // If room is empty, remove it
    if (room.players.size === 0) {
      this.rooms.delete(code);
      return { roomCode: code, room: null };
    }

    // If host left, assign new host
    if (room.hostId === playerId) {
      const firstPlayer = room.players.values().next().value!;
      room.hostId = firstPlayer.id;
    }

    return { roomCode: code, room: this.toRoomInfo(room) };
  }

  setReady(playerId: string): RoomInfo | null {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (player) {
      player.ready = !player.ready;
    }
    return this.toRoomInfo(room);
  }

  // Update room settings — currently just the game mode. Anyone in the room
  // can change it (matches Tank Battle's "first-come" approach); the new
  // value is broadcast via roomUpdated.
  setMode(playerId: string, mode: GameModeConfig): RoomInfo | null {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;
    if (room.started) return null;
    room.mode = mode;
    return this.toRoomInfo(room);
  }

  // Player picks a color in the waiting room. Reject if the room already
  // started, the color isn't on the palette, or another player has it.
  setColor(playerId: string, color: string): RoomInfo | null {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;
    if (room.started) return null;
    const player = room.players.get(playerId);
    if (!player) return null;
    if (!(LOBBY_PLAYER_COLORS as readonly string[]).includes(color)) return null;
    for (const other of room.players.values()) {
      if (other.id !== playerId && other.color === color) return null;
    }
    player.color = color;
    return this.toRoomInfo(room);
  }

  // Reset the room to its waiting-state after a match ends. Clears the
  // started flag and unreadies everyone so the same room can host another
  // round without rejoining.
  returnToLobby(roomCode: string): RoomInfo | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    room.started = false;
    for (const p of room.players.values()) p.ready = false;
    return this.toRoomInfo(room);
  }

  startGame(roomCode: string, requesterId: string): { players: LobbyPlayer[]; mode: GameModeConfig } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.hostId !== requesterId) return null;
    if (room.started) return null;

    room.started = true;
    return { players: Array.from(room.players.values()), mode: room.mode };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getRoomByPlayer(playerId: string): Room | undefined {
    const code = this.playerToRoom.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  getRoomCodeByPlayer(playerId: string): string | undefined {
    return this.playerToRoom.get(playerId);
  }

  private toRoomInfo(room: Room): RoomInfo {
    return {
      code: room.code,
      hostId: room.hostId,
      players: Array.from(room.players.values()),
      maxPlayers: room.maxPlayers,
      started: room.started,
      mode: room.mode,
    };
  }
}
