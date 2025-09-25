import { describe, expect, test } from "bun:test";

import {
  getRulesetCapability,
  isKnownRulesetCapability,
  listRulesetCapabilities,
  RULESET_CAPABILITIES,
  resolveRulesetCapabilities,
} from "../src/index";

describe("capability registry", () => {
  test("exposes every descriptor via list helper", () => {
    const listed = listRulesetCapabilities();
    const fromValues = Object.values(RULESET_CAPABILITIES);

    expect(listed.length).toBe(fromValues.length);
    for (const descriptor of fromValues) {
      expect(listed).toContain(descriptor);
    }
  });

  test("retrieves descriptors by capability id", () => {
    const capability = getRulesetCapability("render:markdown");

    expect(capability).toBeDefined();
    expect(capability?.id).toBe("render:markdown");
    expect(capability).toBe(RULESET_CAPABILITIES.MARKDOWN_RENDER);
  });

  test("supports capability resolution with graceful fallback", () => {
    const resolved = resolveRulesetCapabilities([
      "render:handlebars",
      "does-not-exist",
    ]);

    expect(resolved.length).toBe(1);
    expect(resolved[0]).toBe(RULESET_CAPABILITIES.HANDLEBARS_RENDER);
  });

  test("detects known capability identifiers", () => {
    expect(isKnownRulesetCapability("render:markdown")).toBe(true);
    expect(isKnownRulesetCapability("unknown:capability")).toBe(false);
  });
});
