import { describe, expect, test } from "bun:test";

import { RULESET_CAPABILITIES, type RulesetVersionTag } from "@rulesets/types";

import {
  defineProvider,
  evaluateProviderCompatibility,
  PROVIDER_SDK_VERSION,
  providerCapability,
  unsupportedCapability,
} from "../src/index";

describe("provider capability helpers", () => {
  test("hydrates known capability descriptors", () => {
    const capability = providerCapability("render:markdown");

    expect(capability.id).toBe("render:markdown");
    expect(capability.description).toBe(
      RULESET_CAPABILITIES.MARKDOWN_RENDER.description
    );
    expect(capability.optional).toBeUndefined();
  });

  test("marks capabilities as optional when requested", () => {
    const capability = providerCapability(
      RULESET_CAPABILITIES.HANDLEBARS_RENDER,
      { optional: true }
    );

    expect(capability.optional).toBe(true);
  });

  test("creates structured error when capability unsupported", () => {
    const result = unsupportedCapability("watch:incremental");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unsupported capability to return an error");
    }

    expect(result.error).toMatchObject({
      code: "PROVIDER_CAPABILITY_UNSUPPORTED",
    });
  });

  test("falls back to diagnostics payload when provided", () => {
    const diagnostics = [
      {
        level: "error",
        message: "Capability missing",
      },
    ] as const;

    const result = unsupportedCapability("render:handlebars", diagnostics);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected diagnostics error result");
    }

    expect(result.error).toBe(diagnostics);
  });

  test("treats matching SDK versions as compatible", () => {
    const provider = defineProvider({
      handshake: {
        providerId: "valid",
        version: "0.0.1-test",
        sdkVersion: PROVIDER_SDK_VERSION,
        capabilities: [providerCapability("render:markdown")],
        sandbox: { mode: "in-process" },
      },
      compile: () => unsupportedCapability("render:markdown"),
    });

    const diagnostics = evaluateProviderCompatibility(provider);
    expect(diagnostics.length).toBe(0);
  });

  test("flags mismatched SDK versions", () => {
    const provider = defineProvider({
      handshake: {
        providerId: "legacy",
        version: "0.0.1-test",
        sdkVersion: "1.0.0" as RulesetVersionTag,
        capabilities: [providerCapability("render:markdown")],
        sandbox: { mode: "in-process" },
      },
      compile: () => unsupportedCapability("render:markdown"),
    });

    const diagnostics = evaluateProviderCompatibility(provider);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]?.message.includes("SDK")).toBe(true);
  });
});
