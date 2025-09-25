/**
 * Shared type definitions for the Rulesets v0.4 toolchain.
 *
 * These types are intentionally conservative placeholders that unblock
 * early package wiring. As the orchestrator solidifies, expand each
 * contract with concrete fields and invariants.
 */
export const RULESETS_VERSION_TAG = "0.4.0-next.0";
export const createResultOk = (value) => ({ ok: true, value });
export const createResultErr = (error) => ({
  ok: false,
  error,
});
export const defineCapability = (descriptor) => descriptor;
