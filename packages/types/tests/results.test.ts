import { describe, expect, test } from "bun:test";

import {
  createResultErr,
  createResultOk,
  createRulesetError,
  isResultErr,
  isResultOk,
  RULESET_ERROR_CODES,
} from "../src/index";

describe("result primitives", () => {
  test("createResultOk wraps payload without freezing value", () => {
    const value = { key: "value" };
    const result = createResultOk(value);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(value);
    expect(isResultOk(result)).toBe(true);
    expect(isResultErr(result)).toBe(false);
  });

  test("createResultErr preserves error payload", () => {
    const error = new Error("kaboom");
    const result = createResultErr(error);

    expect(result.ok).toBe(false);
    expect(result.error).toBe(error);
    expect(isResultErr(result)).toBe(true);
    expect(isResultOk(result)).toBe(false);
  });
});

describe("ruleset error helpers", () => {
  test("createRulesetError freezes diagnostics and details", () => {
    const diagnostics = [
      {
        level: "error",
        message: "Something failed",
      },
    ] as const;

    const fallbackCode = RULESET_ERROR_CODES.at(-1);

    const error = createRulesetError({
      code: fallbackCode ?? "INTERNAL_ERROR",
      message: "Internal failure",
      diagnostics,
      details: { attempt: 3 },
    });

    expect(error.diagnostics).toBeDefined();
    expect(error.diagnostics).not.toBe(diagnostics);
    expect(error.diagnostics).toEqual(diagnostics);
    expect(Object.isFrozen(error.diagnostics)).toBe(true);
    expect(Object.isFrozen(error)).toBe(true);
  });

  test("createRulesetError omits optional properties when not provided", () => {
    const error = createRulesetError({
      code: "VALIDATION_ERROR",
      message: "Missing required field",
    });

    expect(error.details).toBeUndefined();
    expect(error.diagnostics).toBeUndefined();
    expect(isResultErr(createResultErr(error))).toBe(true);
  });
});
