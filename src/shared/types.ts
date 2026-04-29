// =====================================================================
// AUTO-GENERATED — DO NOT EDIT.
// Source of truth: ardoremy_actually_website_github_repo/hry/shooter/
// Re-sync: cd shooter-server && ./scripts/sync-shared.sh
// =====================================================================

// ============================================================
// Přestřelka — Client-side type mirror (from server types.ts)
// ============================================================

// --- Geometry ---

export interface Vec2 { x: number; y: number }

// --- Weapons ---

// ============================================================
// LOOT REFERENCE TABLE
// ============================================================
// All numbers also live as actual constants below (WEAPON_DEFS,
// BOX_LOOT_TABLE, NPC_WEAPON_DROPS). Tweak there.
// ────────────────────────────────────────────────────────────
// Weapon            | Ammo¹ | Effect                                  | Durability² | Block³ | Box wt | NPC drop (zombie / ranged / tank)
// ──────────────────|───────|─────────────────────────────────────────|─────────────|────────|────────|──────────────────────────────────
// fists             |  ∞    | melee, 10 dmg                           |  ∞          |  15 %  |   –    | –       /  –       /  –
// knife             |  ∞    | melee, 30 dmg                           |  60 / 2 swg |  35 %  |   8    | 60 %    /  –       /  –
// katana            |  ∞    | melee, 55 dmg + heavy knockback         | 150 / 3 swg |  65 %  |  25    |  –      /  –       / 15 %
// pistol            |  8    | ranged, 15 dmg                          |  –          |   –    |  10    | 40 %    /  –       /  –
// shotgun           |  6    | spread, 6 pellets × 9 dmg               |  –          |   –    |   8    |  –      /  –       / 35 %
// smg               | 30    | rapid fire, 10 dmg                      |  –          |   –    |   8    |  –      / 50 %     /  –
// assault_rifle     | 15    | ranged, 20 dmg                          |  –          |   –    |   7    |  –      / 50 %     / 20 %
// sniper            |  3    | long range, 80 dmg                      |  –          |   –    |   4    |  –      /  –       / 25 %
// rocket_launcher   |  2    | explosive AoE, 90 dmg + 100 px splash   |  –          |   –    |   2    |  –      /  –       /  5 %
// bandage (slot)    |  –    | use to heal 50 HP per dose, stacks      |  –          |   –    |  28    |  –      /  –       /  –
//
// ¹ "Ammo" for ranged = bullets added per pickup; multiple pickups stack additively (no cap).
// ² Durability = melee weapon HP. Each swing costs `swg` durability; each blocked point costs durability too. Hits 0 → weapon breaks.
// ³ Block efficiency = % of incoming damage absorbed when right-click held with that weapon equipped (rest hits the player).
// ============================================================

export type WeaponType = 'fists' | 'knife' | 'katana' | 'pistol' | 'shotgun' | 'smg' | 'assault_rifle' | 'sniper' | 'rocket_launcher';

// SlotItem covers anything that can occupy an inventory slot — weapons + bandages.
export type SlotItem = WeaponType | 'bandage';

