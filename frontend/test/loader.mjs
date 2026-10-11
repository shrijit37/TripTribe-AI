/**
 * Test-time module shim.
 *
 * Two things production gets for free and `node --test` does not:
 *
 * 1. `server-only` throws on import outside a React Server Component — which is
 *    the entire point of it in the app, and precisely what stops it being
 *    importable here. It is remapped to an empty module so the solver, schema
 *    and cost code can be unit-tested directly, with the marker still in the
 *    source where it belongs. The protection that actually matters — that no
 *    Client Component may reach `src/server` — is enforced by the bundler, not
 *    by this file.
 * 2. The `@/*` path alias and extensionless imports from tsconfig, which Node
 *    does not read.
 *
 * Registered through `module.registerHooks`, imported by the `--import` flag
 * in the `test` script.
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolvePath(here, "../src");
const SERVER_ONLY_STUB = pathToFileURL(
  resolvePath(here, "server-only-stub.mjs"),
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: SERVER_ONLY_STUB, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const base = resolvePath(SRC, specifier.slice(2));
      // The bundler resolves extensionless imports; Node does not. Probing the
      // forms TypeScript allows keeps `.ts` suffixes out of the source.
      const target = [base, `${base}.ts`, `${base}/index.ts`].find((p) =>
        existsSync(p),
      );
      if (target) {
        return { url: pathToFileURL(target).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
