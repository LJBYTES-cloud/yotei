import { openDatabaseAsync } from 'expo-sqlite';

/** @type {Promise<import('expo-sqlite').SQLiteDatabase> | null} */
let databasePromise = null;

async function initializeDatabase() {
  const database = await openDatabaseAsync('yotei.db');
  try {
    await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    // The connection is only exposed after initialization, so service queries
    // cannot accidentally join this schema transaction.
    await database.withTransactionAsync(async () => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS Subject (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL CHECK (length(trim(name)) > 0),
          color TEXT NOT NULL DEFAULT '#B8A0F5',
          UNIQUE (id, user_id)
        );

        CREATE TABLE IF NOT EXISTS Task (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          subject_id INTEGER NOT NULL,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          deadline TEXT,
          estimated_minutes INTEGER NOT NULL DEFAULT 30 CHECK (estimated_minutes > 0),
          status TEXT NOT NULL DEFAULT 'pending',
          postpone_count INTEGER NOT NULL DEFAULT 0 CHECK (postpone_count >= 0),
          FOREIGN KEY (subject_id, user_id) REFERENCES Subject (id, user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS StudyBlock (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL REFERENCES Task (id) ON DELETE CASCADE,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'planned'
        );

        CREATE TABLE IF NOT EXISTS ReviewItem (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id INTEGER NOT NULL REFERENCES Subject (id) ON DELETE CASCADE,
          topic TEXT NOT NULL,
          last_reviewed_at TEXT,
          next_review_at TEXT
        );

        CREATE TABLE IF NOT EXISTS Material (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id INTEGER NOT NULL REFERENCES Subject (id) ON DELETE CASCADE,
          task_id INTEGER REFERENCES Task (id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          url_or_note TEXT,
          local_file_path TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_subject_user ON Subject (user_id, id);
        CREATE INDEX IF NOT EXISTS idx_task_user ON Task (user_id, id);
        CREATE INDEX IF NOT EXISTS idx_task_subject ON Task (subject_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_study_block_task ON StudyBlock (task_id);
        CREATE INDEX IF NOT EXISTS idx_review_subject ON ReviewItem (subject_id);
        CREATE INDEX IF NOT EXISTS idx_material_subject ON Material (subject_id);
        CREATE INDEX IF NOT EXISTS idx_material_task ON Material (task_id);
      `);
    });
    return database;
  } catch (error) {
    await database.closeAsync().catch(() => {});
    throw error;
  }
}

/** Share one initialized connection; a failed initialization can be retried. */
export function getDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch(error => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

/** @param {string} userId */
export function requireUserId(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Sign in before accessing your study space.');
  }
}