export interface WeaponDef {
  type: WeaponType;
  name: string;           // Czech display name
  damage: number;
  fireRate: number;       // shots per second
  range: number;          // game units
  maxAmmo: number;        // ammo granted per pickup (-1 = infinite/melee). Pickups stack with no cap.
  melee: boolean;
  spread?: number;        // radians (shotgun)
  pellets?: number;       // projectile count per shot (shotgun)
  projectileSpeed?: number;
  knockback?: number;     // push force on hit
  explosionRadius?: number; // AoE radius for explosive weapons (rocket)
  // ── Melee fields (ignored for ranged) ───────────────────────
  meleeHp?: number;       // starting durability (-1 = infinite, e.g. fists)
  blockEfficiency?: number; // 0..1 — portion of incoming damage absorbed when blocking
  meleeAttackCost?: number; // durability spent per swing
}

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  fists:           { type: 'fists',           name: 'Pěsti',           damage: 10,  fireRate: 2.5,  range: 35,  maxAmmo: -1,  melee: true,  knockback:  3, meleeHp: -1,  blockEfficiency: 0.15, meleeAttackCost: 0 },
  knife:           { type: 'knife',           name: 'Nůž',             damage: 30,  fireRate: 3.3,  range: 50,  maxAmmo: -1,  melee: true,  knockback:  5, meleeHp: 60,  blockEfficiency: 0.35, meleeAttackCost: 2 },
  katana:          { type: 'katana',          name: 'Katana',          damage: 55,  fireRate: 1.6,  range: 80,  maxAmmo: -1,  melee: true,  knockback: 15, meleeHp: 150, blockEfficiency: 0.65, meleeAttackCost: 3 },
  pistol:          { type: 'pistol',          name: 'Pistole',         damage: 15,  fireRate: 2.5,  range: 400, maxAmmo: 8,   melee: false, projectileSpeed: 700 },
  shotgun:         { type: 'shotgun',         name: 'Brokovnice',      damage: 9,   fireRate: 1.2,  range: 220, maxAmmo: 6,   melee: false, projectileSpeed: 550, spread: 0.35, pellets: 6 },
  smg:             { type: 'smg',             name: 'Samopal',         damage: 10,  fireRate: 10,   range: 320, maxAmmo: 30,  melee: false, projectileSpeed: 600 },
  assault_rifle:   { type: 'assault_rifle',   name: 'Útočná puška',    damage: 20,  fireRate: 5,    range: 500, maxAmmo: 15,  melee: false, projectileSpeed: 800 },
  sniper:          { type: 'sniper',          name: 'Odstřelovačka',   damage: 80,  fireRate: 0.7,  range: 800, maxAmmo: 3,   melee: false, projectileSpeed: 1100 },
  rocket_launcher: { type: 'rocket_launcher', name: 'Raketomet',       damage: 90,  fireRate: 0.6,  range: 600, maxAmmo: 2,   melee: false, projectileSpeed: 480, explosionRadius: 100, knockback: 10 },
};

// Emoji icons for each weapon (used in HUD + pickups)
export const WEAPON_ICONS: Record<WeaponType, string> = {
  fists: '👊',
  knife: '🔪',
  katana: '⚔️',
  pistol: '🔫',
  shotgun: '💥',
  smg: '🔥',
  assault_rifle: '🎯',
  sniper: '🏹',
  rocket_launcher: '🚀',
};

// Accent colors per weapon (for HUD and pickup rendering)
export const WEAPON_COLORS: Record<WeaponType, string> = {
  fists: '#888',
  knife: '#aaa',
  katana: '#e0e0e0',
  pistol: '#8bc34a',
  shotgun: '#ff9800',
  smg: '#03a9f4',
  assault_rifle: '#f44336',
  sniper: '#9c27b0',
  rocket_launcher: '#ff5722',
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
  armor: number;
  damageBoost: number;
  regen: number;
  level: number;
  xp: number;
  xpToNext: number;
  coins: number;
  // Coins ever earned this match, regardless of spending. Used by lootLord
  // mode for win checks and the standings panel.
  lifetimeCoins: number;
  kills: number;
  deaths: number;
  // Remaining lives for lastStanding mode. -1 = infinite (other modes).
  livesRemaining: number;
  // True once the player has been permanently knocked out of a
  // lastStanding match (livesRemaining hit 0). Eliminated players stay in the
  // sim as ghosts but don't respawn.
  eliminated: boolean;
  // Generic mode-specific score (currently used by 'domination' for held-zone
  // points). Other modes leave it at 0.
  modeScore: number;
  currentWeapon: SlotItem;
  currentAmmo: number;
  // Durability of the currently-wielded melee weapon (mirror of the slot's
  // durability). -1 = infinite/non-melee.
  currentDurability: number;
  inventory: InventorySlot[];
  alive: boolean;
  respawnTimer: number;
  speedBoostTimer: number;
  shieldTimer: number;
  // True while the player is actively right-click blocking with a melee weapon.
  blocking: boolean;
  // Cooldown for using bandages — set when one is consumed.
  bandageCooldown: number;
  // Optional armor piece equipped in the dedicated armor slot. Damage matching
  // its protect type is partially absorbed; piece HP depletes by absorbed amount.
  equippedArmor: EquippedArmor | null;
  color: string;
  upgrades: Record<StatUpgrade, number>;
  // Permanent skill tree (persists across deaths, unlike upgrades).
  skillPoints: number;
  skills: Record<SkillType, number>;
}

