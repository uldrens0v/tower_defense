# 🏰 PLAN DE DESARROLLO — Tower Defense RPG con Calabozos y RNG Evolutivo

> **Objetivo:** Desarrollar un tower defense con progresión RPG profunda, calabozos de farmeo, sistema de rareza extrema y estrategias de comandante.
> **Modelo:** Claude Opus via Claude Code
> **Stack sugerido:** TypeScript + Phaser 3 (motor de juego 2D) + Vite + LocalStorage para persistencia

---

## 📐 ARQUITECTURA GENERAL DEL PROYECTO

```
tower-defense-rpg/
├── src/
│   ├── core/               # Motor del juego (loop, escenas, eventos)
│   ├── entities/
│   │   ├── characters/     # Personajes defensores (stats, rareza, habilidades)
│   │   ├── enemies/        # Enemigos (aéreos, terrestres, élite)
│   │   └── towers/         # Defensas construibles
│   ├── systems/
│   │   ├── rng/            # Sistema de rareza y drops
│   │   ├── combat/         # Lógica de combate y targeting IA
│   │   ├── dungeon/        # Generación de calabozos
│   │   ├── progression/    # Niveles, evolución, stats escalables
│   │   └── commander/      # Formaciones y estrategias
│   ├── ui/                 # HUD, inventario, menús
│   ├── data/               # JSON de personajes, enemigos, ítems
│   └── scenes/             # Tower Defense, Calabozo, Mapa, Tienda
├── public/
│   └── assets/             # Sprites, audio, tilesets
└── PLAN_tower_defense.md
```

---

## 🔢 FASE 0 — SCAFFOLDING Y SETUP (Paso 1)

**Prompt para Claude Code:**
```
Crea un proyecto con Vite + TypeScript + Phaser 3. Configura:
- tsconfig estricto
- Estructura de carpetas según la arquitectura definida
- Escena principal "GameScene" vacía con loop básico
- Sistema de eventos global con EventEmitter
- Pantalla de carga de assets placeholder
```

**Entregables:**
- [ ] Proyecto corriendo en localhost con Phaser 3
- [ ] Escena de carga funcional
- [ ] EventEmitter central configurado

---

## 📊 FASE 1 — SISTEMA DE PERSONAJES Y RAREZA (Paso 2)

### 1.1 Definición de Rarezas

| Rareza | Drop Rate | Color | Multiplicador de Stats | Particularidades |
|--------|-----------|-------|------------------------|------------------|
| Común | 60% | Gris | ×1.0 | Stats equilibrados |
| Poco Común | 25% | Verde | ×1.3 | +1 stat destacado |
| Raro | 10% | Azul | ×1.7 | Pasiva básica |
| Épico | 4% | Morado | ×2.5 | Pasiva fuerte |
| Legendario | 0.9% | Naranja | ×4.0 | Habilidad definitiva parcial |
| Mítico | 0.099% | Rojo | ×7.0 | Definitiva + aura |
| **Único** | **1 en 1.000.000** | Arcoíris animado | ×15.0 | Rompe reglas del juego |

**Prompt para Claude Code:**
```
Crea el sistema de rareza en src/systems/rng/RaritySystem.ts:
- Enum RarityTier con los 7 niveles
- Función rollRarity() con las probabilidades exactas usando RNG seeded
- Función rollCharacter() que devuelve un CharacterData aleatorio ponderado por rareza
- El tier "Único" debe usar un roll separado de 1/1.000.000 antes del roll normal
- Tests unitarios para verificar distribución estadística en 1.000.000 de rolls
```

### 1.2 Estructura de Personaje

```typescript
interface CharacterData {
  id: string;
  name: string;
  rarity: RarityTier;
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    attackSpeed: number;
    range: number;
    moveSpeed: number;
  };
  statGrowthPerLevel: Record<keyof BaseStats, number>; // varía por rareza
  type: 'ground' | 'aerial' | 'support' | 'commander';
  requiredEquipment: string[];      // IDs de équipamiento para desbloquear definitiva
  ultimateSkill?: UltimateSkill;    // Solo disponible al nivel max con equipamiento
  passiveSkill?: PassiveSkill;
  maxLevel: number;                 // varía por rareza (Común: 30, Único: 100)
}
```

**Prompt para Claude Code:**
```
Implementa CharacterData, CharacterInstance (instancia en juego), y CharacterManager:
- CharacterInstance extiende CharacterData con nivel actual, XP, equipamiento equipado
- Sistema de cálculo de stats finales: baseStat + (statGrowth × level) × rarityMultiplier × equipmentBonuses
- Método canUnlockUltimate() que comprueba nivel mínimo Y equipamiento con buff activo
- Serialización/deserialización para LocalStorage
```

