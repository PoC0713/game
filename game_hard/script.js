const N = 30, MAX = 50; const T = { B: 'barren', S: 'swamp', G: 'grass', F: 'forest', W: 'water-source', L: 'waterway' };
const cost = { waterway: 1, purification: 3, greening: 5, planting: 10 };
const state = { status: 'PLAYING', speed: 1, resource: 20, undo: null, map: [], selected: null, greeningUnlocked: false, plantingUsed: false, waterwayPending: null, last: performance.now(), zero: 0, clearTimer: 0, fish: [], fishTimer: null, waterwaySwampTimer: 0, animals: { fish: [], frog: [], insect: [], rabbit: [], snake: [], bird: [], bee: [], deer: [], bear: [] }, animalTimers: { fish: null, frog: 0, insect: 0, rabbit: 0, snake: 0, bird: 0, bee: 0, deer: 0, bear: 0 }, moveTimers: { fish: 0, frog: 0, insect: 0, rabbit: 0, snake: 0, bird: 0, bee: 0, deer: 0, bear: 0 } };

const $ = id => document.getElementById(id);
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
function tile(x, y) { return inside(x, y) ? state.map[y][x] : null }
function all() { return state.map.flat() }

function saveUndo() {
  state.undo = {
    map: structuredClone(state.map),
    resource: state.resource,
    greeningUnlocked: state.greeningUnlocked,
    plantingUsed: state.plantingUsed,
  };
}

function neigh8(x, y) {
  const a = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if ((dx || dy) && inside(x + dx, y + dy)) a.push({ x: x + dx, y: y + dy });
  return a
}

function count(t) {
  return all().filter(q => q.terrain === t && !q.device).length
}

function sources() {
  return all().filter(q => q.terrain === T.W).length
}

/* ===== 魚 ===== */

function fishCapacity() {
  return Math.floor(count(T.L) / 3 * 1)
}

function spawnFish() {
  if (state.animals.fish.length >= Math.min(80, fishCapacity())) return;

  const spots = all().filter(q => q.terrain === T.L && !q.device && !q.fish);

  if (!spots.length) return;

  const q = spots[Math.floor(Math.random() * spots.length)];

  state.animals.fish.push({ x: q.x, y: q.y });
  q.fish = true;
}

/* ===== カエル ===== */

function updateFrogs(dt) {
  if (count(T.S) <= 0) {
    state.animalTimers.frog = 0;
    return
  }

  if (state.animals.frog.length >= Math.min(80, Math.floor(count(T.S) / 3))) return;

  state.animalTimers.frog += dt;

  if (state.animalTimers.frog >= 15) {
    state.animalTimers.frog -= 15;

    const spots = all().filter(q => q.terrain === T.S && !q.device);

    if (spots.length) {
      const q = spots[Math.floor(Math.random() * spots.length)];
      state.animals.frog.push({ x: q.x, y: q.y });
      q.frog = true;
      render();
    }
  }
}

/* ===== 蝶 ===== */

function updateInsects(dt) {
  if (state.animals.frog.length < 5) {
    state.animalTimers.insect = 0;
    return
  }

  if (state.animals.insect.length >= Math.min(80, Math.floor((count(T.S) + count(T.G)) / 3))) return;

  state.animalTimers.insect += dt;

  if (state.animalTimers.insect >= 20) {
    state.animalTimers.insect -= 20;

    const spots = all().filter(q => (q.terrain === T.S || q.terrain === T.G) && !q.device && !q.frog && !q.insect);

    if (spots.length) {
      const q = spots[Math.floor(Math.random() * spots.length)];
      state.animals.insect.push({ x: q.x, y: q.y });
      q.insect = true;
      render();
    }
  }
}

