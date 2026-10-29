// Logbook API: one Lambda behind an API Gateway HTTP API with a Cognito JWT authorizer.
// Items in the `logbook` table (partition key userID, sort key sk):
//   STATE                      { version, activeQuarterId }
//   Q#<quarterId>              a Quarter without its days
//   Q#<quarterId>#D#<date>     a DayEntry { goal, hours?, metrics? }
//   P#<projectId>              a project's page { description?, tasks?: [{ id, text, done, indent? }], notes?: [{ id, date, text }] }
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.TABLE_NAME ?? 'logbook';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const QUARTER_ID = /^\d{4}-Q[1-4]$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Project ids are made by the app (short random strings, or "s-p1" in the sample data). */
const PROJECT_ID = /^[\w-]{1,64}$/;

// Size limits, so one request can't turn into thousands of DynamoDB writes. Generous for a real log: a quarter of
// daily entries is well under 100 KB, and 40 quarters is ten years.
const MAX_BODY_BYTES = 64 * 1024;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_QUARTERS = 40;
/** A quarter is 13 weeks, or 14 for Q4 of a 53-week year. */
const MAX_QUARTER_DAYS = 14 * 7;
/** Most categories or metrics one day can record. */
const MAX_RECORD_KEYS = 50;
/** Most project pages one import can hold. */
const MAX_PROJECTS = 1000;
/** Most notes one project page can hold (the 64 KB request limit usually comes first). */
const MAX_PROJECT_NOTES = 500;
const MAX_PROJECT_TASKS = 500;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? '' : JSON.stringify(body),
});

export async function handler(event) {
  try {
    // Set by the JWT authorizer after it verifies the token; never read the user from the request.
    const userID = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userID) throw new HttpError(401, 'unauthorized');
    const p = event.pathParameters ?? {};

    switch (event.routeKey) {
      case 'GET /state':
        return json(200, await loadState(userID));
      case 'PUT /state':
        await putState(userID, parseBody(event));
        return json(204);
      case 'PUT /quarters/{quarterId}':
        await putQuarter(userID, checkQuarterId(p.quarterId), parseBody(event));
        return json(204);
      case 'DELETE /quarters/{quarterId}':
        await deleteQuarter(userID, checkQuarterId(p.quarterId));
        return json(204);
      case 'PUT /quarters/{quarterId}/days/{date}':
        await putDay(userID, checkQuarterId(p.quarterId), checkDate(p.date), parseBody(event));
        return json(204);
      case 'PUT /projects/{projectId}':
        await putProject(userID, checkProjectId(p.projectId), parseBody(event));
        return json(204);
      case 'DELETE /projects/{projectId}':
        await db.send(new DeleteCommand({ TableName: TABLE, Key: { userID, sk: `P#${checkProjectId(p.projectId)}` } }));
        return json(204);
      case 'POST /import':
        await importState(userID, parseBody(event, MAX_IMPORT_BYTES));
        return json(204);
      default:
        throw new HttpError(404, 'not found');
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error(err);
    return json(500, { error: 'internal error' });
  }
}

// ---------- reads ----------

async function queryAll(userID, skPrefix) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: skPrefix ? 'userID = :u AND begins_with(sk, :p)' : 'userID = :u',
        ExpressionAttributeValues: skPrefix ? { ':u': userID, ':p': skPrefix } : { ':u': userID },
        ExclusiveStartKey,
      }),
    );
    items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** Rebuilds the app's AppState, or returns null for a user with no data yet. */
