import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

export interface IStorageService {
  save(key: string, data: Buffer, mimeType: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  getBaseDir(): string;
}

/**
 * LocalStorageService implements IStorageService for filesystem-based storage.
 * In production Cloud Run environments, this can be swapped with a Cloud Storage adapter
 * implementing the identical IStorageService interface without altering application domain logic.
 */
export class LocalStorageService implements IStorageService {
  private readonly baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = path.resolve(customBaseDir || config.storageDir);
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o700 });
      logger.info('Storage directory initialized', { baseDir: this.baseDir });
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Resolves and verifies that the key resides strictly inside the base storage directory.
   * Defends against directory traversal (e.g., ../../../etc/passwd).
   */
  private resolveSafePath(key: string): string {
    // Sanitize key by stripping illegal path characters and null bytes
    const sanitizedKey = key.replace(/[\0\r\n]/g, '').trim();
    if (!sanitizedKey || sanitizedKey.includes('..') || path.isAbsolute(sanitizedKey)) {
      throw new AppError(400, 'INVALID_STORAGE_KEY', 'Illegal or insecure storage key path requested.');
    }

    const resolved = path.resolve(this.baseDir, sanitizedKey);
    // Ensure the resolved canonical path starts with the baseDir
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new AppError(403, 'PATH_TRAVERSAL_DETECTED', 'Path traversal attempt blocked.');
    }

    return resolved;
  }

  async save(key: string, data: Buffer, mimeType: string): Promise<string> {
    const filePath = this.resolveSafePath(key);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true, mode: 0o700 });
    }

    // Atomic write using temporary file to prevent partial file corruption
    const tempPath = `${filePath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    try {
      await fs.promises.writeFile(tempPath, data, { mode: 0o600 });
      await fs.promises.rename(tempPath, filePath);
      logger.info('File saved securely to storage', { key, sizeBytes: data.length, mimeType });
      return key;
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try {
          await fs.promises.unlink(tempPath);
        } catch {
          // ignore cleanup error
        }
      }
      logger.error('Failed to write file to storage', err);
      throw new AppError(500, 'STORAGE_WRITE_FAILED', 'Failed to store file in persistent storage.');
    }
  }

  async read(key: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(key);
    if (!fs.existsSync(filePath)) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'The requested file does not exist in storage.');
    }
    return await fs.promises.readFile(filePath);
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info('File deleted from storage', { key });
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Error deleting file from storage', err);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

export const storageService = new LocalStorageService();
