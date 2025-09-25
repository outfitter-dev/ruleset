import { describe, expect, it } from "vitest";

const INVALID_GLOB_NUMBER = 123;
const EXPECTED_RULE_ERROR_COUNT = 3;

import {
  formatValidationErrors,
  validateFrontmatterSchema,
} from "../src/schema-validator";

const EXPECTED_STRING_REGEX = /Expected string/;
const EXPECTED_BOOLEAN_REGEX = /Expected boolean/;
const EXPECTED_ARRAY_OR_STRING_REGEX = /Expected (array|string)/;
const EXPECTED_OBJECT_REGEX = /Expected object/;

describe("schema-validator", () => {
  describe("validateFrontmatterSchema", () => {
    it("should validate valid rule metadata", () => {
      const frontmatter = {
        rule: {
          version: "0.2.0",
          template: true,
          globs: ["**/*.md"],
          name: "test-rule",
          description: "A test rule",
        },
      };

      const { errors, parsed } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(0);
      expect(parsed).toBeDefined();
    });

    it("should allow empty rule metadata", () => {
      const frontmatter = {
        rule: {},
      };

      const { errors, parsed } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(0);
      expect(parsed?.rule).toEqual({});
    });

    it("should allow missing rule metadata", () => {
      const frontmatter = {
        title: "Some title",
        other: "metadata",
      };

      const { errors, parsed } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(0);
      expect(parsed?.title).toBe("Some title");
    });

    it("should validate rule.version must be string", () => {
      const frontmatter = {
        rule: {
          version: 123,
        },
      };

      const { errors } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe("rule.version");
      expect(errors[0].message).toMatch(EXPECTED_STRING_REGEX);
    });

    it("should validate rule.template must be boolean", () => {
      const frontmatter = {
        rule: {
          template: "true",
        },
      };

      const { errors } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe("rule.template");
      expect(errors[0].message).toMatch(EXPECTED_BOOLEAN_REGEX);
    });

    it("should validate rule.globs must be array of strings", () => {
      const frontmatter = {
        rule: {
          globs: ["valid", INVALID_GLOB_NUMBER, true],
        },
      };

      const { errors } = validateFrontmatterSchema(frontmatter);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some((error) => error.path.startsWith("rule.globs"))).toBe(
        true
      );
      expect(
        errors.some((error) =>
          EXPECTED_ARRAY_OR_STRING_REGEX.test(error.message)
        )
      ).toBe(true);
    });

    it("should validate rule.name must be string", () => {
      const frontmatter = {
        rule: {
          name: 42,
        },
      };

      const { errors } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe("rule.name");
      expect(errors[0].message).toMatch(EXPECTED_STRING_REGEX);
    });

    it("should validate rule.description must be string", () => {
      const frontmatter = {
        rule: {
          description: null,
        },
      };

      const { errors } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe("rule.description");
      expect(errors[0].message).toMatch(EXPECTED_STRING_REGEX);
    });

    it("should validate rule must be object", () => {
      const frontmatter = {
        rule: "not-an-object",
      };

      const { errors } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe("rule");
      expect(errors[0].message).toMatch(EXPECTED_OBJECT_REGEX);
    });

    it("should allow additional properties in rule metadata", () => {
      const frontmatter = {
        rule: {
          version: "0.2.0",
          customProperty: "custom-value",
          nested: {
            property: true,
          },
        },
      };

      const { errors, parsed } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(0);
      expect(parsed?.rule?.version).toBe("0.2.0");
    });
  });

  describe("multiple validation errors", () => {
    it("should collect multiple validation errors", () => {
      const frontmatter = {
        rule: {
          version: 123,
          template: "not-boolean",
          globs: "not-array",
        },
      };

      const { errors } = validateFrontmatterSchema(frontmatter);
      expect(errors).toHaveLength(EXPECTED_RULE_ERROR_COUNT);
      expect(errors.map((e) => e.path)).toContain("rule.version");
      expect(errors.map((e) => e.path)).toContain("rule.template");
      expect(errors.map((e) => e.path)).toContain("rule.globs");
    });
  });

  describe("formatValidationErrors", () => {
    it("should format validation errors nicely", () => {
      const errors = [
        {
          path: "rule.version",
          message: "must be a string",
          value: 123,
        },
        {
          path: "rule.template",
          message: "must be a boolean",
          value: "not-boolean",
        },
      ];

      const formatted = formatValidationErrors(errors);
      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toBe("rule.version must be a string (got: number)");
      expect(formatted[1]).toBe(
        "rule.template must be a boolean (got: string)"
      );
    });

    it("should format errors without value info when value is undefined", () => {
      const errors = [
        {
          path: "rule.name",
          message: "is required",
        },
      ];

      const formatted = formatValidationErrors(errors);
      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toBe("rule.name is required");
    });
  });
});
