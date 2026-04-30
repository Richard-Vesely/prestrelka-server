// =====================================================================
// AUTO-GENERATED — DO NOT EDIT.
// Source of truth: ardoremy_actually_website_github_repo/hry/shooter/
// Re-sync: cd shooter-server && node scripts/sync-shared.mjs
// =====================================================================

// Client-side game simulation — mirrors shooter-server/src/game.ts so the game
// can run entirely in the browser for single-player mode.
import type {
  Vec2, MapData, PlayerState, Projectile, Pickup,
  PlayerInput, GameState, WeaponType, WeaponDef, NPCType, ShopItem,
  StatUpgrade, InventorySlot, LobbyPlayer, SkillType, GameModeConfig,
  ControlZoneState,
} from './types.js';
import { GAME_MODE_DEFAULTS, ZONE_CAPTURE_TIME, ZONE_POINTS_PER_SECOND } from './types.js';

import {
  WEAPON_DEFS, NPC_DEFS, NPC_WEAPON_DROPS, SHOP_ITEMS, XP_PER_LEVEL, HP_PER_LEVEL,
  PLAYER_KILL_XP, XP_PER_DAMAGE, DT, PLAYER_RADIUS, NPC_RADIUS,
  PROJECTILE_RADIUS, BASE_PLAYER_HP, BASE_PLAYER_SPEED, RESPAWN_TIME,
  MAX_NPCS, NPC_RESPAWN_INTERVAL, SHOP_INTERACT_RADIUS,
  PICKUP_COLLECT_RADIUS, SPEED_BOOST_MULTIPLIER, SPEED_BOOST_DURATION,
  MAX_INVENTORY_SLOTS, COIN_LOSS_ON_DEATH, PICKUP_RADIUS, SKILL_DEFS,
  BOX_LOOT_TABLE, BOX_SPAWN_INTERVAL, MAX_PICKUP_BOXES, BANDAGE_HEAL_AMOUNT,
  BANDAGE_USE_COOLDOWN, BLOCK_SPEED_MULTIPLIER, ARMOR_PIECES,
} from './types.js';

// ── Helpers ──────────────────────────────────────────────────

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function circleRectCollision(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (cr * cr);
}

function pushCircleOutOfRect(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): Vec2 {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq === 0) {
    const toLeft = cx - rx;
    const toRight = (rx + rw) - cx;
    const toTop = cy - ry;
    const toBottom = (ry + rh) - cy;
    const minDist = Math.min(toLeft, toRight, toTop, toBottom);
    if (minDist === toLeft) return { x: rx - cr, y: cy };
    if (minDist === toRight) return { x: rx + rw + cr, y: cy };
    if (minDist === toTop) return { x: cx, y: ry - cr };
    return { x: cx, y: ry + rh + cr };
  }
  const d = Math.sqrt(distSq);
  const overlap = cr - d;
  if (overlap <= 0) return { x: cx, y: cy };
  return { x: cx + (dx / d) * overlap, y: cy + (dy / d) * overlap };
}

function pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

// Line-of-sight: does the segment from a to b pass through any wall?
function lineOfSight(a: Vec2, b: Vec2, walls: MapData['walls']): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return true;
  const steps = Math.max(8, Math.ceil(len / 30));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    for (const w of walls) {
      if (pointInRect(px, py, w.x, w.y, w.w, w.h)) return false;
    }
  }
  return true;
}

const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
  '#e67e22', '#1abc9c', '#e84393', '#00cec9', '#fd79a8',
];

// ── Sim events ──────────────────────────────────────────────

export type SimEventCallback = (event: string, targetPlayerId: string | null, data: unknown) => void;

interface InternalNPC {
  id: number;
  type: NPCType;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  targetId?: string;
  hitFlash: number;
}

// Bot AI state (overlays a normal PlayerState)
interface BotState {
  wanderDir: Vec2;
  wanderTimer: number;
  targetId: string | null;
  targetIsNPC: boolean;
  fireDelay: number;
  // Difficulty tuning
  reactionTime: number;
  aimError: number;
  aggression: number;
  preferredWeapon: WeaponType;
}

export class Sim {
  private map: MapData;
  private players = new Map<string, PlayerState>();
  private inputs = new Map<string, PlayerInput>();
  private npcs = new Map<number, InternalNPC>();
  private projectiles = new Map<number, Projectile>();
  private pickups = new Map<number, Pickup>();
  private time = 0;
  private npcSpawnTimer = 0;
  // Stagger first box spawn so the kid can fight zombies before items appear.
  private boxSpawnTimer = BOX_SPAWN_INTERVAL * 0.5;
  private usedColors = new Set<string>();

  private nextProjectileId = 1;
  private nextPickupId = 1;
  private nextNPCId = 1;

  private fireCooldowns = new Map<string, number>();
  private npcAttackCooldowns = new Map<number, number>();
  private npcWanderDir = new Map<number, Vec2>();
  private npcWanderTimer = new Map<number, number>();
  private playerNearShop = new Map<string, Set<number>>();

  // Per-player hit flashes (for renderer)
  hitFlashes = new Map<string, number>();

  // Bot tracking
  private bots = new Map<string, BotState>();

  private emitCallback: SimEventCallback;

  // Active game mode + win-condition config. Defaults to massacre when the
  // caller doesn't specify one.
  private modeCfg: GameModeConfig;
  // Once true, win has been declared and we stop checking / respawning.
  private gameEnded = false;
  // Domination control zones — owner + 0..1 capture progress per zone.
  private zoneStates = new Map<number, ControlZoneState>();

  constructor(lobbyPlayers: LobbyPlayer[], map: MapData, emitCallback: SimEventCallback, modeCfg?: GameModeConfig) {
    this.map = map;
    this.emitCallback = emitCallback;
    this.modeCfg = modeCfg ?? GAME_MODE_DEFAULTS.massacre;
    for (const z of map.controlZones) {
      this.zoneStates.set(z.id, { id: z.id, ownerId: null, captureProgress: 0, contenderId: null });
    }
    for (const lp of lobbyPlayers) this.addPlayer(lp.id, lp.name);
  }

  // ── Player management ────────────────────────────────────

  addPlayer(id: string, name: string): void {
    const color = this.pickColor();
    const spawn = this.randomSpawnPoint();
    const pistolDef = WEAPON_DEFS['pistol'];
    const player: PlayerState = {
      id, name,
      x: spawn.x, y: spawn.y,
      angle: 0,
      hp: BASE_PLAYER_HP,
      maxHp: BASE_PLAYER_HP,
      // Brief spawn protection: shield charge that decays in 2.5s
      shield: 25,
      speed: BASE_PLAYER_SPEED,
      armor: 0,
      damageBoost: 0,
      regen: 0,
      level: 1,
      xp: 0,
      xpToNext: XP_PER_LEVEL[1] ?? 100,
      coins: 0,
      lifetimeCoins: 0,
      kills: 0,
      deaths: 0,
      livesRemaining: this.modeCfg.livesPerPlayer,
      eliminated: false,
      modeScore: 0,
      currentWeapon: 'pistol',
      currentAmmo: pistolDef.maxAmmo,
      currentDurability: -1,
      inventory: [
        { type: 'fists', ammo: -1, durability: -1 },
        { type: 'pistol', ammo: pistolDef.maxAmmo },
      ],
      alive: true,
      respawnTimer: 0,
      speedBoostTimer: 0,
      shieldTimer: 2.5,
      blocking: false,
      bandageCooldown: 0,
      equippedArmor: null,
      color,
      upgrades: { maxHp: 0, speed: 0, armor: 0, damage: 0, regen: 0 },
      skillPoints: 0,
      skills: { meleeDamage: 0, gunDamage: 0, agility: 0, vitality: 0, resilience: 0 },
    };
    this.players.set(id, player);
    this.fireCooldowns.set(id, 0);
    this.playerNearShop.set(id, new Set());
  }

  addBot(name: string, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): string {
    const id = `bot-${Math.floor(Math.random() * 100000)}`;
    this.addPlayer(id, name);
    // Give bots a starting weapon so they're more interesting
    const p = this.players.get(id)!;
    const startWeapons: WeaponType[] = ['pistol', 'smg', 'shotgun'];
    const start = startWeapons[Math.floor(Math.random() * startWeapons.length)];
    const def = WEAPON_DEFS[start];
    p.inventory.push({ type: start, ammo: def.maxAmmo });
    p.currentWeapon = start;
    p.currentAmmo = def.maxAmmo;

    const tuning = difficulty === 'easy'
      ? { reactionTime: 0.8, aimError: 0.22, aggression: 0.45 }
      : difficulty === 'hard'
      ? { reactionTime: 0.2, aimError: 0.08, aggression: 0.95 }
      : { reactionTime: 0.45, aimError: 0.14, aggression: 0.7 };

    this.bots.set(id, {
      wanderDir: { x: Math.random() - 0.5, y: Math.random() - 0.5 },
      wanderTimer: 1 + Math.random() * 2,
      targetId: null,
      targetIsNPC: false,
      fireDelay: 0,
      preferredWeapon: start,
      ...tuning,
    });
    return id;
  }