export interface InventorySlot {
  type: SlotItem;
  // For ranged weapons: bullet count. For bandages: doses remaining.
  // For fists / non-bandage melee: -1 (uses durability instead).
  ammo: number;
  // Current melee durability. Only set for melee slots; -1 = infinite (fists).
  durability?: number;
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
  targetId?: string;
}

// --- Projectiles ---

export interface Projectile {
  id: number;
  ownerId: string;
  ownerIsNPC: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  maxRange: number;
  distTraveled: number;
  weapon?: WeaponType;
  explosionRadius?: number;
}

// --- Pickups ---

export type PickupType = 'weapon' | 'coins' | 'bandage';

export interface Pickup {
  id: number;
  type: PickupType;
  x: number;
  y: number;
  weaponType?: WeaponType;
  weaponAmmo?: number;
  coinAmount?: number;
  bandageHeal?: number;
}

// Loot table for boxes spawned around the map. `weight` is relative —
// higher = more common. See LOOT REFERENCE TABLE comment at the top.
export interface BoxLootEntry {
  kind: 'weapon' | 'bandage';
  weapon?: WeaponType;
  weight: number;
}

export const BOX_LOOT_TABLE: BoxLootEntry[] = [
  { kind: 'bandage',                                  weight: 28 },
  { kind: 'weapon', weapon: 'katana',                 weight: 25 },
  { kind: 'weapon', weapon: 'pistol',                 weight: 10 },
  { kind: 'weapon', weapon: 'knife',                  weight:  8 },
  { kind: 'weapon', weapon: 'shotgun',                weight:  8 },
  { kind: 'weapon', weapon: 'smg',                    weight:  8 },
  { kind: 'weapon', weapon: 'assault_rifle',          weight:  7 },
  { kind: 'weapon', weapon: 'sniper',                 weight:  4 },
  { kind: 'weapon', weapon: 'rocket_launcher',        weight:  2 },
];

// --- Map ---

export interface Wall {
  x: number; y: number;
  w: number; h: number;
}

export interface ShopStation {
  id: number;
  x: number; y: number;
  radius: number;
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
  controlZones: ControlZone[];
}

// --- Shop ---

export type StatUpgrade = 'maxHp' | 'speed' | 'armor' | 'damage' | 'regen';
export type Consumable = 'speedBoost';
// Each weapon and each armor piece is also a buyable shop item — they share
// the unified ShopItem union below.
export type WeaponBuy =
  | 'buyPistol' | 'buyKnife' | 'buyShotgun' | 'buySmg' | 'buyKatana'
  | 'buyAssaultRifle' | 'buySniper' | 'buyRocketLauncher';
export type ArmorBuy = 'buyArmorClose' | 'buyArmorLong' | 'buyArmorUniversal';
export type ShopItem = StatUpgrade | Consumable | WeaponBuy | ArmorBuy;

// Map weapon-buy ids ↔ weapon types.
export const WEAPON_BUY_MAP: Record<WeaponBuy, WeaponType> = {
  buyPistol: 'pistol',
  buyKnife: 'knife',
  buyShotgun: 'shotgun',
  buySmg: 'smg',
  buyKatana: 'katana',
  buyAssaultRifle: 'assault_rifle',
  buySniper: 'sniper',
  buyRocketLauncher: 'rocket_launcher',
};

// Armor pieces — equipped in the dedicated armor slot. Damage matching the
// piece's protect type is partially absorbed; the piece's HP depletes by the
// absorbed amount until it breaks.
export type ArmorType = 'close' | 'long' | 'universal';

export interface ArmorPieceDef {
  type: ArmorType;
  name: string;          // Czech display name
  description: string;
  hp: number;            // starting HP buffer
  absorbRatio: number;   // 0..1 portion of incoming damage absorbed
  cost: number;
}

export const ARMOR_PIECES: Record<ArmorType, ArmorPieceDef> = {
  close:     { type: 'close',     name: 'Brnění zblízka',     description: 'Pohlcuje 60 % zásahu zblízka', hp: 80,  absorbRatio: 0.6, cost: 200 },
  long:      { type: 'long',      name: 'Brnění zdálky',      description: 'Pohlcuje 60 % zásahu zdálky',  hp: 80,  absorbRatio: 0.6, cost: 200 },
  universal: { type: 'universal', name: 'Univerzální brnění', description: 'Pohlcuje 40 % každého zásahu', hp: 120, absorbRatio: 0.4, cost: 400 },
};

