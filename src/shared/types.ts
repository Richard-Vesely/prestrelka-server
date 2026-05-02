// =====================================================================
// AUTO-GENERATED — DO NOT EDIT.
// Source of truth: ardoremy_actually_website_github_repo/hry/shooter/
// Re-sync: cd shooter-server && node scripts/sync-shared.mjs
// =====================================================================

// ============================================================
// Přestřelka — Client-side type mirror (from server types.ts)
// ============================================================

// ============================================================================
// TUNING — single-source-of-truth for game balance
// ============================================================================
// Edit values in this section to retune the game. Every consumer (sim.ts,
// renderer.ts, network handlers) reads from these constants — no hardcoded
// balance literals live elsewhere in the codebase.
//
// Engine plumbing (tick rate, map size, hitbox radii, spawn intervals) lives
// further down under "World plumbing" — those don't usually need tweaking.
// ----------------------------------------------------------------------------

// --- Player base ---
export const BASE_PLAYER_HP = 100;
export const BASE_PLAYER_SPEED = 200;
export const HP_PER_LEVEL = 5;
export const RESPAWN_TIME = 3;
export const COIN_LOSS_ON_DEATH = 0.5;
export const INITIAL_INVENTORY_SLOTS = 6;
export const MAX_INVENTORY_SLOTS = 9;

// --- XP / leveling ---
export const XP_PER_LEVEL = [0, 25, 60, 125, 200, 300, 425, 575, 750, 1000];
export const PLAYER_KILL_XP = 100;
export const XP_PER_DAMAGE = 0.4;

// --- Damage model (linear-net) ---
// Per-hit multiplier = max(DAMAGE_FLOOR, 1 + atkBonus - defReduction).
// Lower the floor to let stacked offense actually shred stacked defense.
export const DAMAGE_FLOOR = 0.05;

// --- Shop %-stat tiers (Vlastnosti column) ---
// Each shop tier of an upgrade adds (tier × value). Speed is a movement
// multiplier; damage / armor feed the linear-net buckets; maxHp / regen are
// flat HP units. Descriptions in SHOP_ITEMS auto-format from these.
export const SHOP_TIER = {
  maxHp:  10,    // +HP per tier
  speed:  0.10,  // +10 % movement per tier
  armor:  0.08,  // +8 % defReduction per tier
  damage: 0.10,  // +10 % atkBonus per tier
  regen:  1,     // +HP/s per tier
} as const;

// --- Skill tree per-tier bonuses ---
// SKILL_DEFS reads these; descriptions auto-format from the value.
export const SKILL_TIER = {
  meleeDamage: 0.20,   // +20 % melee damage per tier
  gunDamage:   0.20,   // +20 % gun damage per tier
  agility:     0.20,   // +20 % movement per tier
  vitality:    20,     // +20 max HP per tier (flat)
  resilience:  0.15,   // +15 % defReduction per tier (softer than offense skills on purpose)
} as const;

// --- Potions ---
export const SPEED_BOOST_MULTIPLIER = 1.5;     // legacy; agility potion now uses speedBoostTimer
export const SPEED_BOOST_DURATION = 15;        // seconds
export const AGGRESSION_DAMAGE_BONUS = 0.5;    // additive into atkBonus while active
export const AGGRESSION_DURATION = 15;
export const RESISTANT_REDUCTION = 0.5;        // additive into defReduction while active
export const RESISTANT_DURATION = 15;

// --- Bandages ---
export const BANDAGE_HEAL_AMOUNT = 50;         // HP per dose
export const BANDAGE_USE_COOLDOWN = 1.0;       // seconds between consecutive uses
export const BANDAGE_PACK_DOSES = 3;           // doses granted by the shop pack

// --- Coins ---
// Hard cap on what any single coin pickup pays out. Big drops get scaled
// DOWN to the cap (surplus is lost) — no single grab pays > MAX.
export const COIN_PICKUP_MIN = 15;
export const COIN_PICKUP_MAX = 30;

// --- Domination zones ---
export const ZONE_CAPTURE_TIME = 3;            // solo seconds to fully capture a neutral zone
export const ZONE_POINTS_PER_SECOND = 1;

// --- Capture Flag ---
export const FLAG_PICKUP_RADIUS = 28;
export const FLAG_RETURN_RADIUS = 28;
export const FLAG_CAPTURE_RADIUS = 60;

