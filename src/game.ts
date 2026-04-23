import type {
  Vec2, MapData, Wall, PlayerState, NPCState, Projectile, Pickup,
  PlayerInput, GameState, WeaponType, WeaponDef, NPCType, ShopItem,
  StatUpgrade, InventorySlot, LobbyPlayer,
} from './types.js';

import {
  WEAPON_DEFS, NPC_DEFS, SHOP_ITEMS, XP_PER_LEVEL, HP_PER_LEVEL,
  PLAYER_KILL_XP, TICK_RATE, DT, PLAYER_RADIUS, NPC_RADIUS,
  PROJECTILE_RADIUS, BASE_PLAYER_HP, BASE_PLAYER_SPEED, RESPAWN_TIME,
  MAX_NPCS, NPC_RESPAWN_INTERVAL, SHOP_INTERACT_RADIUS,
  PICKUP_COLLECT_RADIUS, SPEED_BOOST_MULTIPLIER, SPEED_BOOST_DURATION,
  SHIELD_POTION_AMOUNT, SHIELD_POTION_DURATION, HP_POTION_AMOUNT,
  MAX_INVENTORY_SLOTS, COIN_LOSS_ON_DEATH, PICKUP_RADIUS,
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
    // Circle center is inside rect — push to nearest edge
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

// ── Player colors ────────────────────────────────────────────

const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
  '#e67e22', '#1abc9c', '#e84393', '#00cec9', '#fd79a8',
];

// ── Game class ───────────────────────────────────────────────

export type GameEventCallback = (event: string, roomCode: string, targetPlayerId: string | null, data: unknown) => void;

export class Game {
  readonly roomCode: string;
  private map: MapData;
  private players = new Map<string, PlayerState>();
  private inputs = new Map<string, PlayerInput>();
  private npcs = new Map<number, InternalNPC>();
  private projectiles = new Map<number, Projectile>();
  private pickups = new Map<number, Pickup>();
  private time = 0;
  private npcSpawnTimer = 0;
  private usedColors = new Set<string>();

  // ID counters
  private nextProjectileId = 1;
  private nextPickupId = 1;
  private nextNPCId = 1;

  // Per-player fire cooldowns
  private fireCooldowns = new Map<string, number>();

  // Per-NPC attack cooldowns
  private npcAttackCooldowns = new Map<number, number>();

  // NPC wander state
  private npcWanderDir = new Map<number, Vec2>();
  private npcWanderTimer = new Map<number, number>();

  // Track which players are near which shops (for enter/leave events)
  private playerNearShop = new Map<string, Set<number>>();

  // Callback to emit events to clients
  private emitCallback: GameEventCallback;

  constructor(roomCode: string, lobbyPlayers: LobbyPlayer[], map: MapData, emitCallback: GameEventCallback) {
    this.roomCode = roomCode;
    this.map = map;
    this.emitCallback = emitCallback;

    for (const lp of lobbyPlayers) {
      this.addPlayer(lp.id, lp.name);
    }
  }

  // ── Player management ────────────────────────────────────

  addPlayer(id: string, name: string): void {
    const color = this.pickColor();
    const spawn = this.randomSpawnPoint();
    const player: PlayerState = {
      id,
      name,
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: BASE_PLAYER_HP,
      maxHp: BASE_PLAYER_HP,
      shield: 0,
      speed: BASE_PLAYER_SPEED,
      armor: 0,
      damageBoost: 0,
      regen: 0,
      level: 1,
      xp: 0,
      xpToNext: XP_PER_LEVEL[1] ?? 100,
      coins: 0,
      kills: 0,
      deaths: 0,
      currentWeapon: 'fists',
      currentAmmo: -1,
      inventory: [{ type: 'fists', ammo: -1 }],
      alive: true,
      respawnTimer: 0,
      speedBoostTimer: 0,
      shieldTimer: 0,
      color,
      upgrades: { maxHp: 0, speed: 0, armor: 0, damage: 0, regen: 0 },
    };
    this.players.set(id, player);
    this.fireCooldowns.set(id, 0);
    this.playerNearShop.set(id, new Set());
  }