// Map armor-buy ids ↔ armor types.
export const ARMOR_BUY_MAP: Record<ArmorBuy, ArmorType> = {
  buyArmorClose: 'close',
  buyArmorLong: 'long',
  buyArmorUniversal: 'universal',
};

export interface EquippedArmor {
  type: ArmorType;
  hp: number;
  maxHp: number;
}

export interface ShopItemDef {
  id: ShopItem;
  name: string;
  description: string;
  maxTier: number;
  costs: number[];
  isConsumable: boolean;
  // Optional discriminators — set for shop entries that grant a weapon or
  // an armor piece when purchased. The sim's purchase handler routes on these.
  buyWeapon?: WeaponType;
  buyArmor?: ArmorType;
}

// Shop catalog. Tier costs are flat (don't ramp up) per the design guidance.
// Items 6 (hpPotion) and 7 (shieldPotion) were removed — heals come from
// bandage pickups instead. Weapons + armor are buyable here as an alternative
// to scavenging boxes.
export const SHOP_ITEMS: Record<ShopItem, ShopItemDef> = {
  // ── Stat upgrades (flat costs per tier) ──────────────────
  maxHp:        { id: 'maxHp',        name: 'Max HP',          description: '+20 HP',                         maxTier: 5, costs: [60, 60, 60, 60, 60],   isConsumable: false },
  speed:        { id: 'speed',        name: 'Rychlost',        description: '+10 % rychlosti',                maxTier: 3, costs: [150, 150, 150],         isConsumable: false },
  armor:        { id: 'armor',        name: 'Pasivní brnění',  description: '-15 % poškození',                maxTier: 3, costs: [250, 250, 250],         isConsumable: false },
  damage:       { id: 'damage',       name: 'Poškození',       description: '+15 % poškození',                maxTier: 3, costs: [300, 300, 300],         isConsumable: false },
  regen:        { id: 'regen',        name: 'Regenerace',      description: '+1 HP/s',                        maxTier: 3, costs: [200, 200, 200],         isConsumable: false },

  // ── Consumables ──────────────────────────────────────────
  speedBoost:   { id: 'speedBoost',   name: 'Turbo',           description: '+50 % rychlost na 15 s',         maxTier: 1, costs: [60],                    isConsumable: true },

  // ── Weapons (buy = add to inventory or refill ammo) ──────
  buyPistol:         { id: 'buyPistol',         name: 'Koupit pistoli',     description: '+8 nábojů',          maxTier: 1, costs: [80],  isConsumable: true, buyWeapon: 'pistol' },
  buyKnife:          { id: 'buyKnife',          name: 'Koupit nůž',         description: 'Trvanlivost 60',     maxTier: 1, costs: [100], isConsumable: true, buyWeapon: 'knife' },
  buyShotgun:        { id: 'buyShotgun',        name: 'Koupit brokovnici',  description: '+6 nábojů',          maxTier: 1, costs: [200], isConsumable: true, buyWeapon: 'shotgun' },
  buySmg:            { id: 'buySmg',            name: 'Koupit samopal',     description: '+30 nábojů',         maxTier: 1, costs: [200], isConsumable: true, buyWeapon: 'smg' },
  buyKatana:         { id: 'buyKatana',         name: 'Koupit katanu',      description: 'Trvanlivost 150',    maxTier: 1, costs: [350], isConsumable: true, buyWeapon: 'katana' },
  buyAssaultRifle:   { id: 'buyAssaultRifle',   name: 'Koupit puška',       description: '+15 nábojů',         maxTier: 1, costs: [350], isConsumable: true, buyWeapon: 'assault_rifle' },
  buySniper:         { id: 'buySniper',         name: 'Koupit odstřelovačku', description: '+3 náboje',        maxTier: 1, costs: [400], isConsumable: true, buyWeapon: 'sniper' },
  buyRocketLauncher: { id: 'buyRocketLauncher', name: 'Koupit raketomet',   description: '+2 náboje',          maxTier: 1, costs: [800], isConsumable: true, buyWeapon: 'rocket_launcher' },

  // ── Armor pieces (equipped in the armor slot, deplete on hit) ──
  buyArmorClose:     { id: 'buyArmorClose',     name: 'Brnění zblízka',     description: 'Pohlcuje 60 % zásahu zblízka',  maxTier: 1, costs: [200], isConsumable: true, buyArmor: 'close' },
  buyArmorLong:      { id: 'buyArmorLong',      name: 'Brnění zdálky',      description: 'Pohlcuje 60 % zásahu zdálky',   maxTier: 1, costs: [200], isConsumable: true, buyArmor: 'long' },
  buyArmorUniversal: { id: 'buyArmorUniversal', name: 'Univerzální brnění', description: 'Pohlcuje 40 % každého zásahu',  maxTier: 1, costs: [400], isConsumable: true, buyArmor: 'universal' },
};