// --- Capture Arena ---
export const ARENA_CAPTURE_TIME = 60;          // solo seconds to fully capture
export const ARENA_PROGRESS_PER_ATTACKER = 100 / ARENA_CAPTURE_TIME;

// --- Zombie Apocalypse ---
export const ZOMBIE_WAVE_BASE_COUNT = 6;       // wave 1 spawns this many
export const ZOMBIE_WAVE_GROWTH = 4;           // each subsequent wave +N
export const ZOMBIE_WAVE_SPAWN_INTERVAL = 0.7;
export const ZOMBIE_WAVE_INTERMISSION_S = 12;
export const ZOMBIE_PLAYER_HP = 70;
export const ZOMBIE_PLAYER_SPEED_MUL = 1.35;
export const ZOMBIE_PLAYER_DAMAGE_BONUS = 0.5;

// Helper used by SHOP_ITEMS / SKILL_DEFS to format percentage descriptions
// directly from the tuning values above.
const pct = (v: number) => `${Math.round(v * 100)}`;

// ============================================================================
// END TUNING block — types and engine plumbing follow
// ============================================================================


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

// Team identifier for the team-vs-team modes (captureFlag, captureArena).
// Non-team modes default everyone to 'red' so the field is always defined.
export type TeamId = 'red' | 'blue';
export const TEAM_IDS: TeamId[] = ['red', 'blue'];
export const TEAM_COLORS: Record<TeamId, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
};
export const TEAM_LABELS: Record<TeamId, string> = {
  red: 'Červení',
  blue: 'Modří',
};

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
  // Team assignment. Always set, but only meaningful in team modes
  // (captureFlag, captureArena). Solo / FFA modes default everyone to 'red'.
  team: TeamId;
  currentWeapon: SlotItem;
  currentAmmo: number;
  // Durability of the currently-wielded melee weapon (mirror of the slot's
  // durability). -1 = infinite/non-melee.
  currentDurability: number;
  inventory: InventorySlot[];
  // Current per-player inventory cap. Starts at INITIAL_INVENTORY_SLOTS,
  // grows when the player buys "Slot navíc" in the shop, hard-capped at
  // MAX_INVENTORY_SLOTS so number-key bindings (1-9) stay valid.
  inventorySlots: number;
  alive: boolean;
  respawnTimer: number;
  speedBoostTimer: number;
  // Timer-driven potion buffs. Aggression boosts outgoing damage; resistant
  // reduces incoming damage. Both decrement in processTimers.
  aggressionTimer: number;
  resistantTimer: number;
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
  // True if the player has locked the slot with B. Locked slots are skipped
  // when picking what to overwrite during a forced inventory swap.
  locked?: boolean;
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
  // Melee durability carried by the pickup (only set when a melee weapon was
  // dropped by a player). Lets a dropped katana/knife keep its used-up state
  // instead of resetting to full when picked back up.
  weaponDurability?: number;
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
  // Team-mode map data. Always populated so a single map can serve every
  // mode; the sim only consumes the bits relevant to the active mode.
  flagBases: FlagBase[];
  teamArenas: TeamArena[];
  // Per-team spawn anchors. Team modes spawn the player at their own anchor
  // instead of the generic playerSpawnPoints rotation.
  teamSpawnPoints: Record<TeamId, Vec2[]>;
}

// --- Shop ---

export type StatUpgrade = 'maxHp' | 'speed' | 'armor' | 'damage' | 'regen';
export type Consumable =
  | 'buyInventorySlot'
  | 'bandagePack'
  | 'potionAgility'
  | 'potionAggression'
  | 'potionResistant';
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

// Top-level shop categories. Used by the two-key shop UI (Q/W/E/R picks
// a category, then 1-9 picks an item within it).
export type ShopCategory = 'stats' | 'weapons' | 'armor' | 'items';

export interface ShopItemDef {
  id: ShopItem;
  name: string;
  description: string;
  // Soft cap for visual purposes; the only item that's actually capped at
  // runtime is maxHp. costs[] flattens past the array end.
  maxTier: number;
  costs: number[];
  isConsumable: boolean;
  category: ShopCategory;
  // Optional discriminators — set for shop entries that grant a weapon or
  // an armor piece when purchased. The sim's purchase handler routes on these.
  buyWeapon?: WeaponType;
  buyArmor?: ArmorType;
}

