// ============================================================
// Přestřelka — Shared Types (server + client mirror)
// ============================================================

// --- Geometry ---

export interface Vec2 { x: number; y: number }

// --- Weapons ---

export type WeaponType = 'fists' | 'knife' | 'katana' | 'pistol' | 'shotgun' | 'smg' | 'assault_rifle' | 'sniper';

export interface WeaponDef {
  type: WeaponType;
  name: string;           // Czech display name
  damage: number;
  fireRate: number;       // shots per second
  range: number;          // game units
  maxAmmo: number;        // -1 = infinite
  melee: boolean;
  spread?: number;        // radians (shotgun)
  pellets?: number;       // projectile count per shot (shotgun)
  projectileSpeed?: number;
  knockback?: number;     // push force on hit
}

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  fists:          { type: 'fists',          name: 'Pěsti',           damage: 10,  fireRate: 2.5,  range: 35,  maxAmmo: -1,  melee: true,  knockback: 3 },
  knife:          { type: 'knife',          name: 'Nůž',             damage: 30,  fireRate: 3.3,  range: 50,  maxAmmo: -1,  melee: true,  knockback: 5 },
  katana:         { type: 'katana',         name: 'Katana',          damage: 55,  fireRate: 1.6,  range: 80,  maxAmmo: -1,  melee: true,  knockback: 15 },
  pistol:         { type: 'pistol',         name: 'Pistole',         damage: 15,  fireRate: 2.5,  range: 400, maxAmmo: 8,   melee: false, projectileSpeed: 700 },
  shotgun:        { type: 'shotgun',        name: 'Brokovnice',      damage: 9,   fireRate: 1.2,  range: 220, maxAmmo: 6,   melee: false, projectileSpeed: 550, spread: 0.35, pellets: 6 },
  smg:            { type: 'smg',            name: 'Samopal',         damage: 10,  fireRate: 10,   range: 320, maxAmmo: 30,  melee: false, projectileSpeed: 600 },
  assault_rifle:  { type: 'assault_rifle',  name: 'Útočná puška',    damage: 20,  fireRate: 5,    range: 500, maxAmmo: 15,  melee: false, projectileSpeed: 800 },
  sniper:         { type: 'sniper',         name: 'Odstřelovačka',   damage: 80,  fireRate: 0.7,  range: 800, maxAmmo: 3,   melee: false, projectileSpeed: 1100 },
};

// --- Player ---

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  speed: number;
  armor: number;          // damage reduction multiplier (0 = none, 0.15 = -15%)
  damageBoost: number;    // damage multiplier (0 = none, 0.15 = +15%)
  regen: number;          // HP per second
  level: number;
  xp: number;
  xpToNext: number;
  coins: number;
  kills: number;
  deaths: number;
  currentWeapon: WeaponType;
  currentAmmo: number;    // ammo for current weapon (-1 = infinite)
  inventory: InventorySlot[];
  alive: boolean;
  respawnTimer: number;   // seconds remaining, 0 = alive
  // Temporary buffs
  speedBoostTimer: number;
  shieldTimer: number;
  // Visual
  color: string;
  // Upgrades purchased (tier levels, lost on death)
  upgrades: Record<StatUpgrade, number>;
}

export interface InventorySlot {
  type: WeaponType;
  ammo: number;           // -1 = infinite
}

// --- NPC ---

export type NPCType = 'zombie' | 'ranged' | 'tank_npc';

export interface NPCState {
  id: number;
  type: NPCType;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  targetId?: string;      // player id being chased
}

// --- Projectiles ---

export interface Projectile {
  id: number;
  ownerId: string;        // socket id or 'npc-{id}'
  ownerIsNPC: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  maxRange: number;
  distTraveled: number;
}

// --- Pickups ---

export type PickupType = 'weapon' | 'coins';

export interface Pickup {
  id: number;
  type: PickupType;
  x: number;
  y: number;
  weaponType?: WeaponType;
  weaponAmmo?: number;
  coinAmount?: number;
}

// --- Map ---

export interface Wall {
  x: number; y: number;
  w: number; h: number;
}

export interface ShopStation {
  id: number;
  x: number; y: number;
  radius: number;         // interaction range
}

export interface SpawnZone {
  x: number; y: number;
  w: number; h: number;
}

export interface MapData {
  width: number;
  height: number;
  walls: Wall[];
  shopStations: ShopStation[];
  npcSpawnZones: SpawnZone[];
  playerSpawnPoints: Vec2[];
}

// --- Shop ---

export type StatUpgrade = 'maxHp' | 'speed' | 'armor' | 'damage' | 'regen';
export type Consumable = 'hpPotion' | 'shieldPotion' | 'speedBoost';
export type ShopItem = StatUpgrade | Consumable;

export interface ShopItemDef {
  id: ShopItem;
  name: string;             // Czech
  description: string;      // Czech
  maxTier: number;          // 1 for consumables
  costs: number[];          // cost per tier
  isConsumable: boolean;
}

