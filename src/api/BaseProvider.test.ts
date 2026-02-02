/**
 * Tests for BaseProvider utility functions
 */

import { describe, it, expect } from "vitest";
import { 
  getEnabledProviders, 
  getAllProviders, 
  PROVIDER_CONFIGS 
} from "./BaseProvider";

describe("BaseProvider utilities", () => {
  describe("PROVIDER_CONFIGS", () => {
    it("should have github-models configured", () => {
      expect(PROVIDER_CONFIGS["github-models"]).toBeDefined();
      expect(PROVIDER_CONFIGS["github-models"].name).toBe("GitHub Models");
      expect(PROVIDER_CONFIGS["github-models"].enabled).toBe(true);
    });

    it("should have gh-copilot-cli configured", () => {
      expect(PROVIDER_CONFIGS["gh-copilot-cli"]).toBeDefined();
      expect(PROVIDER_CONFIGS["gh-copilot-cli"].name).toBe("GitHub Copilot CLI");
      expect(PROVIDER_CONFIGS["gh-copilot-cli"].enabled).toBe(true);
    });

    it("should have github-copilot-enterprise configured but disabled", () => {
      expect(PROVIDER_CONFIGS["github-copilot-enterprise"]).toBeDefined();
      expect(PROVIDER_CONFIGS["github-copilot-enterprise"].enabled).toBe(false);
    });

    it("should have token instructions for token-requiring providers", () => {
      // github-models requires token
      expect(PROVIDER_CONFIGS["github-models"].requiresToken).toBe(true);
      expect(PROVIDER_CONFIGS["github-models"].tokenInstructions).toBeDefined();
      
      // gh-copilot-cli doesn't require token
      expect(PROVIDER_CONFIGS["gh-copilot-cli"].requiresToken).toBe(false);
    });
  });

  describe("getEnabledProviders", () => {
    it("should return only enabled providers", () => {
      const enabled = getEnabledProviders();
      
      for (const provider of enabled) {
        expect(provider.enabled).toBe(true);
      }
    });

    it("should include github-models", () => {
      const enabled = getEnabledProviders();
      const types = enabled.map(p => p.type);
      
      expect(types).toContain("github-models");
    });

    it("should include gh-copilot-cli", () => {
      const enabled = getEnabledProviders();
      const types = enabled.map(p => p.type);
      
      expect(types).toContain("gh-copilot-cli");
    });

    it("should not include disabled providers like github-copilot-enterprise", () => {
      const enabled = getEnabledProviders();
      const types = enabled.map(p => p.type);
      
      expect(types).not.toContain("github-copilot-enterprise");
    });
  });

  describe("getAllProviders", () => {
    it("should return all configured providers", () => {
      const all = getAllProviders();
      
      expect(all.length).toBeGreaterThan(0);
    });

    it("should include both enabled and disabled providers", () => {
      const all = getAllProviders();
      const types = all.map(p => p.type);
      
      // Enabled
      expect(types).toContain("github-models");
      expect(types).toContain("gh-copilot-cli");
      
      // Disabled (coming soon)
      expect(types).toContain("github-copilot-enterprise");
    });

    it("should return more providers than getEnabledProviders", () => {
      const all = getAllProviders();
      const enabled = getEnabledProviders();
      
      expect(all.length).toBeGreaterThanOrEqual(enabled.length);
    });
  });
});
