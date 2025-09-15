import { promises as fs } from 'node:fs';
import { RESOURCE_LIMITS } from '../config/limits';

const { fileLock: limits } = RESOURCE_LIMITS;

export class FileLock {
  private readonly lockPath: string;

  constructor(filePath: string) {
    this.lockPath = `${filePath}.lock`;
  }

  /**
   * Acquire a lock for the file
   * @param timeout Maximum time to wait for the lock (ms)
   * @returns true if lock acquired, false if timeout
   */
  async acquire(timeout = limits.timeout): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Try to create lock file exclusively
        const fd = await fs.open(this.lockPath, 'wx');
        await fd.write(
          JSON.stringify({
            pid: process.pid,
            timestamp: Date.now(),
          })
        );
        await fd.close();
        return true;
      } catch (error: unknown) {
        // Lock file exists, check if stale
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          const isStale = await this.isLockStale();
          if (isStale) {
            await this.forceRelease();
            continue;
          }
        }
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, limits.retryDelay));
      }
    }
    return false;
  }

  /**
   * Release the lock
   */
  async release(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch {
      // Lock file doesn't exist, that's fine
    }
  }

  /**
   * Force release a lock (use with caution)
   */
  private async forceRelease(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Check if a lock is stale (older than timeout)
   */
  private async isLockStale(): Promise<boolean> {
    try {
      const stat = await fs.stat(this.lockPath);
      const age = Date.now() - stat.mtime.getTime();
      return age > limits.timeout * limits.staleThresholdMultiplier; // Consider stale if threshold multiplier
    } catch {
      return true; // If we can't stat it, consider it stale
    }
  }
}

/**
 * Execute a function with file locking
 * @param filePath The file to lock
 * @param fn The function to execute
 * @returns The result of the function
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>
): Promise<T> {
  const lock = new FileLock(filePath);

  const acquired = await lock.acquire();
  if (!acquired) {
    throw new Error(`Failed to acquire lock for ${filePath}`);
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
