import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { initDatabase, closeDatabase, getDatabase } from '../../server/db/connection.js';
import { runMigrations } from '../../server/db/migrator.js';
import { withTransaction } from '../../server/db/transactions.js';

describe('Relational Database Foundation & Migration Suite', () => {
  before(() => {
    // Initialize clean in-memory database for isolated test execution
    initDatabase(':memory:');
  });

  after(() => {
    closeDatabase();
  });

  test('1. Database migration succeeds from clean database', () => {
    const applied = runMigrations();
    assert.strictEqual(applied.length >= 1, true, 'At least one migration should be applied');
    assert.strictEqual(applied[0].version, '1');

    const db = getDatabase();
    const tables = db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('schema_migrations', 'system_metadata', 'system_modules', 'system_module_configs');"
    );
    assert.strictEqual(tables.length, 4, 'All 4 baseline tables must exist in schema');
  });

  test('2. Migration runner is deterministic on repeated runs', () => {
    const secondRun = runMigrations();
    assert.strictEqual(secondRun.length, 0, 'No migrations should be re-applied on subsequent runs');
  });

  test('3. Foreign-key enforcement is strictly enabled (PRAGMA foreign_keys = ON)', () => {
    const db = getDatabase();
    const fkCheck = db.queryOne<{ foreign_keys: number }>('PRAGMA foreign_keys;');
    assert.strictEqual(fkCheck?.foreign_keys, 1, 'Foreign keys must be active');

    // Attempt to insert child row with non-existent parent module
    assert.throws(
      () => {
        db.execute(
          'INSERT INTO system_module_configs (id, module_id, config_key, config_val) VALUES (?, ?, ?, ?);',
          ['cfg-test-orphan', 'non-existent-module-id', 'test_key', 'test_val']
        );
      },
      (err: Error) => {
        return err.message.includes('FOREIGN KEY constraint failed');
      },
      'Inserting orphan config without parent module must throw FOREIGN KEY constraint violation'
    );
  });

  test('4. Foreign key cascading works on valid parent deletion', () => {
    const db = getDatabase();
    db.execute('INSERT INTO system_modules (id, name, version, created_at) VALUES (?, ?, ?, ?);', [
      'mod-auth',
      'AuthModule',
      '1.0.0',
      new Date().toISOString(),
    ]);

    db.execute(
      'INSERT INTO system_module_configs (id, module_id, config_key, config_val) VALUES (?, ?, ?, ?);',
      ['cfg-auth-1', 'mod-auth', 'token_ttl', '900']
    );

    const childBefore = db.queryOne<{ id: string }>(
      'SELECT id FROM system_module_configs WHERE id = ?;',
      ['cfg-auth-1']
    );
    assert.strictEqual(childBefore?.id, 'cfg-auth-1');

    // Delete parent
    db.execute('DELETE FROM system_modules WHERE id = ?;', ['mod-auth']);

    // Verify cascade deleted child
    const childAfter = db.queryOne<{ id: string }>(
      'SELECT id FROM system_module_configs WHERE id = ?;',
      ['cfg-auth-1']
    );
    assert.strictEqual(childAfter, null, 'Child config must be cascade-deleted when parent module is deleted');
  });

  test('5. Transaction rollback works on failure (Atomic guarantee)', async () => {
    const db = getDatabase();
    const testKey = 'test_tx_key';

    // Verify key does not exist initially
    const initial = db.queryOne('SELECT value FROM system_metadata WHERE key = ?;', [testKey]);
    assert.strictEqual(initial, null);

    // Run transaction that intentionally fails halfway
    await assert.rejects(
      async () => {
        await withTransaction(({ db: txDb }) => {
          txDb.execute(
            'INSERT INTO system_metadata (key, value, updated_at) VALUES (?, ?, ?);',
            [testKey, 'temporary_uncommitted_value', new Date().toISOString()]
          );
          // Intentional failure to trigger rollback
          throw new Error('Simulated runtime error inside business transaction');
        });
      },
      /Simulated runtime error/
    );

    // Verify written data was rolled back and does NOT exist in database
    const afterRollback = db.queryOne('SELECT value FROM system_metadata WHERE key = ?;', [testKey]);
    assert.strictEqual(afterRollback, null, 'Uncommitted insert must be completely rolled back');
  });
});
