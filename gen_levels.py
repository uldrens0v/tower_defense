import json
from collections import deque

COLS = 32
ROWS = 18
# 0=PATH, 1=BUILDABLE, 2=WALL, 3=DECORATION, 4=SPAWN, 5=EXIT

def make_grid(fill=1):
    return [[fill]*COLS for _ in range(ROWS)]

def carve(grid, x, y, val=0):
    if 0 <= x < COLS and 0 <= y < ROWS:
        grid[y][x] = val

def carve_h(grid, y, x1, x2, val=0):
    for x in range(min(x1,x2), max(x1,x2)+1):
        carve(grid, x, y, val)

def carve_v(grid, x, y1, y2, val=0):
    for y in range(min(y1,y2), max(y1,y2)+1):
        carve(grid, x, y, val)

def add_border(grid, val=3):
    for x in range(COLS):
        grid[0][x] = val
        grid[ROWS-1][x] = val
    for y in range(ROWS):
        grid[y][0] = val
        grid[y][COLS-1] = val

def verify(grid, spawns, exit_p):
    walkable = {0, 4, 5}
    ex, ey = exit_p
    for sx, sy in spawns:
        visited = set()
        queue = deque([(sx, sy)])
        visited.add((sx, sy))
        found = False
        while queue:
            x, y = queue.popleft()
            if x == ex and y == ey:
                found = True
                break
            for dx, dy in [(0,-1),(0,1),(-1,0),(1,0)]:
                nx, ny = x+dx, y+dy
                if 0 <= nx < COLS and 0 <= ny < ROWS and (nx,ny) not in visited:
                    if grid[ny][nx] in walkable:
                        visited.add((nx, ny))
                        queue.append((nx, ny))
        if not found:
            return False
    return True

# ========== LEVEL 1: Snake maze ==========
g1 = make_grid(1)
add_border(g1)
# Spawn top-left
carve(g1, 0, 1, 4)
# Snake pattern using rows 1-16 (inside border)
carve_h(g1, 1, 1, 14)       # row 1: right
carve_v(g1, 14, 1, 4)       # col 14: down
carve_h(g1, 4, 3, 14)       # row 4: left
carve_v(g1, 3, 4, 7)        # col 3: down
carve_h(g1, 7, 3, 14)       # row 7: right
carve_v(g1, 14, 7, 10)      # col 14: down
carve_h(g1, 10, 3, 14)      # row 10: left
carve_v(g1, 3, 10, 13)      # col 3: down
carve_h(g1, 13, 3, 14)      # row 13: right
carve_v(g1, 14, 13, 16)     # col 14: down to row 16
carve_h(g1, 16, 14, 20)     # row 16: right to exit area
carve(g1, 20, 16, 5)         # EXIT tile

spawns1 = [(0, 1)]
exit1 = (20, 16)
assert verify(g1, spawns1, exit1), "Level 1 broken!"

# ========== LEVEL 2: Double entry snake ==========
g2 = make_grid(1)
add_border(g2)
carve(g2, 0, 1, 4)   # Spawn 1 top-left
carve(g2, 0, 16, 4)  # Spawn 2 bottom-left

# Top path: snake from top-left
carve_h(g2, 1, 1, 28)
carve_v(g2, 28, 1, 4)
carve_h(g2, 4, 4, 28)
carve_v(g2, 4, 4, 8)
carve_h(g2, 8, 4, 15)
# Exit in center
carve(g2, 15, 8, 0)
carve(g2, 15, 9, 5)

# Bottom path: snake from bottom-left
carve_h(g2, 16, 1, 28)
carve_v(g2, 28, 13, 16)
carve_h(g2, 13, 4, 28)
carve_v(g2, 4, 10, 13)
carve_h(g2, 10, 4, 15)
carve(g2, 15, 10, 0)  # Connect to exit area

spawns2 = [(0, 1), (0, 16)]
exit2 = (15, 9)
assert verify(g2, spawns2, exit2), "Level 2 broken!"

# ========== LEVEL 3: Spiral ==========
g3 = make_grid(1)
add_border(g3)
carve(g3, 0, 1, 4)   # Spawn 1
carve(g3, 0, 16, 4)  # Spawn 2

# Outer ring
carve_h(g3, 1, 1, 29)  # top
carve_v(g3, 29, 1, 16)  # right
carve_h(g3, 16, 1, 29)  # bottom
carve_v(g3, 1, 1, 16)   # left (spawn side)

# Second ring
carve_h(g3, 3, 3, 27)
carve_v(g3, 27, 3, 14)
carve_h(g3, 14, 3, 27)
carve_v(g3, 3, 3, 14)

