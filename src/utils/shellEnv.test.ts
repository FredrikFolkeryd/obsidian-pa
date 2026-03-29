/**
 * Tests for shell environment resolver
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveShellEnv,
  getShellEnv,
  _resetShellEnvCache,
} from "./shellEnv";

// Mock child_process.exec so we don't actually spawn shells in tests
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

// Mock os.homedir to return a predictable value
vi.mock("os", () => ({
  homedir: () => "/home/testuser",
}));

import { exec } from "child_process";

// Helper: make exec resolve with given stdout
function mockExecSuccess(stdout: string): void {
  // exec is promisified inside shellEnv.ts; we need to mock the raw exec callback
  (exec as ReturnType<typeof vi.fn>).mockImplementation(
    (_cmd: string, _opts: unknown, callback: (err: null, result: { stdout: string; stderr: string }) => void) => {
      callback(null, { stdout, stderr: "" });
      return {} as ReturnType<typeof exec>;
    }
  );
}

function mockExecFailure(message: string): void {
  (exec as ReturnType<typeof vi.fn>).mockImplementation(
    (_cmd: string, _opts: unknown, callback: (err: Error) => void) => {
      callback(new Error(message));
      return {} as ReturnType<typeof exec>;
    }
  );
}

describe("shellEnv", () => {
  beforeEach(() => {
    _resetShellEnvCache();
    vi.clearAllMocks();
    // Reset platform to a non-macOS default for most tests
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
  });

  describe("getShellEnv (fallback, no cache)", () => {
    it("should return an object with HOME set", () => {
      const env = getShellEnv();
      expect(env.HOME).toBeDefined();
      expect(typeof env.HOME).toBe("string");
    });

    it("should default XDG_CONFIG_HOME to $HOME/.config when not in process.env", () => {
      const original = process.env.XDG_CONFIG_HOME;
      delete process.env.XDG_CONFIG_HOME;

      _resetShellEnvCache();
      const env = getShellEnv();
      expect(env.XDG_CONFIG_HOME).toMatch(/\.config$/);

      // Restore
      if (original !== undefined) {
        process.env.XDG_CONFIG_HOME = original;
      }
    });

    it("should default XDG_DATA_HOME to $HOME/.local/share when not in process.env", () => {
      const original = process.env.XDG_DATA_HOME;
      delete process.env.XDG_DATA_HOME;

      _resetShellEnvCache();
      const env = getShellEnv();
      expect(env.XDG_DATA_HOME).toMatch(/\.local\/share$/);

      // Restore
      if (original !== undefined) {
        process.env.XDG_DATA_HOME = original;
      }
    });

    it("should preserve existing XDG_CONFIG_HOME if already set", () => {
      const original = process.env.XDG_CONFIG_HOME;
      process.env.XDG_CONFIG_HOME = "/custom/config";

      _resetShellEnvCache();
      const env = getShellEnv();
      expect(env.XDG_CONFIG_HOME).toBe("/custom/config");

      // Restore
      if (original !== undefined) {
        process.env.XDG_CONFIG_HOME = original;
      } else {
        delete process.env.XDG_CONFIG_HOME;
      }
    });

    it("should augment PATH with common bin directories on non-Windows", () => {
      const originalPath = process.env.PATH;
      process.env.PATH = "/usr/bin:/bin";
      Object.defineProperty(process, "platform", {
        value: "linux",
        configurable: true,
      });

      _resetShellEnvCache();
      const env = getShellEnv();

      expect(env.PATH).toContain("/usr/local/bin");
      expect(env.PATH).toContain("/opt/homebrew/bin");
      expect(env.PATH).toContain(".local/bin");

      // Restore
      if (originalPath !== undefined) {
        process.env.PATH = originalPath;
      }
    });

    it("should not duplicate PATH entries that already exist", () => {
      const originalPath = process.env.PATH;
      process.env.PATH = "/usr/local/bin:/usr/bin:/bin";

      _resetShellEnvCache();
      const env = getShellEnv();

      const parts = env.PATH.split(":");
      const localBinCount = parts.filter((p) => p === "/usr/local/bin").length;
      expect(localBinCount).toBe(1);

      // Restore
      if (originalPath !== undefined) {
        process.env.PATH = originalPath;
      }
    });
  });

  describe("resolveShellEnv on non-macOS", () => {
    it("should return enriched process.env without calling exec", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        configurable: true,
      });

      const env = await resolveShellEnv();

      expect(exec).not.toHaveBeenCalled();
      expect(env.HOME).toBeDefined();
      expect(env.XDG_CONFIG_HOME).toBeDefined();
      expect(env.XDG_DATA_HOME).toBeDefined();
    });

    it("should cache the result on subsequent calls", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        configurable: true,
      });

      const first = await resolveShellEnv();
      const second = await resolveShellEnv();
      expect(first).toBe(second); // same reference
    });
  });

  describe("resolveShellEnv on macOS", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "darwin",
        configurable: true,
      });
    });

    it("should call exec to capture login shell env", async () => {
      mockExecSuccess("HOME=/home/testuser\nPATH=/usr/local/bin:/usr/bin\nSHELL=/bin/zsh\n");

      const env = await resolveShellEnv();

      expect(exec).toHaveBeenCalled();
      expect(env.HOME).toBe("/home/testuser");
      expect(env.SHELL).toBe("/bin/zsh");
    });

    it("should let shell env override process.env values (shell takes precedence)", async () => {
      const originalPath = process.env.PATH;
      process.env.PATH = "/minimal/bin";

      mockExecSuccess("HOME=/home/testuser\nPATH=/usr/local/bin:/usr/bin:/bin\nSHELL=/bin/zsh\n");

      const env = await resolveShellEnv();

      // The shell's PATH (/usr/local/bin:/usr/bin:/bin) should win over
      // process.env PATH (/minimal/bin)
      expect(env.PATH).toContain("/usr/local/bin");
      expect(env.PATH).not.toBe("/minimal/bin");

      if (originalPath !== undefined) {
        process.env.PATH = originalPath;
      }
    });

    it("should fall back to enriched process.env when shell exec fails", async () => {
      mockExecFailure("exec failed");

      const env = await resolveShellEnv();

      // Should still have required fields from buildEnv fallback
      expect(env.HOME).toBeDefined();
      expect(env.XDG_CONFIG_HOME).toBeDefined();
      expect(env.XDG_DATA_HOME).toBeDefined();
    });

    it("should cache result so exec is only called once", async () => {
      mockExecSuccess("HOME=/home/testuser\nPATH=/usr/local/bin:/usr/bin\n");

      await resolveShellEnv();
      await resolveShellEnv();

      // exec should only be called once (for the first resolveShellEnv)
      expect(exec).toHaveBeenCalledTimes(1);
    });

    it("should set XDG defaults if not present in shell env", async () => {
      // Ensure XDG vars are absent so buildEnv applies the defaults
      const savedXdgConfig = process.env.XDG_CONFIG_HOME;
      const savedXdgData = process.env.XDG_DATA_HOME;
      delete process.env.XDG_CONFIG_HOME;
      delete process.env.XDG_DATA_HOME;

      try {
        mockExecSuccess("HOME=/home/testuser\nPATH=/usr/bin:/bin\n");

        const env = await resolveShellEnv();

        // XDG dirs should be derived from the HOME supplied by the shell env
        expect(env.XDG_CONFIG_HOME).toBe("/home/testuser/.config");
        expect(env.XDG_DATA_HOME).toBe("/home/testuser/.local/share");
      } finally {
        if (savedXdgConfig !== undefined) process.env.XDG_CONFIG_HOME = savedXdgConfig;
        if (savedXdgData !== undefined) process.env.XDG_DATA_HOME = savedXdgData;
      }
    });

    it("should preserve GITHUB_TOKEN if present in process.env", async () => {
      const original = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = "ghp_testtoken";

      mockExecSuccess("HOME=/home/testuser\nPATH=/usr/bin:/bin\n");

      const env = await resolveShellEnv();

      expect(env.GITHUB_TOKEN).toBe("ghp_testtoken");

      if (original !== undefined) {
        process.env.GITHUB_TOKEN = original;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    });
  });

  describe("_resetShellEnvCache", () => {
    it("should allow resolveShellEnv to run again after reset", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        configurable: true,
      });

      const first = await resolveShellEnv();
      _resetShellEnvCache();
      const second = await resolveShellEnv();

      // After reset, a new object is returned
      expect(first).not.toBe(second);
    });
  });
});
