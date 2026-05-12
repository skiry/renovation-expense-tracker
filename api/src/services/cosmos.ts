import { Container, CosmosClient, Database } from '@azure/cosmos';

let _client: CosmosClient | null = null;
let _db: Database | null = null;
let _workspaces: Container | null = null;
let _expenses: Container | null = null;

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
