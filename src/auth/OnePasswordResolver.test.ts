/**
 * Tests for 1Password credential resolver
 */

import { describe, it, expect } from "vitest";
import {
  isOnePasswordReference,
  validateOnePasswordReference,
} from "./OnePasswordResolver";

describe("OnePasswordResolver", () => {
  describe("isOnePasswordReference", () => {
    it("should return true for valid op:// references", () => {
      expect(isOnePasswordReference("op://vault/item/field")).toBe(true);
      expect(isOnePasswordReference("op://Personal/GitHub-PAT/credential")).toBe(true);
      expect(isOnePasswordReference("op://My Vault/API Keys/github-token")).toBe(true);
    });

    it("should return false for non-op:// strings", () => {
      expect(isOnePasswordReference("ghp_xxxxxxxxxxxx")).toBe(false);
      expect(isOnePasswordReference("https://example.com")).toBe(false);
      expect(isOnePasswordReference("")).toBe(false);
      expect(isOnePasswordReference("OP://vault/item/field")).toBe(false); // case sensitive
    });
  });

  describe("validateOnePasswordReference", () => {
    it("should accept valid references", () => {
      const result = validateOnePasswordReference("op://vault/item/field");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept references with spaces in names", () => {
      const result = validateOnePasswordReference("op://My Vault/GitHub PAT/credential");
      expect(result.valid).toBe(true);
    });

    it("should reject references not starting with op://", () => {
      const result = validateOnePasswordReference("vault/item/field");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Must start with op://");
    });

    it("should reject references with missing parts", () => {
      const result1 = validateOnePasswordReference("op://vault/item");
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain("Format must be");

      const result2 = validateOnePasswordReference("op://vault");
      expect(result2.valid).toBe(false);
    });

    it("should reject references with empty parts", () => {
      const result = validateOnePasswordReference("op:///item/field");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });
  });

  // Note: We don't test resolveOnePasswordSecret because:
  // 1. It requires the op CLI to be installed
  // 2. It requires being signed in to 1Password
  // 3. It would make actual calls to 1Password
  // These should be integration tests, not unit tests
});