export const SHOP_ITEMS: Record<ShopItem, ShopItemDef> = {
  maxHp:        { id: 'maxHp',        name: 'Max HP',          description: '+20 HP',            maxTier: 5, costs: [50, 100, 200, 400, 800], isConsumable: false },
  speed:        { id: 'speed',        name: 'Rychlost',        description: '+10% rychlosti',    maxTier: 3, costs: [100, 250, 500],           isConsumable: false },
  armor:        { id: 'armor',        name: 'Brnění',          description: '-15% poškození',    maxTier: 3, costs: [150, 300, 600],            isConsumable: false },
  damage:       { id: 'damage',       name: 'Poškození',       description: '+15% poškození',    maxTier: 3, costs: [200, 400, 800],            isConsumable: false },
  regen:        { id: 'regen',        name: 'Regenerace',      description: '+1 HP/s',           maxTier: 3, costs: [100, 250, 500],            isConsumable: false },
  hpPotion:     { id: 'hpPotion',     name: 'Léčivý lektvar',  description: '+50 HP',            maxTier: 1, costs: [50],                       isConsumable: true },
  shieldPotion: { id: 'shieldPotion', name: 'Štít',            description: '+50 štít na 30s',   maxTier: 1, costs: [75],                       isConsumable: true },
  speedBoost:   { id: 'speedBoost',   name: 'Turbo',           description: '+50% rychlost 15s', maxTier: 1, costs: [60],                       isConsumable: true },
};

// --- NPC Definitions ---

export interface NPCDef {
  type: NPCType;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  coinDrop: [number, number]; // [min, max]
  weaponDropChance: number;
  aggroRange: number;
  attackRange: number;
  attackRate: number;         // attacks per second
}

export const NPC_DEFS: Record<NPCType, NPCDef> = {
  zombie:   { type: 'zombie',   hp: 60,  speed: 80,  damage: 12, xp: 15, coinDrop: [5, 15],   weaponDropChance: 0.15, aggroRange: 300, attackRange: 40,  attackRate: 1.5 },
  ranged:   { type: 'ranged',   hp: 45,  speed: 60,  damage: 18, xp: 30, coinDrop: [10, 25],  weaponDropChance: 0.3,  aggroRange: 400, attackRange: 250, attackRate: 1.0 },
  tank_npc: { type: 'tank_npc', hp: 200, speed: 40,  damage: 25, xp: 60, coinDrop: [25, 50],  weaponDropChance: 0.7,  aggroRange: 250, attackRange: 50,  attackRate: 0.8 },
};

// --- Leveling ---

export const XP_PER_LEVEL = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000]; // XP needed for levels 1-10
export const HP_PER_LEVEL = 5;   // bonus max HP per level
export const PLAYER_KILL_XP = 100;

// --- Game Constants ---

export const TICK_RATE = 20;                  // server ticks per second
export const DT = 1 / TICK_RATE;
export const MAP_WIDTH = 3000;
export const MAP_HEIGHT = 3000;
export const PLAYER_RADIUS = 16;
export const NPC_RADIUS = 16;
export const PICKUP_RADIUS = 14;
export const PROJECTILE_RADIUS = 4;
export const BASE_PLAYER_HP = 100;
export const BASE_PLAYER_SPEED = 200;        // units per second
export const RESPAWN_TIME = 3;                // seconds
export const MAX_NPCS = 20;
export const NPC_RESPAWN_INTERVAL = 5;        // seconds between NPC spawns
export const SHOP_INTERACT_RADIUS = 60;
export const PICKUP_COLLECT_RADIUS = 30;
export const SPEED_BOOST_MULTIPLIER = 1.5;
export const SPEED_BOOST_DURATION = 15;       // seconds
export const SHIELD_POTION_AMOUNT = 50;
export const SHIELD_POTION_DURATION = 30;     // seconds
export const HP_POTION_AMOUNT = 50;
export const MAX_INVENTORY_SLOTS = 4;
export const COIN_LOSS_ON_DEATH = 0.5;        // lose 50% coins

// --- Game State (broadcast from server) ---

export interface GameState {
  players: PlayerState[];
  npcs: NPCState[];
  projectiles: Projectile[];
  pickups: Pickup[];
  time: number;
}

// --- Lobby ---

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  started: boolean;
}

// --- Input ---

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  angle: number;
  interact: boolean;
}

// --- Events ---

// Client → Server
export const C2S_EVENTS = [
  'createRoom', 'joinRoom', 'playerReady', 'startGame', 'leaveRoom',
  'input', 'purchase', 'switchWeapon',
] as const;

// Server → Client
export const S2C_EVENTS = [
  'roomCreated', 'roomJoined', 'roomUpdated', 'playerJoined', 'playerLeft', 'playerReady',
  'gameStart', 'gameState', 'gameOver',
  'playerKilled', 'playerRespawned',
  'pickupCollected', 'purchaseSuccess', 'purchaseFailed',
  'nearShop', 'levelUp',
  'error',
] as const;

// Event payload types
export interface C2S {
  createRoom: { name: string };
  joinRoom: { code: string; name: string };
  playerReady: {};
  startGame: {};
  leaveRoom: {};
  input: PlayerInput;
  purchase: { item: ShopItem };
  switchWeapon: { slot: number };
}

export interface S2C {
  roomCreated: RoomInfo;
  roomJoined: RoomInfo;
  roomUpdated: RoomInfo;
  playerJoined: { id: string; name: string };
  playerLeft: { id: string };
  playerReady: { id: string };
  gameStart: { map: MapData };
  gameState: GameState;
  gameOver: { scores: { id: string; name: string; kills: number; deaths: number }[] };
  playerKilled: { killerId: string; killerName: string; victimId: string; victimName: string; weapon: WeaponType };
  playerRespawned: { id: string; x: number; y: number };
  pickupCollected: { pickupId: number; playerId: string };
  purchaseSuccess: { item: ShopItem; cost: number; tier: number };
  purchaseFailed: { reason: string };
  nearShop: { shopId: number; near: boolean };
  levelUp: { id: string; level: number };
  error: { message: string };
}