  removePlayer(id: string): void {
    const p = this.players.get(id);
    if (p) this.usedColors.delete(p.color);
    this.players.delete(id);
    this.inputs.delete(id);
    this.fireCooldowns.delete(id);
    this.playerNearShop.delete(id);
  }

  hasPlayers(): boolean {
    return this.players.size > 0;
  }

  private pickColor(): string {
    for (const c of PLAYER_COLORS) {
      if (!this.usedColors.has(c)) {
        this.usedColors.add(c);
        return c;
      }
    }
    // Fallback: random hex
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

    // Check near shop
    const nearShops = this.playerNearShop.get(playerId);
    if (!nearShops || nearShops.size === 0) {
      this.emitCallback('purchaseFailed', this.roomCode, playerId, { reason: 'Nejsi u obchodu' });
      return;
    }

    const def = SHOP_ITEMS[item];
    if (!def) {
      this.emitCallback('purchaseFailed', this.roomCode, playerId, { reason: 'Neznámý předmět' });
      return;
    }

    if (def.isConsumable) {
      const cost = def.costs[0];
      if (p.coins < cost) {
        this.emitCallback('purchaseFailed', this.roomCode, playerId, { reason: 'Nemáš dost mincí' });
        return;
      }
      p.coins -= cost;
      this.applyConsumable(p, item);
      this.emitCallback('purchaseSuccess', this.roomCode, playerId, { item, cost, tier: 1 });
    } else {
      const upgrade = item as StatUpgrade;
      const currentTier = p.upgrades[upgrade];
      if (currentTier >= def.maxTier) {
        this.emitCallback('purchaseFailed', this.roomCode, playerId, { reason: 'Maximální úroveň' });
        return;
      }
      const cost = def.costs[currentTier];
      if (p.coins < cost) {
        this.emitCallback('purchaseFailed', this.roomCode, playerId, { reason: 'Nemáš dost mincí' });
        return;
      }
      p.coins -= cost;
      p.upgrades[upgrade] = currentTier + 1;
      this.applyUpgrade(p, upgrade);
      this.emitCallback('purchaseSuccess', this.roomCode, playerId, { item, cost, tier: currentTier + 1 });
    }
  }

