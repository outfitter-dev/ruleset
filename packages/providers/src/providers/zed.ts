import path from "node:path";

import { createSimpleFilesystemProvider } from "./simple";

const PROVIDER_ID = "zed";

export const createZedProvider = () =>
  createSimpleFilesystemProvider({
    providerId: PROVIDER_ID,
    canonicalOutput: {
      basePath: ({ artifact }) => path.dirname(artifact.target.outputPath),
    },
  });

export type ZedProvider = ReturnType<typeof createZedProvider>;