async function loadState(userID) {
  const items = await queryAll(userID);
  if (!items.length) return null;

  let state = { version: 1, activeQuarterId: null };
  const quarters = new Map();
  const days = [];
  const projectDetails = {};
  for (const { userID: _u, sk, ...rest } of items) {
    if (sk === 'STATE') state = { ...state, ...rest };
    else if (sk.startsWith('P#')) projectDetails[sk.slice(2)] = rest;
    else if (sk.includes('#D#')) days.push([sk, rest]);
    else quarters.set(sk.slice(2), { ...rest, days: {} });
  }
  for (const [sk, day] of days) {
    const [, quarterId, , date] = sk.split('#');
    const q = quarters.get(quarterId);
    if (q) q.days[date] = day;
  }
  const list = [...quarters.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!list.length) return null;
  if (!quarters.has(state.activeQuarterId)) state.activeQuarterId = list.at(-1).id;
  const result = { version: 1, quarters: list, activeQuarterId: state.activeQuarterId };
  return Object.keys(projectDetails).length ? { ...result, projectDetails } : result;
}

// ---------- writes ----------

function stateItem(userID, body) {
  if (typeof body.activeQuarterId !== 'string') throw new HttpError(400, 'activeQuarterId required');
  return { userID, sk: 'STATE', version: 1, activeQuarterId: body.activeQuarterId };
}

function quarterItem(userID, quarterId, body) {
  if (!isObject(body) || body.id !== quarterId) throw new HttpError(400, 'quarter id must match the path');
  if (!checkISODate(body.startDate) || !Array.isArray(body.categories)) throw new HttpError(400, 'invalid quarter');
  // Days are stored as their own items; userID and sk always come from the server.
  const { days: _days, userID: _u, sk: _sk, ...fields } = body;
  return { ...fields, userID, sk: `Q#${quarterId}` };
}

function dayItem(userID, quarterId, date, body) {
  if (!isObject(body) || typeof body.goal !== 'number') throw new HttpError(400, 'invalid day');
  return {
    userID,
    sk: `Q#${quarterId}#D#${date}`,
    goal: body.goal,
    hours: numberRecord(body.hours),
    metrics: numberRecord(body.metrics),
  };
}

function projectItem(userID, projectId, body) {
  if (!isObject(body)) throw new HttpError(400, 'invalid project');
  const { description, tasks, notes } = body;
  if (description !== undefined && typeof description !== 'string') throw new HttpError(400, 'description must be text');
  if (tasks !== undefined && !(Array.isArray(tasks) && tasks.length <= MAX_PROJECT_TASKS && tasks.every(isProjectTask))) {
    throw new HttpError(400, `tasks must be at most ${MAX_PROJECT_TASKS} { id, text, done } entries`);
  }
  if (notes !== undefined && !(Array.isArray(notes) && notes.length <= MAX_PROJECT_NOTES && notes.every(isProjectNote))) {
    throw new HttpError(400, `notes must be at most ${MAX_PROJECT_NOTES} { id, date, text } entries`);
  }
  return {
    userID,
    sk: `P#${projectId}`,
    description,
    tasks: tasks?.length ? tasks.map(({ id, text, done, indent }) => ({ id, text, done, indent: indent === true || undefined })) : undefined,
    notes: notes?.length ? notes.map(({ id, date, text }) => ({ id, date, text })) : undefined,
  };
}

const put = (Item) => db.send(new PutCommand({ TableName: TABLE, Item }));

const putState = (userID, body) => put(stateItem(userID, body));
const putQuarter = (userID, quarterId, body) => put(quarterItem(userID, quarterId, body));
const putDay = (userID, quarterId, date, body) => put(dayItem(userID, quarterId, date, body));
const putProject = (userID, projectId, body) => put(projectItem(userID, projectId, body));

/** Removes a quarter and all of its days. */
async function deleteQuarter(userID, quarterId) {
  const items = await queryAll(userID, `Q#${quarterId}`);
  await batchWrite(items.map(({ sk }) => ({ DeleteRequest: { Key: { userID, sk } } })));
}

/**
 * Replaces everything the user has with a whole AppState: the old localStorage "logbook:v1" blob, a restored backup,
 * sample data, or a full resync after a failed save. Writes first, then removes leftovers, so a failure never loses data.
 */
