# Tower Defense RPG

Juego **Tower Defense + RPG + Dungeon** desarrollado con **TypeScript**, **Phaser 3**, **Vite** y soporte Android vía **Capacitor**.

## Requisitos

- Node.js 20+
- npm

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
npm run build:android
npm run open:android
```

## Estructura del proyecto

```text
.
├── src/
│   ├── main.ts                    # Entrada del juego y ajustes mobile/fullscreen
│   ├── core/
│   │   ├── GameConfig.ts          # Configuración Phaser (escenas, escala, física)
│   │   ├── Constants.ts           # Tamaño de grid, canvas y offsets
│   │   ├── GridMap.ts             # Mapa, tiles y pathfinding A*
│   │   ├── EventBus.ts            # Bus global de eventos
│   │   ├── SaveSystem.ts          # Guardado/carga en localStorage
│   │   ├── SoundFX.ts             # Efectos de sonido
│   │   └── ThemeMusic.ts          # Música por contexto
│   ├── scenes/
│   │   ├── BootScene.ts           # Carga de assets y texturas auxiliares
│   │   ├── PreloadScene.ts        # Pantalla de carga
│   │   └── GameScene.ts           # Escena principal y orquestación del juego
│   ├── entities/
│   │   ├── towers/TowerEntity.ts          # Datos de torres y reglas de objetivo
│   │   ├── enemies/EnemyData.ts            # Datos/instancias de enemigos
│   │   └── characters/
│   │       ├── CharacterData.ts            # Personajes, stats, XP y definitiva
│   │       └── CharacterManager.ts         # Gestión de colección y pool de personajes
│   ├── systems/
│   │   ├── combat/
│   │   │   ├── DefenseSystem.ts            # Ataques de torres y proyectiles
│   │   │   ├── EnemyAI.ts                  # Movimiento por ruta y separación de enemigos
│   │   │   ├── TroopSystem.ts              # IA de tropas y ultimates
│   │   │   └── SpatialHash.ts              # Optimización espacial
│   │   ├── commander/CommanderSystem.ts    # Formaciones y buffs/debuffs
│   │   ├── progression/ProgressionSystem.ts# Curva XP y evolución por etapas
│   │   ├── dungeon/
│   │   │   ├── DungeonGenerator.ts         # Generación procedural BSP
│   │   │   ├── ChestSystem.ts              # Cofres, loot e historial de drops
│   │   │   └── EquipmentSystem.ts          # Inventario/equipamiento y progreso de ultimate
│   │   └── rng/RaritySystem.ts             # Rarezas y RNG seeded
│   ├── ui/
│   │   ├── HUD.ts                  # HUD de ola, recursos y muro
│   │   ├── TroopSidePanel.ts       # Panel lateral de tropas
│   │   ├── MenuPanel.ts            # Menú de pausa/opciones
│   │   ├── DungeonUI.ts            # Interfaz de calabozo
│   │   ├── CollectionUI.ts         # Colección de personajes
│   │   ├── TutorialPanel.ts        # Tutorial inicial
│   │   └── DungeonChallenges.ts    # Minijuegos de dungeon
│   └── data/
│       ├── characters.json         # Personajes jugables
│       ├── enemies.json            # Tipos de enemigos
│       ├── items.json              # Equipamiento
│       └── levels.json             # Niveles, tiles, spawns y olas
├── public/assets/                  # Sprites, música y SFX
├── android/                        # Proyecto nativo Android (Capacitor)
└── package.json                    # Scripts de ejecución/build
```

## Lógica del juego

### 1) Flujo de ejecución

1. `src/main.ts` crea el juego Phaser con `gameConfig`.
2. Escenas en orden: `BootScene` → `PreloadScene` → `GameScene`.
3. `GameScene` inicializa sistemas, carga datos JSON y maneja el loop principal.

### 2) Estados principales de la partida

En `GameScene` se usa una máquina de estados:

- `preparing`
- `playing`
- `between_waves`
- `dungeon`
- `victory`
- `game_over`

### 3) Mapa y olas

- El mapa es un grid (`GridMap`) con tiles (`path`, `buildable`, `wall`, etc.).
- El path de enemigos se calcula con A* (`findPath`).
- Cada nivel (`levels.json`) define:
  - dimensiones del mapa
  - `spawnPoints`
  - `exitPoint`
  - lista de `waves` (qué enemigos salen y tiempos de spawn)

### 4) Combate torre vs enemigo

### Torres (`DefenseSystem` + `TowerEntity`)

- Cada torre tiene `targetType`: `ground`, `aerial` o `both`.
- Selecciona el enemigo más cercano dentro del rango.
- Si es `both`, aplica penalización de daño (`0.7`).
- Daño escala con nivel de torre.
- Soporta proyectiles directos y daño en área (`aoeRadius`).

### IA de enemigos (`EnemyAI`)

- Cada enemigo avanza por su ruta de tiles hacia salida.
- Se aplica separación para evitar amontonamiento (`SEPARATION_DIST`).
- Si llega al final, emite `enemy:reached_end` y daña el muro.

### Tropas (`TroopSystem`)

- Cada personaje se coloca solo una vez.
- Estados: `idle`, `patrol`, `attacking`, `returning`.
- Tienen ataque melee/ranged según `range`.
- Acumulan carga de definitiva (`ultimateCharge`) y activan ultimates según reglas del personaje.

### 5) Progresión RPG

### Rareza (`RaritySystem`)

Rarezas disponibles:

- common
- uncommon
- rare
- epic
- legendary
- mythic
- unique

Regla especial: `unique` tiene tirada separada (1 en 1,000,000) antes del roll normal.

### Niveles y evolución (`ProgressionSystem`)

- Curva de XP: `100 * level^1.5`.
- Emite eventos de level up y evolución visual por etapas.
- Verifica desbloqueo de ultimate al subir de nivel.

### 6) Sistema de comandante y formaciones

`CommanderSystem` permite activar formaciones con cooldown:

- `wedge`
- `v_inverted`
- `barrier`
- `circle`
- `dispersion`

Cada formación:

- reposiciona unidades
- aplica buffs/debuffs de stats

### 7) Dungeon, cofres y equipamiento

### Dungeon (`DungeonGenerator`)

- Generación procedural con BSP.
- Crea salas conectadas y les asigna tipo: `combat`, `chest`, `elite`, `boss`, `rest`.

### Cofres (`ChestSystem`)

Tipos de cofre: `wood`, `iron`, `gold`, `crystal`, `rainbow`.

- Define cantidad de drops, rareza máxima y chance de personaje.
- Guarda historial de drops en localStorage.

### Equipamiento (`EquipmentSystem`)

- Maneja base de ítems + inventario.
- Permite equipar/des-equipar a personajes.
- Comprueba progreso de requisitos para ultimate (nivel + equipamiento requerido).

### 8) Persistencia y eventos

- `SaveSystem` persiste progreso principal en `localStorage` (`td_rpg_save`).
- Inventario e historial de drops usan claves propias de localStorage.
- Los sistemas se comunican mediante `EventBus` (`eventBus.emit/on`).

### 9) Datos del juego (data-driven)

Los archivos en `src/data/*.json` controlan el balance base del juego:

- `characters.json`: stats base, crecimiento, skills y requisitos
- `enemies.json`: tipos enemigos (HP, daño, velocidad, recompensas)
- `items.json`: bonus de equipamiento por rareza
- `levels.json`: mapas y olas

Este diseño permite ajustar balance sin cambiar lógica TypeScript.

## Desarrollo

Para trabajar en local:

1. `npm install`
2. `npm run dev`
3. abrir la URL de Vite (normalmente `http://localhost:5173`)

Para validar compilación:

```bash
npm run build
```