// Display order in the shop overlay. Number keys 1..N map to this list.
// Single source of truth shared by sim, renderer, and shooter.ts.
export const SHOP_ITEM_ORDER: ShopItem[] = [
  // Stats first (most-bought passives)
  'maxHp', 'speed', 'armor', 'damage', 'regen',
  // Consumable
  'speedBoost',
  // Weapons (cheapest → most expensive)
  'buyPistol', 'buyKnife', 'buyShotgun', 'buySmg', 'buyKatana', 'buyAssaultRifle', 'buySniper', 'buyRocketLauncher',
  // Armor pieces
  'buyArmorClose', 'buyArmorLong', 'buyArmorUniversal',
];

// --- NPC Definitions ---

export interface NPCDef {
  type: NPCType;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  coinDrop: [number, number];
  weaponDropChance: number;
  aggroRange: number;
  attackRange: number;
  attackRate: number;
}

export const NPC_DEFS: Record<NPCType, NPCDef> = {
  zombie:   { type: 'zombie',   hp: 60,  speed: 80,  damage: 12, xp: 15, coinDrop: [5, 15],   weaponDropChance: 0.15, aggroRange: 300, attackRange: 40,  attackRate: 1.5 },
  ranged:   { type: 'ranged',   hp: 45,  speed: 60,  damage: 18, xp: 30, coinDrop: [10, 25],  weaponDropChance: 0.3,  aggroRange: 400, attackRange: 250, attackRate: 1.0 },
  tank_npc: { type: 'tank_npc', hp: 200, speed: 40,  damage: 25, xp: 60, coinDrop: [25, 50],  weaponDropChance: 0.7,  aggroRange: 250, attackRange: 50,  attackRate: 0.8 },
};

// Per-NPC weighted weapon drop pool. Picked when a kill rolls within
// NPC_DEFS[type].weaponDropChance. See LOOT REFERENCE TABLE.
export interface NPCDropEntry { weapon: WeaponType; weight: number }

export const NPC_WEAPON_DROPS: Record<NPCType, NPCDropEntry[]> = {
  zombie:   [{ weapon: 'knife',   weight: 60 }, { weapon: 'pistol',         weight: 40 }],
  ranged:   [{ weapon: 'smg',     weight: 50 }, { weapon: 'assault_rifle',  weight: 50 }],
  tank_npc: [
    { weapon: 'shotgun',         weight: 35 },
    { weapon: 'sniper',          weight: 25 },
    { weapon: 'assault_rifle',   weight: 20 },
    { weapon: 'katana',          weight: 15 },
    { weapon: 'rocket_launcher', weight:  5 },
  ],
};

// --- Leveling ---

// XP needed to reach each level. Index = level (0 unused). Halved twice
// so leveling is fast — combined with XP_PER_DAMAGE, ~one zombie kill = lvl 2.
export const XP_PER_LEVEL = [0, 25, 60, 125, 200, 300, 425, 575, 750, 1000];
export const HP_PER_LEVEL = 5;
export const PLAYER_KILL_XP = 100;
// Damage XP: every point of damage you deal grants this much XP, on top of
// the kill bonus. Makes hitting things feel rewarding even before the kill.
export const XP_PER_DAMAGE = 0.4;

// --- Skill tree (permanent, level-up rewards) ---

export type SkillType = 'meleeDamage' | 'gunDamage' | 'agility' | 'vitality' | 'resilience';

export interface SkillDef {
  id: SkillType;
  name: string;          // Czech display name
  description: string;   // Per-tier effect summary
  maxTier: number;
  perTier: number;       // For tooltip math (effect per tier as a 0-1 multiplier or absolute)
}

