// =====================================================================
// AUTO-GENERATED — DO NOT EDIT.
// Source of truth: ardoremy_actually_website_github_repo/hry/shooter/
// Re-sync: cd shooter-server && node scripts/sync-shared.mjs
// =====================================================================

// Map generator — ported from shooter-server/src/map.ts so single-player mode works in-browser.
import type { MapData, Wall, ShopStation, SpawnZone, Vec2, FlagBase, TeamArena, TeamId } from './types.js';

export function createMap(): MapData {
  const W = 3000;
  const H = 3000;
  const WALL_T = 20;

  const walls: Wall[] = [
    // Outer boundary
    { x: 0, y: 0, w: W, h: WALL_T },
    { x: 0, y: H - WALL_T, w: W, h: WALL_T },
    { x: 0, y: 0, w: WALL_T, h: H },
    { x: W - WALL_T, y: 0, w: WALL_T, h: H },

    // Top-left — warehouse
    { x: 200, y: 200, w: 300, h: 40 },
    { x: 200, y: 200, w: 40, h: 200 },
    { x: 600, y: 300, w: 40, h: 250 },
    { x: 400, y: 600, w: 200, h: 40 },

    // Top-right — containers
    { x: 2200, y: 200, w: 120, h: 60 },
    { x: 2500, y: 150, w: 120, h: 60 },
    { x: 2350, y: 350, w: 60, h: 120 },
    { x: 2600, y: 400, w: 120, h: 60 },
    { x: 2200, y: 500, w: 200, h: 40 },

    // Center arena
    { x: 1400, y: 1200, w: 200, h: 40 },
    { x: 1300, y: 1450, w: 40, h: 200 },
    { x: 1660, y: 1450, w: 40, h: 200 },
    { x: 1400, y: 1750, w: 200, h: 40 },

    // Bottom-left — ruined building
    { x: 250, y: 2200, w: 350, h: 40 },
    { x: 250, y: 2200, w: 40, h: 400 },
    { x: 250, y: 2560, w: 350, h: 40 },
    { x: 700, y: 2350, w: 40, h: 180 },

    // Bottom-right — pipes
    { x: 2300, y: 2400, w: 300, h: 40 },
    { x: 2500, y: 2100, w: 40, h: 300 },
    { x: 2700, y: 2250, w: 40, h: 200 },

    // Mid-map corridors
    { x: 900, y: 1000, w: 40, h: 300 },
    { x: 1100, y: 1050, w: 40, h: 250 },
    { x: 2000, y: 1000, w: 300, h: 40 },
    { x: 2000, y: 1800, w: 40, h: 250 },
    { x: 800, y: 1900, w: 250, h: 40 },
  ];

  const shopStations: ShopStation[] = [
    { id: 0, x: 500,  y: 500,  radius: 60 },
    { id: 1, x: 2500, y: 500,  radius: 60 },
    { id: 2, x: 1500, y: 1500, radius: 60 },
    { id: 3, x: 500,  y: 2500, radius: 60 },
    { id: 4, x: 2500, y: 2500, radius: 60 },
  ];

  const npcSpawnZones: SpawnZone[] = [
    { x: 100,  y: 100,  w: 400, h: 400 },
    { x: 2500, y: 100,  w: 400, h: 400 },
    { x: 100,  y: 2500, w: 400, h: 400 },
    { x: 2500, y: 2500, w: 400, h: 400 },
  ];

  const playerSpawnPoints: Vec2[] = [
    { x: 300,  y: 800 },
    { x: 800,  y: 300 },
    { x: 1500, y: 300 },
    { x: 2700, y: 800 },
    { x: 2700, y: 2200 },
    { x: 1500, y: 2700 },
    { x: 300,  y: 2200 },
    { x: 800,  y: 1500 },
    { x: 2200, y: 1500 },
    { x: 1500, y: 1000 },
  ];

  // Three capture zones for domination mode — placed on natural mid-map
  // pivot points so all three corners of the map can pressure them.
  const controlZones = [
    { id: 0, x: 1500, y:  600, radius: 120 },
    { id: 1, x:  700, y: 1900, radius: 120 },
    { id: 2, x: 2300, y: 1900, radius: 120 },
  ];

  // Team-mode anchors — red owns the top-left quadrant, blue the bottom-right,
  // mirroring the existing shop / NPC layout so the map stays balanced.
  const flagBases: FlagBase[] = [
    { team: 'red',  x: 350,  y: 350,  radius: 80 },
    { team: 'blue', x: 2650, y: 2650, radius: 80 },
  ];

  // Capture-Arena: a single arena per team, deep in their half. Far enough
  // from the spawn that the attacker has to fight through map territory to
  // start their 60-second hold.
  const teamArenas: TeamArena[] = [
    { id: 0, team: 'red',  x: 600,  y: 600,  radius: 130 },
    { id: 1, team: 'blue', x: 2400, y: 2400, radius: 130 },
  ];

  // Per-team spawn rotations. Each team has a few options near (but not on
  // top of) their flag base so they don't immediately stomp incoming
  // attackers.
  const teamSpawnPoints: Record<TeamId, Vec2[]> = {
    red: [
      { x: 350,  y: 700 },
      { x: 700,  y: 350 },
      { x: 500,  y: 500 },
    ],
    blue: [
      { x: 2650, y: 2300 },
      { x: 2300, y: 2650 },
      { x: 2500, y: 2500 },
    ],
  };

  return {
    width: W, height: H, walls, shopStations, npcSpawnZones,
    playerSpawnPoints, controlZones, flagBases, teamArenas, teamSpawnPoints,
  };
}