// Shop catalog. Tier costs are flat (don't ramp up) per the design guidance.
// Items 6 (hpPotion) and 7 (shieldPotion) were removed — heals come from
// bandage pickups instead. Weapons + armor are buyable here as an alternative
// to scavenging boxes.
// Flat-pricing rules (set by Richard 2026-05-01):
//   * Stats, items, armor, advanced weapons → 100
//   * Simple weapons (pistol, knife) → 50
//   * No item is capped — every stat including maxHp can be bought indefinitely.
// Tier costs are flat: each costs[] entry is the same.
export const SHOP_ITEMS: Record<ShopItem, ShopItemDef> = {
  // ── Stat upgrades (uncapped) ────────────────────────────
  // Per-tier values come from SHOP_TIER in the TUNING block. Skill tree is
  // the bigger lever per investment; the shop is the steady ramp.
  maxHp:        { id: 'maxHp',        name: 'Max HP',          description: `+${SHOP_TIER.maxHp} HP`,                         maxTier: 99, costs: [100], isConsumable: false, category: 'stats' },
  speed:        { id: 'speed',        name: 'Rychlost',        description: `+${pct(SHOP_TIER.speed)} % rychlosti`,            maxTier: 99, costs: [100], isConsumable: false, category: 'stats' },
  armor:        { id: 'armor',        name: 'Pasivní brnění',  description: `-${pct(SHOP_TIER.armor)} % poškození`,            maxTier: 99, costs: [100], isConsumable: false, category: 'stats' },
  damage:       { id: 'damage',       name: 'Poškození',       description: `+${pct(SHOP_TIER.damage)} % poškození`,           maxTier: 99, costs: [100], isConsumable: false, category: 'stats' },
  regen:        { id: 'regen',        name: 'Regenerace',      description: `+${SHOP_TIER.regen} HP/s`,                        maxTier: 99, costs: [100], isConsumable: false, category: 'stats' },

  // ── Ostatní (consumables) ───────────────────────────────
  bandagePack:       { id: 'bandagePack',       name: 'Tři obvazy',       description: '3× obvaz (50 HP/kus)',           maxTier: 1, costs: [100], isConsumable: true,  category: 'items' },
  potionAggression:  { id: 'potionAggression',  name: 'Lektvar agrese',   description: '+50 % zranění na 15 s',          maxTier: 1, costs: [100], isConsumable: true,  category: 'items' },
  potionResistant:   { id: 'potionResistant',   name: 'Lektvar odolnosti',description: '-50 % příchozího zranění na 15 s',maxTier: 1, costs: [100], isConsumable: true,  category: 'items' },
  potionAgility:     { id: 'potionAgility',     name: 'Lektvar mrštnosti',description: '+50 % rychlost na 15 s',         maxTier: 1, costs: [100], isConsumable: true,  category: 'items' },
  buyInventorySlot:  { id: 'buyInventorySlot',  name: 'Slot navíc',       description: '+1 místo v inventáři',           maxTier: 1, costs: [100], isConsumable: true,  category: 'items' },

  // ── Weapons (simple = 50, advanced = 100) ───────────────
  buyPistol:         { id: 'buyPistol',         name: 'Koupit pistoli',       description: '+8 nábojů',         maxTier: 1, costs: [50],  isConsumable: true, category: 'weapons', buyWeapon: 'pistol' },
  buyKnife:          { id: 'buyKnife',          name: 'Koupit nůž',           description: 'Trvanlivost 60',    maxTier: 1, costs: [50],  isConsumable: true, category: 'weapons', buyWeapon: 'knife' },
  buyShotgun:        { id: 'buyShotgun',        name: 'Koupit brokovnici',    description: '+6 nábojů',         maxTier: 1, costs: [100], isConsumable: true, category: 'weapons', buyWeapon: 'shotgun' },
  buySmg:            { id: 'buySmg',            name: 'Koupit samopal',       description: '+30 nábojů',        maxTier: 1, costs: [100], isConsumable: true, category: 'weapons', buyWeapon: 'smg' },
  buyKatana:         { id: 'buyKatana',         name: 'Koupit katanu',        description: 'Trvanlivost 150',   maxTier: 1, costs: [100], isConsumable: true, category: 'weapons', buyWeapon: 'katana' },
  buyAssaultRifle:   { id: 'buyAssaultRifle',   name: 'Koupit puška',         description: '+15 nábojů',        maxTier: 1, costs: [100], isConsumable: true, category: 'weapons', buyWeapon: 'assault_rifle' },
  buySniper:         { id: 'buySniper',         name: 'Koupit odstřelovačku', description: '+3 náboje',         maxTier: 1, costs: [100], isConsumable: true, category: 'weapons', buyWeapon: 'sniper' },
  buyRocketLauncher: { id: 'buyRocketLauncher', name: 'Koupit raketomet',     description: '+2 náboje',         maxTier: 1, costs: [100], isConsumable: true, category: 'weapons', buyWeapon: 'rocket_launcher' },

  // ── Armor pieces (equipped in the armor slot, deplete on hit) ──
  buyArmorClose:     { id: 'buyArmorClose',     name: 'Brnění zblízka',     description: 'Pohlcuje 60 % zásahu zblízka',  maxTier: 1, costs: [100], isConsumable: true, category: 'armor', buyArmor: 'close' },
  buyArmorLong:      { id: 'buyArmorLong',      name: 'Brnění zdálky',      description: 'Pohlcuje 60 % zásahu zdálky',   maxTier: 1, costs: [100], isConsumable: true, category: 'armor', buyArmor: 'long' },
  buyArmorUniversal: { id: 'buyArmorUniversal', name: 'Univerzální brnění', description: 'Pohlcuje 40 % každého zásahu',  maxTier: 1, costs: [100], isConsumable: true, category: 'armor', buyArmor: 'universal' },
};

