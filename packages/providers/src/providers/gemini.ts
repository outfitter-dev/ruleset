import path from "node:path";

import { createSimpleFilesystemProvider } from "./simple";

const PROVIDER_ID = "gemini";

export const createGeminiProvider = () =>
  createSimpleFilesystemProvider({
    providerId: PROVIDER_ID,
    canonicalOutput: {
      basePath: ({ artifact }) => path.dirname(artifact.target.outputPath),
    },
  });

export type GeminiProvider = ReturnType<typeof createGeminiProvider>;