---

## 🗺️ FASE 2 — TORRE DEFENSE CORE (Paso 3)

### 2.1 Mapa y Grid

**Prompt para Claude Code:**
```
Implementa el sistema de mapa en Phaser 3:
- Grid de tiles configurable (ej: 32×18 tiles de 32px)
- Tiles de tipo: camino, construible, muro, decoración
- Carga desde JSON de nivel
- Highlight de tiles al colocar personajes/defensas
- Pathfinding A* para el camino de enemigos (pre-calculado al cargar nivel)
```

### 2.2 Sistema de Defensa — Terrestre vs Aéreo

```
Tipos de defensas:
- Terrestres: Solo atacan enemigos en suelo. Alta cadencia o daño.
- Aéreas: Solo atacan enemigos aéreos. Balistas, catapultas mágicas.
- Mixtas: Atacan ambos pero con penalización del 30% de daño.
- Muralla: No ataca. Es el objetivo final de los enemigos si no hay personajes.
```

**Prompt para Claude Code:**
```
Crea TowerEntity y DefenseSystem:
- Enum TargetType { GROUND, AERIAL, BOTH }
- Cada defensa tiene targetType que filtra qué enemigos puede atacar
- Sistema de ataque: busca enemigo más cercano dentro de range que sea compatible con targetType
- Proyectiles con hitbox y efectos visuales diferenciados por tipo
- Si un enemigo AÉREO entra en rango de una defensa TERRESTRE, la defensa lo ignora completamente
```

### 2.3 IA de Enemigos

**Regla de oro:** El enemigo SIEMPRE va al personaje o unidad **más cercana**, sin importar su fuerza.

```
IA enemigo (por prioridad):
1. ¿Hay algún personaje/defensa en el mapa? → ir al más cercano (distancia euclidiana)
2. ¿No hay ninguno? → ir a la MURALLA principal
3. Al llegar → atacar hasta matar → recalcular objetivo más cercano
4. Enemigos AÉREOS ignoran obstáculos terrestres en su pathfinding
```

**Prompt para Claude Code:**
```
Implementa EnemyAI en src/systems/combat/EnemyAI.ts:
- Cada tick (cada 100ms), recalcula el objetivo más cercano entre: personajes activos + defensas activas
- Si la lista está vacía, objetivo = muralla principal
- Pathfinding diferenciado: aéreos usan línea recta con evasión suave, terrestres usan A*
- Al morir el objetivo actual, recalcula inmediatamente sin esperar al tick
- Sin memoria: no "recuerda" enemigos, solo distancia en tiempo real
- Performance: spatial hashing para búsqueda O(1) del más cercano
```

---

## 🏛️ FASE 3 — SISTEMA DE CALABOZOS (Paso 4)

### 3.1 Flujo de Juego

```
[Ola de enemigos] → [Descanso entre olas] → [Portal a Calabozo] → [Explorar/Farmear] → [Volver] → [Siguiente ola]
```

### 3.2 Generación Procedural de Calabozos

**Prompt para Claude Code:**
```
Crea DungeonGenerator en src/systems/dungeon/:
- Algoritmo BSP (Binary Space Partitioning) para generar habitaciones conectadas
- Tipos de habitación: combate, cofre, élite, boss, descanso
- Dificultad escala con el número de ola actual del tower defense
- Cada calabozo tiene 5-12 habitaciones según dificultad
- Semilla aleatoria reproducible para debugging
```

### 3.3 Sistema de Cofres y Drops

```
Tipos de cofre:
- Madera (común): 1 ítem común-poco común
- Hierro: 1-2 ítems hasta Raro
- Oro: 2 ítems hasta Épico + posibilidad de personaje
- Cristal: 2-3 ítems hasta Legendario + alta posibilidad personaje
- Arcoíris (rarísimo): Garantiza Épico+, posibilidad real de Mítico/Único
```

**Prompt para Claude Code:**
```
Implementa ChestSystem y LootTable:
- Cada cofre tiene una LootTable con pesos por rareza
- Al abrir: roll de número de ítems → roll de rareza para cada ítem → roll del ítem específico en esa rareza
- Animación de apertura con reveal dramático de rareza (flash de color)
- Historial de drops persistido en LocalStorage para estadísticas del jugador
- Cofre Arcoíris: probabilidad de aparición = 1/500 habitaciones de cofre
```

### 3.4 Equipamiento y Buff para Definitiva

```
Mecánica clave:
- Cada personaje tiene 1-3 piezas de equipamiento "vinculadas" a él
- Con el equipamiento equipado → stats mejoran (buff pasivo)
- Con TODAS las piezas equipadas + nivel suficiente → se desbloquea la DEFINITIVA
- El equipamiento vinculado es más raro cuanto más rara sea la definitiva del personaje
```