/* ===== 草地内部値の進行 ===== */
function updateGrassValues(dt) {
  let g0 = all().filter(q => q.terrain === T.G && (q.grassValue ?? 0) === 0);
  updateGrassValues.t0 = (updateGrassValues.t0 || 0) + dt;
  if (g0.length && updateGrassValues.t0 >= 10) {
    updateGrassValues.t0 -= 10;
    g0[Math.floor(Math.random() * g0.length)].grassValue = 1;
  } else if (!g0.length) updateGrassValues.t0 = 0;

  let g1 = all().filter(q => q.terrain === T.G && (q.grassValue ?? 0) === 1);
  if (state.animals.insect.length >= 5 && g1.length) {
    updateGrassValues.t1 = (updateGrassValues.t1 || 0) + dt;
    if (updateGrassValues.t1 >= 15) {
      updateGrassValues.t1 -= 15;
      g1[Math.floor(Math.random() * g1.length)].grassValue = 2;
    }
  } else updateGrassValues.t1 = 0;

  let g2 = all().filter(q => q.terrain === T.G && (q.grassValue ?? 0) === 2);
  let landInsects = state.animals.insect.filter(a => {
    const q = tile(a.x, a.y);
    return q && q.terrain === T.G;
  }).length;
  if (landInsects >= 3 && g2.length) {
    updateGrassValues.t2 = (updateGrassValues.t2 || 0) + dt;
    if (updateGrassValues.t2 >= 20) {
      updateGrassValues.t2 -= 20;
      g2[Math.floor(Math.random() * g2.length)].grassValue = 3;
    }
  } else updateGrassValues.t2 = 0;

  let g3 = all().filter(q => q.terrain === T.G && (q.grassValue ?? 0) === 3);
  if (state.animals.bird.length >= 1 && g3.length) {
    updateGrassValues.t3 = (updateGrassValues.t3 || 0) + dt;
    if (updateGrassValues.t3 >= 25) {
      updateGrassValues.t3 -= 25;
      g3[Math.floor(Math.random() * g3.length)].grassValue = 4;
    }
  } else updateGrassValues.t3 = 0;

  let g4 = all().filter(q => q.terrain === T.G && (q.grassValue ?? 0) === 4);

  if (state.plantingUsed && g4.length) {
    updateGrassValues.t4 = (updateGrassValues.t4 || 0) + dt;

    if (updateGrassValues.t4 >= 40) {
      updateGrassValues.t4 -= 40;

      const q = g4[Math.floor(Math.random() * g4.length)];
      terrain(q, T.F);
    }
  } else {
    updateGrassValues.t4 = 0;
  }
}

/* ===== ウサギ・ヘビ・鳥・ハチ・シカ・クマ ===== */

function spawnRabbit(dt) {
  if (state.animals.frog.length < 10 || count(T.G) < 16) { state.animalTimers.rabbit = 0; return }
  if (state.animals.rabbit.length >= Math.min(40, Math.floor(count(T.G) / 16))) return;
  state.animalTimers.rabbit += dt;
  if (state.animalTimers.rabbit < 30) return;
  state.animalTimers.rabbit -= 30;
  const spots = all().filter(q => q.terrain === T.G && !q.device && !q.rabbit);
  if (spots.length) { const q = spots[Math.floor(Math.random() * spots.length)]; state.animals.rabbit.push({ x: q.x, y: q.y }); q.rabbit = true; render() }
}
function spawnSnake(dt) {
  if (state.animals.frog.length < 10) { state.animalTimers.snake = 0; return }
  if (state.animals.snake.length >= Math.min(28, Math.floor(count(T.G) / 25))) return;
  state.animalTimers.snake += dt;
  if (state.animalTimers.snake < 40) return;
  state.animalTimers.snake -= 40;
  const spots = all().filter(q => q.terrain === T.G && !q.device && !q.snake);
  if (spots.length) { const q = spots[Math.floor(Math.random() * spots.length)]; state.animals.snake.push({ x: q.x, y: q.y }); q.snake = true; render() }
}
function spawnBird(dt) {
  if (!all().some(q => q.terrain === T.G && (q.grassValue ?? 0) >= 3)) { state.animalTimers.bird = 0; return }
  if (state.animals.bird.length >= 5) return;
  state.animalTimers.bird += dt;
  if (state.animalTimers.bird < 20) return;
  state.animalTimers.bird -= 20;
  if (Math.random() > 0.25) return;
  const spots = all().filter(q => (q.terrain === T.G || q.terrain === T.F) && !q.device && !q.bird);
  if (spots.length) { const q = spots[Math.floor(Math.random() * spots.length)]; state.animals.bird.push({ x: q.x, y: q.y }); q.bird = true; render() }
}
function spawnBee(dt) {
  if (count(T.F) < 15) { state.animalTimers.bee = 0; return }
  if (state.animals.bee.length >= 5) return;
  state.animalTimers.bee += dt;
  if (state.animalTimers.bee < 30) return;
  state.animalTimers.bee -= 30;
  if (Math.random() > 0.2) return;
  const spots = all().filter(q => q.terrain === T.F && !q.device && !q.bee);
  if (spots.length) { const q = spots[Math.floor(Math.random() * spots.length)]; state.animals.bee.push({ x: q.x, y: q.y }); q.bee = true; render() }
}
function spawnDeer(dt) {
  if (count(T.F) < 15) { state.animalTimers.deer = 0; return }
  if (state.animals.deer.length >= Math.min(21, count(T.F))) return;
  state.animalTimers.deer += dt;
  if (state.animalTimers.deer < 30) return;
  state.animalTimers.deer -= 30;
  const spots = all().filter(q => q.terrain === T.F && !q.device && !q.deer);
  if (spots.length) { const q = spots[Math.floor(Math.random() * spots.length)]; state.animals.deer.push({ x: q.x, y: q.y }); q.deer = true; render() }
}
function spawnBear(dt) {
  if (state.animals.bee.length < 1 || count(T.F) < 60 || state.animals.deer.length < 9) { state.animalTimers.bear = 0; return }
  if (state.animals.bear.length >= 5) return;
  state.animalTimers.bear += dt;
  if (state.animalTimers.bear < 40) return;
  state.animalTimers.bear -= 40;
  if (Math.random() > 0.20 + 0.05 * state.animals.bee.length) return;
  const spots = all().filter(q => q.terrain === T.F && !q.device && !q.bear);
  if (spots.length) { const q = spots[Math.floor(Math.random() * spots.length)]; state.animals.bear.push({ x: q.x, y: q.y }); q.bear = true; render() }
}

