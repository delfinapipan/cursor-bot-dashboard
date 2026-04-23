# Cursor Bot Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single `index.html` dashboard that pulls data from Jira in real time and visualiza la adopción del Cursor Bot sprint a sprint por squad.

**Architecture:** Un único archivo HTML con CSS y JS embebidos. El JS llama directamente a la Jira Cloud REST API desde el browser usando Basic auth (email + API token). Los datos se procesan en memoria y se renderizan con Chart.js via CDN. Sin build step — GitHub Pages lo sirve directamente.

**Tech Stack:** HTML5, CSS3, Vanilla JS (ES2020), Chart.js 4.4 via CDN, Jira Cloud REST API v3 + Agile API v1.

---

## Estructura de archivos

```
/
├── index.html     ← todo el dashboard (HTML + CSS + JS)
└── README.md      ← instrucciones de token y deploy
```

---

## Estructura interna de `index.html`

```
index.html
├── <head>
│   ├── Chart.js CDN
│   └── <style> (CSS completo)
├── <body>
│   ├── #app
│   │   ├── #sidebar (logo + lista de squads)
│   │   └── #main (panel principal cambiante)
│   │       ├── #view-global (KPIs + charts globales)
│   │       └── #view-squad (KPIs + chart por squad)
│   └── <script>
│       ├── JIRA_CONFIG (constantes de config)
│       ├── API layer (jiraFetch, getBoardId, getSprints, getIssueCounts)
│       ├── Data layer (loadAllData, aggregateGlobal)
│       └── UI layer (renderGlobalView, renderSquadView, switchView)
```

---

## Modelo de datos en memoria

```js
// Por squad, después de cargar:
squadData[squad] = {
  sprints: [
    { id: 12345, name: "Sprint 1", startDate: "2025-02-24", botCount: 14, totalCount: 22 },
    ...
  ],
  error: null  // o string con mensaje de error
}

// Globales (calculados después de cargar todo):
globalStats = {
  totalBotTasks: 1248,
  sprintsCount: 8,
  activeSquads: 15,
  avgAdoption: 73,
  evolutionBySprintName: { "Sprint 1": 45, "Sprint 2": 78, ... },
  ranking: [
    { squad: "SQRN", adoption: 92, botCount: 148, totalCount: 161 },
    ...
  ]
}
```

---

## Task 1: Verificar acceso a Jira API (CORS + auth)

**Archivos:**
- Crear: `index.html` (versión mínima de prueba)

Este task valida que el browser puede llamar a Jira antes de construir todo. Si CORS falla, hay que ajustar el approach.

