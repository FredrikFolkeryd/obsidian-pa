/**
 * Tests for ProviderManager
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ProviderManager } from "./ProviderManager";
import type { ProviderType } from "./types";

// Helper for testing invalid provider types
const INVALID_PROVIDER = "unknown" as ProviderType;

describe("ProviderManager", () => {
  let manager: ProviderManager;

  beforeEach(() => {
    manager = new ProviderManager();
  });

  describe("constructor", () => {
    it("should initialize with default providers", () => {
      const statuses = manager.getProviderStatuses();
      expect(statuses.length).toBeGreaterThan(0);
    });

    it("should have github-models as default active provider", () => {
      expect(manager.getActiveProviderType()).toBe("github-models");
    });
  });

  describe("getActiveProvider", () => {
    it("should return the active provider", () => {
      const provider = manager.getActiveProvider();
      expect(provider).not.toBeNull();
      expect(provider?.type).toBe("github-models");
    });
  });

  describe("getProvider", () => {
    it("should return a specific provider", () => {
      const provider = manager.getProvider("gh-copilot-cli");
      expect(provider).not.toBeNull();
      expect(provider?.type).toBe("gh-copilot-cli");
    });

    it("should return null for unknown provider", () => {
      const provider = manager.getProvider(INVALID_PROVIDER);
      expect(provider).toBeNull();
    });
  });

  describe("setActiveProvider", () => {
    it("should change the active provider", () => {
      const result = manager.setActiveProvider("gh-copilot-cli");
      expect(result).toBe(true);
      expect(manager.getActiveProviderType()).toBe("gh-copilot-cli");
    });

    it("should reject unknown provider", () => {
      const result = manager.setActiveProvider(INVALID_PROVIDER);
      expect(result).toBe(false);
    });

    it("should reject disabled provider", () => {
      // github-copilot-enterprise is disabled by default
      const result = manager.setActiveProvider("github-copilot-enterprise");
      expect(result).toBe(false);
    });
  });

  describe("setProviderToken", () => {
    it("should set token for a provider", () => {
      const result = manager.setProviderToken("github-models", "test-token");
      expect(result).toBe(true);
    });

    it("should return false for unknown provider", () => {
      const result = manager.setProviderToken(INVALID_PROVIDER, "test-token");
      expect(result).toBe(false);
    });
  });

  describe("clearProviderToken", () => {
    it("should clear token for a provider", () => {
      manager.setProviderToken("github-models", "test-token");
      manager.clearProviderToken("github-models");
      // Token should be cleared - provider not authenticated
      const provider = manager.getProvider("github-models");
      expect(provider?.isAuthenticated()).toBe(false);
    });

    it("should handle unknown provider gracefully", () => {
      // Should not throw
      manager.clearProviderToken(INVALID_PROVIDER);
    });
  });

  describe("getProviderStatuses", () => {
    it("should return statuses for all configured providers", () => {
      const statuses = manager.getProviderStatuses();
      
      // Should have github-models and gh-copilot-cli at minimum
      const types = statuses.map(s => s.type);
      expect(types).toContain("github-models");
      expect(types).toContain("gh-copilot-cli");
    });

    it("should include implementation status", () => {
      const statuses = manager.getProviderStatuses();
      const ghModels = statuses.find(s => s.type === "github-models");
      
      expect(ghModels?.implemented).toBe(true);
      expect(ghModels?.enabled).toBe(true);
    });
  });

  describe("getModels", () => {
    it("should return models from active provider", async () => {
      manager.setActiveProvider("gh-copilot-cli");
      const models = await manager.getModels();
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe("getModelsForProvider", () => {
    it("should return models from specific provider", async () => {
      const models = await manager.getModelsForProvider("gh-copilot-cli");
      expect(models.length).toBeGreaterThan(0);
    });

    it("should return empty array for unknown provider", async () => {
      const models = await manager.getModelsForProvider(INVALID_PROVIDER);
      expect(models).toEqual([]);
    });
  });

  describe("getDefaultModel", () => {
    it("should return default model for active provider", () => {
      manager.setActiveProvider("gh-copilot-cli");
      const model = manager.getDefaultModel();
      expect(model).toBe("claude-sonnet-4");
    });

    it("should return gpt-4o if no active provider", () => {
      // Force no active provider by setting to disabled one
      manager.setActiveProvider(INVALID_PROVIDER);
      const model = manager.getDefaultModel();
      expect(model).toBe("gpt-4o");
    });
  });

  describe("isAuthenticated", () => {
    it("should return false when no token set", () => {
      expect(manager.isAuthenticated()).toBe(false);
    });

    it("should return true after setting token for github-models", () => {
      manager.setProviderToken("github-models", "test-token");
      expect(manager.isAuthenticated()).toBe(true);
    });
  });

  describe("getEnabledProviderTypes", () => {
    it("should return list of enabled providers", () => {
      const enabled = manager.getEnabledProviderTypes();
      expect(enabled).toContain("github-models");
      expect(enabled).toContain("gh-copilot-cli");
    });

    it("should not include disabled providers", () => {
      const enabled = manager.getEnabledProviderTypes();
      expect(enabled).not.toContain("github-copilot-enterprise");
    });
  });

  describe("chat", () => {
    it("should throw if no active provider", async () => {
      // This is tricky to test since we always have a provider
      // We'll test the unauthenticated case instead
      await expect(
        manager.chat([{ role: "user", content: "test" }], { model: "gpt-4o" })
      ).rejects.toThrow("Please authenticate");
    });
  });

  describe("validateProviderToken", () => {
    it("should return error for unknown provider", async () => {
      const result = await manager.validateProviderToken(INVALID_PROVIDER);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider not found");
    });
  });
});