/* ===== 生物の移動・捕食 ===== */

const moveInterval = { fish: 10, frog: 15, insect: 20, rabbit: 20, snake: 15, bird: 40, bee: 30, deer: 40, bear: 50 };
const moveHabitat = {
  fish: q => q.terrain === T.L,
  frog: q => q.terrain === T.S,
  insect: q => q.terrain === T.S || q.terrain === T.G,
  rabbit: q => q.terrain === T.G,
  snake: q => q.terrain === T.G,
  bird: q => q.terrain === T.G || q.terrain === T.F,
  bee: q => q.terrain === T.G || q.terrain === T.F,
  deer: q => q.terrain === T.F,
  bear: q => q.terrain === T.F
};

function moveAnimal(species, a) {
  const q = tile(a.x, a.y);
  const ok = moveHabitat[species];
  if (!q || !ok(q)) {
    const candidates = all().filter(t => ok(t) && !t.device && !t[species]);
    if (!candidates.length) return;
    candidates.sort((u, v) => {
      const du = Math.abs(u.x - a.x) + Math.abs(u.y - a.y);
      const dv = Math.abs(v.x - a.x) + Math.abs(v.y - a.y);
      return du - dv;
    });
    const t = candidates[0];
    q && (q[species] = false);
    a.x = t.x; a.y = t.y; t[species] = true;
    return;
  }

  const spots = neigh8(a.x, a.y)
    .map(p => tile(p.x, p.y))
    .filter(t => ok(t) && !t.device && !t[species]);
  if (!spots.length) return;

  const t = spots[Math.floor(Math.random() * spots.length)];
  q[species] = false;
  a.x = t.x; a.y = t.y; t[species] = true;
}

function eatAdjacent(species, preySpecies) {
  let eaten = false;
  for (const predator of state.animals[species]) {
    const prey = state.animals[preySpecies].find(a =>
      Math.abs(a.x - predator.x) <= 1 && Math.abs(a.y - predator.y) <= 1
    );
    if (!prey) continue;
    const pq = tile(prey.x, prey.y);
    if (pq) pq[preySpecies] = false;
    state.animals[preySpecies] = state.animals[preySpecies].filter(a => a !== prey);
    eaten = true;
  }
  return eaten;
}

function updateAnimalMovement(dt) {
  let changed = false;

  for (const species of Object.keys(moveInterval)) {
    state.moveTimers[species] += dt;
    if (state.moveTimers[species] < moveInterval[species]) continue;
    state.moveTimers[species] -= moveInterval[species];

    const before = state.animals[species].map(a => `${a.x},${a.y}`).join('|');
    state.animals[species].forEach(a => moveAnimal(species, a));
    const after = state.animals[species].map(a => `${a.x},${a.y}`).join('|');
    if (before !== after) changed = true;

    if (species === 'snake' && eatAdjacent('snake', 'frog')) changed = true;
    if (species === 'bear' && eatAdjacent('bear', 'deer')) changed = true;
  }

  if (changed) render();
}