// Per-category ordered list — drives column rendering and the keyboard
// "select column then buy item N" flow.
export const SHOP_CATEGORY_ORDER: Record<ShopCategory, ShopItem[]> = {
  stats:   ['maxHp', 'speed', 'armor', 'damage', 'regen'],
  items:   ['bandagePack', 'potionAggression', 'potionResistant', 'potionAgility', 'buyInventorySlot'],
  weapons: ['buyPistol', 'buyKnife', 'buyShotgun', 'buySmg', 'buyKatana', 'buyAssaultRifle', 'buySniper', 'buyRocketLauncher'],
  armor:   ['buyArmorClose', 'buyArmorLong', 'buyArmorUniversal'],
};

// Category list as it appears in the shop HUD. Mapped to number keys 1-4 so
// they don't collide with E (the shop open/close key) or with WASD movement.
// Two-step keyboard buy: press 1-4 to highlight a column, then 1-N to buy
// the Nth item in that column. Mouse click on any item still buys directly.
export const SHOP_CATEGORY_LIST: { category: ShopCategory; keyLabel: string; name: string }[] = [
  { category: 'stats',   keyLabel: '1', name: 'Vlastnosti' },
  { category: 'weapons', keyLabel: '2', name: 'Zbraně' },
  { category: 'armor',   keyLabel: '3', name: 'Brnění' },
  { category: 'items',   keyLabel: '4', name: 'Ostatní' },
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
// XP_PER_LEVEL / HP_PER_LEVEL / PLAYER_KILL_XP / XP_PER_DAMAGE — moved to TUNING block.

// --- Skill tree (permanent, level-up rewards) ---

export type SkillType = 'meleeDamage' | 'gunDamage' | 'agility' | 'vitality' | 'resilience';

export interface SkillDef {
  id: SkillType;
  name: string;          // Czech display name
  description: string;   // Per-tier effect summary
  maxTier: number;
  perTier: number;       // For tooltip math (effect per tier as a 0-1 multiplier or absolute)
}

// SKILL_DEFS reads its perTier numbers from the TUNING block at the top of
// the file — edit SKILL_TIER there to retune. Descriptions auto-format
// from the value so the picker text stays in sync. (`pct` helper is also
// in the TUNING block.)
export const SKILL_DEFS: Record<SkillType, SkillDef> = {
  meleeDamage: { id: 'meleeDamage', name: 'Boj zblízka', description: `+${pct(SKILL_TIER.meleeDamage)} % poškození zblízka`, maxTier: 5, perTier: SKILL_TIER.meleeDamage },
  gunDamage:   { id: 'gunDamage',   name: 'Střelba',     description: `+${pct(SKILL_TIER.gunDamage)} % poškození zbraní`,    maxTier: 5, perTier: SKILL_TIER.gunDamage },
  agility:     { id: 'agility',     name: 'Hbitost',     description: `+${pct(SKILL_TIER.agility)} % rychlosti`,             maxTier: 5, perTier: SKILL_TIER.agility },
  vitality:    { id: 'vitality',    name: 'Vitalita',    description: `+${SKILL_TIER.vitality} maximálního HP`,                maxTier: 5, perTier: SKILL_TIER.vitality },
  resilience:  { id: 'resilience',  name: 'Odolnost',    description: `−${pct(SKILL_TIER.resilience)} % přijatého poškození`, maxTier: 5, perTier: SKILL_TIER.resilience },
};

// --- World plumbing (engine-internal — usually leave alone) ---
//
// Balance values (player HP / speed, potions, bandages, coins, etc.) live
// in the TUNING block at the top of this file. The constants below are
// engine-internal: tick rate, map dimensions, hit radii, spawn intervals.

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
export const MAP_WIDTH = 3000;
export const MAP_HEIGHT = 3000;
export const PLAYER_RADIUS = 16;
export const NPC_RADIUS = 16;
export const PICKUP_RADIUS = 14;
export const PROJECTILE_RADIUS = 4;
export const MAX_NPCS = 20;
export const NPC_RESPAWN_INTERVAL = 5;
export const SHOP_INTERACT_RADIUS = 60;
export const PICKUP_COLLECT_RADIUS = 30;
// Loot box spawning: every BOX_SPAWN_INTERVAL seconds a box drops at a
// random valid location, capped at MAX_PICKUP_BOXES live boxes on the map.
export const BOX_SPAWN_INTERVAL = 12;
export const MAX_PICKUP_BOXES = 8;
// Movement speed multiplier while right-click blocking with a melee weapon.
export const BLOCK_SPEED_MULTIPLIER = 0.45;
// Legacy constants — referenced by older code paths but not by the current
// shop catalog. Kept for backwards compatibility with any in-flight saves.
export const SHIELD_POTION_AMOUNT = 50;
export const SHIELD_POTION_DURATION = 30;
export const HP_POTION_AMOUNT = 50;

// --- Game State (broadcast from server) ---

export interface GameState {
  players: PlayerState[];
  npcs: NPCState[];
  projectiles: Projectile[];
  pickups: Pickup[];
  controlZones: ControlZoneState[];
  time: number;
  // Team-mode state. Both arrays are present in every state but stay empty
  // outside of the matching mode, so older clients ignore them harmlessly.
  flags: FlagState[];
  arenas: ArenaState[];
  // Aggregate team scores for HUD rendering.
  //   captureFlag  — captures per team (whichever hits pointTarget wins).
  //   captureArena — best per-team capture progress over all arenas.
  teamScore: Record<TeamId, number>;
  // Zombie-apocalypse wave state. Empty wrapper for non-zombie modes.
  zombie?: {
    wave: number;            // current wave (1-indexed); 0 before first wave
    target: number;          // total waves to survive (mirrors pointTarget)
    spawned: number;         // zombies drip-spawned this wave
    waveCount: number;       // total zombies expected this wave
    inIntermission: boolean;
    intermissionRemaining: number;  // seconds left
  };
}

// --- Game modes ---
//
// Three multiplayer modes with distinct win conditions. The same map and
// gameplay loop runs underneath; only victory checks differ.
//
//   massacre     — first to N kills wins. Classic deathmatch.
//   lastStanding — each player has N lives; last with lives > 0 wins.
//   lootLord     — first to N lifetime coins (coins earned, never spent) wins.

export type GameMode = 'massacre' | 'lastStanding' | 'lootLord' | 'domination' | 'captureFlag' | 'captureArena' | 'zombieApocalypse';

// Modes where players are sorted into red/blue at spawn. Non-team modes
// don't render the team picker / score banner and assign everyone 'red'.
// zombieApocalypse is a team mode too — humans on red, zombies on blue —
// even though it's co-op rather than team-vs-team.
export const TEAM_MODES: ReadonlyArray<GameMode> = ['captureFlag', 'captureArena', 'zombieApocalypse'];
export function isTeamMode(mode: GameMode): boolean {
  return TEAM_MODES.includes(mode);
}

export interface GameModeConfig {
  mode: GameMode;
  killTarget: number;        // -1 disables; only used by 'massacre'
  livesPerPlayer: number;    // -1 = infinite respawns; only used by 'lastStanding'
  coinTarget: number;        // -1 disables; only used by 'lootLord'
  pointTarget: number;       // -1 disables; used by 'domination' and team modes
                             //   (captureFlag = captures to win,
                             //    captureArena = capture progress per arena, fixed at 100)
}

export const GAME_MODE_DEFAULTS: Record<GameMode, GameModeConfig> = {
  massacre:      { mode: 'massacre',      killTarget: 20, livesPerPlayer: -1, coinTarget: -1,  pointTarget: -1 },
  lastStanding:  { mode: 'lastStanding',  killTarget: -1, livesPerPlayer: 5,  coinTarget: -1,  pointTarget: -1 },
  lootLord:      { mode: 'lootLord',      killTarget: -1, livesPerPlayer: -1, coinTarget: 500, pointTarget: -1 },
  domination:    { mode: 'domination',    killTarget: -1, livesPerPlayer: -1, coinTarget: -1,  pointTarget: 400 },
  captureFlag:      { mode: 'captureFlag',      killTarget: -1, livesPerPlayer: -1, coinTarget: -1, pointTarget: 3 },
  captureArena:     { mode: 'captureArena',     killTarget: -1, livesPerPlayer: -1, coinTarget: -1, pointTarget: 100 },
  // pointTarget = number of waves humans must survive to win.
  zombieApocalypse: { mode: 'zombieApocalypse', killTarget: -1, livesPerPlayer: -1, coinTarget: -1, pointTarget: 5 },
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
  captureFlag: {
    name: 'Vlajka',
    tagline: 'Týmy — ukradni vlajku, dones do své základny',
    description: 'Červení proti Modrým. Sebereš vlajku v cizí základně, doneseš ke své. Tým, který vlastní 3 vlajky, vyhrává.',
  },
  captureArena: {
    name: 'Aréna',
    tagline: 'Týmy — obsaď arénu nepřítele od 0 do 100',
    description: 'Červení proti Modrým. Stůj v aréně nepřítele, abys ji obsazoval. Postup nelze otočit. Tým, který obsadí cizí arénu na 100 %, vyhrává.',
  },
  zombieApocalypse: {
    name: 'Zombie apokalypsa',
    tagline: 'Co-op — přežij vlny zombíků',
    description: 'Hráči proti zombíkům. Když zemřeš, sám se staneš zombíkem a útočíš na bývalé spoluhráče. Vyhrávají hráči, kteří přežijí všechny vlny.',
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

// ZONE_CAPTURE_TIME / ZONE_POINTS_PER_SECOND — moved to TUNING block.

// --- Team modes: shared map data + state ---
//
// Capture Flag: every team has one base. The flag rests at the base when
// idle; an enemy carries it (visible on the map and minimap); it drops
// when its carrier dies; an ally returning to the dropped flag instantly
// teleports it back to base. A capture happens when an enemy carrier
// reaches their own base while their own flag is also at home.
export interface FlagBase {
  team: TeamId;
  x: number;
  y: number;
  // Capture / pickup radius around the base.
  radius: number;
}

export interface FlagState {
  team: TeamId;            // which team this flag *belongs* to
  x: number;               // current world position (mirrors carrier when held)
  y: number;
  carrierId: string | null; // null when at base or dropped on the ground
  atBase: boolean;          // false while carried OR dropped on the ground
}

// FLAG_PICKUP_RADIUS / FLAG_RETURN_RADIUS / FLAG_CAPTURE_RADIUS — moved to TUNING block.

// Capture Arena: each team has one or more arenas. While alive opposing
// players stand inside an arena, capture progress for THEIR team rises
// toward 100. Progress never reverses. First arena to 100 ends the match.
export interface TeamArena {
  id: number;
  team: TeamId;            // the team that *owns* the arena (defends it)
  x: number;
  y: number;
  radius: number;
}

export interface ArenaState {
  id: number;
  ownerTeam: TeamId;
  // Per-attacker-team capture progress (0..pointTarget). Indexed by the
  // attacker team — the owner team's entry is always 0 since you can't
  // capture your own arena.
  progress: Record<TeamId, number>;
}

// ARENA_CAPTURE_TIME / ARENA_PROGRESS_PER_ATTACKER — moved to TUNING block.
// All ZOMBIE_* constants — moved to TUNING block.

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
  // Currently-selected mode for the waiting room. Anyone can change it via
  // updateRoomSettings before startGame fires; the server broadcasts the new
  // value on roomUpdated.
  mode: GameModeConfig;
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
  'updateRoomSettings',
  'input', 'purchase', 'switchWeapon', 'spendSkill', 'dropWeapon',
  // B toggles lock on the currently-equipped slot. F asks the server to
  // swap the closest in-range pickup with the held slot when inventory's full.
  'toggleLock', 'swapPickup',
] as const;

// Server -> Client
export const S2C_EVENTS = [
  'roomCreated', 'roomJoined', 'roomUpdated', 'playerJoined', 'playerLeft', 'playerReady',
  'gameStart', 'gameState', 'gameOver',
  'playerKilled', 'playerRespawned',
  'pickupCollected', 'purchaseSuccess', 'purchaseFailed',
  'nearShop', 'nearPickup', 'levelUp',
  // Local-sim-only effect events (also safe for future server use):
  'weaponFired', 'projectileHitWall', 'damageDealt', 'hitConfirmed', 'npcKilled',
  'explosion',
  // Team-mode events (captureFlag, captureArena):
  'flagPicked', 'flagDropped', 'flagReturned', 'flagCaptured', 'arenaCaptured',
  // Zombie-apocalypse lifecycle:
  'zombieWaveStart', 'zombieWaveComplete', 'zombieInfected',
  'error',
] as const;

export type S2CEventName = typeof S2C_EVENTS[number];

// Event payload types
export interface C2S {
  createRoom: { name: string; mode?: GameModeConfig };
  joinRoom: { code: string; name: string };
  playerReady: {};
  startGame: {};
  updateRoomSettings: { mode: GameModeConfig };
  leaveRoom: {};
  input: PlayerInput;
  purchase: { item: ShopItem };
  switchWeapon: { slot: number };
  spendSkill: { skill: SkillType };
  dropWeapon: Record<string, never>;
  toggleLock: Record<string, never>;
  swapPickup: Record<string, never>;
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
  gameOver: {
    scores: { id: string; name: string; kills: number; deaths: number; team?: TeamId; win?: boolean }[];
    // Set when the match was decided by a team-mode win (captureFlag /
    // captureArena). FFA / domination leave it undefined.
    winnerTeam?: TeamId;
  };
  playerKilled: { killerId: string; killerName: string; victimId: string; victimName: string; weapon: WeaponType };
  playerRespawned: { id: string; x: number; y: number };
  pickupCollected: { pickupId: number; playerId: string };
  purchaseSuccess: { item: ShopItem; cost: number; tier: number };
  purchaseFailed: { reason: string };
  nearShop: { shopId: number; near: boolean };
  // Sent when the player walks within F-swap range of a pickup that doesn't
  // fit their inventory. -1 in pickupId means "no pickup currently in range".
  nearPickup: { pickupId: number };
  levelUp: { id: string; level: number };
  weaponFired: { playerId: string; weapon: WeaponType; x: number; y: number; angle: number };
  projectileHitWall: { x: number; y: number; angle: number };
  damageDealt: { id: string; x: number; y: number; dmg: number; shield: boolean };
  hitConfirmed: Record<string, never>;
  npcKilled: { x: number; y: number; type: NPCType };
  explosion: { x: number; y: number; radius: number };
  // Team-mode lifecycle events. Clients can use them for sound / kill-feed
  // style notifications; the canonical state still flows through gameState.
  flagPicked:    { team: TeamId; carrierId: string };
  flagDropped:   { team: TeamId; x: number; y: number };
  flagReturned:  { team: TeamId };
  flagCaptured:  { scoringTeam: TeamId; capturedTeam: TeamId; capturerId: string; score: number };
  arenaCaptured: { arenaId: number; capturedTeam: TeamId; scoringTeam: TeamId };
  // Zombie apocalypse lifecycle. canonical wave state still flows through
  // gameState.zombie; these are for one-shot UX (notification, sound).
  zombieWaveStart:    { wave: number; count: number };
  zombieWaveComplete: { wave: number };
  zombieInfected:     { id: string; name: string };
  error: { message: string };
}