# Connect outer to inner ring
carve_v(g3, 2, 1, 3)  # top-left connector
carve_v(g3, 2, 14, 16) # bottom-left connector

# Third ring / center path
carve_h(g3, 5, 5, 25)
carve_v(g3, 25, 5, 12)
carve_h(g3, 12, 5, 25)
carve_v(g3, 5, 5, 12)

# Connect 2nd to 3rd
carve_v(g3, 4, 3, 5)  # left connector
carve_v(g3, 4, 12, 14) # left bottom connector

# Center exit
carve_h(g3, 8, 7, 15)
carve_v(g3, 7, 5, 8)  # connect to 3rd ring
carve(g3, 15, 8, 0)
carve(g3, 15, 9, 5)

spawns3 = [(0, 1), (0, 16)]
exit3 = (15, 9)
assert verify(g3, spawns3, exit3), "Level 3 broken!"

# ========== LEVEL 4: Triple entry maze ==========
g4 = make_grid(1)
add_border(g4)
carve(g4, 0, 1, 4)    # Spawn top-left
carve(g4, 0, 16, 4)   # Spawn bottom-left
carve(g4, 30, 0, 4)   # Spawn top-right

# Top-left snake
carve_h(g4, 1, 1, 10)
carve_v(g4, 10, 1, 5)
carve_h(g4, 5, 3, 10)
carve_v(g4, 3, 5, 8)
carve_h(g4, 8, 3, 15)

# Top-right snake
carve_h(g4, 1, 12, 30)  # connects with top spawn row
carve_v(g4, 12, 1, 5)
carve_h(g4, 5, 12, 28)
carve_v(g4, 28, 5, 8)
carve_h(g4, 8, 16, 28)

# Bottom-left snake
carve_h(g4, 16, 1, 10)
carve_v(g4, 10, 13, 16)
carve_h(g4, 13, 3, 10)
carve_v(g4, 3, 10, 13)
carve_h(g4, 10, 3, 15)

# Bottom connector
carve_v(g4, 15, 8, 10)

# Exit center
carve(g4, 15, 9, 5)

# Connect top-right spawn
carve_v(g4, 30, 1, 1)

spawns4 = [(0, 1), (0, 16), (30, 0)]
exit4 = (15, 9)
assert verify(g4, spawns4, exit4), "Level 4 broken!"

# ========== LEVEL 5: 4-corner assault ==========
g5 = make_grid(1)
add_border(g5)
carve(g5, 0, 1, 4)    # Spawn TL
carve(g5, 30, 0, 4)   # Spawn TR
carve(g5, 0, 16, 4)   # Spawn BL
carve(g5, 30, 17, 4)  # Spawn BR

# Top-left path
carve_h(g5, 1, 1, 7)
carve_v(g5, 7, 1, 5)
carve_h(g5, 5, 3, 7)
carve_v(g5, 3, 5, 8)
carve_h(g5, 8, 3, 15)

# Top-right path
carve_h(g5, 1, 24, 30)
carve_v(g5, 24, 1, 5)
carve_h(g5, 5, 24, 28)
carve_v(g5, 28, 5, 8)
carve_h(g5, 8, 16, 28)

# Bottom-left path
carve_h(g5, 16, 1, 7)
carve_v(g5, 7, 12, 16)
carve_h(g5, 12, 3, 7)
carve_v(g5, 3, 10, 12)
carve_h(g5, 10, 3, 15)

# Bottom-right path
carve_h(g5, 16, 24, 30)
carve_v(g5, 24, 12, 16)
carve_h(g5, 12, 24, 28)
carve_v(g5, 28, 10, 12)
carve_h(g5, 10, 16, 28)

# Connect top-right spawn
carve_v(g5, 30, 1, 1)
# Connect bottom-right spawn
carve_v(g5, 30, 16, 16)

# Center exit - paths from top (row 8) and bottom (row 10) meet here
carve(g5, 15, 9, 5)

spawns5 = [(0, 1), (30, 0), (0, 16), (30, 17)]
exit5 = (15, 9)
assert verify(g5, spawns5, exit5), "Level 5 broken!"

print("All levels verified!")

