import type { RoomInfo, LobbyPlayer } from './shared/types.js';

interface Room {
  code: string;
  hostId: string;
  players: Map<string, LobbyPlayer>;
  maxPlayers: number;
  started: boolean;
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O to avoid confusion

export class Lobby {
  private rooms = new Map<string, Room>();
  private playerToRoom = new Map<string, string>(); // playerId → roomCode

  private generateCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not generate unique room code');
  }

  createRoom(hostId: string, hostName: string): RoomInfo {
    // Leave any existing room first
    this.leaveRoom(hostId);

    const code = this.generateCode();
    const host: LobbyPlayer = { id: hostId, name: hostName, ready: false };
    const room: Room = {
      code,
      hostId,
      players: new Map([[hostId, host]]),
      maxPlayers: 10,
      started: false,
    };
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

    const player: LobbyPlayer = { id: playerId, name: playerName, ready: false };
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

  startGame(roomCode: string, requesterId: string): { players: LobbyPlayer[] } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.hostId !== requesterId) return null;
    if (room.started) return null;

    room.started = true;
    return { players: Array.from(room.players.values()) };
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
    };
  }
}
