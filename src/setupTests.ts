
// Yjs needs Web Crypto, which Jest's environments don't expose.
if (!(globalThis as any).crypto) (globalThis as any).crypto = require('crypto').webcrypto;
export {};
