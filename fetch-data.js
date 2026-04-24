const BASE_URL   = 'https://humand.atlassian.net';
const TOKEN      = process.env.JIRA_TOKEN;
const BOT_ID     = '712020:98b3a270-fe83-4788-9d35-e5b5611a7a64';
const START_DATE = '2025-02-24';
const SQUADS     = [
  'SQZB','SQSQ','SQSH','SQRN','SQRC','SQPM','SQPD',
  'SQOW','SQOT','SQKA','SQJG','SQGZ','SQEG','SQDP',
  'SQXS','SQCY','SQWH'
];

if (!TOKEN) { console.error('Falta JIRA_TOKEN'); process.exit(1); }

async function jiraFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Authorization': `Basic ${TOKEN}`, 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`Jira ${res.status} - ${path.split('?')[0]}`);
  return res.json();
}

async function loadSquad(squad) {
  try {
    const cutoff = new Date(START_DATE);
    const sprintMap = new Map();

    // Paginar todas las bot tasks del squad y extraer sprints
    let startAt = 0;
    while (true) {
      const jql = `project = "${squad}" AND issuetype in (Subtask, "Sub-task", "Dev Task") AND status = Done AND assignee = "${BOT_ID}"`;
      const data = await jiraFetch(
        `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100&startAt=${startAt}&fields=customfield_10020`
      );
      for (const issue of (data.issues || [])) {
        const sprintArr = issue.fields.customfield_10020;
        if (!sprintArr || sprintArr.length === 0) continue;
        const sprint = sprintArr[sprintArr.length - 1];
        if (!sprint.startDate || new Date(sprint.startDate) < cutoff) continue;
        if (!sprintMap.has(sprint.id)) {
          sprintMap.set(sprint.id, { id: sprint.id, name: sprint.name, startDate: sprint.startDate, botCount: 0, totalCount: 0 });
        }
        sprintMap.get(sprint.id).botCount++;
      }
      if ((data.issues || []).length < 100 || startAt + 100 >= (data.total || 0)) break;
      startAt += 100;
    }

    if (sprintMap.size === 0) return { sprints: [], error: 'Sin tasks del bot desde Feb 2025' };

    // Obtener total de tasks por sprint
    await Promise.all(Array.from(sprintMap.values()).map(async sprint => {
      const jql = `project = "${squad}" AND issuetype in (Subtask, "Sub-task", "Dev Task") AND status = Done AND sprint = ${sprint.id}`;
      const data = await jiraFetch(`/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=0`);
      sprint.totalCount = data.total || 0;
    }));

    const sprints = Array.from(sprintMap.values())
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    return { sprints, error: null };
  } catch (err) {
    console.error(`  X ${squad}: ${err.message}`);
    return { sprints: [], error: err.message };
  }
}

(async () => {
  console.log(`Fetching ${SQUADS.length} squads...`);
  const results = await Promise.all(SQUADS.map(async squad => {
    const result = await loadSquad(squad);
    const count = result.sprints.reduce((s, x) => s + x.botCount, 0);
    console.log(`  ${squad}: ${result.error || `${result.sprints.length} sprints, ${count} bot tasks`}`);
    return [squad, result];
  }));
  const fs = await import('fs');
  fs.writeFileSync('data.json', JSON.stringify({
    lastUpdated: new Date().toISOString(),
    squads: Object.fromEntries(results)
  }, null, 2));
  console.log('data.json guardado.');
})();