/* ===== 水路による自然湿地化 ＋ 魚 ===== */

function updateWaterway(dt) {
  const waterways = all().filter(q => q.terrain === T.L);

  if (!waterways.length) {
    state.waterwaySwampTimer = 0;
    state.fishTimer = null;
    return
  }

  /* 水路隣接の荒地を3秒ごとに1マス湿地化 */
  state.waterwaySwampTimer += dt;

  if (state.waterwaySwampTimer >= 3) {
    state.waterwaySwampTimer -= 3;

    const candidates = [];

    for (const w of waterways) {
      for (const p of neigh8(w.x, w.y)) {
        const q = tile(p.x, p.y);

        if (q && q.terrain === T.B && !q.device) {
          candidates.push(q)
        }
      }
    }

    if (candidates.length) {
      const q = candidates[Math.floor(Math.random() * candidates.length)];
      terrain(q, T.S)
    }
  }

  /* 最初の水路ができてから10秒後、その後10秒ごとに魚 */
  if (state.fishTimer === null) {
    state.fishTimer = 10
  }

  state.fishTimer += dt;

  if (state.fishTimer >= 10) {
    state.fishTimer -= 10;
    spawnFish()
  }
}

/* ===== 生物カウンター（現段階は魚のみ実装） ===== */

function animalCounts() {
  const c = state.animals;
  return {
    fish: c.fish.length,
    frog: c.frog.length,
    insect: c.insect.length,
    rabbit: c.rabbit.length,
    snake: c.snake.length,
    bird: c.bird.length,
    bee: c.bee.length,
    deer: c.deer.length,
    bear: c.bear.length
  }
}

function renderAnimalCounts() {
  const c = animalCounts();
  const el = document.querySelector('aside h2:nth-of-type(2)+p');

  if (el) {
    el.innerHTML = `
      <span title="水路3マスにつき魚1匹">🐟${c.fish}</span>
      <span title="湿地3マスにつきカエル1匹">🐸${c.frog}</span>
      <span title="カエル5匹以上">🦋${c.insect}</span>
      <span title="カエル10匹以上・草地16マスにつきウサギ1匹">🐰${c.rabbit}</span>
      <span title="カエル10匹以上・草地25マス以上">🐍${c.snake}</span>
      <span title="草地の内部値3以上※popでランダムに草地を森林化">🐦${c.bird}</span>
      <span title="森林15マス以上※popでハチミツ効果発動">🐝${c.bee}</span>
      <span title="森林15マス以上">🦌${c.deer}</span>
      <span title="ハチミツ効果・森林60マス以上・シカ9匹以上">🐻${c.bear}</span>
    `;
  }
}

function checkClear(dt) {
  const conditions =
    count(T.G) >= 460 &&
    count(T.F) >= 92 &&
    state.animals.fish.length >= 40 &&
    state.animals.rabbit.length >= 28 &&
    state.animals.insect.length >= 60 &&
    state.animals.snake.length >= 12 &&
    state.animals.deer.length >= 16 &&
    state.animals.bear.length >= 5 &&
    sources() >= 5 &&
    all().every(q => !q.device);

  if (conditions) {
    state.clearTimer += dt;
    if (state.clearTimer >= 30) {
      state.status = 'CLEAR';
      alert('GAME CLEAR! エコシステムが復元されました！');
    }
  } else {
    state.clearTimer = 0;
  }
}

function renderConditions() {
  const c = animalCounts();
  const values = {
    grass: [count(T.G), 460], forest: [count(T.F), 92], fish: [c.fish, 40], rabbit: [c.rabbit, 28],
    insect: [c.insect, 60], snake: [c.snake, 12], deer: [c.deer, 16], bear: [c.bear, 5], source: [sources(), 5],
    device: [all().filter(q => q.device).length, 0]
  };
  Object.entries(values).forEach(([key, [value, need]]) => {
    const el = document.getElementById(`cond-${key}`);
    if (!el) return;
    const ok =
      key === 'source'
        ? value >= 5
        : key === 'device'
          ? value === 0
          : value >= need;
    const labels = {
      grass: '🌿 草地', forest: '🌳 森', fish: '🐟 魚', rabbit: '🐰 ウサギ', insect: '🦋 昆虫',
      snake: '🐍 ヘビ', deer: '🦌 鹿', bear: '🐻 熊', source: '💧 水源', device: '🔧 人工物'
    };
    el.textContent = `${ok ? '✓' : '○'} ${labels[key]} ${value} / ${key === 'source' ? '5' : need}`;
  });
  const timer = document.getElementById('cond-time');
  if (timer) {
    const seconds = Math.min(30, state.clearTimer);
    timer.textContent = `${seconds >= 30 ? '✓' : '○'} ⏱️ 維持 ${seconds.toFixed(1)} / 30秒`;
  }
}

