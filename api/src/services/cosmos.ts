import { Container, CosmosClient, Database } from '@azure/cosmos';

let _client: CosmosClient | null = null;
let _db: Database | null = null;
let _workspaces: Container | null = null;
let _expenses: Container | null = null;
let _history: Container | null = null;
let _historyEnsured = false;
let _pushSubs: Container | null = null;
let _pushSubsEnsured = false;
let _scheduled: Container | null = null;
let _scheduledEnsured = false;

function getClient(): CosmosClient {
  if (_client) return _client;
  const conn = process.env.COSMOS_CONNECTION;
  if (!conn) throw new Error('COSMOS_CONNECTION env variable is not set');
  _client = new CosmosClient(conn);
  return _client;
}

function getDatabase(): Database {
  if (_db) return _db;
  const name = process.env.COSMOS_DB_NAME || 'reno';
  _db = getClient().database(name);
  return _db;
}

export function workspacesContainer(): Container {
  if (_workspaces) return _workspaces;
  _workspaces = getDatabase().container('workspaces');
  return _workspaces;
}

export function expensesContainer(): Container {
  if (_expenses) return _expenses;
  _expenses = getDatabase().container('expenses');
  return _expenses;
}

/**
 * Lazily ensures the `history` container exists with the right partition key.
 * Safe to call on every request; the Cosmos SDK only issues the network call once.
 */
export async function historyContainer(): Promise<Container> {
  if (_history && _historyEnsured) return _history;
  if (!_historyEnsured) {
    const db = getDatabase();
    await db.containers.createIfNotExists({
      id: 'history',
      partitionKey: { paths: ['/workspaceId'] },
    });
    _historyEnsured = true;
  }
  if (!_history) _history = getDatabase().container('history');
  return _history;
}

export async function pushSubscriptionsContainer(): Promise<Container> {
  if (_pushSubs && _pushSubsEnsured) return _pushSubs;
  if (!_pushSubsEnsured) {
    const db = getDatabase();
    await db.containers.createIfNotExists({
      id: 'pushSubscriptions',
      partitionKey: { paths: ['/workspaceId'] },
    });
    _pushSubsEnsured = true;
  }
  if (!_pushSubs) _pushSubs = getDatabase().container('pushSubscriptions');
  return _pushSubs;
}

export async function scheduledNotificationsContainer(): Promise<Container> {
  if (_scheduled && _scheduledEnsured) return _scheduled;
  if (!_scheduledEnsured) {
    const db = getDatabase();
    await db.containers.createIfNotExists({
      id: 'scheduledNotifications',
      partitionKey: { paths: ['/workspaceId'] },
    });
    _scheduledEnsured = true;
  }
  if (!_scheduled) _scheduled = getDatabase().container('scheduledNotifications');
  return _scheduled;
}

