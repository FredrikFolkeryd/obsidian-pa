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

    it("should have chatOnlyMode disabled by default", () => {
      expect(DEFAULT_SETTINGS.chatOnlyMode).toBe(false);
    });

    it("should use github-models provider by default", () => {
      expect(DEFAULT_SETTINGS.provider).toBe("github-models");
    });

    it("should have empty usage tracking by default", () => {
      expect(DEFAULT_SETTINGS.usageDate).toBe("");
      expect(DEFAULT_SETTINGS.usageRequests).toBe(0);
    });

    it("should have empty conversation history by default", () => {
      expect(DEFAULT_SETTINGS.conversationHistory).toEqual([]);
    });

    it("should have max 50 history messages by default", () => {
      expect(DEFAULT_SETTINGS.maxHistoryMessages).toBe(50);
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

    it("should accept gh-copilot-cli provider", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        provider: "gh-copilot-cli",
      };
      expect(settings.provider).toBe("gh-copilot-cli");
    });

    it("should accept github-copilot-enterprise provider", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        provider: "github-copilot-enterprise",
      };
      expect(settings.provider).toBe("github-copilot-enterprise");
    });

    it("should accept 1password credential reference", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        authMethod: "1password",
        credentialReference: "op://vault/item/field",
      };
      expect(settings.credentialReference).toBe("op://vault/item/field");
    });

    it("should accept conversation history with proper structure", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        conversationHistory: [
          {
            id: "msg-123",
            role: "user",
            content: "Hello",
            timestamp: "2024-01-01T10:00:00.000Z",
          },
          {
            id: "msg-124",
            role: "assistant",
            content: "Hi there!",
            timestamp: "2024-01-01T10:00:05.000Z",
          },
        ],
      };
      expect(settings.conversationHistory).toHaveLength(2);
      expect(settings.conversationHistory[0].role).toBe("user");
      expect(settings.conversationHistory[1].role).toBe("assistant");
    });

    it("should accept system role in conversation", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        conversationHistory: [
          {
            id: "msg-sys",
            role: "system",
            content: "You are a helpful assistant",
            timestamp: "2024-01-01T10:00:00.000Z",
          },
        ],
      };
      expect(settings.conversationHistory[0].role).toBe("system");
    });
  });

  describe("Settings Merging", () => {
    it("should allow partial override with spread operator", () => {
      const customSettings: PASettings = {
        ...DEFAULT_SETTINGS,
        consentEnabled: true,
        model: "claude-sonnet-4",
      };
      
      expect(customSettings.consentEnabled).toBe(true);
      expect(customSettings.model).toBe("claude-sonnet-4");
      // Defaults preserved
      expect(customSettings.consentMode).toBe("opt-in");
      expect(customSettings.authMethod).toBe("1password");
    });

    it("should handle folder list updates independently", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        includedFolders: ["notes", "journal"],
      };
      
      // Should not affect excludedFolders
      expect(settings.includedFolders).toEqual(["notes", "journal"]);
      expect(settings.excludedFolders).toEqual([]);
    });

    it("should preserve usage data when updating other settings", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        usageDate: "2024-01-15",
        usageRequests: 42,
        model: "gpt-4o-mini",
      };
      
      const updated: PASettings = {
        ...settings,
        model: "claude-sonnet-4",
      };
      
      expect(updated.usageDate).toBe("2024-01-15");
      expect(updated.usageRequests).toBe(42);
      expect(updated.model).toBe("claude-sonnet-4");
    });
  });

  describe("Provider-specific settings", () => {
    it("should allow model change for github-models provider", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        provider: "github-models",
        model: "Meta-Llama-3.1-70B-Instruct",
      };
      expect(settings.model).toBe("Meta-Llama-3.1-70B-Instruct");
    });

    it("should allow model change for gh-copilot-cli provider", () => {
      const settings: PASettings = {
        ...DEFAULT_SETTINGS,
        provider: "gh-copilot-cli",
        model: "claude-sonnet-4",
      };
      expect(settings.model).toBe("claude-sonnet-4");
    });
  });
});
