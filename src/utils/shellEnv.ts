/**
 * Shell environment resolver
 *
 * On macOS, GUI apps (like Obsidian launched from Dock or Spotlight) do NOT
 * inherit the user's login shell environment. This means CLIs that rely on
 * PATH entries, XDG_CONFIG_HOME, or credential vars set in ~/.zshrc /
 * ~/.bash_profile will fail silently when spawned from Obsidian, even though
 * they work perfectly in a terminal.
 *
 * This module captures the login shell environment once at plugin startup via
 * `/bin/zsh -l -c env` (with bash fallback) and caches it for the plugin
 * lifetime. On non-macOS platforms it simply enriches process.env with
 * sensible defaults and is otherwise a no-op.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { homedir } from "os";

const execAsync = promisify(exec);

/** Cached resolved environment (populated by resolveShellEnv) */
let cachedEnv: Record<string, string> | null = null;

/**
 * Resolve the user's login shell environment.
 *
 * On macOS, runs `/bin/zsh -l -c env` (falling back to `/bin/bash -l -c env`)
 * to obtain the full environment a terminal session would have. The result is
 * merged with `process.env` (shell values win on overlap) and then enriched
 * with XDG defaults and augmented PATH entries.
 *
 * On non-macOS platforms the function immediately returns an enriched
 * `process.env` without spawning a shell.
 *
 * The resolved value is cached; subsequent calls return the cached result.
 */
export async function resolveShellEnv(): Promise<Record<string, string>> {
  if (cachedEnv !== null) {
    return cachedEnv;
  }

  if (process.platform !== "darwin") {
    cachedEnv = buildEnv(process.env as Record<string, string>);
    return cachedEnv;
  }

  // On macOS, capture the login shell environment
  let shellEnv: Record<string, string> = {};
  const shells = ["/bin/zsh", "/bin/bash"];

  for (const shell of shells) {
    try {
      // `shell` is from a hardcoded constant — no injection risk
      const { stdout } = await execAsync(`"${shell}" -l -c env`, {
        timeout: 5000,
      });
      shellEnv = parseEnvOutput(stdout);
      break;
    } catch {
      // Try next shell
    }
  }

  // Merge: shell env takes precedence over the impoverished process.env from
  // the GUI app launch (important for PATH, XDG_CONFIG_HOME, etc.)
  const merged: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...shellEnv,
  };

  cachedEnv = buildEnv(merged);
  return cachedEnv;
}

/**
 * Get the cached shell environment synchronously.
 *
 * `resolveShellEnv()` should be called at plugin startup to populate the
 * cache before any CLI calls are made. If called before resolution completes,
 * falls back to an enriched `process.env`.
 */
export function getShellEnv(): Record<string, string> {
  if (cachedEnv !== null) {
    return cachedEnv;
  }
  // Fallback: enrich process.env without shell resolution
  return buildEnv(process.env as Record<string, string>);
}

/** Parse `env` command output (KEY=value lines) into a map */
function parseEnvOutput(output: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const eqIdx = line.indexOf("=");
    // Skip lines with no `=`; allow any non-negative position (including empty key)
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx);
      const value = line.slice(eqIdx + 1);
      if (key) {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Build the final env object, ensuring the minimum required variables are
 * present and PATH is augmented with directories commonly absent in GUI
 * app environments.
 */
function buildEnv(base: Record<string, string>): Record<string, string> {
  const home = base.HOME || homedir();
  const result = { ...base };

  // Always ensure HOME is set
  result.HOME = home;

  // Default XDG dirs when unset — the GitHub Copilot CLI stores credentials
  // and configuration under XDG_CONFIG_HOME
  if (!result.XDG_CONFIG_HOME) {
    result.XDG_CONFIG_HOME = `${home}/.config`;
  }
  if (!result.XDG_DATA_HOME) {
    result.XDG_DATA_HOME = `${home}/.local/share`;
  }

  // Augment PATH with directories that are commonly missing from GUI app
  // environments (Homebrew on both Intel & Apple Silicon, user-local installs)
  if (process.platform !== "win32") {
    const extraDirs = [
      "/usr/local/bin",
      "/opt/homebrew/bin",
      `${home}/.local/bin`,
    ];
    const currentPath = result.PATH || "/usr/bin:/bin";
    const pathParts = currentPath.split(":");
    for (const dir of extraDirs) {
      if (!pathParts.includes(dir)) {
        pathParts.unshift(dir);
      }
    }
    result.PATH = pathParts.join(":");
  }

  return result;
}

/**
 * Reset the cached environment.
 * @internal For testing purposes only — do not call in production code.
 */
export function _resetShellEnvCache(): void {
  cachedEnv = null;
}
