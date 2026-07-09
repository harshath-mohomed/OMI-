import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'omi.db');

const db = new Database(dbPath);
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

db.exec(schema);
console.log('Database schema successfully synchronized.');
db.close();