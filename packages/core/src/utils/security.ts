import { isAbsolute, relative, resolve } from 'node:path';

// TLDR: Security helpers and validators (mixd-v0)
const MAX_PACKAGE_NAME_LENGTH = 214; // mixd-v0
const DANGEROUS_CHARS_RE = /[;&|`$<>\\]/; // mixd-perf: precompiled once at module scope
const VALID_PATTERNS = [
  /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/i, // Scoped package
  /^[a-z0-9-~][a-z0-9-._~]*$/i, // Regular package
  /^[a-z0-9-]+\/[a-z0-9-]+$/i, // GitHub shorthand
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
  return !(relativePath.startsWith('..') || isAbsolute(relativePath));
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
  if (packageName.includes('..') || packageName.includes('//')) {
    return false;
  }

  // Reject if it contains shell metacharacters
  if (DANGEROUS_CHARS_RE.test(packageName)) {
    return false;
  }

  // Allow npm scoped packages, GitHub URLs, and regular names
  return VALID_PATTERNS.some((pattern) =>
    pattern.test(packageName.toLowerCase())
  );
}

/**
 * Sanitizes a file path by removing dangerous characters
 * @param filePath The file path to sanitize
 * @returns The sanitized file path
 */
export function sanitizePath(filePath: string): string {
  // Remove null bytes and other dangerous characters
  return filePath
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\r\n]/g, '') // Remove line breaks
    .trim();
}