- [ ] **Paso 1: Crear index.html mínimo con test de conexión**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cursor Bot — Test</title>
</head>
<body>
  <h2>Test Jira API</h2>
  <pre id="out">cargando...</pre>
  <script>
    const BASE_URL = 'https://humand.atlassian.net';
    // Reemplazar con email:apiToken codificado en base64
    // Ejemplo: btoa('delfina@humand.co:ATATT3x...')
    const TOKEN = 'Basic REEMPLAZAR';

    fetch(`${BASE_URL}/rest/api/3/myself`, {
      headers: { 'Authorization': TOKEN, 'Accept': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
      document.getElementById('out').textContent = JSON.stringify(data, null, 2);
    })
    .catch(err => {
      document.getElementById('out').textContent = 'ERROR: ' + err.message;
    });
  </script>
</body>
</html>
```

- [ ] **Paso 2: Generar el token Base64**

Abrir la consola del browser (F12 → Console) y ejecutar:
```js
btoa('tu-email@humand.co:TU_API_TOKEN_DE_JIRA')
```
Reemplazar `TOKEN` en el HTML con `'Basic ' + resultado`.

Para obtener el API token: https://id.atlassian.com/manage-profile/security/api-tokens

- [ ] **Paso 3: Abrir index.html en el browser y verificar**

Abrir el archivo con `File > Open` en Chrome. Resultado esperado en pantalla:
```json
{
  "accountId": "...",
  "displayName": "Delfina Pipan",
  "emailAddress": "delfina.pipan@humand.co"
}
```
Si aparece `ERROR: Failed to fetch` → hay un problema de CORS. Ver nota al final de este task.

- [ ] **Paso 4: Obtener el accountId del Cursor Bot**

Agregar al script, reemplazando el fetch de `/myself`:
```js
fetch(`${BASE_URL}/rest/api/3/user/search?query=Cursor+Bot`, {
  headers: { 'Authorization': TOKEN, 'Accept': 'application/json' }
})
.then(r => r.json())
.then(data => {
  document.getElementById('out').textContent = JSON.stringify(data, null, 2);
})
```
Abrir en browser. Buscar en el resultado el `accountId` del usuario "Cursor Bot". Anotar ese ID (lo usaremos en `JIRA_CONFIG`).

- [ ] **Paso 5: Commit**

```bash
git init
git add index.html
git commit -m "chore: test CORS + Jira auth"
```

> **Nota CORS:** Si el browser bloquea el request, abrir Chrome con CORS deshabilitado solo para desarrollo:
> ```bash
> open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --disable-web-security --user-data-dir="/tmp/chrome_dev"
> ```
> Si el problema persiste en producción (GitHub Pages), el fallback es un Cloudflare Worker gratuito como proxy. Consultar con quien implemente.

---

## Task 2: HTML skeleton + CSS

**Archivos:**
- Modificar: `index.html`

- [ ] **Paso 1: Reemplazar index.html con el skeleton completo**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cursor Bot Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      min-height: 100vh;
      display: flex;
    }

    /* ── Sidebar ── */
    #sidebar {
      width: 200px;
      min-height: 100vh;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }

    .sidebar-logo {
      padding: 20px 16px 16px;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
    }

    .sidebar-section {
      padding: 16px 16px 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
    }

    .sidebar-item {
      padding: 8px 16px;
      font-size: 13px;
      color: #475569;
      cursor: pointer;
      border-radius: 6px;
      margin: 1px 8px;
      transition: background 0.1s, color 0.1s;
    }

    .sidebar-item:hover { background: #f1f5f9; color: #0f172a; }

    .sidebar-item.active {
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 500;
    }

    .sidebar-item.error { color: #94a3b8; font-style: italic; }

    /* ── Main panel ── */
    #main {
      flex: 1;
      padding: 28px 32px;
      overflow-y: auto;
      min-width: 0;
    }

    .view-header { margin-bottom: 24px; }
    .view-title { font-size: 22px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
    .view-subtitle { font-size: 13px; color: #64748b; }

    /* ── KPI cards ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;
    }

    .kpi-label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 6px;
      font-weight: 500;
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }

    /* ── Chart cards ── */
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    .charts-grid.full { grid-template-columns: 1fr; }

    @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }

    .chart-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
    }

    .chart-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 16px;
    }

    .chart-wrap { position: relative; }

    /* ── Loading / error ── */
    #loading {
      position: fixed;
      inset: 0;
      background: rgba(255,255,255,0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 100;
    }

    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .loading-text { font-size: 14px; color: #64748b; }

    /* ── Ranking bars ── */
    .rank-list { display: flex; flex-direction: column; gap: 10px; }

    .rank-row { display: flex; align-items: center; gap: 10px; }

    .rank-name {
      width: 44px;
      font-size: 12px;
      font-weight: 500;
      color: #475569;
      flex-shrink: 0;
    }

    .rank-bar-wrap {
      flex: 1;
      background: #f1f5f9;
      border-radius: 4px;
      height: 14px;
      overflow: hidden;
    }

    .rank-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }

    .rank-pct {
      width: 36px;
      text-align: right;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    /* Colores de adopción */
    .adopt-high  { color: #16a34a; }
    .adopt-mid   { color: #2563eb; }
    .adopt-low   { color: #ea580c; }

    .bar-high  { background: #16a34a; }
    .bar-mid   { background: #2563eb; }
    .bar-low   { background: #ea580c; }

    /* ── Trend badge ── */
    .trend-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
    .trend-up   { background: #dcfce7; color: #16a34a; }
    .trend-down { background: #fee2e2; color: #dc2626; }
    .trend-flat { background: #f1f5f9; color: #64748b; }
  </style>
</head>
<body>

<div id="sidebar">
  <div class="sidebar-logo">🤖 Cursor Bot</div>
  <div class="sidebar-section">General</div>
  <div class="sidebar-item active" data-view="global" onclick="switchView('global')">Vista global</div>
  <div class="sidebar-section">Squads</div>
  <div id="squad-list"><!-- se llena por JS --></div>
</div>

<div id="main">
  <div id="view-global"></div>
  <div id="view-squad" style="display:none"></div>
</div>

<div id="loading">
  <div class="spinner"></div>
  <div class="loading-text">Cargando datos desde Jira...</div>
</div>

<script>
// ── CONFIG ──────────────────────────────────────────────────────────
const JIRA_CONFIG = {
  baseUrl: 'https://humand.atlassian.net',
  token: 'Basic REEMPLAZAR_CON_TOKEN_BASE64',
  botAccountId: 'REEMPLAZAR_CON_ACCOUNT_ID_DEL_BOT',
  startDate: '2025-02-24',
  squads: ['SQZB','SQSQ','SQSH','SQRN','SQRC','SQPM','SQPD','SQOW','SQOT','SQKA','SQJG','SQGZ','SQEG','SQDP','SQXS','SQCY','SQWH']
};

// TODO: se llenará en tasks siguientes
</script>
</body>
</html>
```

- [ ] **Paso 2: Verificar el skeleton en browser**

Abrir `index.html`. Verificar:
- Sidebar visible a la izquierda con "🤖 Cursor Bot" y "Vista global" en azul
- Spinner de carga en el centro (normal, el JS aún no carga datos)
- Fondo gris claro, layout correcto

- [ ] **Paso 3: Commit**

```bash
git add index.html
git commit -m "feat: HTML skeleton + CSS layout"
```

---

## Task 3: Capa de API (Jira fetch)

**Archivos:**
- Modificar: `index.html` — sección `<script>`

Reemplazar el comentario `// TODO` con el siguiente código completo de la capa de API.

- [ ] **Paso 1: Agregar la capa de API al script**

Reemplazar `// TODO: se llenará en tasks siguientes` con:

```js
// ── API LAYER ───────────────────────────────────────────────────────

async function jiraFetch(path) {
  const res = await fetch(`${JIRA_CONFIG.baseUrl}${path}`, {
    headers: {
      'Authorization': JIRA_CONFIG.token,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Jira ${res.status}: ${path}`);
  }
  return res.json();
}