# Build final JSON
waves1 = [
    {"waveNumber":1,"enemies":[{"enemyId":"enemy_runner","count":6,"spawnPointIndex":0}],"spawnDelay":1000,"timeBetweenSpawns":800},
    {"waveNumber":2,"enemies":[{"enemyId":"enemy_runner","count":8,"spawnPointIndex":0},{"enemyId":"enemy_tank","count":3,"spawnPointIndex":0}],"spawnDelay":1000,"timeBetweenSpawns":700},
    {"waveNumber":3,"enemies":[{"enemyId":"enemy_runner","count":10,"spawnPointIndex":0},{"enemyId":"enemy_berserker","count":4,"spawnPointIndex":0},{"enemyId":"enemy_harpy","count":3,"spawnPointIndex":0}],"spawnDelay":1000,"timeBetweenSpawns":600}
]
waves2 = [
    {"waveNumber":1,"enemies":[{"enemyId":"enemy_runner","count":8,"spawnPointIndex":0},{"enemyId":"enemy_runner","count":5,"spawnPointIndex":1}],"spawnDelay":800,"timeBetweenSpawns":600},
    {"waveNumber":2,"enemies":[{"enemyId":"enemy_tank","count":4,"spawnPointIndex":0},{"enemyId":"enemy_berserker","count":5,"spawnPointIndex":1},{"enemyId":"enemy_harpy","count":5,"spawnPointIndex":0}],"spawnDelay":800,"timeBetweenSpawns":500},
    {"waveNumber":3,"enemies":[{"enemyId":"enemy_dark_mage","count":4,"spawnPointIndex":0},{"enemyId":"enemy_shield","count":3,"spawnPointIndex":1},{"enemyId":"enemy_wyvern","count":3,"spawnPointIndex":0}],"spawnDelay":800,"timeBetweenSpawns":500},
    {"waveNumber":4,"enemies":[{"enemyId":"enemy_ground_boss","count":1,"spawnPointIndex":0},{"enemyId":"enemy_runner","count":15,"spawnPointIndex":1}],"spawnDelay":500,"timeBetweenSpawns":400}
]
waves3 = [
    {"waveNumber":1,"enemies":[{"enemyId":"enemy_runner","count":12,"spawnPointIndex":0},{"enemyId":"enemy_harpy","count":6,"spawnPointIndex":1}],"spawnDelay":600,"timeBetweenSpawns":500},
    {"waveNumber":2,"enemies":[{"enemyId":"enemy_tank","count":5,"spawnPointIndex":0},{"enemyId":"enemy_wyvern","count":5,"spawnPointIndex":1},{"enemyId":"enemy_berserker","count":8,"spawnPointIndex":0}],"spawnDelay":600,"timeBetweenSpawns":400},
    {"waveNumber":3,"enemies":[{"enemyId":"enemy_dark_mage","count":6,"spawnPointIndex":0},{"enemyId":"enemy_healer","count":3,"spawnPointIndex":1},{"enemyId":"enemy_sky_boss","count":1,"spawnPointIndex":1}],"spawnDelay":500,"timeBetweenSpawns":400},
    {"waveNumber":4,"enemies":[{"enemyId":"enemy_shield","count":6,"spawnPointIndex":0},{"enemyId":"enemy_exploder","count":8,"spawnPointIndex":1},{"enemyId":"enemy_specter","count":5,"spawnPointIndex":0}],"spawnDelay":500,"timeBetweenSpawns":350},
    {"waveNumber":5,"enemies":[{"enemyId":"enemy_ground_boss","count":1,"spawnPointIndex":0},{"enemyId":"enemy_sky_boss","count":1,"spawnPointIndex":1},{"enemyId":"enemy_golem","count":3,"spawnPointIndex":0}],"spawnDelay":500,"timeBetweenSpawns":300}
]
waves4 = [
    {"waveNumber":1,"enemies":[{"enemyId":"enemy_runner","count":15,"spawnPointIndex":0},{"enemyId":"enemy_runner","count":15,"spawnPointIndex":1}],"spawnDelay":500,"timeBetweenSpawns":300},
    {"waveNumber":2,"enemies":[{"enemyId":"enemy_tank","count":6,"spawnPointIndex":0},{"enemyId":"enemy_berserker","count":10,"spawnPointIndex":1},{"enemyId":"enemy_harpy","count":8,"spawnPointIndex":2}],"spawnDelay":500,"timeBetweenSpawns":300},
    {"waveNumber":3,"enemies":[{"enemyId":"enemy_dark_mage","count":8,"spawnPointIndex":0},{"enemyId":"enemy_healer","count":4,"spawnPointIndex":1},{"enemyId":"enemy_wyvern","count":6,"spawnPointIndex":2},{"enemyId":"enemy_shield","count":5,"spawnPointIndex":0}],"spawnDelay":400,"timeBetweenSpawns":250},
    {"waveNumber":4,"enemies":[{"enemyId":"enemy_exploder","count":12,"spawnPointIndex":0},{"enemyId":"enemy_specter","count":8,"spawnPointIndex":1},{"enemyId":"enemy_flying_bomb","count":6,"spawnPointIndex":2}],"spawnDelay":400,"timeBetweenSpawns":200},
    {"waveNumber":5,"enemies":[{"enemyId":"enemy_golem","count":3,"spawnPointIndex":0},{"enemyId":"enemy_ground_boss","count":1,"spawnPointIndex":1},{"enemyId":"enemy_sky_boss","count":1,"spawnPointIndex":2}],"spawnDelay":300,"timeBetweenSpawns":200},
    {"waveNumber":6,"enemies":[{"enemyId":"enemy_titan","count":1,"spawnPointIndex":0},{"enemyId":"enemy_runner","count":20,"spawnPointIndex":1},{"enemyId":"enemy_harpy","count":15,"spawnPointIndex":2}],"spawnDelay":300,"timeBetweenSpawns":150}
]
waves5 = [
    {"waveNumber":1,"enemies":[{"enemyId":"enemy_runner","count":10,"spawnPointIndex":0},{"enemyId":"enemy_runner","count":10,"spawnPointIndex":1},{"enemyId":"enemy_runner","count":10,"spawnPointIndex":2},{"enemyId":"enemy_runner","count":10,"spawnPointIndex":3}],"spawnDelay":400,"timeBetweenSpawns":200},
    {"waveNumber":2,"enemies":[{"enemyId":"enemy_tank","count":5,"spawnPointIndex":0},{"enemyId":"enemy_berserker","count":8,"spawnPointIndex":1},{"enemyId":"enemy_dark_mage","count":6,"spawnPointIndex":2},{"enemyId":"enemy_harpy","count":12,"spawnPointIndex":3}],"spawnDelay":400,"timeBetweenSpawns":200},
    {"waveNumber":3,"enemies":[{"enemyId":"enemy_shield","count":6,"spawnPointIndex":0},{"enemyId":"enemy_healer","count":4,"spawnPointIndex":1},{"enemyId":"enemy_wyvern","count":8,"spawnPointIndex":2},{"enemyId":"enemy_exploder","count":10,"spawnPointIndex":3}],"spawnDelay":300,"timeBetweenSpawns":150},
    {"waveNumber":4,"enemies":[{"enemyId":"enemy_golem","count":4,"spawnPointIndex":0},{"enemyId":"enemy_ground_boss","count":1,"spawnPointIndex":1},{"enemyId":"enemy_sky_boss","count":1,"spawnPointIndex":2},{"enemyId":"enemy_specter","count":10,"spawnPointIndex":3}],"spawnDelay":300,"timeBetweenSpawns":150},
    {"waveNumber":5,"enemies":[{"enemyId":"enemy_titan","count":2,"spawnPointIndex":0},{"enemyId":"enemy_titan","count":2,"spawnPointIndex":2},{"enemyId":"enemy_flying_bomb","count":15,"spawnPointIndex":1},{"enemyId":"enemy_flying_bomb","count":15,"spawnPointIndex":3}],"spawnDelay":200,"timeBetweenSpawns":100}
]

