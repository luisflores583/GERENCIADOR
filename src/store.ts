import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { logger, maskPhone } from './logger';
import type { Outgoing, Patient, Session } from './types';

export interface Store {
  getPatient(phone: string): Patient | undefined;
  savePatient(patient: Patient): void;
  getSession(phone: string): Session | undefined;
  saveSession(session: Session): void;
  beginMessage(id: string): 'new' | 'done' | 'inflight';
  getReplies(id: string): Outgoing[] | undefined;
  saveReplies(id: string, replies: Outgoing[]): void;
  completeMessage(id: string): void;
  abortMessage(id: string): void;
  close(): void;
}

interface PatientRow {
  phone: string;
  name: string;
  updated_at: string;
}

interface SessionRow {
  data: string;
}

interface ReplyRow {
  replies: string;
}

export class SqliteStore implements Store {
  private readonly db: DatabaseSync;
  private readonly inflight = new Set<string>();

  constructor(filename: string) {
    if (filename !== ':memory:') {
      fs.mkdirSync(path.dirname(filename), { recursive: true });
    }
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        phone TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        phone TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS message_replies (
        id TEXT PRIMARY KEY,
        replies TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS seen_messages (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      );
    `);
  }

  getPatient(phone: string): Patient | undefined {
    const row = this.db.prepare('SELECT phone, name, updated_at FROM patients WHERE phone = ?').get(phone) as
      | PatientRow
      | undefined;
    if (!row) return undefined;
    return { phone: row.phone, name: row.name, updatedAt: row.updated_at };
  }

  savePatient(patient: Patient): void {
    this.db
      .prepare(
        `INSERT INTO patients (phone, name, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(phone) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
      )
      .run(patient.phone, patient.name, patient.updatedAt);
  }

  getSession(phone: string): Session | undefined {
    const row = this.db.prepare('SELECT data FROM sessions WHERE phone = ?').get(phone) as SessionRow | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.data) as Session;
    } catch {
      logger.error('session_corrompida', { phone: maskPhone(phone) });
      return undefined;
    }
  }

  saveSession(session: Session): void {
    this.db
      .prepare(
        `INSERT INTO sessions (phone, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(phone) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(session.phone, JSON.stringify(session), session.updatedAt);
  }

  beginMessage(id: string): 'new' | 'done' | 'inflight' {
    const seen = this.db.prepare('SELECT id FROM seen_messages WHERE id = ?').get(id);
    if (seen) return 'done';
    if (this.inflight.has(id)) return 'inflight';
    this.inflight.add(id);
    return 'new';
  }

  getReplies(id: string): Outgoing[] | undefined {
    const row = this.db.prepare('SELECT replies FROM message_replies WHERE id = ?').get(id) as ReplyRow | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.replies) as Outgoing[];
    } catch {
      return undefined;
    }
  }

  saveReplies(id: string, replies: Outgoing[]): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO message_replies (id, replies, created_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET replies = excluded.replies`,
      )
      .run(id, JSON.stringify(replies), now);
  }

  completeMessage(id: string): void {
    this.inflight.delete(id);
    const now = new Date().toISOString();
    this.db.prepare('INSERT OR IGNORE INTO seen_messages (id, created_at) VALUES (?, ?)').run(id, now);
    this.db.prepare('DELETE FROM message_replies WHERE id = ?').run(id);
    this.db.exec(`
      DELETE FROM seen_messages
      WHERE rowid NOT IN (SELECT rowid FROM seen_messages ORDER BY rowid DESC LIMIT 1000)
    `);
  }

  abortMessage(id: string): void {
    this.inflight.delete(id);
  }

  close(): void {
    this.db.close();
  }
}