  removePlayer(id: string): void {
    const p = this.players.get(id);
    if (p) this.usedColors.delete(p.color);
    this.players.delete(id);
    this.inputs.delete(id);
    this.fireCooldowns.delete(id);
    this.playerNearShop.delete(id);
    this.bots.delete(id);
  }

  hasHumanPlayers(): boolean {
    for (const id of this.players.keys()) {
      if (!this.bots.has(id)) return true;
    }
    return false;
  }

  private pickColor(): string {
    for (const c of PLAYER_COLORS) {
      if (!this.usedColors.has(c)) {
        this.usedColors.add(c);
        return c;
      }
    }
    const c = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    this.usedColors.add(c);
    return c;
  }

  private randomSpawnPoint(): Vec2 {
    const pts = this.map.playerSpawnPoints;
    return pts[Math.floor(Math.random() * pts.length)];
  }

  // ── Input ────────────────────────────────────────────────

  setInput(playerId: string, input: PlayerInput): void {
    this.inputs.set(playerId, input);
  }

  // ── Shop purchase ────────────────────────────────────────

  purchase(playerId: string, item: ShopItem): void {
    const p = this.players.get(playerId);
    if (!p || !p.alive) return;

    const nearShops = this.playerNearShop.get(playerId);
    if (!nearShops || nearShops.size === 0) {
      this.emitCallback('purchaseFailed', playerId, { reason: 'Nejsi u obchodu' });
      return;
    }

    const def = SHOP_ITEMS[item];
    if (!def) {
      this.emitCallback('purchaseFailed', playerId, { reason: 'Neznámý předmět' });
      return;
    }

    // Weapon buy: 1-shot purchase, adds the weapon (or refills its ammo).
    if (def.buyWeapon) {
      const cost = def.costs[0];
      if (p.coins < cost) {
        this.emitCallback('purchaseFailed', playerId, { reason: 'Nemáš dost mincí' });
        return;
      }
      if (!this.giveWeapon(p, def.buyWeapon)) {
        this.emitCallback('purchaseFailed', playerId, { reason: 'Plný inventář' });
        return;
      }
      p.coins -= cost;
      this.emitCallback('purchaseSuccess', playerId, { item, cost, tier: 1 });
      return;
    }

    // Armor buy: 1-shot purchase, equips/replaces the armor piece.
    if (def.buyArmor) {
      const cost = def.costs[0];
      if (p.coins < cost) {
        this.emitCallback('purchaseFailed', playerId, { reason: 'Nemáš dost mincí' });
        return;
      }
      const piece = ARMOR_PIECES[def.buyArmor];
      p.equippedArmor = { type: piece.type, hp: piece.hp, maxHp: piece.hp };
      p.coins -= cost;
      this.emitCallback('purchaseSuccess', playerId, { item, cost, tier: 1 });
      return;
    }

    if (def.isConsumable) {
      const cost = def.costs[0];
      if (p.coins < cost) {
        this.emitCallback('purchaseFailed', playerId, { reason: 'Nemáš dost mincí' });
        return;
      }
      p.coins -= cost;
      this.applyConsumable(p, item);
      this.emitCallback('purchaseSuccess', playerId, { item, cost, tier: 1 });
    } else {
      const upgrade = item as StatUpgrade;
      const currentTier = p.upgrades[upgrade];
      if (currentTier >= def.maxTier) {
        this.emitCallback('purchaseFailed', playerId, { reason: 'Maximální úroveň' });
        return;
      }
      const cost = def.costs[currentTier];
      if (p.coins < cost) {
        this.emitCallback('purchaseFailed', playerId, { reason: 'Nemáš dost mincí' });
        return;
      }
      p.coins -= cost;
      p.upgrades[upgrade] = currentTier + 1;
      this.applyUpgrade(p, upgrade);
      this.emitCallback('purchaseSuccess', playerId, { item, cost, tier: currentTier + 1 });
    }
  }

  private applyConsumable(p: PlayerState, item: ShopItem): void {
    // hpPotion / shieldPotion were removed from the shop — heals come from
    // bandage pickups / pickup drops now. Only speedBoost remains as a
    // one-off consumable purchase.
    if (item === 'speedBoost') {
      p.speedBoostTimer = SPEED_BOOST_DURATION;
    }
  }

  private applyUpgrade(p: PlayerState, upgrade: StatUpgrade): void {
    const tier = p.upgrades[upgrade];
    switch (upgrade) {
      case 'maxHp': {
        const bonus = tier * 20;
        p.maxHp = BASE_PLAYER_HP + (p.level - 1) * HP_PER_LEVEL + bonus;
        p.hp = Math.min(p.hp + 20, p.maxHp);
        break;
      }
      case 'speed':
        p.speed = BASE_PLAYER_SPEED * (1 + 0.1 * tier);
        break;
      case 'armor':
        p.armor = tier * 0.15;
        break;
      case 'damage':
        p.damageBoost = tier * 0.15;
        break;
      case 'regen':
        p.regen = tier * 1;
        break;
    }
  }

  private recalcStats(p: PlayerState): void {
    const hpBonus = p.upgrades.maxHp * 20;
    const vitalityBonus = (p.skills.vitality ?? 0) * SKILL_DEFS.vitality.perTier;
    p.maxHp = BASE_PLAYER_HP + (p.level - 1) * HP_PER_LEVEL + hpBonus + vitalityBonus;
    p.speed = BASE_PLAYER_SPEED * (1 + 0.1 * p.upgrades.speed) * (1 + (p.skills.agility ?? 0) * SKILL_DEFS.agility.perTier);
    p.armor = p.upgrades.armor * 0.15;
    p.damageBoost = p.upgrades.damage * 0.15;
    p.regen = p.upgrades.regen * 1;
  }

  // Public method invoked from network adapter when the player buys a skill.
  spendSkillPoint(playerId: string, skill: SkillType): void {
    const p = this.players.get(playerId);
    if (!p || !p.alive) return;
    if (p.skillPoints <= 0) return;
    const def = SKILL_DEFS[skill];
    if (!def) return;
    const current = p.skills[skill] ?? 0;
    if (current >= def.maxTier) return;
    p.skills[skill] = current + 1;
    p.skillPoints--;
    this.recalcStats(p);
    // Heal up so the new HP cap feels good immediately.
    if (skill === 'vitality') p.hp = p.maxHp;
  }

  // Multipliers for damage. Pulled here so sim.ts has a single source of truth.
  private meleeDamageMultiplier(p: PlayerState): number {
    return (1 + p.damageBoost) * (1 + (p.skills.meleeDamage ?? 0) * SKILL_DEFS.meleeDamage.perTier);
  }
  private gunDamageMultiplier(p: PlayerState): number {
    return (1 + p.damageBoost) * (1 + (p.skills.gunDamage ?? 0) * SKILL_DEFS.gunDamage.perTier);
  }

  switchWeapon(playerId: string, slot: number): void {
    const p = this.players.get(playerId);
    if (!p || !p.alive) return;
    if (slot < 0 || slot >= p.inventory.length) return;
    this.equipSlot(p, slot);
  }

  // Drop the currently-wielded slot as a pickup near the player. Fists are
  // not droppable. Bandages drop as a single bandage pickup carrying all the
  // remaining doses; weapons drop with a full mag (mirrors the death-drop).
  dropCurrent(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p || !p.alive) return;
    if (p.currentWeapon === 'fists') return;

    const slotIdx = p.inventory.findIndex(s => s.type === p.currentWeapon);
    if (slotIdx < 0) return;
    const slot = p.inventory[slotIdx];

    // Drop outside the player's pickup-collect radius so we don't immediately
    // re-collect it on the next tick.
    const dropAngle = Math.random() * Math.PI * 2;
    const dropDist = 70;
    const dropX = p.x + Math.cos(dropAngle) * dropDist;
    const dropY = p.y + Math.sin(dropAngle) * dropDist;

