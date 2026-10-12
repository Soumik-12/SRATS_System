import { getDatabase } from './connection.js';
import { logger } from '../utils/logger.js';
import type { DatabaseAdapter } from '../types/index.js';

export interface TransactionContext {
  db: DatabaseAdapter;
}

/**
 * Executes a unit of work inside an ACID transaction.
 * Commits on success, rolls back on any exception.
 */
export async function withTransaction<T>(
  work: (tx: TransactionContext) => Promise<T> | T
): Promise<T> {
  const db = getDatabase();
  db.execScript('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = await work({ db });
    db.execScript('COMMIT;');
    return result;
  } catch (error) {
    try {
      db.execScript('ROLLBACK;');
      logger.warn('Transaction rolled back due to error', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } catch (rollbackError) {
      logger.error('Failed to rollback transaction', rollbackError);
    }
    throw error;
  }
}