async function importState(userID, body) {
  if (!isObject(body) || body.version !== 1 || !Array.isArray(body.quarters) || !body.quarters.length) {
    throw new HttpError(400, 'invalid state');
  }
  if (body.quarters.length > MAX_QUARTERS) throw new HttpError(400, `at most ${MAX_QUARTERS} quarters`);
  const items = [stateItem(userID, body)];
  const seen = new Set();
  for (const q of body.quarters) {
    const quarterId = checkQuarterId(q?.id);
    if (seen.has(quarterId)) throw new HttpError(400, 'duplicate quarter');
    seen.add(quarterId);
    items.push(quarterItem(userID, quarterId, q));
    for (const [date, day] of Object.entries(q.days ?? {})) {
      const offset = daysBetween(q.startDate, checkDate(date));
      if (!(offset >= 0 && offset < MAX_QUARTER_DAYS)) throw new HttpError(400, `day ${date} is outside quarter ${quarterId}`);
      items.push(dayItem(userID, quarterId, date, day));
    }
  }
  if (body.projectDetails !== undefined) {
    if (!isObject(body.projectDetails)) throw new HttpError(400, 'invalid project details');
    const projects = Object.entries(body.projectDetails);
    if (projects.length > MAX_PROJECTS) throw new HttpError(400, `at most ${MAX_PROJECTS} project pages`);
    for (const [projectId, details] of projects) items.push(projectItem(userID, checkProjectId(projectId), details));
  }
  const existing = await queryAll(userID);
  await batchWrite(items.map((Item) => ({ PutRequest: { Item } })));
  const keep = new Set(items.map((i) => i.sk));
  await batchWrite(existing.filter((i) => !keep.has(i.sk)).map(({ sk }) => ({ DeleteRequest: { Key: { userID, sk } } })));
}

/** BatchWrite takes at most 25 requests per call and may hand some back unprocessed. */
async function batchWrite(requests) {
  for (let i = 0; i < requests.length; i += 25) {
    let pending = requests.slice(i, i + 25);
    for (let attempt = 0; pending.length; attempt++) {
      if (attempt > 5) throw new Error('batch write did not finish');
      if (attempt) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      const res = await db.send(new BatchWriteCommand({ RequestItems: { [TABLE]: pending } }));
      pending = res.UnprocessedItems?.[TABLE] ?? [];
    }
  }
}

// ---------- validation ----------

function parseBody(event, maxBytes = MAX_BODY_BYTES) {
  if (!event.body) throw new HttpError(400, 'body required');
  const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (Buffer.byteLength(text) > maxBytes) throw new HttpError(413, 'body too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'body must be JSON');
  }
}

function checkQuarterId(id) {
  if (typeof id !== 'string' || !QUARTER_ID.test(id)) throw new HttpError(400, 'invalid quarter id');
  return id;
}

function checkProjectId(id) {
  if (typeof id !== 'string' || !PROJECT_ID.test(id)) throw new HttpError(400, 'invalid project id');
  return id;
}

function checkDate(date) {
  if (!checkISODate(date)) throw new HttpError(400, 'invalid date');
  return date;
}

/** A real YYYY-MM-DD date, not just the right shape (so no 2026-13-45). */
function checkISODate(date) {
  if (typeof date !== 'string' || !ISO_DATE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(date);
}

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const isProjectTask = (t) => isObject(t) && typeof t.id === 'string' && PROJECT_ID.test(t.id) && typeof t.text === 'string' && typeof t.done === 'boolean';

const isProjectNote = (n) => isObject(n) && typeof n.id === 'string' && PROJECT_ID.test(n.id) && checkISODate(n.date) && typeof n.text === 'string';

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function numberRecord(rec) {
  if (rec == null) return undefined;
  if (!isObject(rec) || Object.keys(rec).length > MAX_RECORD_KEYS || !Object.values(rec).every((n) => Number.isFinite(n))) {
    throw new HttpError(400, 'hours and metrics must map ids to numbers');
  }
  return Object.keys(rec).length ? rec : undefined;
}