**Prompt para Claude Code:**
```
Implementa EquipmentSystem:
- ItemData con: id, name, rarity, linkedCharacterId (opcional), stats bonus, buffDescription
- CharacterInstance.equipItem(item): calcula si se cumplen condiciones para definitiva
- Método checkUltimateUnlock(): nivel >= ultimateMinLevel AND todos linkedItems equipados con buff activo
- UI de equipamiento con slots visuales y indicador de progreso hacia definitiva
```

---

## ⚔️ FASE 4 — SISTEMA DE COMANDANTE Y FORMACIONES (Paso 5)

### 4.1 Rol del Comandante

El Comandante es una unidad especial que no ataca directamente pero activa formaciones de equipo.

### 4.2 Formaciones

| Formación | Descripción | Efecto |
|-----------|-------------|--------|
| **Cuña (▽)** | Personajes en triángulo apuntando al frente | +20% daño frontal, -15% flancos |
| **V invertida (^)** | Personajes flanqueando, centro abierto | Atrae enemigos al centro, AoE bonus |
| **Barrera (━)** | Línea horizontal | +40% defensa, -20% velocidad de ataque |
| **Círculo (○)** | Rodean un punto | 360° defensa, ideal para proteger torre |
| **Dispersión** | Máxima separación | Reduce daño AoE recibido |

**Prompt para Claude Code:**
```
Implementa CommanderSystem y FormationManager:
- FormationType enum con las 5 formaciones
- Al activar formación: reposicionar personajes automáticamente en el grid según patrón
- Aplicar buffs/debuffs de formación como modificadores temporales de stats
- Solo 1 Comandante por equipo; si muere, formación se mantiene hasta próxima ola
- UI: rueda de formaciones activable con tecla/botón del Comandante
- Cooldown de cambio de formación: 30 segundos
```

---

## 📈 FASE 5 — PROGRESIÓN Y EVOLUCIÓN (Paso 6)

### 5.1 Escalado de Stats por Rareza

```
Fórmula: StatFinal = (BaseStat + StatGrowth × Level) × RarityMult × EquipmentMult

StatGrowth por rareza (ejemplo para HP):
- Común:     +8 HP/nivel
- Poco Común: +12 HP/nivel
- Raro:       +18 HP/nivel
- Épico:      +28 HP/nivel
- Legendario: +45 HP/nivel
- Mítico:     +80 HP/nivel
- Único:      +150 HP/nivel (con curva exponencial en últimos 10 niveles)
```

### 5.2 Niveles Máximos

```
- Común:       Nivel 30
- Poco Común:  Nivel 40
- Raro:        Nivel 50
- Épico:       Nivel 60
- Legendario:  Nivel 75
- Mítico:      Nivel 90
- Único:       Nivel 100
```

**Prompt para Claude Code:**
```
Implementa ProgressionSystem:
- XPCurve: array precalculado de XP necesaria por nivel, con curva exponencial suave
- Al subir nivel: recalcular todos los stats finales, notificar si se desbloquea definitiva
- Evolución visual: al llegar a ciertos hitos (25%, 50%, 75%, 100% del max level) cambiar sprite/aura del personaje
- Pantalla de level up con animación y resumen de stats ganados
```

---

## 🎮 FASE 6 — UI/UX (Paso 7)

**Prompt para Claude Code:**
```
Implementa las siguientes pantallas y HUD:

HUD en combate:
- Barra de vida de la muralla (prominente, centro arriba)
- Número de ola actual y timer hasta siguiente ola
- Recursos actuales (oro, cristales)
- Botón de formación del Comandante (si está vivo)
- Miniaturas de personajes activos con HP bar

Menú de descanso / entre olas:
- Botón "Entrar al Calabozo" con tiempo disponible
- Panel de mejora de personajes (subir nivel con recursos)
- Acceso al inventario y equipamiento

Pantalla de Calabozo:
- Vista top-down del mapa generado
- Habitaciones como nodos clicables
- Al entrar habitación de cofre: animación de apertura
- Inventario lateral con drag & drop para equipar

Pantalla de Colección:
- Galería de personajes ordenada por rareza
- Los no obtenidos aparecen como siluetas con "???"
- Barra de progreso hacia definitiva por personaje
```

---

## 🧪 FASE 7 — CONTENIDO INICIAL (Paso 8)

