# Cursor Bot Dashboard — Design Spec

**Date:** 2026-04-23  
**Author:** Delfina Pipan  
**Status:** Approved

---

## Objetivo

Dashboard web para medir la utilización e implementación del Cursor Bot en los squads de Humand, sprint a sprint. Permite a PMs y líderes tomar decisiones basadas en datos sobre adopción del bot.

---

## Squads analizados

`SQZB, SQSQ, SQSH, SQRN, SQRC, SQPM, SQPD, SQOW, SQOT, SQKA, SQJG, SQGZ, SQEG, SQDP, SQXS, SQCY, SQWH`

17 squads en total.

---

## Período de análisis

A partir del sprint que cubre el intervalo **24 de Febrero → 10 de Marzo 2025** (primer sprint donde el bot comenzó a trabajar). El dashboard analiza desde ese sprint hasta el sprint activo actual.

---

## Criterio de tickets del bot

Los tickets se cuentan si cumplen **todas** estas condiciones:

- **Tipo:** `Subtask`, `Sub-task` o `Dev Task`
- **Estado:** `Done`
- **Asignado a:** Cursor Bot (usuario en Jira)

El total de tasks del squad (denominador para % adopción) incluye todos los tickets `Done` del sprint en ese squad con los mismos tipos (`Subtask`, `Sub-task`, `Dev Task`), sin filtro de asignado. Se usan los mismos tipos para que la comparación sea justa (el bot solo puede hacer trabajo de ese tipo).

---

## Stack técnico

- **Un único archivo `index.html`** con CSS y JS embebidos
- **Chart.js** via CDN para los gráficos
- **Jira Cloud REST API** llamada desde el browser
- **Token de autenticación** hardcodeado en el archivo (repo privado)
- **Hosting:** GitHub Pages — se publica directamente desde el repo sin build step

---

## Layout

**Sidebar + main panel:**

```
┌─────────────────┬────────────────────────────────────────┐
│  🤖 Cursor Bot  │  [Título de la vista activa]           │
│                 │  [Subtítulo: rango de sprints]         │
│  General        │                                        │
│  > Vista global │  [Sección KPIs]                        │
│                 │  [Sección Gráficos]                    │
│  Squads         │                                        │
│  SQZB           │                                        │
│  SQSQ           │                                        │
│  SQSH           │                                        │
│  ...            │                                        │
│  (scrolleable)  │                                        │
└─────────────────┴────────────────────────────────────────┘
```

El sidebar es fijo. El panel principal cambia según la selección.

---

## Vistas

### Vista Global

Muestra datos agregados de todos los squads.

**Sección 1 — KPIs generales (4 tarjetas)**

| Métrica | Definición |
|---|---|
| Tasks del bot (total) | Suma de todos los tickets Done asignados al bot desde el sprint inicial |
| Sprints analizados | Cantidad de sprints desde el sprint inicial hasta el actual |
| Squads activos | Cantidad de squads con al menos 1 task del bot |
| Adopción promedio | Promedio del % de adopción de todos los squads |

**Sección 2 — Evolución sprint a sprint**

Gráfico de barras verticales. Eje X: sprints (S1, S2, ... Sn). Eje Y: cantidad de tasks del bot. Suma de todos los squads por sprint.

**Sección 3 — Ranking de squads**

Barras horizontales ordenadas de mayor a menor % de adopción. Cada barra muestra el nombre del squad y el porcentaje. Color verde para adopción ≥ 75%, azul para 50-74%, naranja para < 50%.

---

### Vista de Squad Individual

Se activa al clickear un squad en el sidebar. Muestra datos solo de ese squad.

**Sección 1 — KPIs del squad (4 tarjetas)**

| Métrica | Definición |
|---|---|
| Tasks del bot | Total de tasks Done asignadas al bot en ese squad (todos los sprints) |
| Total tasks squad | Total de tasks Done en ese squad (todos los sprints) |
| % adopción bot | Tasks bot / Total tasks × 100 |
| Variación vs sprint anterior | Diferencia de % adopción entre el último y el anteúltimo sprint |

**Sección 2 — Evolución del squad por sprint**

Gráfico de barras verticales. Eje X: sprints. Eje Y: tasks del bot. Panel lateral con datos del sprint más reciente (tasks bot, total tasks, % adopción).

---

## Flujo de datos (Jira API)

### Paso 1: Descubrir el board de cada squad

Cada squad tiene un board de Scrum en Jira. Se obtiene dinámicamente:

```
GET /rest/agile/1.0/board?projectKeyOrId={SQUAD}
```

Se toma el primer board del resultado. Si no tiene board, el squad se marca como "sin datos".

### Paso 2: Obtener sprints del squad

Con el boardId descubierto, se obtienen los sprints cerrados + el activo:

```
GET /rest/agile/1.0/board/{boardId}/sprint?state=closed,active
```

Se filtran los sprints cuya fecha de inicio (`startDate`) sea ≥ 24 Feb 2025.

### Paso 3: Obtener issues por sprint y squad

Por cada sprint × squad, se usa JQL para obtener los issues que cumplen el criterio del bot:

```jql
project = {SQUAD} 
AND issuetype in (Subtask, "Sub-task", "Dev Task") 
AND status = Done 
AND assignee = "Cursor Bot" 
AND sprint = {sprintId}
```

Y una query separada para el total del squad (mismos tipos):

```jql
project = {SQUAD} 
AND issuetype in (Subtask, "Sub-task", "Dev Task")
AND status = Done 
AND sprint = {sprintId}
```

### Paso 4: Calcular métricas y renderizar

Los datos se procesan en memoria y se renderizan con Chart.js.

---

## Autenticación

El archivo `index.html` contendrá una constante al inicio:

```js
const JIRA_CONFIG = {
  baseUrl: "https://humand.atlassian.net",
  token: "Basic BASE64_TOKEN_AQUI",  // reemplazar antes de subir
  botUser: "Cursor Bot"
};
```

Para obtener el token: Jira → Profile → Manage API tokens → Create token → Base64 encode `email:token`.

---

## Consideraciones técnicas

- **CORS:** Jira Cloud soporta CORS para requests desde el browser con Basic auth. Se debe verificar en el primer paso de implementación — si hay problemas de CORS, el fallback es un proxy serverless liviano (ej. Cloudflare Worker gratuito).
- **Rate limiting:** Con 17 squads × N sprints, puede haber muchos requests. Se implementa un loading state y los requests se hacen en paralelo con `Promise.all` por squad.
- **Cache:** Los datos del sprint actual se refrescan en cada carga. No hay cache persistente (el dashboard siempre muestra datos frescos).
- **Error handling:** Si un squad no tiene board en Jira o no tiene sprints, se muestra en gris en el sidebar con un indicador "sin datos".

---

## Archivos del proyecto

```
cursor-bot-dashboard/
├── index.html          # Todo el dashboard (HTML + CSS + JS)
└── README.md           # Instrucciones para actualizar el token y publicar
```

---

## Definition of Done

- [ ] Dashboard carga datos reales desde Jira al abrir
- [ ] Vista global muestra los 4 KPIs, el gráfico de evolución y el ranking
- [ ] Vista por squad muestra los 4 KPIs y el gráfico de evolución del squad
- [ ] Sidebar lista los 17 squads, clickear cada uno cambia la vista
- [ ] Loading state mientras cargan los datos
- [ ] Funciona en GitHub Pages sin configuración adicional
- [ ] README explica cómo actualizar el token
