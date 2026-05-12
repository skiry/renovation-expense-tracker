// Polyfill globalThis.crypto for Node 18 < 18.17 (Cosmos SDK uses Web Crypto internally)
if (!(globalThis as any).crypto) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (globalThis as any).crypto = require('crypto').webcrypto;
}

// Entry point: importing each module triggers the @azure/functions app.http() registrations.
import './functions/auth';
import './functions/expenses';
import './functions/details';
import './functions/photos';
import './functions/exchangeRate';