function updatePlantingButton() {
  const planting = document.querySelector('[data-device="planting"]');
  if (planting) planting.disabled = !plantingUnlocked();
}

function plantingUnlocked() {
  for (let y = 0; y < N - 2; y++) {
    for (let x = 0; x < N - 2; x++) {
      let ok = true;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const q = tile(x + dx, y + dy);
          if (!q || q.terrain !== T.G) ok = false;
        }
      }
      if (ok) return true;
    }
  }
  return false;
}

/* ===== マップ ===== */

function make() {
  state.map = Array.from(
    { length: N },
    (_, y) => Array.from(
      { length: N },
      (_, x) => ({
        x,
        y,
        terrain: T.B,
        grassValue: null,
        device: null,
        fish: false,
        frog: false,
        insect: false,
        rabbit: false,
        snake: false,
        bird: false,
        bee: false,
        deer: false,
        bear: false
      })
    )
  );

  let pool = all().sort(() => Math.random() - .5),
    n = 3 + Math.floor(Math.random() * 2);

  const validSource = q =>
    all().every(t => {
      if (t.terrain !== T.W) return true;
      return Math.max(Math.abs(t.x - q.x), Math.abs(t.y - q.y)) > 2;
    }) &&
    neigh8(q.x, q.y).every(p => tile(p.x, p.y).terrain !== T.W) &&
    [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => inside(q.x + dx, q.y + dy)).filter(([dx, dy]) => {
      const t = tile(q.x + dx, q.y + dy);
      return t && t.terrain === T.B && !t.device;
    }).length >= 2;

  // 四辺に水源を1つずつ、位置はランダム
  const fixed = [
    [4 + Math.floor(Math.random() * 22), 3],   // 上
    [26, 4 + Math.floor(Math.random() * 22)],  // 右
    [4 + Math.floor(Math.random() * 22), 26],  // 下
    [3, 4 + Math.floor(Math.random() * 22)]    // 左
  ];

  fixed.forEach(([x, y]) => {
    tile(x, y).terrain = T.W;
  });

  // 中央4マスのどこかに水源を1つ
  const center = [
    [14, 14],
    [15, 14],
    [14, 15],
    [15, 15]
  ];

  const [cx, cy] = center[Math.floor(Math.random() * center.length)];
  tile(cx, cy).terrain = T.W;
}

/* ===== 描画 ===== */

function render() {
  const m = $('map');
  m.innerHTML = '';

  all().forEach(q => {
    const e = document.createElement('div');

    e.className = 'tile ' + q.terrain + (q.device ? ' device' : '') +
      (state.selected && state.selected !== 'remove' && canPlaceDevice(state.selected, q) ? ' placement-target' : '');
    e.style.left = q.x * 19 + 'px';
    e.style.top = q.y * 19 + 'px';

    e.textContent =
      q.fish
        ? '🐟'
        : q.frog
          ? '🐸'
          : q.insect
            ? '🦋'
            : q.rabbit
              ? '🐰'
              : q.snake
                ? '🐍'
                : q.bird
                  ? '🐦'
                  : q.bee
                    ? '🐝'
                    : q.deer
                      ? '🦌'
                      : q.bear
                        ? '🐻'
                        : q.device
                          ? ({
                            waterway: '⚙️',
                            purification: '🧪',
                            greening: '🌱',
                            planting: '🌲'
                          }[q.device] || '⚙️')
                          : (
                            q.terrain === T.W
                              ? '💧'
                              : q.terrain === T.F
                                ? '🌲'
                                : q.terrain === T.G
                                  ? '🌿'
                                  : ''
                          );

    e.onclick = () => clickTile(q);

    m.appendChild(e)
  });

  $('resource').textContent = state.resource;
  $('grass').textContent = count(T.G);
  $('forest').textContent = count(T.F);
  $('swamp').textContent = count(T.S);
  $('source').textContent = sources();
  $('waterway').textContent = count(T.L);
  renderAnimalCounts();
  renderConditions();
  const planting = document.querySelector('[data-device="planting"]');
  if (planting) planting.disabled = !plantingUnlocked();
  document.querySelectorAll('[data-device]').forEach(b => {
    b.classList.toggle('selected-device', state.selected === b.dataset.device);
  });
}