  private applyConsumable(p: PlayerState, item: ShopItem): void {
    switch (item) {
      case 'hpPotion':
        p.hp = Math.min(p.hp + HP_POTION_AMOUNT, p.maxHp);
        break;
      case 'shieldPotion':
        p.shield = SHIELD_POTION_AMOUNT;
        p.shieldTimer = SHIELD_POTION_DURATION;
        break;
      case 'speedBoost':
        p.speedBoostTimer = SPEED_BOOST_DURATION;
        break;
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
    // Recalculate all stats from base + level + upgrades
    const hpBonus = p.upgrades.maxHp * 20;
    p.maxHp = BASE_PLAYER_HP + (p.level - 1) * HP_PER_LEVEL + hpBonus;
    p.speed = BASE_PLAYER_SPEED * (1 + 0.1 * p.upgrades.speed);
    p.armor = p.upgrades.armor * 0.15;
    p.damageBoost = p.upgrades.damage * 0.15;
    p.regen = p.upgrades.regen * 1;
  }

  // ── Weapon switching ─────────────────────────────────────

  switchWeapon(playerId: string, slot: number): void {
    const p = this.players.get(playerId);
    if (!p || !p.alive) return;
    if (slot < 0 || slot >= p.inventory.length) return;

    // Save current ammo to inventory
    const currentSlot = p.inventory.findIndex(s => s.type === p.currentWeapon);
    if (currentSlot >= 0) {
      p.inventory[currentSlot].ammo = p.currentAmmo;
    }

    // Switch
    const newSlot = p.inventory[slot];
    p.currentWeapon = newSlot.type;
    p.currentAmmo = newSlot.ammo;
  }

  // ── Main tick ────────────────────────────────────────────

  tick(): GameState {
    this.time += DT;

    this.processInputs();
    this.processMovement();
    this.processFiring();
    this.processProjectiles();
    this.processNPCAI();
    this.processNPCSpawning();
    this.processCollisions();
    this.processPickups();
    this.processShopProximity();
    this.processTimers();

    return this.getState();
  }

  // ── Phase: Inputs → Movement ─────────────────────────────

  private processInputs(): void {
    for (const [id, input] of this.inputs) {
      const p = this.players.get(id);
      if (!p || !p.alive) continue;
      p.angle = input.angle;
    }
  }

  private processMovement(): void {
    for (const [id, input] of this.inputs) {
      const p = this.players.get(id);
      if (!p || !p.alive) continue;

      // Direction from WASD
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

        p.x += dir.x * speed * DT;
        p.y += dir.y * speed * DT;
      }

      // Clamp to map bounds
      p.x = Math.max(PLAYER_RADIUS + 20, Math.min(this.map.width - PLAYER_RADIUS - 20, p.x));
      p.y = Math.max(PLAYER_RADIUS + 20, Math.min(this.map.height - PLAYER_RADIUS - 20, p.y));

      // Collide with walls
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

      const cooldown = this.fireCooldowns.get(id) ?? 0;
      if (cooldown > 0) continue;

      const wDef = WEAPON_DEFS[p.currentWeapon];
      if (!wDef) continue;

      // Check ammo
      if (p.currentAmmo === 0) continue;

      // Set cooldown
      this.fireCooldowns.set(id, 1 / wDef.fireRate);

      // Consume ammo
      if (p.currentAmmo > 0) p.currentAmmo--;
      // Update inventory slot ammo
      const slot = p.inventory.findIndex(s => s.type === p.currentWeapon);
      if (slot >= 0) p.inventory[slot].ammo = p.currentAmmo;

      if (wDef.melee) {
        this.doMeleeAttack(p, wDef);
      } else {
        this.doRangedAttack(p, wDef);
      }
    }

    // Decrement cooldowns
    for (const [id, cd] of this.fireCooldowns) {
      if (cd > 0) this.fireCooldowns.set(id, Math.max(0, cd - DT));
    }
  }

