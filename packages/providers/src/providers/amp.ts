import path from "node:path";

import { createSimpleFilesystemProvider } from "./simple";

const PROVIDER_ID = "amp";

export const createAmpProvider = () =>
  createSimpleFilesystemProvider({
    providerId: PROVIDER_ID,
    canonicalOutput: {
      basePath: ({ artifact }) => path.dirname(artifact.target.outputPath),
    },
  });

export type AmpProvider = ReturnType<typeof createAmpProvider>;
