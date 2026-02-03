# Cross-Platform Development Guide

**Status**: Reference architecture for future Windows support  
**Context**: Windows support is deferred, but we design for cross-platform from the start

---

## 1. File Path Handling

### Current Issues Found

| File | Issue |
|------|-------|
| [GhCopilotCliProvider.ts](../src/api/providers/GhCopilotCliProvider.ts#L53) | Hardcoded Windows backslash in path |
| [SafeVaultAccess.ts](../src/vault/SafeVaultAccess.ts) | Uses forward slash only (OK for Obsidian vault paths) |

### Recommendations

#### For Obsidian Vault Paths

Use Obsidian's `normalizePath()` function which handles cross-platform path normalization:

```typescript
import { normalizePath } from "obsidian";

// Always normalize paths before using them
const normalizedPath = normalizePath("folder/subfolder/file.md");
```

Obsidian vault paths are **always forward-slash based**, regardless of OS. This is handled internally by Obsidian.

#### For Filesystem Paths (CLI binaries, config files)

Use Node.js `path` module:

```typescript
import { join, resolve, sep } from "path";
import { homedir } from "os";

// GOOD: Platform-agnostic home directory
const homeDir = homedir();  // Not process.env.HOME

// GOOD: Platform-agnostic path joining
const configPath = join(homeDir, ".config", "app", "settings.json");

// BAD: Hardcoded separators
const badPath = `${homeDir}/.config/app/settings.json`;        // Unix only
const alsoBAd = `${homeDir}\\.config\\app\\settings.json`;     // Windows only
```

#### Refactoring Pattern

Replace current patterns:

```typescript
// BEFORE (Unix-specific)
const paths = [
  `${process.env.HOME}/.local/bin/copilot`,
  `${process.env.HOME}/.op/bin/op`,
];

// AFTER (Cross-platform)
import { join } from "path";
import { homedir } from "os";

const paths = [
  join(homedir(), ".local", "bin", "copilot"),
  join(homedir(), ".op", "bin", "op"),
];
```

---

## 2. Shell Command Execution

### Current Status ✅

The codebase correctly uses `spawn` with `shell: false` for security. This is also the best pattern for cross-platform compatibility.

### Recommendations

#### Always use `spawn` with Array Arguments

```typescript
import { spawn, type ChildProcess } from "child_process";

// GOOD: Arguments as array, no shell interpretation
const child = spawn(executablePath, ["--flag", "value"], {
  shell: false,           // CRITICAL: Prevents injection and platform shell differences
  windowsHide: true,      // Prevents cmd window flash on Windows
  timeout: 120000,
});

// BAD: Using exec (shell interpretation varies by platform)
const { stdout } = await execAsync(`"${path}" --flag value`);
```

#### Platform-Specific Command Discovery

For finding executables in PATH, handle platform differences:

```typescript
// Current pattern (already cross-platform aware)
const whichCmd = process.platform === "win32" ? "where" : "which";

// Better: Use Node's built-in which for consistency
import { existsSync } from "fs";
import { join } from "path";

function findInPath(executable: string): string | null {
  const pathEnv = process.env.PATH || "";
  const separator = process.platform === "win32" ? ";" : ":";
  const extension = process.platform === "win32" ? ".exe" : "";
  
  const dirs = pathEnv.split(separator);
  for (const dir of dirs) {
    const fullPath = join(dir, executable + extension);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}
```

#### CLI Path Constants

Organize platform-specific paths clearly:

```typescript
import { join } from "path";
import { homedir } from "os";

const CLI_PATHS: Record<NodeJS.Platform, string[]> = {
  darwin: [
    "/opt/homebrew/bin/copilot",           // Homebrew (Apple Silicon)
    "/usr/local/bin/copilot",              // Homebrew (Intel) / npm global
    join(homedir(), ".local", "bin", "copilot"),
  ],
  linux: [
    "/usr/local/bin/copilot",
    join(homedir(), ".local", "bin", "copilot"),
    "/usr/bin/copilot",
  ],
  win32: [
    "C:\\Program Files\\GitHub Copilot\\copilot.exe",
    join(process.env.LOCALAPPDATA || "", "Programs", "GitHub Copilot", "copilot.exe"),
  ],
  // Fallback for other platforms
  aix: [], android: [], cygwin: [], freebsd: [], haiku: [], 
  netbsd: [], openbsd: [], sunos: [],
};
```

---

## 3. Environment Variables

### Current Issues Found

| Pattern | Issue |
|---------|-------|
| `process.env.HOME` | Not defined on Windows (use `USERPROFILE` or `HOMEDRIVE`+`HOMEPATH`) |
| `process.env.LOCALAPPDATA` | Windows-specific |

### Recommendations

#### Use `os.homedir()` for Home Directory

```typescript
// BEFORE (platform-specific)
const home = process.env.HOME;

// AFTER (cross-platform)
import { homedir } from "os";
const home = homedir();  // Works on all platforms
```

#### PATH Variable Separator

```typescript
const pathSeparator = process.platform === "win32" ? ";" : ":";
const paths = (process.env.PATH || "").split(pathSeparator);
```

#### Environment Variable Abstraction

Create a helper for common patterns:

```typescript
// src/utils/platform.ts
import { homedir } from "os";
import { join } from "path";

export const platform = {
  isWindows: process.platform === "win32",
  isMac: process.platform === "darwin",
  isLinux: process.platform === "linux",
  
  /** Home directory (cross-platform) */
  home: homedir(),
  
  /** User's local app data directory */
  localAppData(): string {
    if (process.platform === "win32") {
      return process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    }
    return join(homedir(), ".local", "share");
  },
  
  /** User's config directory */
  configDir(): string {
    if (process.platform === "win32") {
      return process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    }
    if (process.platform === "darwin") {
      return join(homedir(), "Library", "Application Support");
    }
    return process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  },
  
  /** PATH separator */
  pathSep: process.platform === "win32" ? ";" : ":",
};
```

---

## 4. Line Endings

### Current Status

The codebase uses `\n` consistently, which is correct for:

- Obsidian vault content (normalized by Obsidian)
- In-memory string operations
- Network protocols (HTTP, API responses)

### Recommendations

#### Obsidian Vault Files

Obsidian handles line ending normalization internally. When reading/writing through `vault.read()` and `vault.modify()`, use `\n` consistently.

```typescript
// Reading: Obsidian provides normalized content
const content = await vault.read(file);
const lines = content.split("\n");  // Always use \n

// Writing: Use \n, Obsidian handles the rest
const newContent = lines.join("\n");
await vault.modify(file, newContent);
```

#### External File Operations

If ever reading/writing files outside the vault (e.g., config files), be explicit:

```typescript
import { EOL } from "os";

// For config files that should match OS conventions
const lines = ["line1", "line2"];
const content = lines.join(EOL);  // Uses platform line endings

// For normalizing input
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
```

#### CLI Output Parsing

When parsing CLI output, normalize line endings first:

```typescript
child.stdout.on("data", (data: Buffer) => {
  // Normalize before processing
  const text = data.toString().replace(/\r\n/g, "\n");
  stdout += text;
});
```

---

## 5. Files Requiring Refactoring

### Priority 1: Before Windows Support

| File | Changes Needed |
|------|----------------|
| [GhCopilotCliProvider.ts](../src/api/providers/GhCopilotCliProvider.ts) | Replace `process.env.HOME` with `homedir()`, use `path.join()` |
| [OnePasswordResolver.ts](../src/auth/OnePasswordResolver.ts) | Replace `process.env.HOME` with `homedir()`, add Windows paths |

### Priority 2: Nice to Have

| File | Changes Needed |
|------|----------------|
| Create `src/utils/platform.ts` | Centralize platform utilities |

### No Changes Needed

| File | Reason |
|------|--------|
| [SafeVaultAccess.ts](../src/vault/SafeVaultAccess.ts) | Uses Obsidian paths (always forward-slash) |
| [ChatView.ts](../src/views/ChatView.ts) | Uses Obsidian paths and `\n` (correct) |

---

## 6. Testing Strategy

When Windows support is implemented:

### Unit Tests

- Mock `process.platform` to test platform-specific branches
- Test path construction on different platforms

### Integration Tests

- CI matrix: `macos-latest`, `ubuntu-latest`, `windows-latest`
- Test CLI discovery on each platform

### Manual Testing

- Test in Obsidian on each platform
- Verify CLI paths resolve correctly

---

## 7. Quick Reference

| Task | Pattern |
|------|---------|
| Home directory | `import { homedir } from "os"` |
| Join paths | `import { join } from "path"` |
| Check platform | `process.platform === "win32"` |
| Run CLI | `spawn(path, args, { shell: false, windowsHide: true })` |
| PATH separator | `process.platform === "win32" ? ";" : ":"` |
| Line endings (vault) | Always use `\n` |
| Normalize path (vault) | `import { normalizePath } from "obsidian"` |

---

## 8. References

- [Obsidian normalizePath](https://docs.obsidian.md/Reference/TypeScript+API/normalizePath)
- [Node.js path module](https://nodejs.org/api/path.html)
- [Node.js os module](https://nodejs.org/api/os.html)
- [Node.js child_process](https://nodejs.org/api/child_process.html)
