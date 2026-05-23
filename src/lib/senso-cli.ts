import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const NPM_GLOBAL_BIN = `${process.env.HOME}/.npm-global/bin`;

function shellEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${NPM_GLOBAL_BIN}:${process.env.PATH}`,
  };
}

/** Prefer global `senso`, fall back to `npx @senso-ai/cli` (no global install needed). */
export async function runSensoCli(args: string[]): Promise<string> {
  const preferNpx = process.env.SENSO_CLI === "npx";
  const attempts: [string, string[]][] = preferNpx
    ? [["npx", ["--yes", "@senso-ai/cli", ...args]]]
    : [
        ["senso", args],
        ["npx", ["--yes", "@senso-ai/cli", ...args]],
      ];

  let lastError: unknown;
  for (const [bin, argv] of attempts) {
    try {
      const { stdout } = await execFileAsync(bin, argv, {
        env: shellEnv(),
        maxBuffer: 10 * 1024 * 1024,
      });
      return stdout;
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError ?? new Error("Senso CLI failed");
}

export function parseSensoJson(stdout: string): unknown {
  const match = stdout.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Senso returned no JSON");
  return JSON.parse(match[0]);
}