**Prompt para Claude Code:**
```
Crea el contenido base en src/data/ como archivos JSON:

characters.json: 20 personajes con distribución de rareza natural
- 8 Comunes, 5 Poco Comunes, 3 Raros, 2 Épicos, 1 Legendario, 1 Mítico
- El Único NO está en el JSON base; se genera proceduralmente al hacer el roll de 1/1M

enemies.json: 15 tipos de enemigos
- 8 terrestres (corredor, tanque, berserker, mago, curandero, explosor, escudo, jefe)
- 5 aéreos (arpía, dragón menor, espectro, bomba voladora, jefe aéreo)
- 2 mixtos (golem flotante, titán)

items.json: 60 ítems de equipamiento
- 10 por rareza (Común a Mítico)
- 5 de ellos vinculados a personajes específicos (legendarios+)

levels.json: 5 niveles del tower defense
- Cada nivel con su JSON de mapa, olas de enemigos y progresión de dificultad
```

---

## 🔧 FASE 8 — POLISH Y OPTIMIZACIÓN (Paso 9)

**Prompt para Claude Code:**
```
Optimizaciones y polish final:
- Object pooling para proyectiles y partículas (Phaser Groups)
- Spatial hashing para detección de colisiones eficiente
- Frustum culling: no renderizar entidades fuera de pantalla
- Sistema de partículas para: muerte de enemigos, level up, apertura de cofres, activación de definitiva
- Música y SFX: sistema de audio con categorías (combate, calabozo, menú, rareza_reveal)
- Guardar y cargar partida completa con LocalStorage
- Pantalla de estadísticas: horas jugadas, rolls realizados, drop más raro obtenido
```

---

## 🚀 ORDEN DE EJECUCIÓN PARA CLAUDE CODE

```bash
# Ejecutar en este orden exacto, verificando que cada fase compila y funciona antes de continuar:

1. claude "Ejecuta FASE 0: Setup del proyecto con Vite + TypeScript + Phaser 3"
2. claude "Ejecuta FASE 1.1: Sistema de rareza RaritySystem con tests estadísticos"
3. claude "Ejecuta FASE 1.2: CharacterData, CharacterInstance y CharacterManager"
4. claude "Ejecuta FASE 2.1: Mapa con grid, tiles y pathfinding A*"
5. claude "Ejecuta FASE 2.2: DefenseSystem con separación terrestre/aéreo"
6. claude "Ejecuta FASE 2.3: EnemyAI con targeting al más cercano y spatial hashing"
7. claude "Ejecuta FASE 3.1-3.2: DungeonGenerator con BSP"
8. claude "Ejecuta FASE 3.3: ChestSystem y LootTable con animaciones"
9. claude "Ejecuta FASE 3.4: EquipmentSystem y condición de definitiva"
10. claude "Ejecuta FASE 4: CommanderSystem y 5 formaciones con reposicionamiento"
11. claude "Ejecuta FASE 5: ProgressionSystem con curva de XP y evolución visual"
12. claude "Ejecuta FASE 6: UI completa — HUD, menús, calabozo, colección"
13. claude "Ejecuta FASE 7: Contenido base — JSONs de personajes, enemigos, ítems, niveles"
14. claude "Ejecuta FASE 8: Optimización con object pooling, partículas y guardado"
```

---

## ⚠️ REGLAS CRÍTICAS PARA CLAUDE CODE (leer antes de cada fase)

1. **Nunca avances si la fase anterior no compila.** Ejecuta `tsc --noEmit` antes de cada nueva fase.
2. **El roll del Único** debe ser una función separada e independiente que se llama ANTES del roll normal.
3. **La IA de enemigos NO tiene memoria:** recalcula distancias cada tick desde cero.
4. **Los aéreos ignoran defensas terrestres y viceversa:** comprobación estricta de TargetType.
5. **La definitiva SOLO se activa** si `level >= ultimateMinLevel` AND todos los `requiredEquipment` están equipados con buff activo. Sin excepciones.
6. **El Comandante no ataca.** Si Claude Code lo implementa atacando, es un bug.
7. **Performance primero en EnemyAI:** spatial hashing obligatorio, no O(n²) aunque el mapa sea pequeño.
8. **Persistencia completa:** cada progreso se guarda automáticamente al completar una acción importante (ola, cofre, level up).

---

## 📋 CHECKLIST DE VERIFICACIÓN FINAL

- [ ] 1 millón de rolls estadísticamente distribuidos correctamente
- [ ] Roll de 1/1.000.000 implementado y verificado
- [ ] Enemigo aéreo ignorado por defensa terrestre (test manual)
- [ ] Enemigo va a muralla si no hay personajes (test manual)
- [ ] Definitiva NO se activa sin el equipamiento (test unitario)
- [ ] Cambio de formación reposiciona personajes en el grid
- [ ] Calabozo generado proceduralmente sin habitaciones sin salida
- [ ] Guardar/cargar partida sin pérdida de datos
- [ ] 60 FPS estables con 50 enemigos en pantalla (Phaser debug stats)
