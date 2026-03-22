import { SeededRNG } from '../rng/RaritySystem';

export const RoomType = {
  COMBAT: 'combat',
  CHEST: 'chest',
  ELITE: 'elite',
  BOSS: 'boss',
  REST: 'rest',
} as const;

export type RoomType = (typeof RoomType)[keyof typeof RoomType];

export interface DungeonRoom {
  id: number;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  height: number;
  connections: number[];
  cleared: boolean;
}

export interface DungeonData {
  rooms: DungeonRoom[];
  seed: number;
  difficulty: number;
}

export class DungeonGenerator {
  private rng: SeededRNG;

  constructor(seed?: number) {
    this.rng = new SeededRNG(seed);
  }

  generate(waveNumber: number): DungeonData {
    const difficulty = Math.min(waveNumber, 50);
    const roomCount = Math.min(5 + Math.floor(difficulty / 5), 12);

    const rooms = this.generateRoomsBSP(roomCount, difficulty);
    this.connectRooms(rooms);
    this.assignRoomTypes(rooms, difficulty);

    return {
      rooms,
      seed: this.rng.nextInt(0, 999999),
      difficulty,
    };
  }

  private generateRoomsBSP(count: number, _difficulty: number): DungeonRoom[] {
    const rooms: DungeonRoom[] = [];
    const mapWidth = 40;
    const mapHeight = 30;

    interface BSPNode {
      x: number;
      y: number;
      w: number;
      h: number;
      left?: BSPNode;
      right?: BSPNode;
      room?: DungeonRoom;
    }

    const split = (node: BSPNode, depth: number): void => {
      if (depth <= 0 || rooms.length >= count) return;

      const minSize = 6;
      const horizontal = this.rng.next() > 0.5;

      if (horizontal && node.h > minSize * 2) {
        const splitY = node.y + minSize + this.rng.nextInt(0, node.h - minSize * 2);
        node.left = { x: node.x, y: node.y, w: node.w, h: splitY - node.y };
        node.right = { x: node.x, y: splitY, w: node.w, h: node.h - (splitY - node.y) };
      } else if (!horizontal && node.w > minSize * 2) {
        const splitX = node.x + minSize + this.rng.nextInt(0, node.w - minSize * 2);
        node.left = { x: node.x, y: node.y, w: splitX - node.x, h: node.h };
        node.right = { x: splitX, y: node.y, w: node.w - (splitX - node.x), h: node.h };
      } else {
        // Can't split, create room
        if (rooms.length < count) {
          const room: DungeonRoom = {
            id: rooms.length,
            type: RoomType.COMBAT,
            x: node.x + 1,
            y: node.y + 1,
            width: Math.max(3, node.w - 2),
            height: Math.max(3, node.h - 2),
            connections: [],
            cleared: false,
          };
          rooms.push(room);
          node.room = room;
        }
        return;
      }

      if (node.left) split(node.left, depth - 1);
      if (node.right) split(node.right, depth - 1);

      // Create rooms in leaf nodes that don't have children
      if (!node.left?.left && !node.left?.right && node.left && !node.left.room && rooms.length < count) {
        const room: DungeonRoom = {
          id: rooms.length,
          type: RoomType.COMBAT,
          x: node.left.x + 1,
          y: node.left.y + 1,
          width: Math.max(3, node.left.w - 2),
          height: Math.max(3, node.left.h - 2),
          connections: [],
          cleared: false,
        };
        rooms.push(room);
        node.left.room = room;
      }

      if (!node.right?.left && !node.right?.right && node.right && !node.right.room && rooms.length < count) {
        const room: DungeonRoom = {
          id: rooms.length,
          type: RoomType.COMBAT,
          x: node.right.x + 1,
          y: node.right.y + 1,
          width: Math.max(3, node.right.w - 2),
          height: Math.max(3, node.right.h - 2),
          connections: [],
          cleared: false,
        };
        rooms.push(room);
        node.right.room = room;
      }
    };

    const root: BSPNode = { x: 0, y: 0, w: mapWidth, h: mapHeight };
    split(root, Math.ceil(Math.log2(count)) + 2);

    // If we don't have enough rooms, pad with simple generation
    while (rooms.length < count) {
      rooms.push({
        id: rooms.length,
        type: RoomType.COMBAT,
        x: this.rng.nextInt(1, mapWidth - 6),
        y: this.rng.nextInt(1, mapHeight - 6),
        width: this.rng.nextInt(3, 6),
        height: this.rng.nextInt(3, 6),
        connections: [],
        cleared: false,
      });
    }

    return rooms;
  }

  private connectRooms(rooms: DungeonRoom[]): void {
    // Connect each room to its nearest unconnected neighbor (MST-like)
    const connected = new Set<number>([0]);
    const unconnected = new Set<number>(rooms.map((_, i) => i).filter(i => i !== 0));

    while (unconnected.size > 0) {
      let bestDist = Infinity;
      let bestFrom = -1;
      let bestTo = -1;

      for (const from of connected) {
        for (const to of unconnected) {
          const dx = (rooms[from].x + rooms[from].width / 2) - (rooms[to].x + rooms[to].width / 2);
          const dy = (rooms[from].y + rooms[from].height / 2) - (rooms[to].y + rooms[to].height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            bestFrom = from;
            bestTo = to;
          }
        }
      }

      if (bestFrom >= 0 && bestTo >= 0) {
        rooms[bestFrom].connections.push(bestTo);
        rooms[bestTo].connections.push(bestFrom);
        connected.add(bestTo);
        unconnected.delete(bestTo);
      } else {
        break;
      }
    }
  }

  private assignRoomTypes(rooms: DungeonRoom[], difficulty: number): void {
    if (rooms.length === 0) return;

    // First room is always rest (entry point)
    rooms[0].type = RoomType.REST;

    // Last room is boss
    if (rooms.length > 1) {
      rooms[rooms.length - 1].type = RoomType.BOSS;
    }

    // Assign remaining rooms
    for (let i = 1; i < rooms.length - 1; i++) {
      const roll = this.rng.next();
      if (roll < 0.3) {
        rooms[i].type = RoomType.CHEST;
      } else if (roll < 0.45 && difficulty >= 5) {
        rooms[i].type = RoomType.ELITE;
      } else if (roll < 0.55) {
        rooms[i].type = RoomType.REST;
      } else {
        rooms[i].type = RoomType.COMBAT;
      }
    }
  }
}