export const SKILL_DEFS: Record<SkillType, SkillDef> = {
  meleeDamage: { id: 'meleeDamage', name: 'Boj zblízka', description: '+15 % poškození zblízka',  maxTier: 5, perTier: 0.15 },
  gunDamage:   { id: 'gunDamage',   name: 'Střelba',     description: '+10 % poškození zbraní',    maxTier: 5, perTier: 0.10 },
  agility:     { id: 'agility',     name: 'Hbitost',     description: '+8 % rychlosti',            maxTier: 5, perTier: 0.08 },
  vitality:    { id: 'vitality',    name: 'Vitalita',    description: '+15 maximálního HP',         maxTier: 5, perTier: 15   },
  resilience:  { id: 'resilience',  name: 'Odolnost',    description: '−8 % přijatého poškození',  maxTier: 5, perTier: 0.08 },
};

// --- Game Constants ---

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
export const MAP_WIDTH = 3000;
export const MAP_HEIGHT = 3000;
export const PLAYER_RADIUS = 16;
export const NPC_RADIUS = 16;
export const PICKUP_RADIUS = 14;
export const PROJECTILE_RADIUS = 4;
export const BASE_PLAYER_HP = 100;
export const BASE_PLAYER_SPEED = 200;
export const RESPAWN_TIME = 3;
export const MAX_NPCS = 20;
export const NPC_RESPAWN_INTERVAL = 5;
export const SHOP_INTERACT_RADIUS = 60;
export const PICKUP_COLLECT_RADIUS = 30;
export const SPEED_BOOST_MULTIPLIER = 1.5;
export const SPEED_BOOST_DURATION = 15;
export const SHIELD_POTION_AMOUNT = 50;
export const SHIELD_POTION_DURATION = 30;
export const HP_POTION_AMOUNT = 50;
// 6 inventory slots = the original 4 + the two extra spots Richard asked for
// (plus a separate equippedArmor field on PlayerState for the dedicated armor slot).
export const MAX_INVENTORY_SLOTS = 6;
export const COIN_LOSS_ON_DEATH = 0.5;

// Loot box spawning: every BOX_SPAWN_INTERVAL seconds a box drops at a
// random valid location, capped at MAX_PICKUP_BOXES live boxes on the map.
export const BOX_SPAWN_INTERVAL = 12;
export const MAX_PICKUP_BOXES = 8;
export const BANDAGE_HEAL_AMOUNT = 50;
export const BANDAGE_USE_COOLDOWN = 1.0; // seconds between uses
// Movement speed multiplier while right-click blocking with a melee weapon.
export const BLOCK_SPEED_MULTIPLIER = 0.45;

// --- Game State (broadcast from server) ---

export interface GameState {
  players: PlayerState[];
  npcs: NPCState[];
  projectiles: Projectile[];
  pickups: Pickup[];
  controlZones: ControlZoneState[];
  time: number;
}

// --- Game modes ---
//
// Three multiplayer modes with distinct win conditions. The same map and
// gameplay loop runs underneath; only victory checks differ.
//
//   massacre     — first to N kills wins. Classic deathmatch.
//   lastStanding — each player has N lives; last with lives > 0 wins.
//   lootLord     — first to N lifetime coins (coins earned, never spent) wins.

export type GameMode = 'massacre' | 'lastStanding' | 'lootLord' | 'domination';

export interface GameModeConfig {
  mode: GameMode;
  killTarget: number;        // -1 disables; only used by 'massacre'
  livesPerPlayer: number;    // -1 = infinite respawns; only used by 'lastStanding'
  coinTarget: number;        // -1 disables; only used by 'lootLord'
  pointTarget: number;       // -1 disables; only used by 'domination'
}

export const GAME_MODE_DEFAULTS: Record<GameMode, GameModeConfig> = {
  massacre:     { mode: 'massacre',     killTarget: 20, livesPerPlayer: -1, coinTarget: -1,  pointTarget: -1 },
  lastStanding: { mode: 'lastStanding', killTarget: -1, livesPerPlayer: 5,  coinTarget: -1,  pointTarget: -1 },
  lootLord:     { mode: 'lootLord',     killTarget: -1, livesPerPlayer: -1, coinTarget: 500, pointTarget: -1 },
  domination:   { mode: 'domination',   killTarget: -1, livesPerPlayer: -1, coinTarget: -1,  pointTarget: 400 },
};