  private doMeleeAttack(attacker: PlayerState, wDef: WeaponDef): void {
    const ax = attacker.x + Math.cos(attacker.angle) * (PLAYER_RADIUS + 5);
    const ay = attacker.y + Math.sin(attacker.angle) * (PLAYER_RADIUS + 5);
    const meleeArc = Math.PI / 2; // 90 degree arc

    const dmg = wDef.damage * (1 + attacker.damageBoost);

    // Hit players
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

    // Hit NPCs
    for (const [nid, npc] of this.npcs) {
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
      if (wDef.spread) {
        angle += (Math.random() - 0.5) * wDef.spread;
      }

      const speed = wDef.projectileSpeed ?? 500;
      const proj: Projectile = {
        id: this.nextProjectileId++,
        ownerId: attacker.id,
        ownerIsNPC: false,
        x: attacker.x + Math.cos(angle) * (PLAYER_RADIUS + 5),
        y: attacker.y + Math.sin(angle) * (PLAYER_RADIUS + 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: wDef.damage * (1 + attacker.damageBoost),
        maxRange: wDef.range,
        distTraveled: 0,
      };
      this.projectiles.set(proj.id, proj);
    }
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

      // Remove if out of range
      if (proj.distTraveled >= proj.maxRange) {
        toRemove.push(id);
        continue;
      }

      // Remove if out of bounds
      if (proj.x < 0 || proj.x > this.map.width || proj.y < 0 || proj.y > this.map.height) {
        toRemove.push(id);
        continue;
      }

      // Check wall collision
      let hitWall = false;
      for (const w of this.map.walls) {
        if (pointInRect(proj.x, proj.y, w.x, w.y, w.w, w.h)) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.projectiles.delete(id);
    }
  }

  // ── Phase: Collisions (projectile vs entities) ───────────

  private processCollisions(): void {
    const projToRemove: number[] = [];

    for (const [projId, proj] of this.projectiles) {
      let hit = false;

      if (!proj.ownerIsNPC) {
        // Player projectile — check vs other players and NPCs
        for (const [pid, target] of this.players) {
          if (pid === proj.ownerId || !target.alive) continue;
          if (dist(proj, target) < PROJECTILE_RADIUS + PLAYER_RADIUS) {
            const attacker = this.players.get(proj.ownerId);
            this.damagePlayer(target, proj.damage, proj.ownerId, attacker?.name ?? '???', 'pistol');
            // Knockback
            const dir = normalize({ x: proj.vx, y: proj.vy });
            target.x += dir.x * 3;
            target.y += dir.y * 3;
            hit = true;
            break;
          }
        }

        if (!hit) {
          for (const [nid, npc] of this.npcs) {
            if (!npc.alive) continue;
            if (dist(proj, npc) < PROJECTILE_RADIUS + NPC_RADIUS) {
              const attacker = this.players.get(proj.ownerId);
              if (attacker) this.damageNPC(npc, proj.damage, attacker);
              const dir = normalize({ x: proj.vx, y: proj.vy });
              npc.x += dir.x * 3;
              npc.y += dir.y * 3;
              hit = true;
              break;
            }
          }
        }
      } else {
        // NPC projectile — check vs players only
        for (const [pid, target] of this.players) {
          if (!target.alive) continue;
          if (dist(proj, target) < PROJECTILE_RADIUS + PLAYER_RADIUS) {
            this.damagePlayer(target, proj.damage, proj.ownerId, 'NPC', 'pistol');
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

    for (const id of projToRemove) {
      this.projectiles.delete(id);
    }
  }

  // ── Damage helpers ───────────────────────────────────────

  private damagePlayer(target: PlayerState, rawDamage: number, attackerId: string, attackerName: string, weapon: WeaponType): void {
    let dmg = rawDamage * (1 - target.armor);

    // Shield absorbs first
    if (target.shield > 0) {
      if (target.shield >= dmg) {
        target.shield -= dmg;
        return;
      }
      dmg -= target.shield;
      target.shield = 0;
    }

    target.hp -= dmg;
    if (target.hp <= 0) {
      this.killPlayer(target, attackerId, attackerName, weapon);
    }
  }

  private killPlayer(victim: PlayerState, killerId: string, killerName: string, weapon: WeaponType): void {
    victim.alive = false;
    victim.hp = 0;
    victim.respawnTimer = RESPAWN_TIME;
    victim.deaths++;

    // Drop current weapon (if not pistol)
    if (victim.currentWeapon !== 'pistol') {
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'weapon',
        x: victim.x + randomInRange(-20, 20),
        y: victim.y + randomInRange(-20, 20),
        weaponType: victim.currentWeapon,
        weaponAmmo: victim.currentAmmo,
      });
    }

    // Drop coins
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

    // Lose coins and upgrades
    victim.coins -= droppedCoins;
    victim.upgrades = { maxHp: 0, speed: 0, armor: 0, damage: 0, regen: 0 };
    victim.shield = 0;
    victim.shieldTimer = 0;
    victim.speedBoostTimer = 0;

    // Credit killer
    const killer = this.players.get(killerId);
    if (killer && killer.id !== victim.id) {
      killer.kills++;
      this.giveXP(killer, PLAYER_KILL_XP);
    }

    this.emitCallback('playerKilled', this.roomCode, null, {
      killerId,
      killerName,
      victimId: victim.id,
      victimName: victim.name,
      weapon,
    });
  }

  private respawnPlayer(p: PlayerState): void {
    const spawn = this.randomSpawnPoint();
    p.alive = true;
    p.x = spawn.x;
    p.y = spawn.y;
    p.hp = BASE_PLAYER_HP + (p.level - 1) * HP_PER_LEVEL; // base + level bonus only, no upgrade bonus
    p.maxHp = p.hp;
    p.shield = 0;
    p.armor = 0;
    p.damageBoost = 0;
    p.regen = 0;
    p.speed = BASE_PLAYER_SPEED;
    p.currentWeapon = 'fists';
    p.currentAmmo = -1;
    p.inventory = [{ type: 'fists', ammo: -1 }];
    p.respawnTimer = 0;

    this.emitCallback('playerRespawned', this.roomCode, null, {
      id: p.id,
      x: p.x,
      y: p.y,
    });
  }

  private damageNPC(npc: InternalNPC, rawDamage: number, attacker: PlayerState): void {
    npc.hp -= rawDamage;
    // Aggro on attacker
    npc.targetId = attacker.id;

    if (npc.hp <= 0) {
      this.killNPC(npc, attacker);
    }
  }

  private killNPC(npc: InternalNPC, killer: PlayerState): void {
    npc.alive = false;
    const def = NPC_DEFS[npc.type];

    // Give XP and coins
    this.giveXP(killer, def.xp);
    const coinDrop = randomInt(def.coinDrop[0], def.coinDrop[1]);
    killer.coins += coinDrop;

    // Drop coins pickup
    if (coinDrop > 0) {
      this.spawnPickup({
        id: this.nextPickupId++,
        type: 'coins',
        x: npc.x + randomInRange(-15, 15),
        y: npc.y + randomInRange(-15, 15),
        coinAmount: coinDrop,
      });
    }

    // Chance to drop weapon
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

    // Remove NPC after a tick
    this.npcs.delete(npc.id);
    this.npcAttackCooldowns.delete(npc.id);
    this.npcWanderDir.delete(npc.id);
    this.npcWanderTimer.delete(npc.id);
  }

  private npcWeaponDrop(type: NPCType): WeaponType {
    const drops: Record<NPCType, WeaponType[]> = {
      zombie: ['knife', 'pistol'],
      ranged: ['smg', 'assault_rifle'],
      tank_npc: ['shotgun', 'sniper', 'assault_rifle'],
    };
    const pool = drops[type];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── XP & Leveling ───────────────────────────────────────

  private giveXP(player: PlayerState, amount: number): void {
    player.xp += amount;
    while (player.level < XP_PER_LEVEL.length && player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level++;
      player.xpToNext = XP_PER_LEVEL[player.level] ?? player.xpToNext * 2;

      // Level up bonuses
      player.maxHp += HP_PER_LEVEL;
      player.hp = player.maxHp; // Heal to full on level up
      this.recalcStats(player);

      this.emitCallback('levelUp', this.roomCode, null, {
        id: player.id,
        level: player.level,
      });
    }
  }

  // ── NPC AI ───────────────────────────────────────────────

  private processNPCAI(): void {
    for (const [id, npc] of this.npcs) {
      if (!npc.alive) continue;
      const def = NPC_DEFS[npc.type];

      // Find nearest alive player
      let nearestPlayer: PlayerState | null = null;
      let nearestDist = Infinity;
      for (const [, p] of this.players) {
        if (!p.alive) continue;
        const d = dist(npc, p);
        if (d < nearestDist) {
          nearestDist = d;
          nearestPlayer = p;
        }
      }

      const inAggro = nearestPlayer && nearestDist <= def.aggroRange;

      if (inAggro && nearestPlayer) {
        npc.targetId = nearestPlayer.id;
        // Move toward target
        const dir = normalize({ x: nearestPlayer.x - npc.x, y: nearestPlayer.y - npc.y });
        npc.angle = Math.atan2(dir.y, dir.x);

        // Don't move if within attack range
        if (nearestDist > def.attackRange) {
          npc.x += dir.x * def.speed * DT;
          npc.y += dir.y * def.speed * DT;
        }

        // Attack if in range
        if (nearestDist <= def.attackRange + PLAYER_RADIUS) {
          const cd = this.npcAttackCooldowns.get(id) ?? 0;
          if (cd <= 0) {
            this.npcAttack(npc, nearestPlayer, def);
            this.npcAttackCooldowns.set(id, 1 / def.attackRate);
          }
        }
      } else {
        npc.targetId = undefined;
        // Wander
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

      // Clamp NPC to map
      npc.x = Math.max(NPC_RADIUS + 20, Math.min(this.map.width - NPC_RADIUS - 20, npc.x));
      npc.y = Math.max(NPC_RADIUS + 20, Math.min(this.map.height - NPC_RADIUS - 20, npc.y));

      // Wall collision
      this.resolveWallCollision(npc, NPC_RADIUS);
    }

    // Decrement NPC attack cooldowns
    for (const [id, cd] of this.npcAttackCooldowns) {
      if (cd > 0) this.npcAttackCooldowns.set(id, Math.max(0, cd - DT));
    }
  }

  private npcAttack(npc: InternalNPC, target: PlayerState, def: typeof NPC_DEFS[NPCType]): void {
    if (npc.type === 'zombie' || npc.type === 'tank_npc') {
      // Melee attack
      this.damagePlayer(target, def.damage, `npc-${npc.id}`, npc.type, 'knife');
      const dir = normalize({ x: target.x - npc.x, y: target.y - npc.y });
      target.x += dir.x * 5;
      target.y += dir.y * 5;
    } else {
      // Ranged — shoot projectile
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
    }
  }

  // ── NPC Spawning ─────────────────────────────────────────

  private processNPCSpawning(): void {
    this.npcSpawnTimer -= DT;
    if (this.npcSpawnTimer > 0) return;
    this.npcSpawnTimer = NPC_RESPAWN_INTERVAL;

    if (this.npcs.size >= MAX_NPCS) return;

    // Pick random type: 60% zombie, 25% ranged, 15% tank
    const roll = Math.random();
    let type: NPCType;
    if (roll < 0.60) type = 'zombie';
    else if (roll < 0.85) type = 'ranged';
    else type = 'tank_npc';

    const def = NPC_DEFS[type];

    // Pick random spawn zone
    const zone = this.map.npcSpawnZones[Math.floor(Math.random() * this.map.npcSpawnZones.length)];

    // Try a few times to find a spot not inside a wall
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
        type,
        x,
        y,
        angle: Math.random() * Math.PI * 2,
        hp: def.hp,
        maxHp: def.hp,
        alive: true,
      };
      this.npcs.set(npc.id, npc);
      break;
    }
  }

  // ── Pickups ──────────────────────────────────────────────

  private processPickups(): void {
    const collected: number[] = [];

    for (const [pickupId, pickup] of this.pickups) {
      for (const [, p] of this.players) {
        if (!p.alive) continue;
        if (dist(p, pickup) > PICKUP_COLLECT_RADIUS + PICKUP_RADIUS) continue;

        if (pickup.type === 'coins' && pickup.coinAmount) {
          p.coins += pickup.coinAmount;
          collected.push(pickupId);
          this.emitCallback('pickupCollected', this.roomCode, null, { pickupId, playerId: p.id });
          break;
        }

        if (pickup.type === 'weapon' && pickup.weaponType) {
          const newSlot: InventorySlot = { type: pickup.weaponType, ammo: pickup.weaponAmmo ?? WEAPON_DEFS[pickup.weaponType].maxAmmo };

          if (p.inventory.length < MAX_INVENTORY_SLOTS) {
            // Add to inventory and auto-switch to it
            // Save current ammo first
            const curIdx = p.inventory.findIndex(s => s.type === p.currentWeapon);
            if (curIdx >= 0) p.inventory[curIdx].ammo = p.currentAmmo;
            p.inventory.push(newSlot);
            p.currentWeapon = newSlot.type;
            p.currentAmmo = newSlot.ammo;
          } else {
            // Swap current weapon
            const currentSlotIdx = p.inventory.findIndex(s => s.type === p.currentWeapon);
            if (currentSlotIdx >= 0) {
              // Drop current weapon as pickup (don't drop fists)
              const oldSlot = p.inventory[currentSlotIdx];
              if (oldSlot.type !== 'fists') {
                this.spawnPickup({
                  id: this.nextPickupId++,
                  type: 'weapon',
                  x: p.x + randomInRange(-20, 20),
                  y: p.y + randomInRange(-20, 20),
                  weaponType: oldSlot.type,
                  weaponAmmo: oldSlot.ammo,
                });
              }
              p.inventory[currentSlotIdx] = newSlot;
              p.currentWeapon = newSlot.type;
              p.currentAmmo = newSlot.ammo;
            }
          }

          collected.push(pickupId);
          this.emitCallback('pickupCollected', this.roomCode, null, { pickupId, playerId: p.id });
          break;
        }
      }
    }

    for (const id of collected) {
      this.pickups.delete(id);
    }
  }

  private spawnPickup(pickup: Pickup): void {
    this.pickups.set(pickup.id, pickup);
  }

  // ── Shop proximity ───────────────────────────────────────

  private processShopProximity(): void {
    for (const [pid, p] of this.players) {
      if (!p.alive) continue;
      const currentNear = this.playerNearShop.get(pid)!;

      for (const shop of this.map.shopStations) {
        const isNear = dist(p, shop) <= SHOP_INTERACT_RADIUS + PLAYER_RADIUS;
        const wasNear = currentNear.has(shop.id);

        if (isNear && !wasNear) {
          currentNear.add(shop.id);
          this.emitCallback('nearShop', this.roomCode, pid, { shopId: shop.id, near: true });
        } else if (!isNear && wasNear) {
          currentNear.delete(shop.id);
          this.emitCallback('nearShop', this.roomCode, pid, { shopId: shop.id, near: false });
        }
      }
    }
  }

  // ── Timers ───────────────────────────────────────────────

  private processTimers(): void {
    for (const [, p] of this.players) {
      if (!p.alive) {
        // Respawn timer
        if (p.respawnTimer > 0) {
          p.respawnTimer -= DT;
          if (p.respawnTimer <= 0) {
            this.respawnPlayer(p);
          }
        }
        continue;
      }

      // HP regen
      if (p.regen > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.hp + p.regen * DT, p.maxHp);
      }

      // Shield timer
      if (p.shieldTimer > 0) {
        p.shieldTimer -= DT;
        if (p.shieldTimer <= 0) {
          p.shieldTimer = 0;
          p.shield = 0;
        }
      }

      // Speed boost timer
      if (p.speedBoostTimer > 0) {
        p.speedBoostTimer -= DT;
        if (p.speedBoostTimer <= 0) {
          p.speedBoostTimer = 0;
        }
      }
    }
  }

  // ── State serialization ──────────────────────────────────

  getState(): GameState {
    const players: PlayerState[] = [];
    for (const [, p] of this.players) {
      players.push({ ...p });
    }

    const npcs: NPCState[] = [];
    for (const [, n] of this.npcs) {
      npcs.push({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        angle: n.angle,
        hp: n.hp,
        maxHp: n.maxHp,
        alive: n.alive,
        targetId: n.targetId,
      });
    }

    const projectiles: Projectile[] = [];
    for (const [, p] of this.projectiles) {
      projectiles.push({ ...p });
    }

    const pickups: Pickup[] = [];
    for (const [, p] of this.pickups) {
      pickups.push({ ...p });
    }

    return { players, npcs, projectiles, pickups, time: this.time };
  }
}

// Internal NPC type (same as NPCState but mutable)
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
}