/* ===== デバイス ===== */

function canPlaceDevice(d, q) {
  if (!d || d === 'remove') return false;
  if (q.device || q.terrain === T.W || state.resource < cost[d]) return false;

  if (d === 'waterway') {
    return (
      (q.terrain === T.B || q.terrain === T.S) &&
      neigh8(q.x, q.y).some(
        p => tile(p.x, p.y).terrain === T.W &&
          Math.abs(p.x - q.x) === 1 &&
          Math.abs(p.y - q.y) === 1
      )
    );
  }

  if (d === 'purification') {
    return q.terrain === T.B && all().some(
      w =>
        (w.terrain === T.W || w.terrain === T.L) &&
        Math.max(Math.abs(w.x - q.x), Math.abs(w.y - q.y)) <= 2
    );
  }

  if (d === 'greening') {
    return state.greeningUnlocked && q.terrain === T.S;
  }

  if (d === 'planting') {
    return plantingUnlocked() && q.terrain === T.G;
  }

  return false;
}

function select(d) {
  if (state.status !== 'PLAYING') return;
  state.selected = state.selected === d ? null : d;
  render();
}

function terrain(q, t) {
  q.terrain = t;
  q.grassValue = t === T.G ? (q.grassValue ?? 0) : null
}

function clickTile(q) {
  if (state.selected === 'remove') {
    if (q.device) {
      q.device = null;
      terrain(q, T.S);
      render()
    }
    return
  }

  let d = state.selected;

  if (!d) return;

  if (q.device || q.terrain === T.W || state.resource < cost[d]) return;

  /* ===== 水路 ===== */

  if (d === 'waterway') {
    if (
      (q.terrain !== T.B && q.terrain !== T.S) ||
      !neigh8(q.x, q.y).some(
        p => tile(p.x, p.y).terrain === T.W &&
          Math.abs(p.x - q.x) === 1 &&
          Math.abs(p.y - q.y) === 1
      )
    ) return;
    saveUndo();
    q.device = d;
    state.waterwayPending = q;

    state.selected = null;
    showDirectionButtons();
    render();
    return
  }

  /* ===== 浄化装置 ===== */

  if (d === 'purification') {
    if (
      q.terrain !== T.B ||
      !all().some(
        w =>
          (w.terrain === T.W || w.terrain === T.L) &&
          Math.max(Math.abs(w.x - q.x), Math.abs(w.y - q.y)) <= 2
      )
    ) return;
    saveUndo();
    q.device = d;
    state.resource -= 3;

    /* 浄化装置を中心に3×3マスを湿地化（水源・水路・他の装置は除外） */
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = tile(q.x + dx, q.y + dy);
        if (t && !t.device && t.terrain !== T.W && t.terrain !== T.L) {
          terrain(t, T.S)
        }
      }
    }
  }

  /* ===== 緑化装置 ===== */

  else if (d === 'greening') {
    if (!state.greeningUnlocked && count(T.S) >= 15) state.greeningUnlocked = true;
    if (!state.greeningUnlocked || q.terrain !== T.S) return;
    saveUndo();
    q.device = d;
    state.resource -= 5;

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const t = tile(q.x + dx, q.y + dy);
        if (t && t.terrain === T.S && !t.device) {
          terrain(t, T.G);
          t.grassValue = 0;
          state.resource = Math.min(MAX, state.resource + 4)
        }
      }
    }
  }

  /* ===== 植林装置 ===== */

  else if (d === 'planting') {
    if (q.terrain !== T.G) return;
    saveUndo();

    state.plantingUsed = true;

    q.device = d;
    state.resource -= 10;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = tile(q.x + dx, q.y + dy);
        if (t && !t.device && t.terrain === T.G) {
          terrain(t, T.F);
          state.resource = Math.min(MAX, state.resource + 2);
        }
      }
    }

  }

  render()
}

/* ===== 水路方向ボタン ===== */