    if (p.currentWeapon === 'bandage') {
      const doses = Math.max(0, slot.ammo);
      if (doses > 0) {
        this.spawnPickup({
          id: this.nextPickupId++,
          type: 'bandage',
          x: dropX,
          y: dropY,
          bandageHeal: doses * BANDAGE_HEAL_AMOUNT,
        });
      }
    } else {
      const wDef = WEAPON_DEFS[p.currentWeapon];
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'weapon',
        x: dropX,
        y: dropY,
        weaponType: p.currentWeapon,
        weaponAmmo: wDef.maxAmmo,
      });
    }

    p.inventory.splice(slotIdx, 1);
    this.equipFists(p);
  }

  // ── Main tick ────────────────────────────────────────────

  tick(): GameState {
    this.time += DT;

    this.runBotAI();
    this.processInputs();
    this.processMovement();
    this.processFiring();
    this.processProjectiles();
    this.processNPCAI();
    this.processNPCSpawning();
    this.processBoxSpawning();
    this.processCollisions();
    this.processPickups();
    this.processShopProximity();
    this.processControlZones();
    this.processTimers();
    this.decayHitFlashes();

    return this.getState();
  }

  // ── Bot AI ───────────────────────────────────────────────

  private runBotAI(): void {
    for (const [botId, bot] of this.bots) {
      const p = this.players.get(botId);
      if (!p || !p.alive) {
        // Clear any stale input
        this.inputs.set(botId, { up: false, down: false, left: false, right: false, fire: false, angle: 0, interact: false, block: false });
        continue;
      }

      // Find nearest visible enemy (player or NPC)
      let bestTarget: { x: number; y: number; id: string; isNPC: boolean } | null = null;
      let bestDist = Infinity;

      for (const [pid, other] of this.players) {
        if (pid === botId || !other.alive) continue;
        const d = dist(p, other);
        if (d > 700) continue;
        if (!lineOfSight(p, other, this.map.walls)) continue;
        if (d < bestDist) {
          bestDist = d;
          bestTarget = { x: other.x, y: other.y, id: pid, isNPC: false };
        }
      }
      for (const [, npc] of this.npcs) {
        if (!npc.alive) continue;
        const d = dist(p, npc);
        if (d > 600) continue;
        if (!lineOfSight(p, npc, this.map.walls)) continue;
        if (d < bestDist) {
          bestDist = d;
          bestTarget = { x: npc.x, y: npc.y, id: `npc-${npc.id}`, isNPC: true };
        }
      }

      let dx = 0, dy = 0, fire = false;
      let angle = p.angle;

      if (bestTarget) {
        // Aim at target (with error)
        const aimAngle = Math.atan2(bestTarget.y - p.y, bestTarget.x - p.x);
        const errorOsc = Math.sin(this.time * 4 + (parseInt(botId.split('-')[1] || '0', 10) % 7)) * bot.aimError;
        angle = aimAngle + errorOsc;

        // Bots never carry bandages — but guard the lookup just in case.
        const wDef = p.currentWeapon !== 'bandage'
          ? WEAPON_DEFS[p.currentWeapon]
          : WEAPON_DEFS.fists;
        const idealRange = wDef.melee ? 30 : Math.min(wDef.range * 0.55, 350);

        // Approach or retreat to ideal range
        const moveDir = bestDist > idealRange ? 1 : -1;
        dx = Math.cos(aimAngle) * moveDir;
        dy = Math.sin(aimAngle) * moveDir;
        // Strafe a bit so they aren't standing still
        const strafe = Math.sin(this.time * 1.6 + bot.wanderTimer) * 0.6;
        dx += -Math.sin(aimAngle) * strafe;
        dy += Math.cos(aimAngle) * strafe;

        // Fire when roughly aimed at a target in range
        const inRange = bestDist < (wDef.melee ? wDef.range + 25 : wDef.range);
        if (inRange) fire = true;
      } else {
        // Wander
        bot.wanderTimer -= DT;
        if (bot.wanderTimer <= 0) {
          const a = Math.random() * Math.PI * 2;
          bot.wanderDir = { x: Math.cos(a), y: Math.sin(a) };
          bot.wanderTimer = 2 + Math.random() * 3;
        }
        dx = bot.wanderDir.x;
        dy = bot.wanderDir.y;
        if (dx !== 0 || dy !== 0) angle = Math.atan2(dy, dx);
      }

      // Reduce aggression by ignoring fire some fraction of frames
      if (fire && Math.random() > bot.aggression) fire = false;

      this.inputs.set(botId, {
        up: dy < -0.1,
        down: dy > 0.1,
        left: dx < -0.1,
        right: dx > 0.1,
        fire,
        angle,
        interact: false,
        block: false,
      });
    }
  }

  // ── Phase: Inputs → Movement ─────────────────────────────

  private processInputs(): void {
    for (const [id, input] of this.inputs) {
      const p = this.players.get(id);
      if (!p || !p.alive) continue;
      p.angle = input.angle;
      // Blocking is only valid with a melee weapon (and not while wielding bandages).
      const wDef = p.currentWeapon !== 'bandage' ? WEAPON_DEFS[p.currentWeapon] : null;
      p.blocking = !!input.block && !!wDef && wDef.melee;
    }
  }

  private processMovement(): void {
    for (const [id, input] of this.inputs) {
      const p = this.players.get(id);
      if (!p || !p.alive) continue;

      let dx = 0;
      let dy = 0;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
      if (input.left) dx -= 1;
      if (input.right) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const dir = normalize({ x: dx, y: dy });
        let speed = p.speed;
        if (p.speedBoostTimer > 0) speed *= SPEED_BOOST_MULTIPLIER;
        if (p.blocking) speed *= BLOCK_SPEED_MULTIPLIER;

        p.x += dir.x * speed * DT;
        p.y += dir.y * speed * DT;
      }

      p.x = Math.max(PLAYER_RADIUS + 20, Math.min(this.map.width - PLAYER_RADIUS - 20, p.x));
      p.y = Math.max(PLAYER_RADIUS + 20, Math.min(this.map.height - PLAYER_RADIUS - 20, p.y));

      this.resolveWallCollision(p, PLAYER_RADIUS);
    }
  }

  private resolveWallCollision(entity: { x: number; y: number }, radius: number): void {
    for (const w of this.map.walls) {
      if (circleRectCollision(entity.x, entity.y, radius, w.x, w.y, w.w, w.h)) {
        const pushed = pushCircleOutOfRect(entity.x, entity.y, radius, w.x, w.y, w.w, w.h);
        entity.x = pushed.x;
        entity.y = pushed.y;
      }
    }
  }

  // ── Phase: Firing ────────────────────────────────────────

  private processFiring(): void {
    for (const [id, input] of this.inputs) {
      if (!input.fire) continue;
      const p = this.players.get(id);
      if (!p || !p.alive) continue;
      // Can't attack while actively blocking — the right-click stance wins.
      if (p.blocking) continue;

      const cooldown = this.fireCooldowns.get(id) ?? 0;
      if (cooldown > 0) continue;

      // ── Bandage use (special slot) ──────────────────────
      if (p.currentWeapon === 'bandage') {
        if (p.bandageCooldown > 0) continue;
        if (p.currentAmmo <= 0) continue;
        if (p.hp >= p.maxHp) {
          // Don't waste a bandage — fail silently with a short cooldown so the
          // click doesn't spam every frame.
          this.fireCooldowns.set(id, 0.3);
          continue;
        }
        p.hp = Math.min(p.hp + BANDAGE_HEAL_AMOUNT, p.maxHp);
        p.currentAmmo--;
        p.bandageCooldown = BANDAGE_USE_COOLDOWN;
        const slotIdx = p.inventory.findIndex(s => s.type === 'bandage');
        if (slotIdx >= 0) {
          p.inventory[slotIdx].ammo = p.currentAmmo;
          // If we just used the last bandage, drop the slot and switch to fists.
          if (p.currentAmmo <= 0) {
            p.inventory.splice(slotIdx, 1);
            this.equipFists(p);
          }
        }
        this.fireCooldowns.set(id, BANDAGE_USE_COOLDOWN);
        continue;
      }

      const wDef = WEAPON_DEFS[p.currentWeapon];
      if (!wDef) continue;

      // Ranged: ammo gate. Melee: durability gate (-1 = infinite/fists).
      if (wDef.melee) {
        if (p.currentDurability === 0) continue;
      } else {
        if (p.currentAmmo === 0) continue;
      }

      this.fireCooldowns.set(id, 1 / wDef.fireRate);

      // Spend ammo or durability on the swing.
      if (wDef.melee) {
        const cost = wDef.meleeAttackCost ?? 0;
        if (cost > 0 && p.currentDurability > 0) {
          p.currentDurability = Math.max(0, p.currentDurability - cost);
          const slotIdx = p.inventory.findIndex(s => s.type === p.currentWeapon);
          if (slotIdx >= 0) p.inventory[slotIdx].durability = p.currentDurability;
        }
      } else if (p.currentAmmo > 0) {
        p.currentAmmo--;
        const slot = p.inventory.findIndex(s => s.type === p.currentWeapon);
        if (slot >= 0) p.inventory[slot].ammo = p.currentAmmo;
      }

      // Notify renderer (muzzle flash + recoil) via event
      this.emitCallback('weaponFired', null, { playerId: id, weapon: p.currentWeapon, x: p.x, y: p.y, angle: p.angle });

      if (wDef.melee) {
        this.doMeleeAttack(p, wDef);
        // Break the weapon if this swing hit 0 durability.
        if (p.currentDurability === 0 && (wDef.meleeHp ?? -1) > 0) {
          this.breakCurrentWeapon(p);
        }
      } else {
        this.doRangedAttack(p, wDef);
      }
    }

    for (const [id, cd] of this.fireCooldowns) {
      if (cd > 0) this.fireCooldowns.set(id, Math.max(0, cd - DT));
    }
  }

  // Remove the currently-wielded melee weapon (durability hit 0) and fall
  // back to fists.
  private breakCurrentWeapon(p: PlayerState): void {
    if (p.currentWeapon === 'fists' || p.currentWeapon === 'bandage') return;
    const slotIdx = p.inventory.findIndex(s => s.type === p.currentWeapon);
    if (slotIdx >= 0) p.inventory.splice(slotIdx, 1);
    this.equipFists(p);
  }

  // Switch the player to their fists slot, ensuring it exists.
  private equipFists(p: PlayerState): void {
    let fistIdx = p.inventory.findIndex(s => s.type === 'fists');
    if (fistIdx < 0) {
      p.inventory.unshift({ type: 'fists', ammo: -1, durability: -1 });
      fistIdx = 0;
    }
    p.currentWeapon = 'fists';
    p.currentAmmo = -1;
    p.currentDurability = -1;
  }

  private doMeleeAttack(attacker: PlayerState, wDef: WeaponDef): void {
    const ax = attacker.x + Math.cos(attacker.angle) * (PLAYER_RADIUS + 5);
    const ay = attacker.y + Math.sin(attacker.angle) * (PLAYER_RADIUS + 5);
    const meleeArc = Math.PI / 2;

    const dmg = wDef.damage * this.meleeDamageMultiplier(attacker);

    for (const [pid, target] of this.players) {
      if (pid === attacker.id || !target.alive) continue;
      const d = dist({ x: ax, y: ay }, { x: target.x, y: target.y });
      if (d > wDef.range + PLAYER_RADIUS) continue;

      const angleToTarget = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      let angleDiff = angleToTarget - attacker.angle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      if (Math.abs(angleDiff) > meleeArc / 2) continue;

      this.damagePlayer(target, dmg, attacker.id, attacker.name, wDef.type);
      if (wDef.knockback) {
        const dir = normalize({ x: target.x - attacker.x, y: target.y - attacker.y });
        target.x += dir.x * wDef.knockback;
        target.y += dir.y * wDef.knockback;
      }
    }

    for (const [, npc] of this.npcs) {
      if (!npc.alive) continue;
      const d = dist({ x: ax, y: ay }, { x: npc.x, y: npc.y });
      if (d > wDef.range + NPC_RADIUS) continue;

      const angleToTarget = Math.atan2(npc.y - attacker.y, npc.x - attacker.x);
      let angleDiff = angleToTarget - attacker.angle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      if (Math.abs(angleDiff) > meleeArc / 2) continue;

      this.damageNPC(npc, dmg, attacker);
      if (wDef.knockback) {
        const dir = normalize({ x: npc.x - attacker.x, y: npc.y - attacker.y });
        npc.x += dir.x * wDef.knockback;
        npc.y += dir.y * wDef.knockback;
      }
    }
  }

  private doRangedAttack(attacker: PlayerState, wDef: WeaponDef): void {
    const pellets = wDef.pellets ?? 1;
    const baseAngle = attacker.angle;

    for (let i = 0; i < pellets; i++) {
      let angle = baseAngle;
      if (wDef.spread) angle += (Math.random() - 0.5) * wDef.spread;

      const speed = wDef.projectileSpeed ?? 500;
      const proj: Projectile = {
        id: this.nextProjectileId++,
        ownerId: attacker.id,
        ownerIsNPC: false,
        x: attacker.x + Math.cos(angle) * (PLAYER_RADIUS + 5),
        y: attacker.y + Math.sin(angle) * (PLAYER_RADIUS + 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: wDef.damage * this.gunDamageMultiplier(attacker),
        maxRange: wDef.range,
        distTraveled: 0,
        weapon: wDef.type,
        explosionRadius: wDef.explosionRadius,
      };
      this.projectiles.set(proj.id, proj);
    }
  }

  // AoE blast from an explosive projectile. Damages players + NPCs within
  // radius, with linear falloff. The owner does NOT damage themselves
  // (kindness — rocket suicide is rough at this leveling pace).
  private explodeAt(x: number, y: number, ownerId: string, baseDamage: number, radius: number, weapon: WeaponType): void {
    const center: Vec2 = { x, y };
    const attacker = this.players.get(ownerId);

    for (const [pid, target] of this.players) {
      if (pid === ownerId || !target.alive) continue;
      const d = dist(center, target);
      if (d > radius + PLAYER_RADIUS) continue;
      const falloff = Math.max(0.3, 1 - d / radius);
      const dmg = baseDamage * falloff;
      this.damagePlayer(target, dmg, ownerId, attacker?.name ?? '???', weapon);
      // Knock away from blast center
      const dir = normalize({ x: target.x - x, y: target.y - y });
      target.x += dir.x * 8;
      target.y += dir.y * 8;
    }

    for (const [, npc] of this.npcs) {
      if (!npc.alive) continue;
      const d = dist(center, npc);
      if (d > radius + NPC_RADIUS) continue;
      const falloff = Math.max(0.3, 1 - d / radius);
      const dmg = baseDamage * falloff;
      if (attacker) this.damageNPC(npc, dmg, attacker);
      const dir = normalize({ x: npc.x - x, y: npc.y - y });
      npc.x += dir.x * 8;
      npc.y += dir.y * 8;
    }

    this.emitCallback('explosion', null, { x, y, radius });
  }

  // ── Phase: Projectiles ───────────────────────────────────

  private processProjectiles(): void {
    const toRemove: number[] = [];

    for (const [id, proj] of this.projectiles) {
      const moveX = proj.vx * DT;
      const moveY = proj.vy * DT;
      proj.x += moveX;
      proj.y += moveY;
      proj.distTraveled += Math.sqrt(moveX * moveX + moveY * moveY);

      if (proj.distTraveled >= proj.maxRange) {
        toRemove.push(id);
        continue;
      }
      if (proj.x < 0 || proj.x > this.map.width || proj.y < 0 || proj.y > this.map.height) {
        toRemove.push(id);
        continue;
      }

      let hitWall = false;
      for (const w of this.map.walls) {
        if (pointInRect(proj.x, proj.y, w.x, w.y, w.w, w.h)) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        if (proj.explosionRadius && proj.explosionRadius > 0) {
          this.explodeAt(proj.x, proj.y, proj.ownerId, proj.damage, proj.explosionRadius, proj.weapon ?? 'rocket_launcher');
        } else {
          this.emitCallback('projectileHitWall', null, { x: proj.x, y: proj.y, angle: Math.atan2(proj.vy, proj.vx) });
        }
        toRemove.push(id);
      }
    }

    for (const id of toRemove) this.projectiles.delete(id);
  }

  // ── Phase: Collisions ────────────────────────────────────

  private processCollisions(): void {
    const projToRemove: number[] = [];

    for (const [projId, proj] of this.projectiles) {
      let hit = false;
      const projWeapon: WeaponType = proj.weapon ?? 'pistol';

      if (!proj.ownerIsNPC) {
        for (const [pid, target] of this.players) {
          if (pid === proj.ownerId || !target.alive) continue;
          if (dist(proj, target) < PROJECTILE_RADIUS + PLAYER_RADIUS) {
            const attacker = this.players.get(proj.ownerId);
            if (proj.explosionRadius && proj.explosionRadius > 0) {
              this.explodeAt(proj.x, proj.y, proj.ownerId, proj.damage, proj.explosionRadius, projWeapon);
            } else {
              this.damagePlayer(target, proj.damage, proj.ownerId, attacker?.name ?? '???', projWeapon);
              const dir = normalize({ x: proj.vx, y: proj.vy });
              target.x += dir.x * 3;
              target.y += dir.y * 3;
            }
            hit = true;
            break;
          }
        }

        if (!hit) {
          for (const [, npc] of this.npcs) {
            if (!npc.alive) continue;
            if (dist(proj, npc) < PROJECTILE_RADIUS + NPC_RADIUS) {
              const attacker = this.players.get(proj.ownerId);
              if (proj.explosionRadius && proj.explosionRadius > 0) {
                this.explodeAt(proj.x, proj.y, proj.ownerId, proj.damage, proj.explosionRadius, projWeapon);
              } else if (attacker) {
                this.damageNPC(npc, proj.damage, attacker);
                const dir = normalize({ x: proj.vx, y: proj.vy });
                npc.x += dir.x * 3;
                npc.y += dir.y * 3;
              }
              hit = true;
              break;
            }
          }
        }
      } else {
        for (const [, target] of this.players) {
          if (!target.alive) continue;
          if (dist(proj, target) < PROJECTILE_RADIUS + PLAYER_RADIUS) {
            this.damagePlayer(target, proj.damage, proj.ownerId, 'NPC', projWeapon);
            const dir = normalize({ x: proj.vx, y: proj.vy });
            target.x += dir.x * 3;
            target.y += dir.y * 3;
            hit = true;
            break;
          }
        }
      }

      if (hit) projToRemove.push(projId);
    }

    for (const id of projToRemove) this.projectiles.delete(id);
  }

  private decayHitFlashes(): void {
    for (const [k, v] of this.hitFlashes) {
      const next = v - DT * 3;
      if (next <= 0) this.hitFlashes.delete(k);
      else this.hitFlashes.set(k, next);
    }
  }

  // ── Damage helpers ───────────────────────────────────────

  private damagePlayer(target: PlayerState, rawDamage: number, attackerId: string, attackerName: string, weapon: WeaponType): void {
    const incomingMelee = !!WEAPON_DEFS[weapon]?.melee;
    let dmg = rawDamage;

    // 1. Block: target is right-click blocking with a melee weapon.
    if (target.blocking && target.currentWeapon !== 'bandage') {
      const wDef = WEAPON_DEFS[target.currentWeapon];
      if (wDef?.melee) {
        const blockEff = wDef.blockEfficiency ?? 0;
        const absorbed = dmg * blockEff;
        dmg -= absorbed;
        // Durability cost: -1 (fists) means infinite — ignore.
        if (target.currentDurability > 0) {
          target.currentDurability = Math.max(0, target.currentDurability - absorbed);
          const slotIdx = target.inventory.findIndex(s => s.type === target.currentWeapon);
          if (slotIdx >= 0) target.inventory[slotIdx].durability = target.currentDurability;
          if (target.currentDurability === 0 && (wDef.meleeHp ?? -1) > 0) {
            this.breakCurrentWeapon(target);
          }
        }
      }
    }

    // 2. Passive armor stat + resilience skill
    const resilience = (target.skills.resilience ?? 0) * SKILL_DEFS.resilience.perTier;
    dmg = dmg * (1 - target.armor) * (1 - resilience);

    // 3. Equipped armor piece — absorbs portion of matching-type damage.
    if (target.equippedArmor && target.equippedArmor.hp > 0) {
      const armor = target.equippedArmor;
      const def = ARMOR_PIECES[armor.type];
      const protects =
        armor.type === 'universal' ||
        (armor.type === 'close' && incomingMelee) ||
        (armor.type === 'long' && !incomingMelee);
      if (protects) {
        const absorbed = Math.min(dmg * def.absorbRatio, armor.hp);
        dmg -= absorbed;
        armor.hp -= absorbed;
        if (armor.hp <= 0) target.equippedArmor = null;
      }
    }

    const dmgAfterMitigation = dmg;

    if (target.shield > 0) {
      if (target.shield >= dmg) {
        target.shield -= dmg;
        this.emitCallback('damageDealt', null, { id: target.id, x: target.x, y: target.y, dmg: Math.round(dmg), shield: true });
        this.awardDamageXP(attackerId, target.id, dmgAfterMitigation);
        return;
      }
      dmg -= target.shield;
      target.shield = 0;
    }

    target.hp -= dmg;
    this.hitFlashes.set(target.id, 1);
    this.emitCallback('damageDealt', null, { id: target.id, x: target.x, y: target.y, dmg: Math.round(dmg), shield: false });

    // Tell the attacker they hit something (for hit marker)
    this.emitCallback('hitConfirmed', attackerId, {});

    this.awardDamageXP(attackerId, target.id, dmgAfterMitigation);

    if (target.hp <= 0) this.killPlayer(target, attackerId, attackerName, weapon);
  }

  // Grant XP to the attacker for any damage they deal (shield or HP).
  // Skips self-damage and NPC attackers.
  private awardDamageXP(attackerId: string, victimId: string, dmg: number): void {
    if (attackerId === victimId) return;
    const attacker = this.players.get(attackerId);
    if (!attacker) return; // NPC attackers have ids like "npc-3"
    if (dmg <= 0) return;
    this.giveXP(attacker, dmg * XP_PER_DAMAGE);
  }

  private killPlayer(victim: PlayerState, killerId: string, killerName: string, weapon: WeaponType): void {
    victim.alive = false;
    victim.hp = 0;
    victim.respawnTimer = RESPAWN_TIME;
    victim.deaths++;

    // Drop the victim's weapon with a full magazine — the kill is the reward,
    // not whatever ammo the victim had left when they died. Fists and bandages
    // aren't dropped (fists are universal; bandages would feel cheap).
    if (victim.currentWeapon !== 'fists' && victim.currentWeapon !== 'bandage') {
      const dropDef = WEAPON_DEFS[victim.currentWeapon];
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'weapon',
        x: victim.x + randomInRange(-20, 20),
        y: victim.y + randomInRange(-20, 20),
        weaponType: victim.currentWeapon,
        weaponAmmo: dropDef.maxAmmo,
      });
    }

    const droppedCoins = Math.floor(victim.coins * COIN_LOSS_ON_DEATH);
    if (droppedCoins > 0) {
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'coins',
        x: victim.x + randomInRange(-20, 20),
        y: victim.y + randomInRange(-20, 20),
        coinAmount: droppedCoins,
      });
    }

    victim.coins -= droppedCoins;
    victim.upgrades = { maxHp: 0, speed: 0, armor: 0, damage: 0, regen: 0 };
    victim.shield = 0;
    victim.shieldTimer = 0;
    victim.speedBoostTimer = 0;
    victim.equippedArmor = null;
    victim.blocking = false;
    victim.bandageCooldown = 0;

    const killer = this.players.get(killerId);
    if (killer && killer.id !== victim.id) {
      killer.kills++;
      this.giveXP(killer, PLAYER_KILL_XP);
    }

    // Lives system (lastStanding mode). -1 means infinite respawns.
    if (victim.livesRemaining > 0) {
      victim.livesRemaining--;
      if (victim.livesRemaining === 0) {
        victim.eliminated = true;
        // No respawn — sit out the rest of the match.
        victim.respawnTimer = -1;
      }
    }

    this.emitCallback('playerKilled', null, {
      killerId, killerName,
      victimId: victim.id, victimName: victim.name,
      weapon,
    });

    this.checkWinCondition();
  }

  // ── Win conditions ───────────────────────────────────────
  // Called from kill / coin events. Once a winner is determined we emit
  // gameOver with sorted standings and freeze further win checks.
  private checkWinCondition(): void {
    if (this.gameEnded) return;

    let winnerId: string | null = null;

    if (this.modeCfg.mode === 'massacre' && this.modeCfg.killTarget > 0) {
      for (const [, p] of this.players) {
        if (p.kills >= this.modeCfg.killTarget) { winnerId = p.id; break; }
      }
    } else if (this.modeCfg.mode === 'lootLord' && this.modeCfg.coinTarget > 0) {
      for (const [, p] of this.players) {
        if (p.lifetimeCoins >= this.modeCfg.coinTarget) { winnerId = p.id; break; }
      }
    } else if (this.modeCfg.mode === 'domination' && this.modeCfg.pointTarget > 0) {
      for (const [, p] of this.players) {
        if (p.modeScore >= this.modeCfg.pointTarget) { winnerId = p.id; break; }
      }
    } else if (this.modeCfg.mode === 'lastStanding') {
      // Need at least 2 starters before "last alive" makes sense.
      if (this.players.size > 1) {
        const remaining = [...this.players.values()].filter(p => !p.eliminated);
        if (remaining.length === 1) winnerId = remaining[0].id;
        else if (remaining.length === 0) winnerId = null; // tie / nobody
      }
    }

    if (winnerId !== null || (this.modeCfg.mode === 'lastStanding' && this.players.size > 1 &&
        [...this.players.values()].filter(p => !p.eliminated).length === 0)) {
      this.endGame();
    }
  }

  private endGame(): void {
    if (this.gameEnded) return;
    this.gameEnded = true;
    // Sort by mode-relevant metric first, then a stable tiebreaker.
    const sorted = [...this.players.values()].sort((a, b) => {
      if (this.modeCfg.mode === 'massacre') return b.kills - a.kills || a.deaths - b.deaths;
      if (this.modeCfg.mode === 'lootLord') return b.lifetimeCoins - a.lifetimeCoins || b.kills - a.kills;
      if (this.modeCfg.mode === 'domination') return b.modeScore - a.modeScore || b.kills - a.kills;
      // lastStanding — alive first, then by kills.
      const aliveDelta = (a.eliminated ? 0 : 1) - (b.eliminated ? 0 : 1);
      if (aliveDelta !== 0) return -aliveDelta;
      return b.kills - a.kills;
    });
    this.emitCallback('gameOver', null, {
      scores: sorted.map(p => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths })),
    });
  }

  getModeConfig(): GameModeConfig {
    return this.modeCfg;
  }

  isGameEnded(): boolean {
    return this.gameEnded;
  }

  private respawnPlayer(p: PlayerState): void {
    const spawn = this.randomSpawnPoint();
    const pistolDef = WEAPON_DEFS['pistol'];
    p.alive = true;
    p.x = spawn.x;
    p.y = spawn.y;
    p.hp = BASE_PLAYER_HP + (p.level - 1) * HP_PER_LEVEL;
    p.maxHp = p.hp;
    // Spawn protection
    p.shield = 25;
    p.shieldTimer = 2.5;
    p.armor = 0;
    p.damageBoost = 0;
    p.regen = 0;
    p.speed = BASE_PLAYER_SPEED;
    p.currentWeapon = 'pistol';
    p.currentAmmo = pistolDef.maxAmmo;
    p.currentDurability = -1;
    p.inventory = [
      { type: 'fists', ammo: -1, durability: -1 },
      { type: 'pistol', ammo: pistolDef.maxAmmo },
    ];
    p.respawnTimer = 0;
    p.equippedArmor = null;
    p.blocking = false;
    p.bandageCooldown = 0;

    // Bots respawn with their preferred starting weapon so they remain interesting opponents.
    const bot = this.bots.get(p.id);
    if (bot) {
      const def = WEAPON_DEFS[bot.preferredWeapon];
      // Replace pistol slot with bot's preferred weapon (or add)
      const pIdx = p.inventory.findIndex(s => s.type === 'pistol');
      const slotForBot: InventorySlot = def.melee
        ? { type: bot.preferredWeapon, ammo: -1, durability: def.meleeHp ?? -1 }
        : { type: bot.preferredWeapon, ammo: def.maxAmmo };
      if (pIdx >= 0 && bot.preferredWeapon !== 'pistol') {
        p.inventory[pIdx] = slotForBot;
      } else if (bot.preferredWeapon !== 'pistol') {
        p.inventory.push(slotForBot);
      }
      p.currentWeapon = bot.preferredWeapon;
      p.currentAmmo = def.melee ? -1 : def.maxAmmo;
      p.currentDurability = def.melee ? (def.meleeHp ?? -1) : -1;
    }

    this.emitCallback('playerRespawned', null, { id: p.id, x: p.x, y: p.y });
  }

  // Add a weapon to the player's inventory. If they already own it, refill
  // ammo (ranged) or restore full durability (melee). Returns false if no
  // free slot was available (and we couldn't replace the held weapon).
  private giveWeapon(p: PlayerState, weapon: WeaponType): boolean {
    const wDef = WEAPON_DEFS[weapon];

    // Already owned? Refill.
    const dupIdx = p.inventory.findIndex(s => s.type === weapon);
    if (dupIdx >= 0) {
      if (wDef.melee) {
        const fullHp = wDef.meleeHp ?? -1;
        p.inventory[dupIdx].durability = fullHp;
        if (p.currentWeapon === weapon) p.currentDurability = fullHp;
      } else {
        const newAmmo = (p.currentWeapon === weapon ? p.currentAmmo : p.inventory[dupIdx].ammo) + wDef.maxAmmo;
        p.inventory[dupIdx].ammo = newAmmo;
        if (p.currentWeapon === weapon) p.currentAmmo = newAmmo;
      }
      return true;
    }

    // New slot
    const cap = MAX_INVENTORY_SLOTS;
    const newSlot: InventorySlot = wDef.melee
      ? { type: weapon, ammo: -1, durability: wDef.meleeHp ?? -1 }
      : { type: weapon, ammo: wDef.maxAmmo };

    if (p.inventory.length < cap) {
      p.inventory.push(newSlot);
      this.equipSlot(p, p.inventory.length - 1);
      return true;
    }
    // Inventory full — purchase fails, ask the player to drop something.
    return false;
  }

  // Equip a slot index, syncing currentWeapon / currentAmmo / currentDurability.
  private equipSlot(p: PlayerState, slotIdx: number): void {
    if (slotIdx < 0 || slotIdx >= p.inventory.length) return;
    // Persist the previous slot's state from the live counters.
    const oldIdx = p.inventory.findIndex(s => s.type === p.currentWeapon);
    if (oldIdx >= 0) {
      p.inventory[oldIdx].ammo = p.currentAmmo;
      if (p.inventory[oldIdx].durability !== undefined) {
        p.inventory[oldIdx].durability = p.currentDurability;
      }
    }
    const slot = p.inventory[slotIdx];
    p.currentWeapon = slot.type;
    p.currentAmmo = slot.ammo;
    p.currentDurability = slot.durability ?? -1;
  }

  private damageNPC(npc: InternalNPC, rawDamage: number, attacker: PlayerState): void {
    // Cap awarded damage at remaining hp so killing a low-hp enemy with a
    // huge rocket doesn't gift inflated XP.
    const dmgForXP = Math.min(rawDamage, Math.max(0, npc.hp));
    npc.hp -= rawDamage;
    npc.targetId = attacker.id;
    npc.hitFlash = 1;
    this.emitCallback('damageDealt', null, { id: `npc-${npc.id}`, x: npc.x, y: npc.y, dmg: Math.round(rawDamage), shield: false });
    this.emitCallback('hitConfirmed', attacker.id, {});

    if (dmgForXP > 0) this.giveXP(attacker, dmgForXP * XP_PER_DAMAGE);

    if (npc.hp <= 0) this.killNPC(npc, attacker);
  }

  private killNPC(npc: InternalNPC, killer: PlayerState): void {
    npc.alive = false;
    const def = NPC_DEFS[npc.type];

    this.giveXP(killer, def.xp);
    const coinDrop = randomInt(def.coinDrop[0], def.coinDrop[1]);
    killer.coins += coinDrop;
    killer.lifetimeCoins += coinDrop;
    this.checkWinCondition();

    if (coinDrop > 0) {
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'coins',
        x: npc.x + randomInRange(-15, 15),
        y: npc.y + randomInRange(-15, 15),
        coinAmount: coinDrop,
      });
    }

    if (Math.random() < def.weaponDropChance) {
      const weaponType = this.npcWeaponDrop(npc.type);
      const wDef = WEAPON_DEFS[weaponType];
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'weapon',
        x: npc.x + randomInRange(-15, 15),
        y: npc.y + randomInRange(-15, 15),
        weaponType,
        weaponAmmo: wDef.maxAmmo,
      });
    }

    this.emitCallback('npcKilled', null, { x: npc.x, y: npc.y, type: npc.type });

    this.npcs.delete(npc.id);
    this.npcAttackCooldowns.delete(npc.id);
    this.npcWanderDir.delete(npc.id);
    this.npcWanderTimer.delete(npc.id);
  }

  private npcWeaponDrop(type: NPCType): WeaponType {
    const pool = NPC_WEAPON_DROPS[type];
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * total;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry.weapon;
    }
    return pool[pool.length - 1].weapon;
  }

  private giveXP(player: PlayerState, amount: number): void {
    player.xp += amount;
    while (player.level < XP_PER_LEVEL.length && player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level++;
      player.xpToNext = XP_PER_LEVEL[player.level] ?? player.xpToNext * 2;

      player.maxHp += HP_PER_LEVEL;
      player.hp = player.maxHp;
      player.skillPoints++;
      this.recalcStats(player);

      this.emitCallback('levelUp', null, { id: player.id, level: player.level });
    }
  }

  // ── NPC AI ───────────────────────────────────────────────

  private processNPCAI(): void {
    for (const [id, npc] of this.npcs) {
      if (!npc.alive) continue;
      if (npc.hitFlash > 0) npc.hitFlash = Math.max(0, npc.hitFlash - DT * 3);
      const def = NPC_DEFS[npc.type];

      let nearestPlayer: PlayerState | null = null;
      let nearestDist = Infinity;
      for (const [, p] of this.players) {
        if (!p.alive) continue;
        const d = dist(npc, p);
        if (d < nearestDist) { nearestDist = d; nearestPlayer = p; }
      }

      const inAggro = nearestPlayer && nearestDist <= def.aggroRange;

      if (inAggro && nearestPlayer) {
        npc.targetId = nearestPlayer.id;
        const dir = normalize({ x: nearestPlayer.x - npc.x, y: nearestPlayer.y - npc.y });
        npc.angle = Math.atan2(dir.y, dir.x);

        if (nearestDist > def.attackRange) {
          npc.x += dir.x * def.speed * DT;
          npc.y += dir.y * def.speed * DT;
        }

        if (nearestDist <= def.attackRange + PLAYER_RADIUS) {
          const cd = this.npcAttackCooldowns.get(id) ?? 0;
          if (cd <= 0) {
            this.npcAttack(npc, nearestPlayer, def);
            this.npcAttackCooldowns.set(id, 1 / def.attackRate);
          }
        }
      } else {
        npc.targetId = undefined;
        let wanderTimer = this.npcWanderTimer.get(id) ?? 0;
        wanderTimer -= DT;
        if (wanderTimer <= 0) {
          const angle = Math.random() * Math.PI * 2;
          this.npcWanderDir.set(id, { x: Math.cos(angle), y: Math.sin(angle) });
          this.npcWanderTimer.set(id, 2 + Math.random() * 3);
        } else {
          this.npcWanderTimer.set(id, wanderTimer);
        }

        const wDir = this.npcWanderDir.get(id);
        if (wDir) {
          npc.x += wDir.x * def.speed * 0.5 * DT;
          npc.y += wDir.y * def.speed * 0.5 * DT;
          npc.angle = Math.atan2(wDir.y, wDir.x);
        }
      }

      npc.x = Math.max(NPC_RADIUS + 20, Math.min(this.map.width - NPC_RADIUS - 20, npc.x));
      npc.y = Math.max(NPC_RADIUS + 20, Math.min(this.map.height - NPC_RADIUS - 20, npc.y));
      this.resolveWallCollision(npc, NPC_RADIUS);
    }

    for (const [id, cd] of this.npcAttackCooldowns) {
      if (cd > 0) this.npcAttackCooldowns.set(id, Math.max(0, cd - DT));
    }
  }

  private npcAttack(npc: InternalNPC, target: PlayerState, def: typeof NPC_DEFS[NPCType]): void {
    if (npc.type === 'zombie' || npc.type === 'tank_npc') {
      this.damagePlayer(target, def.damage, `npc-${npc.id}`, npc.type, 'knife');
      const dir = normalize({ x: target.x - npc.x, y: target.y - npc.y });
      target.x += dir.x * 5;
      target.y += dir.y * 5;
    } else {
      const angle = Math.atan2(target.y - npc.y, target.x - npc.x);
      const proj: Projectile = {
        id: this.nextProjectileId++,
        ownerId: `npc-${npc.id}`,
        ownerIsNPC: true,
        x: npc.x + Math.cos(angle) * (NPC_RADIUS + 5),
        y: npc.y + Math.sin(angle) * (NPC_RADIUS + 5),
        vx: Math.cos(angle) * 500,
        vy: Math.sin(angle) * 500,
        damage: def.damage,
        maxRange: def.attackRange * 1.5,
        distTraveled: 0,
      };
      this.projectiles.set(proj.id, proj);
      this.emitCallback('weaponFired', null, { playerId: `npc-${npc.id}`, weapon: 'pistol' as WeaponType, x: npc.x, y: npc.y, angle });
    }
  }

  private processNPCSpawning(): void {
    this.npcSpawnTimer -= DT;
    if (this.npcSpawnTimer > 0) return;
    this.npcSpawnTimer = NPC_RESPAWN_INTERVAL;

    if (this.npcs.size >= MAX_NPCS) return;

    const roll = Math.random();
    let type: NPCType;
    if (roll < 0.60) type = 'zombie';
    else if (roll < 0.85) type = 'ranged';
    else type = 'tank_npc';

    const def = NPC_DEFS[type];
    const zone = this.map.npcSpawnZones[Math.floor(Math.random() * this.map.npcSpawnZones.length)];

    for (let attempt = 0; attempt < 10; attempt++) {
      const x = zone.x + Math.random() * zone.w;
      const y = zone.y + Math.random() * zone.h;

      let inWall = false;
      for (const w of this.map.walls) {
        if (circleRectCollision(x, y, NPC_RADIUS, w.x, w.y, w.w, w.h)) {
          inWall = true;
          break;
        }
      }
      if (inWall) continue;

      const npc: InternalNPC = {
        id: this.nextNPCId++,
        type, x, y,
        angle: Math.random() * Math.PI * 2,
        hp: def.hp,
        maxHp: def.hp,
        alive: true,
        hitFlash: 0,
      };
      this.npcs.set(npc.id, npc);
      break;
    }
  }

  private processPickups(): void {
    const collected: number[] = [];

    for (const [pickupId, pickup] of this.pickups) {
      for (const [, p] of this.players) {
        if (!p.alive) continue;
        if (dist(p, pickup) > PICKUP_COLLECT_RADIUS + PICKUP_RADIUS) continue;

        if (pickup.type === 'coins' && pickup.coinAmount) {
          p.coins += pickup.coinAmount;
          p.lifetimeCoins += pickup.coinAmount;
          collected.push(pickupId);
          this.emitCallback('pickupCollected', null, { pickupId, playerId: p.id });
          this.checkWinCondition();
          break;
        }

        // Bandage: stack count in an existing bandage slot, else take a free slot.
        // Don't auto-switch to bandages — keep the player on whatever they were
        // wielding. They use bandages explicitly by selecting the slot + click.
        if (pickup.type === 'bandage') {
          const heal = pickup.bandageHeal ?? BANDAGE_HEAL_AMOUNT;
          const dose = Math.max(1, Math.round(heal / BANDAGE_HEAL_AMOUNT));
          const dupIdx = p.inventory.findIndex(s => s.type === 'bandage');
          if (dupIdx >= 0) {
            p.inventory[dupIdx].ammo += dose;
            if (p.currentWeapon === 'bandage') p.currentAmmo = p.inventory[dupIdx].ammo;
            collected.push(pickupId);
            this.emitCallback('pickupCollected', null, { pickupId, playerId: p.id });
            break;
          }
          if (p.inventory.length < MAX_INVENTORY_SLOTS) {
            p.inventory.push({ type: 'bandage', ammo: dose });
            collected.push(pickupId);
            this.emitCallback('pickupCollected', null, { pickupId, playerId: p.id });
            break;
          }
          // Inventory full and no existing slot — leave the bandage on the floor.
          continue;
        }

        if (pickup.type === 'weapon' && pickup.weaponType) {
          const wDef = WEAPON_DEFS[pickup.weaponType];

          // Already own this weapon? Stack ammo (no cap) or refill durability.
          const dupIdx = p.inventory.findIndex(s => s.type === pickup.weaponType);
          if (dupIdx >= 0) {
            if (wDef.melee) {
              // Melee pickup restores durability to full.
              const fullHp = wDef.meleeHp ?? -1;
              p.inventory[dupIdx].durability = fullHp;
              if (p.currentWeapon === pickup.weaponType) p.currentDurability = fullHp;
            } else {
              const stacked = (p.currentWeapon === pickup.weaponType ? p.currentAmmo : p.inventory[dupIdx].ammo) + (pickup.weaponAmmo ?? wDef.maxAmmo);
              p.inventory[dupIdx].ammo = stacked;
              if (p.currentWeapon === pickup.weaponType) p.currentAmmo = stacked;
            }
            collected.push(pickupId);
            this.emitCallback('pickupCollected', null, { pickupId, playerId: p.id });
            break;
          }

          // New weapon — take an empty slot or replace the held one.
          const newSlot: InventorySlot = wDef.melee
            ? { type: pickup.weaponType, ammo: -1, durability: wDef.meleeHp ?? -1 }
            : { type: pickup.weaponType, ammo: pickup.weaponAmmo ?? wDef.maxAmmo };

          if (p.inventory.length < MAX_INVENTORY_SLOTS) {
            // Persist current weapon state before pushing the new slot.
            const curIdx = p.inventory.findIndex(s => s.type === p.currentWeapon);
            if (curIdx >= 0) {
              p.inventory[curIdx].ammo = p.currentAmmo;
              if (p.inventory[curIdx].durability !== undefined) {
                p.inventory[curIdx].durability = p.currentDurability;
              }
            }
            p.inventory.push(newSlot);
            this.equipSlot(p, p.inventory.length - 1);
          } else {
            const currentSlotIdx = p.inventory.findIndex(s => s.type === p.currentWeapon);
            if (currentSlotIdx >= 0) {
              const oldSlot = p.inventory[currentSlotIdx];
              if (oldSlot.type !== 'fists' && oldSlot.type !== 'bandage') {
                // Drop the swapped weapon outside this player's pickup radius
                // to avoid re-collecting it on the same tick.
                const dropAngle = Math.random() * Math.PI * 2;
                const dropDist = 70;
                this.spawnPickup({
                  id: this.nextPickupId++,
                  type: 'weapon',
                  x: p.x + Math.cos(dropAngle) * dropDist,
                  y: p.y + Math.sin(dropAngle) * dropDist,
                  weaponType: oldSlot.type,
                  weaponAmmo: oldSlot.ammo,
                });
              }
              p.inventory[currentSlotIdx] = newSlot;
              p.currentWeapon = newSlot.type;
              p.currentAmmo = newSlot.ammo;
              p.currentDurability = newSlot.durability ?? -1;
            }
          }

          collected.push(pickupId);
          this.emitCallback('pickupCollected', null, { pickupId, playerId: p.id });
          break;
        }
      }
    }

    for (const id of collected) this.pickups.delete(id);
  }

  private spawnPickup(pickup: Pickup): void {
    this.pickups.set(pickup.id, pickup);
  }

  // ── Phase: Loot box spawning ─────────────────────────────
  // Drops a random item from BOX_LOOT_TABLE at a random valid map location
  // every BOX_SPAWN_INTERVAL seconds, capped at MAX_PICKUP_BOXES boxes.
  private processBoxSpawning(): void {
    this.boxSpawnTimer -= DT;
    if (this.boxSpawnTimer > 0) return;
    this.boxSpawnTimer = BOX_SPAWN_INTERVAL;

    // Count current live boxes (weapon + bandage pickups). Coins don't count.
    let boxes = 0;
    for (const [, pk] of this.pickups) {
      if (pk.type === 'weapon' || pk.type === 'bandage') boxes++;
    }
    if (boxes >= MAX_PICKUP_BOXES) return;

    const entry = this.rollBoxLoot();
    if (!entry) return;

    const spot = this.findFreeSpawnSpot();
    if (!spot) return;

    if (entry.kind === 'bandage') {
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'bandage',
        x: spot.x,
        y: spot.y,
        bandageHeal: BANDAGE_HEAL_AMOUNT,
      });
    } else if (entry.kind === 'weapon' && entry.weapon) {
      const wDef = WEAPON_DEFS[entry.weapon];
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'weapon',
        x: spot.x,
        y: spot.y,
        weaponType: entry.weapon,
        weaponAmmo: wDef.maxAmmo,
      });
    }
  }

  private rollBoxLoot() {
    const total = BOX_LOOT_TABLE.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * total;
    for (const entry of BOX_LOOT_TABLE) {
      roll -= entry.weight;
      if (roll <= 0) return entry;
    }
    return BOX_LOOT_TABLE[BOX_LOOT_TABLE.length - 1];
  }

  // Pick a random map point not inside a wall and not on top of a player.
  private findFreeSpawnSpot(): Vec2 | null {
    const margin = PICKUP_RADIUS + 30;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = randomInRange(margin, this.map.width - margin);
      const y = randomInRange(margin, this.map.height - margin);

      let inWall = false;
      for (const w of this.map.walls) {
        if (circleRectCollision(x, y, PICKUP_RADIUS + 4, w.x, w.y, w.w, w.h)) {
          inWall = true;
          break;
        }
      }
      if (inWall) continue;

      let onPlayer = false;
      for (const [, p] of this.players) {
        if (!p.alive) continue;
        if (dist({ x, y }, p) < PLAYER_RADIUS + PICKUP_RADIUS + 10) {
          onPlayer = true;
          break;
        }
      }
      if (onPlayer) continue;

      return { x, y };
    }
    return null;
  }

  // ── Phase: Control zones (domination mode) ───────────────
  //
  // 1. Every owned zone pays its owner ZONE_POINTS_PER_SECOND, regardless of
  //    whether the owner is currently standing in it. That's the whole point
  //    of capturing — you bank points while you go fight elsewhere.
  // 2. Per zone, count alive players inside:
  //      0 occupants → if there's a stale contender, decay their progress.
  //      1 owner inside → defending; clear any stale contender.
  //      1 non-owner inside → that player captures over ZONE_CAPTURE_TIME
  //                            seconds; on full, ownership flips.
  //      2+ inside → contested; no capture progress (held zones still pay).
  private processControlZones(): void {
    if (this.modeCfg.mode !== 'domination') return;

    // Step 1: pay point dividends to every zone's owner. Eliminated/dead
    // owners don't earn (so you can't bank points from the grave).
    for (const [, state] of this.zoneStates) {
      if (state.ownerId === null) continue;
      const owner = this.players.get(state.ownerId);
      if (!owner || !owner.alive || owner.eliminated) continue;
      owner.modeScore += ZONE_POINTS_PER_SECOND * DT;
    }
    this.checkWinCondition();

    // Step 2: capture mechanics.
    for (const zone of this.map.controlZones) {
      const state = this.zoneStates.get(zone.id);
      if (!state) continue;

      let lone: PlayerState | null = null;
      let count = 0;
      for (const [, p] of this.players) {
        if (!p.alive) continue;
        const dx = p.x - zone.x, dy = p.y - zone.y;
        if (dx * dx + dy * dy <= zone.radius * zone.radius) {
          count++;
          lone = p;
        }
      }

      if (count === 0) {
        // Decay stale contender progress so partial captures don't linger.
        if (state.contenderId !== null) {
          state.captureProgress = Math.max(0, state.captureProgress - DT * 0.5);
          if (state.captureProgress === 0) state.contenderId = null;
        }
      } else if (count === 1 && lone) {
        if (state.ownerId === lone.id) {
          // Owner defending — clear any contender progress.
          state.contenderId = null;
          state.captureProgress = 1;
        } else {
          if (state.contenderId !== lone.id) {
            state.contenderId = lone.id;
            state.captureProgress = 0;
          }
          state.captureProgress = Math.min(1, state.captureProgress + DT / ZONE_CAPTURE_TIME);
          if (state.captureProgress >= 1) {
            state.ownerId = lone.id;
            state.contenderId = null;
          }
        }
      }
      // count >= 2: contested — capture progress paused; held zones still pay.
    }
  }

  private processShopProximity(): void {
    for (const [pid, p] of this.players) {
      if (!p.alive) continue;
      const currentNear = this.playerNearShop.get(pid)!;

      for (const shop of this.map.shopStations) {
        const isNear = dist(p, shop) <= SHOP_INTERACT_RADIUS + PLAYER_RADIUS;
        const wasNear = currentNear.has(shop.id);

        if (isNear && !wasNear) {
          currentNear.add(shop.id);
          this.emitCallback('nearShop', pid, { shopId: shop.id, near: true });
        } else if (!isNear && wasNear) {
          currentNear.delete(shop.id);
          this.emitCallback('nearShop', pid, { shopId: shop.id, near: false });
        }
      }
    }
  }

  private processTimers(): void {
    for (const [, p] of this.players) {
      if (!p.alive) {
        if (p.respawnTimer > 0) {
          p.respawnTimer -= DT;
          if (p.respawnTimer <= 0) this.respawnPlayer(p);
        }
        continue;
      }

      if (p.regen > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.hp + p.regen * DT, p.maxHp);
      }

      if (p.bandageCooldown > 0) {
        p.bandageCooldown = Math.max(0, p.bandageCooldown - DT);
      }

      if (p.shieldTimer > 0) {
        p.shieldTimer -= DT;
        if (p.shieldTimer <= 0) {
          p.shieldTimer = 0;
          p.shield = 0;
        }
      }

      if (p.speedBoostTimer > 0) {
        p.speedBoostTimer -= DT;
        if (p.speedBoostTimer <= 0) p.speedBoostTimer = 0;
      }
    }
  }

  getState(): GameState {
    const players: PlayerState[] = [];
    for (const [, p] of this.players) players.push({ ...p });

    const npcs = [];
    for (const [, n] of this.npcs) {
      npcs.push({
        id: n.id, type: n.type, x: n.x, y: n.y, angle: n.angle,
        hp: n.hp, maxHp: n.maxHp, alive: n.alive, targetId: n.targetId,
      });
    }

    const projectiles: Projectile[] = [];
    for (const [, p] of this.projectiles) projectiles.push({ ...p });

    const pickups: Pickup[] = [];
    for (const [, p] of this.pickups) pickups.push({ ...p });

    const controlZones: ControlZoneState[] = [];
    for (const [, z] of this.zoneStates) controlZones.push({ ...z });

    return { players, npcs, projectiles, pickups, controlZones, time: this.time };
  }

  getMap(): MapData {
    return this.map;
  }

  getNPCHitFlash(npcId: number): number {
    const n = this.npcs.get(npcId);
    return n?.hitFlash ?? 0;
  }
}
