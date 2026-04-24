// fetch-data.js — corre en GitHub Actions, guarda data.json
// Requiere: Node 20+, variable de entorno JIRA_TOKEN

const BASE_URL   = 'https://humand.atlassian.net';
const TOKEN      = process.env.JIRA_TOKEN;
const BOT_ID     = '712020:98b3a270-fe83-4788-9d35-e5b5611a7a64';
const START_DATE = '2025-02-24';
const SQUADS     = [
  'SQZB','SQSQ','SQSH','SQRN','SQRC','SQPM','SQPD',
  'SQOW','SQOT','SQKA','SQJG','SQGZ','SQEG','SQDP',
  'SQXS','SQCY','SQWH'
];

if (!TOKEN) {
  console.error('ERROR: falta la variable de entorno JIRA_TOKEN');
  process.exit(1);
}

async function jiraFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Authorization': `Basic ${TOKEN}`, 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`Jira ${res.status} - ${path.split('?')[0]}`);
  return res.json();
}

async function getBoardId(squad) {
  const data = await jiraFetch(
    `/rest/agile/1.0/board?projectKeyOrId=${squad}&type=scrum&maxResults=1`
  );
  if (!data.values || data.values.length === 0) return null;
  return data.values[0].id;
}

async function getSprints(boardId) {
  const data = await jiraFetch(
    `/rest/agile/1.0/board/${boardId}/sprint?state=closed,active&maxResults=100`
  );
  const cutoff = new Date(START_DATE);
  return (data.values || [])
    .filter(s => s.startDate && new Date(s.startDate) >= cutoff)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

async function getIssueCount(squad, sprintId, botOnly) {
  const assigneeClause = botOnly ? ` AND assignee = "${BOT_ID}"` : '';
  const jql = `project = "${squad}" AND issuetype in (Subtask, "Sub-task", "Dev Task") AND status = Done AND sprint = ${sprintId}${assigneeClause}`;
  const data = await jiraFetch(
    `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=0&fields=id`
  );
  return data.total || 0;
}

async function loadSquad(squad) {
  try {
    const boardId = await getBoardId(squad);
    if (!boardId) return { sprints: [], error: 'Sin board Scrum' };
    const sprints = await getSprints(boardId);
    if (sprints.length === 0) return { sprints: [], error: 'Sin sprints desde Feb 2025' };
    const sprintData = await Promise.all(sprints.map(async s => {
      const [botCount, totalCount] = await Promise.all([
        getIssueCount(squad, s.id, true),
        getIssueCount(squad, s.id, false)
      ]);
      return { id: s.id, name: s.name, startDate: s.startDate, botCount, totalCount };
    }));
    return { sprints: sprintData, error: null };
  } catch (err) {
    console.error(`  X ${squad}: ${err.message}`);
    return { sprints: [], error: err.message };
  }
}

(async () => {
  console.log(`Fetching data for ${SQUADS.length} squads...`);
  const results = await Promise.all(
    SQUADS.map(async squad => {
      const result = await loadSquad(squad);
      const count = result.sprints.reduce((s, x) => s + x.botCount, 0);
      console.log(`  OK ${squad}: ${result.error || `${result.sprints.length} sprints, ${count} bot tasks`}`);
      return [squad, result];
    })
  );
  const squadData = Object.fromEntries(results);
  const output = {
    lastUpdated: new Date().toISOString(),
    squads: squadData
  };
  const fs = await import('fs');
  fs.writeFileSync('data.json', JSON.stringify(output, null, 2));
  console.log('\ndata.json guardado correctamente.');
})();