function showDirectionButtons() {
  let box = document.getElementById('water-direction-buttons');

  if (!box) {
    box = document.createElement('div');
    box.id = 'water-direction-buttons';
    box.style.position = 'fixed';
    box.style.left = '50%';
    box.style.top = '50%';
    box.style.transform = 'translate(-50%,-50%)';
    box.style.zIndex = '9999';
    box.style.display = 'grid';
    box.style.gridTemplateColumns = 'repeat(3,60px)';
    box.style.gap = '8px';
    box.style.padding = '16px';
    box.style.background = '#242a24';
    box.style.border = '1px solid #596359';
    box.style.borderRadius = '12px';

    const dirs = [
      ['up', '↑', 1, 2],
      ['left', '←', 0, 3],
      ['right', '→', 2, 3],
      ['down', '↓', 1, 4]
    ];

    dirs.forEach(([dir, label, col, row]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.gridColumn = col + 1;
      b.style.gridRow = row;
      b.onclick = () => water(dir);
      box.appendChild(b);
    });

    const cancel = document.createElement('button');
    cancel.textContent = '✕';
    cancel.style.gridColumn = '2';
    cancel.style.gridRow = '3';
    cancel.onclick = () => {
      const p = state.waterwayPending;
      if (p) p.device = null;
      state.waterwayPending = null;
      hideDirectionButtons();
      render();
    };
    box.appendChild(cancel);

    document.body.appendChild(box);
  }
}

function hideDirectionButtons() {
  const box = document.getElementById('water-direction-buttons');
  if (box) box.remove();
}

/* ===== 水路生成 ===== */

function water(dir) {
  const p = state.waterwayPending;

  if (!p) return;

  const src =
    neigh8(p.x, p.y)
      .map(z => tile(z.x, z.y))
      .find(q => q && q.terrain === T.W);

  const v = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
  }[dir];

  if (!src || !v) {
    p.device = null;
    state.waterwayPending = null;
    hideDirectionButtons();
    render();
    return
  }

  let [x, y] = [src.x + v[0], src.y + v[1]];

  if (!inside(x, y) || tile(x, y).device) {
    p.device = null;
    state.waterwayPending = null;
    hideDirectionButtons();
    render();
    return
  }

  state.resource--;

  while (inside(x, y) && !tile(x, y).device) {
    if (tile(x, y).terrain !== T.W) {
      terrain(tile(x, y), T.L)
    }

    x += v[0];
    y += v[1]
  }

  state.waterwayPending = null;
  hideDirectionButtons();
  render()
}

/* ===== ポーズ ===== */

$('pause').onclick = () => {
  state.status = state.status === 'PLAYING' ? 'PAUSED' : 'PLAYING';

  $('pause').textContent =
    state.status === 'PAUSED'
      ? '▶ RESUME'
      : '⏸ PAUSE'
};

$('speed').onclick = () => {
  state.speed = state.speed === 1 ? 2 : 1;
  $('speed').textContent = state.speed === 2 ? '⏩ 2×' : '▶ 1×';
};

document.querySelectorAll('[data-device]').forEach(b => {
  b.onclick = () => select(b.dataset.device);
});

/* ===== ゲームループ ===== */

function loop(t) {
  let dt = Math.min((t - state.last) / 1000, .1) * state.speed;
  state.last = t;

  if (state.status === 'PLAYING') {
    if (!state.greeningUnlocked && count(T.S) >= 15) state.greeningUnlocked = true;

    if (state.resource === 0) {
      state.zero += dt;

      if (state.zero >= 10) {
        alert('GAME OVER: 資源が0のまま10秒経過しました。');
        location.reload()
      }

    } else {
      state.zero = 0
    }

    updateWaterway(dt)
    updateFrogs(dt)
    updateInsects(dt)
    updateGrassValues(dt)
    updatePlantingButton()
    spawnRabbit(dt)
    spawnSnake(dt)
    spawnBird(dt)
    spawnBee(dt)
    spawnDeer(dt)
    spawnBear(dt)
    updateAnimalMovement(dt)
    checkClear(dt)
  }

  requestAnimationFrame(loop)
}

make();
render();
requestAnimationFrame(loop);
$('undo').onclick = () => {
  if (!state.undo || state.status !== 'PLAYING') return;

  state.map = structuredClone(state.undo.map);
  state.resource = state.undo.resource;
  state.greeningUnlocked = state.undo.greeningUnlocked;
  state.plantingUsed = state.undo.plantingUsed;

  state.undo = null;

  render();
};