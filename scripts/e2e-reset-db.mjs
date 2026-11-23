// Recreates the e2e database so every Playwright run starts with a fresh install (setup screen).
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL ?? '');
const dbName = url.pathname.slice(1);
if (!dbName.endsWith('_e2e')) throw new Error(`Refusing to reset non-e2e database "${dbName}"`);

url.pathname = '/postgres';
const sql = postgres(url.toString(), { onnotice: () => {} });
await sql.unsafe(`drop database if exists "${dbName}" with (force)`);
await sql.unsafe(`create database "${dbName}"`);
await sql.end();
console.log(`e2e database ${dbName} reset`);
