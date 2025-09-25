import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

import {
  RULESET_SCHEMA_IDS,
  rulesetFrontmatterJsonSchema,
  rulesetProjectConfigJsonSchema,
  rulesetProviderConfigJsonSchema,
  rulesetRuleFrontmatterJsonSchema,
} from "../dist/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SCHEMA_OUTPUT_DIR = path.resolve(__dirname, "../dist/schemas");
const SCHEMA_MANIFEST_FILENAME = "manifest.json";

const SCHEMAS = {
  "rule-frontmatter": {
    id: RULESET_SCHEMA_IDS.ruleFrontmatter,
    schema: rulesetRuleFrontmatterJsonSchema,
  },
  frontmatter: {
    id: RULESET_SCHEMA_IDS.frontmatter,
    schema: rulesetFrontmatterJsonSchema,
  },
  "provider-config": {
    id: RULESET_SCHEMA_IDS.providerConfig,
    schema: rulesetProviderConfigJsonSchema,
  },
  "project-config": {
    id: RULESET_SCHEMA_IDS.projectConfig,
    schema: rulesetProjectConfigJsonSchema,
  },
} as const;

const buildManifest = () =>
  Object.fromEntries(
    Object.entries(SCHEMAS).map(([key, entry]) => [key, entry.id])
  );

async function writeSchemaFiles() {
  await mkdir(SCHEMA_OUTPUT_DIR, { recursive: true });

  await Promise.all(
    Object.entries(SCHEMAS).map(async ([name, entry]) => {
      const filePath = path.join(SCHEMA_OUTPUT_DIR, `${name}.json`);
      await writeFile(
        filePath,
        `${JSON.stringify(entry.schema, null, 2)}\n`,
        "utf8"
      );
    })
  );

  const manifestPath = path.join(SCHEMA_OUTPUT_DIR, SCHEMA_MANIFEST_FILENAME);
  await writeFile(
    manifestPath,
    `${JSON.stringify(buildManifest(), null, 2)}\n`,
    "utf8"
  );
}

await writeSchemaFiles();
