import path from "node:path";

import { createSimpleFilesystemProvider } from "./simple";

const PROVIDER_ID = "opencode";

export const createOpenCodeProvider = () =>
  createSimpleFilesystemProvider({
    providerId: PROVIDER_ID,
    canonicalOutput: {
      basePath: ({ artifact }) => path.dirname(artifact.target.outputPath),
    },
  });

export type OpenCodeProvider = ReturnType<typeof createOpenCodeProvider>;
