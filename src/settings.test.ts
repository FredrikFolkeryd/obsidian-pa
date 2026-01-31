/**
 * Tests for plugin settings
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, type PASettings } from "./settings";

describe("Settings", () => {
  describe("DEFAULT_SETTINGS", () => {
    it("should have consent disabled by default", () => {
      expect(DEFAULT_SETTINGS.consentEnabled).toBe(false);
    });

    it("should use opt-in mode by default", () => {
      expect(DEFAULT_SETTINGS.consentMode).toBe("opt-in");
    });

    it("should have empty folder lists by default", () => {
      expect(DEFAULT_SETTINGS.includedFolders).toEqual([]);
      expect(DEFAULT_SETTINGS.excludedFolders).toEqual([]);
    });

    it("should use gpt-4o model by default", () => {
      expect(DEFAULT_SETTINGS.model).toBe("gpt-4o");
    });

    it("should use 1password auth method by default", () => {
      expect(DEFAULT_SETTINGS.authMethod).toBe("1password");
    });

    it("should not have a token stored by default", () => {
      expect(DEFAULT_SETTINGS.githubToken).toBeUndefined();
    });
  });

  describe("PASettings type", () => {
    it("should accept valid settings object", () => {
      const settings: PASettings = {
        consentEnabled: true,
        consentMode: "opt-out",
        includedFolders: ["notes"],
        excludedFolders: ["private"],
        model: "gpt-4o-mini",
        authMethod: "direct",
        githubToken: "ghp_test",
      };

      expect(settings.consentEnabled).toBe(true);
      expect(settings.consentMode).toBe("opt-out");
      expect(settings.authMethod).toBe("direct");
    });
  });
});