// Devuelve el boardId de tipo scrum para un squad, o null si no tiene board
async function getBoardId(squad) {
  const data = await jiraFetch(
    `/rest/agile/1.0/board?projectKeyOrId=${squad}&type=scrum&maxResults=1`
  );
  if (!data.values || data.values.length === 0) return null;
  return data.values[0].id;
}

// Devuelve sprints cerrados + activo desde JIRA_CONFIG.startDate en adelante
async function getSprints(boardId) {
  const data = await jiraFetch(
    `/rest/agile/1.0/board/${boardId}/sprint?state=closed,active&maxResults=100`
  );
  const cutoff = new Date(JIRA_CONFIG.startDate);
  return (data.values || [])
    .filter(s => s.startDate && new Date(s.startDate) >= cutoff)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

// Devuelve el total de issues que cumplen el criterio (bot o todos)
async function getIssueCount(squad, sprintId, botOnly) {
  const assigneeClause = botOnly
    ? ` AND assignee = "${JIRA_CONFIG.botAccountId}"`
    : '';
  const jql = `project = "${squad}" AND issuetype in (Subtask, "Sub-task", "Dev Task") AND status = Done AND sprint = ${sprintId}${assigneeClause}`;
  const data = await jiraFetch(
    `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=0&fields=id`
  );
  return data.total || 0;
}
```

- [ ] **Paso 2: Verificar que no hay errores de sintaxis**

Abrir `index.html` en el browser. Abrir DevTools (F12) → Console. No debe haber errores en rojo. El spinner sigue visible (normal).

- [ ] **Paso 3: Commit**

```bash
git add index.html
git commit -m "feat: Jira API layer (fetch, board, sprints, issues)"
```

---

## Task 4: Carga de datos + estado en memoria

**Archivos:**
- Modificar: `index.html` — sección `<script>`

- [ ] **Paso 1: Agregar la capa de datos después de la capa de API**

```js
// ── DATA LAYER ──────────────────────────────────────────────────────

// Estado global de la app
const state = {
  squadData: {},   // { [squad]: { sprints: [...], error: null|string } }
  globalStats: null,
  currentView: 'global'
};

// Carga datos de un squad. Retorna { sprints, error }.
async function loadSquad(squad) {
  try {
    const boardId = await getBoardId(squad);
    if (!boardId) return { sprints: [], error: 'Sin board en Jira' };

    const sprints = await getSprints(boardId);
    if (sprints.length === 0) return { sprints: [], error: 'Sin sprints desde Feb 2025' };

    const sprintData = await Promise.all(sprints.map(async (s) => {
      const [botCount, totalCount] = await Promise.all([
        getIssueCount(squad, s.id, true),
        getIssueCount(squad, s.id, false)
      ]);
      return {
        id: s.id,
        name: s.name,
        startDate: s.startDate,
        botCount,
        totalCount
      };
    }));

    return { sprints: sprintData, error: null };
  } catch (err) {
    return { sprints: [], error: err.message };
  }
}

// Calcula estadísticas globales a partir de state.squadData
function computeGlobalStats() {
  const squads = JIRA_CONFIG.squads;

  let totalBotTasks = 0;
  let activeSquads = 0;
  const adoptionRates = [];
  const evolutionMap = {};  // sprintName → botCount (suma todos los squads)

  const ranking = [];

  for (const squad of squads) {
    const d = state.squadData[squad];
    if (!d || d.error || d.sprints.length === 0) continue;

    const squadBot   = d.sprints.reduce((sum, s) => sum + s.botCount, 0);
    const squadTotal = d.sprints.reduce((sum, s) => sum + s.totalCount, 0);

    if (squadBot === 0) continue;
    activeSquads++;
    totalBotTasks += squadBot;

    const adoption = squadTotal > 0 ? Math.round((squadBot / squadTotal) * 100) : 0;
    adoptionRates.push(adoption);

    ranking.push({ squad, adoption, botCount: squadBot, totalCount: squadTotal });

    for (const s of d.sprints) {
      if (!evolutionMap[s.name]) evolutionMap[s.name] = 0;
      evolutionMap[s.name] += s.botCount;
    }
  }

  // Ordenar ranking por adopción desc
  ranking.sort((a, b) => b.adoption - a.adoption);

  // Ordenar evolution por fecha (usando el primer squad que tenga ese sprint)
  const evolutionEntries = Object.entries(evolutionMap).map(([name, botCount]) => {
    // Buscar la fecha del sprint en cualquier squad
    let startDate = null;
    for (const squad of squads) {
      const d = state.squadData[squad];
      if (!d) continue;
      const found = d.sprints.find(s => s.name === name);
      if (found) { startDate = found.startDate; break; }
    }
    return { name, botCount, startDate };
  });
  evolutionEntries.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const avgAdoption = adoptionRates.length > 0
    ? Math.round(adoptionRates.reduce((a, b) => a + b, 0) / adoptionRates.length)
    : 0;

  // Contar sprints únicos
  const allSprintNames = new Set();
  for (const squad of squads) {
    const d = state.squadData[squad];
    if (!d || d.error) continue;
    d.sprints.forEach(s => allSprintNames.add(s.name));
  }

  return {
    totalBotTasks,
    sprintsCount: allSprintNames.size,
    activeSquads,
    avgAdoption,
    evolution: evolutionEntries,
    ranking
  };
}

// Orquesta la carga de todos los squads en paralelo
async function loadAllData() {
  setLoadingText('Buscando boards y sprints...');

  // Cargar todos los squads en paralelo
  const results = await Promise.all(
    JIRA_CONFIG.squads.map(squad => loadSquad(squad))
  );

  JIRA_CONFIG.squads.forEach((squad, i) => {
    state.squadData[squad] = results[i];
  });

  state.globalStats = computeGlobalStats();
}

function setLoadingText(text) {
  const el = document.querySelector('#loading .loading-text');
  if (el) el.textContent = text;
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}
```

- [ ] **Paso 2: Agregar el arranque de la app al final del script**

```js
// ── BOOT ────────────────────────────────────────────────────────────
(async () => {
  try {
    await loadAllData();
    buildSidebarSquads();
    renderGlobalView();   // se define en Task 5
    hideLoading();
  } catch (err) {
    document.querySelector('#loading .loading-text').textContent =
      'Error al cargar: ' + err.message;
  }
})();
```

- [ ] **Paso 3: Agregar stub de buildSidebarSquads para que no rompa**

```js
// ── UI LAYER (stubs — se completan en tasks siguientes) ─────────────

function buildSidebarSquads() {
  const list = document.getElementById('squad-list');
  list.innerHTML = JIRA_CONFIG.squads.map(squad => {
    const d = state.squadData[squad];
    const hasError = d && d.error;
    return `<div class="sidebar-item ${hasError ? 'error' : ''}"
                 data-view="${squad}"
                 onclick="switchView('${squad}')">
              ${squad}${hasError ? ' ⚠' : ''}
            </div>`;
  }).join('');
}

function renderGlobalView() {
  document.getElementById('view-global').innerHTML =
    '<p style="color:#64748b;padding:20px">Vista global — próximo task</p>';
}

function renderSquadView(squad) {
  document.getElementById('view-squad').innerHTML =
    `<p style="color:#64748b;padding:20px">Vista squad ${squad} — próximo task</p>`;
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  const isGlobal = view === 'global';
  document.getElementById('view-global').style.display = isGlobal ? '' : 'none';
  document.getElementById('view-squad').style.display  = isGlobal ? 'none' : '';
  if (!isGlobal) renderSquadView(view);
  else renderGlobalView();
}
```

- [ ] **Paso 4: Reemplazar el token y el botAccountId en JIRA_CONFIG con los valores obtenidos en Task 1**

En el `<script>`, actualizar:
```js
token: 'Basic TU_TOKEN_BASE64_REAL',
botAccountId: 'EL_ACCOUNT_ID_DEL_BOT_QUE_ENCONTRASTE',
```

- [ ] **Paso 5: Verificar en browser**

Abrir `index.html`. El spinner debe aparecer ~10-30 segundos (cargando 17 squads × N sprints). Luego debe desaparecer y mostrar el sidebar con todos los squads. En DevTools → Network, verificar que hay requests a `humand.atlassian.net`. En Console, no debe haber errores en rojo.

- [ ] **Paso 6: Commit**

```bash
git add index.html
git commit -m "feat: data loading layer + sidebar population"
```

---

## Task 5: Vista global — KPIs

**Archivos:**
- Modificar: `index.html` — función `renderGlobalView()`

- [ ] **Paso 1: Reemplazar renderGlobalView() con la versión real**

```js
function renderGlobalView() {
  const g = state.globalStats;
  if (!g) return;

  document.getElementById('view-global').innerHTML = `
    <div class="view-header">
      <div class="view-title">Vista global</div>
      <div class="view-subtitle">Todos los squads · ${g.sprintsCount} sprint${g.sprintsCount !== 1 ? 's' : ''} analizados</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Tasks del bot (total)</div>
        <div class="kpi-value" style="color:#2563eb">${g.totalBotTasks.toLocaleString('es-AR')}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Sprints analizados</div>
        <div class="kpi-value" style="color:#0891b2">${g.sprintsCount}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Squads activos</div>
        <div class="kpi-value" style="color:#7c3aed">${g.activeSquads}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Adopción promedio</div>
        <div class="kpi-value ${adoptionClass(g.avgAdoption)}">${g.avgAdoption}%</div>
      </div>
    </div>

    <div class="charts-grid" id="global-charts-grid">
      <div class="chart-card" id="global-evolution-card">
        <div class="chart-title">Evolución sprint a sprint (todos los squads)</div>
        <div class="chart-wrap"><canvas id="chart-global-evolution" height="180"></canvas></div>
      </div>
      <div class="chart-card" id="global-ranking-card">
        <div class="chart-title">Ranking de squads por adopción</div>
        <div class="rank-list" id="ranking-list"></div>
      </div>
    </div>
  `;

  renderGlobalEvolutionChart();
  renderRanking();
}

function adoptionClass(pct) {
  if (pct >= 75) return 'adopt-high';
  if (pct >= 50) return 'adopt-mid';
  return 'adopt-low';
}

function adoptionBarClass(pct) {
  if (pct >= 75) return 'bar-high';
  if (pct >= 50) return 'bar-mid';
  return 'bar-low';
}

function renderGlobalEvolutionChart() { /* Task 6 */ }
function renderRanking() { /* Task 7 */ }
```

- [ ] **Paso 2: Verificar en browser**

Recargar. La vista global debe mostrar los 4 KPI cards con valores reales. Los charts aparecen vacíos (normal por ahora). Verificar que los números se ven coherentes.

- [ ] **Paso 3: Commit**

```bash
git add index.html
git commit -m "feat: global view KPI cards"
```

---

## Task 6: Vista global — Gráfico de evolución

**Archivos:**
- Modificar: `index.html` — función `renderGlobalEvolutionChart()`

- [ ] **Paso 1: Reemplazar renderGlobalEvolutionChart() con la versión real**

```js
function renderGlobalEvolutionChart() {
  const g = state.globalStats;
  const labels = g.evolution.map(e => e.name);
  const values = g.evolution.map(e => e.botCount);

  new Chart(document.getElementById('chart-global-evolution'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tasks del bot',
        data: values,
        backgroundColor: '#3b82f6',
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} tasks del bot`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, maxRotation: 45 }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { size: 11 }, precision: 0 }
        }
      }
    }
  });
}
```

- [ ] **Paso 2: Verificar en browser**

Recargar. El gráfico de barras debe aparecer con los sprints en el eje X y las tasks del bot en el eje Y. Pasar el mouse sobre las barras debe mostrar el tooltip con el count. Las barras deben crecer de izquierda a derecha (más adopción con el tiempo).

- [ ] **Paso 3: Commit**

```bash
git add index.html
git commit -m "feat: global evolution bar chart"
```

---

## Task 7: Vista global — Ranking de squads

**Archivos:**
- Modificar: `index.html` — función `renderRanking()`

- [ ] **Paso 1: Reemplazar renderRanking() con la versión real**

```js
function renderRanking() {
  const ranking = state.globalStats.ranking;
  const maxAdoption = ranking.length > 0 ? ranking[0].adoption : 100;

  document.getElementById('ranking-list').innerHTML = ranking.map(r => `
    <div class="rank-row">
      <div class="rank-name">${r.squad}</div>
      <div class="rank-bar-wrap">
        <div class="rank-bar ${adoptionBarClass(r.adoption)}"
             style="width: ${maxAdoption > 0 ? Math.round((r.adoption / maxAdoption) * 100) : 0}%">
        </div>
      </div>
      <div class="rank-pct ${adoptionClass(r.adoption)}">${r.adoption}%</div>
    </div>
  `).join('');
}
```

- [ ] **Paso 2: Verificar en browser**

Recargar. La sección de ranking debe mostrar todos los squads con datos, ordenados de mayor a menor %. Verde para ≥75%, azul para 50-74%, naranja para <50%. La barra del squad con mayor adopción debe llegar casi al 100% del ancho.

- [ ] **Paso 3: Commit**

```bash
git add index.html
git commit -m "feat: squad ranking with adoption color coding"
```

---

## Task 8: Vista de squad — KPIs

**Archivos:**
- Modificar: `index.html` — función `renderSquadView(squad)`

- [ ] **Paso 1: Reemplazar renderSquadView() con la versión real**

```js
function renderSquadView(squad) {
  const d = state.squadData[squad];

  if (!d || d.sprints.length === 0) {
    document.getElementById('view-squad').innerHTML = `
      <div class="view-header">
        <div class="view-title">${squad}</div>
        <div class="view-subtitle">${d?.error || 'Sin datos disponibles'}</div>
      </div>
    `;
    return;
  }

  const totalBot   = d.sprints.reduce((sum, s) => sum + s.botCount, 0);
  const totalAll   = d.sprints.reduce((sum, s) => sum + s.totalCount, 0);
  const adoption   = totalAll > 0 ? Math.round((totalBot / totalAll) * 100) : 0;

  // Variación vs sprint anterior (comparar último vs anteúltimo)
  let trendHtml = '';
  if (d.sprints.length >= 2) {
    const last = d.sprints[d.sprints.length - 1];
    const prev = d.sprints[d.sprints.length - 2];
    const lastPct = last.totalCount > 0 ? Math.round((last.botCount / last.totalCount) * 100) : 0;
    const prevPct = prev.totalCount > 0 ? Math.round((prev.botCount / prev.totalCount) * 100) : 0;
    const diff = lastPct - prevPct;
    const cls  = diff > 0 ? 'trend-up' : diff < 0 ? 'trend-down' : 'trend-flat';
    const icon = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    trendHtml = `<span class="trend-badge ${cls}">${icon}${Math.abs(diff)}% vs sprint anterior</span>`;
  }

  const lastSprint = d.sprints[d.sprints.length - 1];
  const lastAdoption = lastSprint.totalCount > 0
    ? Math.round((lastSprint.botCount / lastSprint.totalCount) * 100)
    : 0;

  document.getElementById('view-squad').innerHTML = `
    <div class="view-header">
      <div class="view-title">${squad}</div>
      <div class="view-subtitle">
        ${d.sprints[0].name} → ${lastSprint.name}
        &nbsp;${trendHtml}
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Tasks del bot</div>
        <div class="kpi-value" style="color:#2563eb">${totalBot}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total tasks squad</div>
        <div class="kpi-value" style="color:#475569">${totalAll}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Adopción acumulada</div>
        <div class="kpi-value ${adoptionClass(adoption)}">${adoption}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Adopción último sprint</div>
        <div class="kpi-value ${adoptionClass(lastAdoption)}">${lastAdoption}%</div>
      </div>
    </div>

    <div class="charts-grid full">
      <div class="chart-card">
        <div class="chart-title">Evolución de ${squad} por sprint</div>
        <div class="chart-wrap"><canvas id="chart-squad-evolution" height="180"></canvas></div>
      </div>
    </div>
  `;

  renderSquadEvolutionChart(squad);
}
```

- [ ] **Paso 2: Verificar en browser**

Recargar. Clickear un squad en el sidebar. Deben aparecer los 4 KPI cards con datos reales de ese squad. El badge de tendencia debe aparecer en el subtítulo (↑ verde si creció, ↓ rojo si bajó).

- [ ] **Paso 3: Commit**

```bash
git add index.html
git commit -m "feat: squad view KPI cards + trend badge"
```

---

## Task 9: Vista de squad — Gráfico de evolución

**Archivos:**
- Modificar: `index.html` — agregar función `renderSquadEvolutionChart(squad)`

- [ ] **Paso 1: Agregar renderSquadEvolutionChart() después de renderSquadView()**

```js
function renderSquadEvolutionChart(squad) {
  const d = state.squadData[squad];
  const labels = d.sprints.map(s => s.name);
  const botCounts   = d.sprints.map(s => s.botCount);
  const totalCounts = d.sprints.map(s => s.totalCount);

  new Chart(document.getElementById('chart-squad-evolution'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Tasks del bot',
          data: botCounts,
          backgroundColor: '#6366f1',
          borderRadius: 4,
          borderSkipped: false,
          order: 1
        },
        {
          label: 'Total tasks squad',
          data: totalCounts,
          backgroundColor: '#e2e8f0',
          borderRadius: 4,
          borderSkipped: false,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 12 }, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            afterBody: (items) => {
              const botVal   = items.find(i => i.dataset.label === 'Tasks del bot')?.parsed.y ?? 0;
              const totalVal = items.find(i => i.dataset.label === 'Total tasks squad')?.parsed.y ?? 0;
              const pct = totalVal > 0 ? Math.round((botVal / totalVal) * 100) : 0;
              return [`Adopción: ${pct}%`];
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, maxRotation: 45 }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { size: 11 }, precision: 0 },
          stacked: false
        }
      }
    }
  });
}
```

- [ ] **Paso 2: Verificar en browser**

Clickear un squad. El gráfico debe mostrar barras grises (total tasks) con barras violetas superpuestas (tasks del bot). El tooltip al pasar por una barra debe mostrar ambos valores y el % de adopción de ese sprint.

- [ ] **Paso 3: Commit**

```bash
git add index.html
git commit -m "feat: squad evolution chart (bot vs total tasks)"
```

---

## Task 10: README

**Archivos:**
- Crear: `README.md`

- [ ] **Paso 1: Crear README.md**

```markdown
# Cursor Bot Dashboard

Dashboard para medir la adopción del Cursor Bot en los squads de Humand, sprint a sprint.

## Acceso

URL: https://[tu-usuario].github.io/[nombre-del-repo]/

## Cómo actualizar el token de Jira

El dashboard necesita un API token de Jira para llamar a la API. El token está hardcodeado en `index.html`.

### Pasos para generar/renovar el token:

1. Ir a https://id.atlassian.com/manage-profile/security/api-tokens
2. Click en "Create API token"
3. Ponerle un nombre (ej. "Cursor Bot Dashboard")
4. Copiar el token generado
5. En la terminal (o en un editor de texto), generar el valor Base64:
   - Abrir cualquier browser → F12 → Console → ejecutar:
     ```js
     btoa('tu-email@humand.co:EL_TOKEN_QUE_COPIASTE')
     ```
   - Copiar el resultado
6. En `index.html`, buscar la línea:
   ```js
   token: 'Basic REEMPLAZAR_CON_TOKEN_BASE64',
   ```
   Reemplazar `REEMPLAZAR_CON_TOKEN_BASE64` con el resultado del paso 5.
7. Commitear y pushear — GitHub Pages se actualiza automáticamente.

## Cómo publicar en GitHub Pages

1. Crear un repo en GitHub (privado)
2. Pushear el código:
   ```bash
   git remote add origin https://github.com/tu-usuario/nombre-repo.git
   git push -u origin main
   ```
3. En GitHub → Settings → Pages → Source: Deploy from branch → Branch: `main` → `/` (root)
4. En unos minutos el dashboard estará disponible en la URL que muestra GitHub Pages.

## Squads monitoreados

SQZB, SQSQ, SQSH, SQRN, SQRC, SQPM, SQPD, SQOW, SQOT, SQKA, SQJG, SQGZ, SQEG, SQDP, SQXS, SQCY, SQWH

## Criterio de tasks del bot

Se cuentan tickets de tipo `Subtask`, `Sub-task` o `Dev Task`, en estado `Done`, asignados al usuario "Cursor Bot" en Jira. El período arranca desde el sprint que comenzó el 24 de Febrero de 2025.
```

- [ ] **Paso 2: Commit final**

```bash
git add README.md
git commit -m "docs: README con instrucciones de token y deploy"
```

---

## Self-review del plan

### Cobertura del spec

| Requisito del spec | Task que lo implementa |
|---|---|
| Sidebar con 17 squads | Task 2 (skeleton) + Task 4 (buildSidebarSquads) |
| KPIs globales (4 tarjetas) | Task 5 |
| Gráfico evolución global | Task 6 |
| Ranking de squads | Task 7 |
| KPIs por squad (4 tarjetas) | Task 8 |
| Gráfico evolución por squad | Task 9 |
| Loading state | Task 4 (spinner + hideLoading) |
| Auth hardcodeada | Task 1 (token) + Task 4 (JIRA_CONFIG) |
| Error handling por squad | Task 4 (loadSquad try/catch) + Task 8 (vista sin datos) |
| Squad "sin datos" en sidebar | Task 4 (buildSidebarSquads) |
| GitHub Pages + README | Task 10 |
| Colores de adopción (verde/azul/naranja) | Tasks 5, 7, 8 (adoptionClass / adoptionBarClass) |

### Consistencia de tipos

- `getIssueCount(squad, sprintId, botOnly)` → usado en Task 3 (definición) y Task 4 (uso en `loadSquad`) ✓
- `state.globalStats.evolution` → array de `{ name, botCount, startDate }` definido en Task 4, usado en Task 6 ✓
- `state.globalStats.ranking` → array de `{ squad, adoption, botCount, totalCount }` definido en Task 4, usado en Task 7 ✓
- `state.squadData[squad].sprints` → array de `{ id, name, startDate, botCount, totalCount }` definido en Task 4, usado en Tasks 8 y 9 ✓
- `adoptionClass(pct)` → definida en Task 5, usada en Tasks 5, 8 ✓
- `adoptionBarClass(pct)` → definida en Task 5, usada en Task 7 ✓

### Placeholders

Ninguno detectado. Todos los pasos tienen código completo o comandos ejecutables.
