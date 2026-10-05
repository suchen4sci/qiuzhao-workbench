'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { AsyncLocalStorage } = require('node:async_hooks');

const VERSION = 1;
const COLLECTIONS = new Set(['organizations', 'opportunities', 'preferences', 'watches', 'userOpportunities', 'plans', 'applications', 'events', 'tasks', 'activities', 'reminders', 'assets', 'profileRevisions', 'snapshots', 'connections', 'syncRuns', 'sources', 'evidence', 'discoveryRuns', 'briefings', 'notes', 'aiJobs', 'settings', 'messages', 'confirmations']);
const MAX_DOCUMENT = 2 * 1024 * 1024;
function assertCollection(collection) {
  if (!COLLECTIONS.has(collection)) throw Error('未知数据类型');
}
function identifier(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(id)) throw Error('记录标识无效');
  return id;
}
function plainDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('记录必须是对象');
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > MAX_DOCUMENT) throw Error('记录过大，请将附件保存在文件库');
  return JSON.parse(json);
}
function conflict() { const error = Error('内容已被更新，请刷新后再保存'); error.code = 'REVISION_CONFLICT'; return error; }
function openStore(workspace, { clock = () => new Date().toISOString() } = {}) {
  const directory = path.join(workspace, '.workbench');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, 'workbench.sqlite');
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > VERSION) throw Error('此工作区由更新版本创建，请升级应用后打开');
    if (version === 0) {
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE documents (collection TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL CHECK(json_valid(document)), PRIMARY KEY(collection,id));
        CREATE INDEX documents_collection_updated ON documents(collection,updated_at);
        CREATE TABLE audit (sequence INTEGER PRIMARY KEY AUTOINCREMENT, collection TEXT NOT NULL, id TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER NOT NULL, at TEXT NOT NULL);
        PRAGMA user_version=1; COMMIT;`);
    }
    fs.chmodSync(filename, 0o600);
  } catch (error) { db.close(); throw error; }
  let depth = 0, closed = false;
  const transactionContext = new AsyncLocalStorage();
  function ensureOpen() {
    if (closed) throw Error('工作区已关闭');
    if (transactionContext.getStore()?.active === false) throw Error('事务已结束，不能继续异步写入');
  }
  function transaction(fn) {
    ensureOpen();
    if (fn?.constructor?.name === 'AsyncFunction') throw Error('数据事务不能包含异步操作');
    return transactionContext.run({ active: true }, () => {
      const context = transactionContext.getStore();
      const savepoint = depth ? `nested_${depth}` : null;
      db.exec(savepoint ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE'); depth++;
      try {
        const value = fn();
        if (value && typeof value.then === 'function') {
          Promise.resolve(value).catch(() => {});
          throw Error('数据事务不能包含异步操作');
        }
        db.exec(savepoint ? `RELEASE ${savepoint}` : 'COMMIT'); return value;
      } catch (error) {
        db.exec(savepoint ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK');
        throw error;
      } finally { depth--; context.active = false; }
    });
  }
  function nextRevision(collection, id, minimum = 0) {
    const highest = db.prepare('SELECT MAX(revision) AS highest FROM audit WHERE collection=? AND id=?').get(collection, id).highest || 0;
    return Math.max(highest, minimum) + 1;
  }

  function get(collection, id) {
    ensureOpen(); assertCollection(collection); identifier(id);
    const row = db.prepare('SELECT document FROM documents WHERE collection=? AND id=?').get(collection, id);
    return row ? JSON.parse(row.document) : null;
  }
  function list(collection) {
    ensureOpen(); assertCollection(collection);
    return db.prepare('SELECT document FROM documents WHERE collection=? ORDER BY created_at,id').all(collection).map(row => JSON.parse(row.document));
  }
  function put(collection, input, { expectedRevision } = {}) {
    assertCollection(collection);
    const document = plainDocument(input), id = identifier(document.id || randomUUID());
    return transaction(() => {
      const before = get(collection, id);
      if (expectedRevision !== undefined && expectedRevision !== (before?.revision || 0)) throw conflict();
      // Existing writes always require an observed revision; avoids stale GUI/provider updates.
      if (before && expectedRevision === undefined) throw conflict();
      const at = clock();
      const next = { ...document, id, revision: nextRevision(collection, id, before?.revision || 0), createdAt: before?.createdAt || at, updatedAt: at };
      const json = JSON.stringify(next);
      if (Buffer.byteLength(json) > MAX_DOCUMENT) throw Error('记录过大');
      db.prepare('INSERT INTO documents VALUES (?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET revision=excluded.revision,updated_at=excluded.updated_at,document=excluded.document').run(collection, id, next.revision, next.createdAt, at, json);
      db.prepare('INSERT INTO audit(collection,id,action,revision,at) VALUES(?,?,?,?,?)').run(collection, id, before ? 'update' : 'create', next.revision, at);
      return next;
    });
  }
  function remove(collection, id, expectedRevision) {
    return transaction(() => {
      const before = get(collection, id);
      if (!before) return false;
      if (before.revision !== expectedRevision) throw conflict();
      db.prepare('DELETE FROM documents WHERE collection=? AND id=?').run(collection, id);
      db.prepare('INSERT INTO audit(collection,id,action,revision,at) VALUES(?,?,?,?,?)').run(collection, id, 'delete', before.revision, clock());
      return true;
    });
  }
  function exportData() {
    return transaction(() => ({ schemaVersion: VERSION, exportedAt: clock(), collections: Object.fromEntries([...COLLECTIONS].map(c => [c, list(c)])) }));
  }
  function validateBackup(backup) {
    if (!backup || backup.schemaVersion !== VERSION || !backup.collections || Array.isArray(backup.collections)) throw Error('备份版本或结构不受支持');
    const result = {};
    for (const [collection, entries] of Object.entries(backup.collections)) {
      assertCollection(collection);
      if (!Array.isArray(entries)) throw Error('备份记录无效');
      const ids = new Set();
      result[collection] = entries.map(entry => {
        const item = plainDocument(entry); identifier(item.id);
        if (ids.has(item.id) || !Number.isInteger(item.revision) || item.revision < 1 || !Number.isFinite(Date.parse(item.createdAt)) || !Number.isFinite(Date.parse(item.updatedAt))) throw Error('备份记录重复或版本/时间无效');
        ids.add(item.id); return item;
      });
    }
    // A partial backup must never silently wipe omitted collections.
    if (Object.keys(result).length !== COLLECTIONS.size) throw Error('备份不完整，未恢复');
    return result;
  }
  function restoreData(backup) {
    const data = validateBackup(backup);
    return transaction(() => {
      // Revision numbers only move forward, including restoration, to invalidate stale editors.
      const previous = exportData();
      const revisions = new Map([...COLLECTIONS].flatMap(c => previous.collections[c].map(d => [`${c}/${d.id}`, d.revision])));
      db.exec('DELETE FROM documents');
      for (const [collection, entries] of Object.entries(data)) for (const entry of entries) {
        const restored = { ...entry, revision: nextRevision(collection, entry.id, Math.max(entry.revision, revisions.get(`${collection}/${entry.id}`) || 0)), updatedAt: clock() };
        db.prepare('INSERT INTO documents VALUES (?,?,?,?,?,?)').run(collection, restored.id, restored.revision, restored.createdAt, restored.updatedAt, JSON.stringify(restored));
        db.prepare('INSERT INTO audit(collection,id,action,revision,at) VALUES(?,?,?,?,?)').run(collection, restored.id, 'restore', restored.revision, restored.updatedAt);
      }
      return previous;
    });
  }
  function close() { if (!closed) { db.close(); closed = true; } }
  return { get, list, put, remove, transaction, exportData, validateBackup, restoreData, close, directory, filename, schemaVersion: VERSION };
}
module.exports = { openStore, COLLECTIONS, VERSION };
