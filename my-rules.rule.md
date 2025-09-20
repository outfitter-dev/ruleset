---
rulesets:
  version: "0.1.0"
title: My First Ruleset
description: A simple rule for testing v0.1.
destinations:
  cursor:
    outputPath: ".cursor/rules/my-first-rule.mdc"
  windsurf:
    outputPath: ".windsurf/rules/my-first-rule.md"
---

## Main content

This is a paragraph of the rule. In v0.1, this content will be passed through as-is.
`{{sections}}`, `{{$variables}}`, and `{{>imports}}` are preserved for future compiler versions.
