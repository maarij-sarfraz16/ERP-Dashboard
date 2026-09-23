// Types for the one server module `vite.config.ts` imports. The server itself
// is plain JavaScript — it runs under Node with no build step — so this only
// exists to keep `tsc -b` happy about the config file.

import type { IncomingMessage, ServerResponse } from "node:http";

export declare function createApiMiddleware(
  env: Record<string, string | undefined>,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>;