export const GAME_MODE_DEFS: Record<GameMode, { name: string; tagline: string; description: string }> = {
  massacre: {
    name: 'Masakr',
    tagline: 'První na 20 zabití',
    description: 'Klasický deathmatch. Sbírej zbraně, zabíjej, opakuj.',
  },
  lastStanding: {
    name: 'Poslední přeživší',
    tagline: '5 životů — kdo přežije, vyhraje',
    description: 'Battle royale ve zmenšeném. Každý začíná s 5 životy. Když všechny ztratíš, jsi venku.',
  },
  lootLord: {
    name: 'Zlatý král',
    tagline: 'První na 500 mincí',
    description: 'Ekonomický boj. Mince z příšer, hráčů a krabic. Utrácení mincí v obchodě se nepočítá zpátky.',
  },
  domination: {
    name: 'Nadvláda',
    tagline: 'Drž zóny — první na 400 bodů',
    description: 'Tři kontrolní zóny rozeseté po mapě. Stůj v zóně sám, abys ji ovládl. Za každou ovládanou zónu dostáváš 1 bod/s. První na 400 bodů vyhrává.',
  },
};

// Capture-zone definition for domination mode. Map exposes a `controlZones`
// list; sim tracks each one's owner and capture progress.
export interface ControlZone {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export interface ControlZoneState {
  id: number;
  ownerId: string | null;     // current full owner; null = neutral
  captureProgress: number;    // 0..1; once it hits 1 the contender becomes owner
  contenderId: string | null; // who's currently capturing (set when ownerId differs from sole occupant)
}

// Domination: how many seconds of solo presence to fully capture a neutral
// zone, plus the points-per-second the owner accrues.
export const ZONE_CAPTURE_TIME = 3;
export const ZONE_POINTS_PER_SECOND = 1;

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
  block: boolean;
}

// --- Events ---

// Client -> Server
export const C2S_EVENTS = [
  'createRoom', 'joinRoom', 'playerReady', 'startGame', 'leaveRoom',
  'input', 'purchase', 'switchWeapon', 'spendSkill', 'dropWeapon',
] as const;

// Server -> Client
export const S2C_EVENTS = [
  'roomCreated', 'roomJoined', 'roomUpdated', 'playerJoined', 'playerLeft', 'playerReady',
  'gameStart', 'gameState', 'gameOver',
  'playerKilled', 'playerRespawned',
  'pickupCollected', 'purchaseSuccess', 'purchaseFailed',
  'nearShop', 'levelUp',
  // Local-sim-only effect events (also safe for future server use):
  'weaponFired', 'projectileHitWall', 'damageDealt', 'hitConfirmed', 'npcKilled',
  'explosion',
  'error',
] as const;

export type S2CEventName = typeof S2C_EVENTS[number];

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
  spendSkill: { skill: SkillType };
  dropWeapon: Record<string, never>;
}

export interface S2C {
  roomCreated: RoomInfo;
  roomJoined: RoomInfo;
  roomUpdated: RoomInfo;
  playerJoined: { id: string; name: string };
  playerLeft: { id: string };
  playerReady: { id: string };
  gameStart: { map: MapData; mode?: GameModeConfig };
  gameState: GameState;
  gameOver: { scores: { id: string; name: string; kills: number; deaths: number }[] };
  playerKilled: { killerId: string; killerName: string; victimId: string; victimName: string; weapon: WeaponType };
  playerRespawned: { id: string; x: number; y: number };
  pickupCollected: { pickupId: number; playerId: string };
  purchaseSuccess: { item: ShopItem; cost: number; tier: number };
  purchaseFailed: { reason: string };
  nearShop: { shopId: number; near: boolean };
  levelUp: { id: string; level: number };
  weaponFired: { playerId: string; weapon: WeaponType; x: number; y: number; angle: number };
  projectileHitWall: { x: number; y: number; angle: number };
  damageDealt: { id: string; x: number; y: number; dmg: number; shield: boolean };
  hitConfirmed: Record<string, never>;
  npcKilled: { x: number; y: number; type: NPCType };
  explosion: { x: number; y: number; radius: number };
  error: { message: string };
}
