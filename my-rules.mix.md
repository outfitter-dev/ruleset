---
rulesets:
  version: "0.1.0"
title: My First Mixdown Rule
description: A simple rule for testing v0.1.
destinations:
  cursor:
    outputPath: ".cursor/rules/my-first-rule.mdc"
  windsurf:
    outputPath: ".windsurf/rules/my-first-rule.md"
---

## Main content

This is a paragraph of the rule. In v0.1, this content will be passed through as-is.
`{{stems}}`, `{{$variables}}`, and `{{>imports}}` will be ignored by the v0.1 parser and compiler.
