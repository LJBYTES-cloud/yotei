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
          subject_code TEXT NOT NULL DEFAULT 'GEN-101' CHECK (length(trim(subject_code)) BETWEEN 1 AND 32),
          field_of_study TEXT NOT NULL DEFAULT 'General' CHECK (length(trim(field_of_study)) > 0),
          field_colors TEXT NOT NULL DEFAULT '#C2ACF3',
          UNIQUE (id, user_id)
        );

        CREATE TABLE IF NOT EXISTS Task (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          subject_id INTEGER NOT NULL,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          description TEXT,
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
          status TEXT NOT NULL DEFAULT 'scheduled',
          actual_start_time TEXT,
          break_time_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_time_minutes >= 0),
          break_started_at TEXT,
          break_time_ms INTEGER NOT NULL DEFAULT 0 CHECK (break_time_ms >= 0),
          actual_end_time TEXT,
          actual_study_seconds INTEGER NOT NULL DEFAULT 0 CHECK (actual_study_seconds >= 0),
          rescheduled_from INTEGER REFERENCES StudyBlock (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS ReflectionItem (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id INTEGER NOT NULL REFERENCES Subject (id) ON DELETE CASCADE,
          study_block_id INTEGER REFERENCES StudyBlock (id) ON DELETE SET NULL,
          note TEXT NOT NULL CHECK (length(trim(note)) > 0),
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Material (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id INTEGER NOT NULL REFERENCES Subject (id) ON DELETE CASCADE,
          task_id INTEGER REFERENCES Task (id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          url_or_note TEXT,
          local_file_path TEXT
        );

        CREATE TABLE IF NOT EXISTS JournalEntry (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          content TEXT NOT NULL CHECK (length(trim(content)) > 0),
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_subject_user ON Subject (user_id, id);
        CREATE INDEX IF NOT EXISTS idx_task_user ON Task (user_id, id);
        CREATE INDEX IF NOT EXISTS idx_task_user_deadline ON Task (user_id, deadline);
        CREATE INDEX IF NOT EXISTS idx_task_subject ON Task (subject_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_study_block_task ON StudyBlock (task_id);
        CREATE INDEX IF NOT EXISTS idx_study_block_task_time ON StudyBlock (task_id, start_time, end_time);
        CREATE INDEX IF NOT EXISTS idx_reflection_subject_created ON ReflectionItem (subject_id, created_at, id);
        CREATE INDEX IF NOT EXISTS idx_material_subject ON Material (subject_id);
        CREATE INDEX IF NOT EXISTS idx_material_task ON Material (task_id);
        CREATE INDEX IF NOT EXISTS idx_journal_user_created ON JournalEntry (user_id, created_at, id);
      `);
      const legacyReviews = await database.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ReviewItem'");
      if (legacyReviews) {
        // Preserve IDs/subjects and all topic text as journal notes. The old
        // review schedule is intentionally retired by the reflection pivot.
        await database.execAsync(`INSERT INTO ReflectionItem (id, subject_id, study_block_id, note, created_at)
          SELECT id, subject_id, NULL, topic, COALESCE(last_reviewed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) FROM ReviewItem;
          DROP TABLE ReviewItem;`);
      }
      const taskColumns = /** @type {{name: string}[]} */ (await database.getAllAsync('PRAGMA table_info(Task)'));
      if (!taskColumns.some(column => column.name === 'description')) await database.execAsync('ALTER TABLE Task ADD COLUMN description TEXT');
      // ALTER preserves subject IDs and all dependent foreign keys. Copy the
      // legacy color before dropping it, in the same retryable transaction.
      const subjectColumns = /** @type {{ name: string }[]} */ (await database.getAllAsync('PRAGMA table_info(Subject)'));
      if (!subjectColumns.some(column => column.name === 'subject_code')) {
        await database.execAsync("ALTER TABLE Subject ADD COLUMN subject_code TEXT NOT NULL DEFAULT 'GEN-101' CHECK (length(trim(subject_code)) BETWEEN 1 AND 32)");
      }
      if (!subjectColumns.some(column => column.name === 'field_of_study')) {
        await database.execAsync("ALTER TABLE Subject ADD COLUMN field_of_study TEXT NOT NULL DEFAULT 'General' CHECK (length(trim(field_of_study)) > 0)");
      }
      if (!subjectColumns.some(column => column.name === 'field_colors')) {
        await database.execAsync("ALTER TABLE Subject ADD COLUMN field_colors TEXT NOT NULL DEFAULT '#C2ACF3'");
        if (subjectColumns.some(column => column.name === 'color')) {
          await database.execAsync('UPDATE Subject SET field_colors = color');
        }
      }
      if (subjectColumns.some(column => column.name === 'color')) {
        await database.execAsync('ALTER TABLE Subject DROP COLUMN color');
      }
      await database.execAsync('CREATE INDEX IF NOT EXISTS idx_subject_user_field ON Subject (user_id, field_of_study, id)');
      // Existing installations already have StudyBlock; CREATE IF NOT EXISTS
      // cannot add its new column. Migrate inside the initialization transaction.
      const columns = /** @type {{ name: string }[]} */ (await database.getAllAsync('PRAGMA table_info(StudyBlock)'));
      if (!columns.some(column => column.name === 'rescheduled_from')) {
        await database.execAsync('ALTER TABLE StudyBlock ADD COLUMN rescheduled_from INTEGER REFERENCES StudyBlock (id) ON DELETE SET NULL');
      }
      const timerColumns = [
        ['actual_start_time', 'TEXT'], ['break_time_minutes', 'INTEGER NOT NULL DEFAULT 0 CHECK (break_time_minutes >= 0)'],
        ['break_started_at', 'TEXT'], ['break_time_ms', 'INTEGER NOT NULL DEFAULT 0 CHECK (break_time_ms >= 0)'],
        ['actual_end_time', 'TEXT'], ['actual_study_seconds', 'INTEGER NOT NULL DEFAULT 0 CHECK (actual_study_seconds >= 0)'],
      ];
      for (const [name, definition] of timerColumns) {
        if (!columns.some(column => column.name === name)) await database.execAsync(`ALTER TABLE StudyBlock ADD COLUMN ${name} ${definition}`);
      }
      await database.execAsync(`
        UPDATE StudyBlock SET status = 'scheduled' WHERE status = 'planned';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_study_block_rescheduled_from ON StudyBlock (rescheduled_from) WHERE rescheduled_from IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_study_block_status_end ON StudyBlock (status, end_time);
        CREATE TRIGGER IF NOT EXISTS count_study_block_postponement
        AFTER INSERT ON StudyBlock WHEN NEW.rescheduled_from IS NOT NULL
        BEGIN
          UPDATE Task SET postpone_count = postpone_count + 1 WHERE id = NEW.task_id;
        END;
        UPDATE Task SET postpone_count = MAX(postpone_count, (
          SELECT COUNT(*) FROM StudyBlock WHERE task_id = Task.id AND rescheduled_from IS NOT NULL
        ));
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
