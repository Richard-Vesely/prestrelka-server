import type { MapData, Wall, ShopStation, SpawnZone, Vec2 } from './types.js';

export function createMap(): MapData {
  const W = 3000;
  const H = 3000;
  const WALL_T = 20; // boundary wall thickness

  const walls: Wall[] = [
    // Outer boundary walls
    { x: 0, y: 0, w: W, h: WALL_T },             // top
    { x: 0, y: H - WALL_T, w: W, h: WALL_T },    // bottom
    { x: 0, y: 0, w: WALL_T, h: H },              // left
    { x: W - WALL_T, y: 0, w: WALL_T, h: H },     // right

    // === Top-left quadrant — warehouse buildings ===
    { x: 200, y: 200, w: 300, h: 40 },   // long wall
    { x: 200, y: 200, w: 40, h: 200 },   // L-corner down
    { x: 600, y: 300, w: 40, h: 250 },   // vertical barrier
    { x: 400, y: 600, w: 200, h: 40 },   // horizontal cover

    // === Top-right quadrant — containers yard ===
    { x: 2200, y: 200, w: 120, h: 60 },  // container 1
    { x: 2500, y: 150, w: 120, h: 60 },  // container 2
    { x: 2350, y: 350, w: 60, h: 120 },  // container vertical
    { x: 2600, y: 400, w: 120, h: 60 },  // container 3
    { x: 2200, y: 500, w: 200, h: 40 },  // long wall

    // === Center — open arena with scattered cover ===
    { x: 1400, y: 1200, w: 200, h: 40 }, // center N wall
    { x: 1300, y: 1450, w: 40, h: 200 }, // center W pillar
    { x: 1660, y: 1450, w: 40, h: 200 }, // center E pillar
    { x: 1400, y: 1750, w: 200, h: 40 }, // center S wall

    // === Bottom-left quadrant — ruined building ===
    { x: 250, y: 2200, w: 350, h: 40 },  // north wall
    { x: 250, y: 2200, w: 40, h: 400 },  // west wall
    { x: 250, y: 2560, w: 350, h: 40 },  // south wall (gap on right)
    { x: 700, y: 2350, w: 40, h: 180 },  // interior divider

    // === Bottom-right quadrant — industrial pipes ===
    { x: 2300, y: 2400, w: 300, h: 40 },
    { x: 2500, y: 2100, w: 40, h: 300 },
    { x: 2700, y: 2250, w: 40, h: 200 },

    // === Mid-map corridors and choke points ===
    { x: 900, y: 1000, w: 40, h: 300 },   // left corridor wall
    { x: 1100, y: 1050, w: 40, h: 250 },  // right corridor wall
    { x: 2000, y: 1000, w: 300, h: 40 },  // upper horizontal
    { x: 2000, y: 1800, w: 40, h: 250 },  // right side vertical
    { x: 800, y: 1900, w: 250, h: 40 },   // lower-left horizontal
  ];

  const shopStations: ShopStation[] = [
    { id: 0, x: 500,  y: 500,  radius: 60 },   // top-left
    { id: 1, x: 2500, y: 500,  radius: 60 },   // top-right
    { id: 2, x: 1500, y: 1500, radius: 60 },   // center
    { id: 3, x: 500,  y: 2500, radius: 60 },   // bottom-left
    { id: 4, x: 2500, y: 2500, radius: 60 },   // bottom-right
  ];

  const npcSpawnZones: SpawnZone[] = [
    { x: 100,  y: 100,  w: 400, h: 400 },  // top-left corner
    { x: 2500, y: 100,  w: 400, h: 400 },  // top-right corner
    { x: 100,  y: 2500, w: 400, h: 400 },  // bottom-left corner
    { x: 2500, y: 2500, w: 400, h: 400 },  // bottom-right corner
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

  return { width: W, height: H, walls, shopStations, npcSpawnZones, playerSpawnPoints };
}