levels = [
    {"id":"level_1","name":"Pradera del Inicio","cols":COLS,"rows":ROWS,"tiles":g1,
     "spawnPoints":[{"x":s[0],"y":s[1]} for s in spawns1],"exitPoint":{"x":exit1[0],"y":exit1[1]},"waves":waves1},
    {"id":"level_2","name":"Bosque Encantado","cols":COLS,"rows":ROWS,"tiles":g2,
     "spawnPoints":[{"x":s[0],"y":s[1]} for s in spawns2],"exitPoint":{"x":exit2[0],"y":exit2[1]},"waves":waves2},
    {"id":"level_3","name":"Montaña del Dragón","cols":COLS,"rows":ROWS,"tiles":g3,
     "spawnPoints":[{"x":s[0],"y":s[1]} for s in spawns3],"exitPoint":{"x":exit3[0],"y":exit3[1]},"waves":waves3},
    {"id":"level_4","name":"Abismo Oscuro","cols":COLS,"rows":ROWS,"tiles":g4,
     "spawnPoints":[{"x":s[0],"y":s[1]} for s in spawns4],"exitPoint":{"x":exit4[0],"y":exit4[1]},"waves":waves4},
    {"id":"level_5","name":"Trono del Caos","cols":COLS,"rows":ROWS,"tiles":g5,
     "spawnPoints":[{"x":s[0],"y":s[1]} for s in spawns5],"exitPoint":{"x":exit5[0],"y":exit5[1]},"waves":waves5},
]

with open('D:/claude_cosas/tower_defense/src/data/levels.json', 'w') as f:
    json.dump(levels, f)

print("Saved levels.json")

# Print ascii preview
for lvl in levels:
    print(f"\n{lvl['name']}:")
    chars = {0:'.', 1:' ', 2:'#', 3:'~', 4:'S', 5:'E'}
    for row in lvl['tiles']:
        print(''.join(chars.get(t, '?') for t in row))
