import { promises as fs } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

/** Maximum safe length for package names (mirrors npm constraints). */
const MAX_PACKAGE_NAME_LENGTH = 214;
/** Characters that may lead to shell injection if allowed in package names. */
const DANGEROUS_CHARS_RE = /[;&|`$<>\\]/;
const VALID_PATTERNS = [
  /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/, // Scoped npm (lowercase only)
  /^[a-z0-9-~][a-z0-9-._~]*$/, // Unscoped npm (lowercase only)
  /^[a-z0-9-]+\/[a-z0-9-]+$/i, // GitHub shorthand (case-insensitive)
];

/**
 * Validates that a resolved path stays within the allowed boundary
 * @param resolvedPath The absolute path to validate
 * @param boundaryPath The boundary directory that the path must be within
 * @returns true if the path is safe, false otherwise
 */
export function isPathWithinBoundary(
  resolvedPath: string,
  boundaryPath: string
): boolean {
  const normalizedResolved = resolve(resolvedPath);
  const normalizedBoundary = resolve(boundaryPath);

  // Calculate relative path from boundary to resolved
  const relativePath = relative(normalizedBoundary, normalizedResolved);

  // If the relative path starts with "..", it's outside the boundary
  // Also reject if it's an absolute path (shouldn't happen after relative())
  return !(relativePath.startsWith("..") || isAbsolute(relativePath));
}

async function resolveRealPathAllowingNonexistent(
  pathToResolve: string
): Promise<string> {
  const target = resolve(pathToResolve);
  try {
    return await fs.realpath(target);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw err;
    }
  }

  // Ascend until a resolvable ancestor is found, then join the remainder.
  let current = target;
  for (;;) {
    const parent = dirname(current);

    if (parent === current) {
      // Reached filesystem root without a resolvable ancestor; fall back.
      return target;
    }

    try {
      const realParent = await fs.realpath(parent);
      const remainder = relative(parent, target);
      return resolve(realParent, remainder);
    } catch (parentError) {
      const code = (parentError as NodeJS.ErrnoException).code;
      if (code && code !== "ENOENT") {
        throw parentError;
      }
    }

    current = parent;
  }
}

/**
 * Validates that the real path (resolving symlinks) stays within the boundary.
 * This guards against symlink escapes where the normalized path appears safe.
 *
 * @param targetPath The path to validate (may not exist yet)
 * @param boundaryPath The directory boundary that must contain the target
 * @returns Promise resolving to true if the real path is within the boundary
 */
export async function isPathWithinBoundaryReal(
  targetPath: string,
  boundaryPath: string
): Promise<boolean> {
  try {
    const [realTarget, realBoundary] = await Promise.all([
      resolveRealPathAllowingNonexistent(targetPath),
      fs.realpath(resolve(boundaryPath)),
    ]);
    const relativePath = relative(realBoundary, realTarget);
    return !(relativePath.startsWith("..") || isAbsolute(relativePath));
  } catch {
    return false;
  }
}

/**
 * Validates a package name for safety
 * @param packageName The package name to validate
 * @returns true if the package name is safe, false otherwise
 */
export function isValidPackageName(packageName: string): boolean {
  // Reject if empty or too long
  if (!packageName || packageName.length > MAX_PACKAGE_NAME_LENGTH) {
    return false;
  }

  // Reject if it contains path traversal patterns
  if (packageName.includes("..") || packageName.includes("//")) {
    return false;
  }

  // Reject if it contains shell metacharacters
  if (DANGEROUS_CHARS_RE.test(packageName)) {
    return false;
  }

  // Allow npm scoped packages, GitHub URLs, and regular names
  return VALID_PATTERNS.some((pattern) => pattern.test(packageName));
}

/**
 * Sanitizes a file path by stripping NUL/CRLF characters and trimming whitespace
 * @param filePath The file path to sanitize
 * @returns The sanitized file path
 */
export function sanitizePath(filePath: string): string {
  // Remove null bytes and other dangerous characters
  return filePath
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[\r\n]/g, "") // Remove line breaks
    .trim();
}

/**
 * Validates the nesting depth of an object
 * @param obj The object to validate
 * @param maxDepth Maximum allowed nesting depth
 * @param currentDepth Current recursion depth
 * @returns true if the object depth is within limits, false otherwise
 */
export function validateObjectDepth(
  obj: unknown,
  maxDepth: number,
  currentDepth = 0,
  seen: WeakSet<object> = new WeakSet()
): boolean {
  if (currentDepth > maxDepth) {
    return false;
  }

  if (obj === null || obj === undefined) {
    return true;
  }

  if (typeof obj !== "object") {
    return true;
  }

  const asObj = obj as object;
  if (seen.has(asObj)) {
    return false;
  }
  seen.add(asObj);

  if (Array.isArray(obj)) {
    const result = obj.every((item) =>
      validateObjectDepth(item, maxDepth, currentDepth + 1, seen)
    );
    seen.delete(asObj);
    return result;
  }

  const result = Object.values(obj).every((value) =>
    validateObjectDepth(value, maxDepth, currentDepth + 1, seen)
  );
  seen.delete(asObj);
  return result;
}
