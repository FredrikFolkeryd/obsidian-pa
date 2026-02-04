/**
 * Tests for TokenBudget utilities
 */

import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  calculateTokenUsage,
  formatTokenCount,
  formatTokenBudgetSummary,
  getTokenBudgetForModel,
  MODEL_TOKEN_LIMITS,
  DEFAULT_TOKEN_BUDGET,
} from "./TokenBudget";

describe("estimateTokens", () => {
  it("should return 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("should return 0 for null/undefined", () => {
    expect(estimateTokens(null as unknown as string)).toBe(0);
    expect(estimateTokens(undefined as unknown as string)).toBe(0);
  });

  it("should estimate tokens at ~4 chars per token", () => {
    // 100 chars should be ~25 tokens
    const text = "a".repeat(100);
    expect(estimateTokens(text)).toBe(25);
  });

  it("should round up partial tokens", () => {
    // 5 chars should ceil to 2 tokens
    expect(estimateTokens("hello")).toBe(2);
  });

  it("should handle short strings", () => {
    expect(estimateTokens("hi")).toBe(1);
    expect(estimateTokens("a")).toBe(1);
  });

  it("should handle long content", () => {
    const longText = "word ".repeat(1000); // 5000 chars
    expect(estimateTokens(longText)).toBe(1250);
  });
});

describe("calculateTokenUsage", () => {
  it("should calculate usage for empty files", () => {
    const usage = calculateTokenUsage([], 0);
    expect(usage.total).toBe(0);
    expect(usage.byFile.size).toBe(0);
    expect(usage.isWarning).toBe(false);
    expect(usage.isOverLimit).toBe(false);
  });

  it("should calculate usage for single file", () => {
    const files = [{ path: "test.md", content: "a".repeat(400) }]; // 100 tokens
    const usage = calculateTokenUsage(files, 50);
    
    expect(usage.total).toBe(150); // 100 + 50 system
    expect(usage.byFile.get("test.md")).toBe(100);
    expect(usage.percentUsed).toBeGreaterThan(0);
  });

  it("should calculate usage for multiple files", () => {
    const files = [
      { path: "a.md", content: "a".repeat(400) }, // 100 tokens
      { path: "b.md", content: "b".repeat(800) }, // 200 tokens
    ];
    const usage = calculateTokenUsage(files, 100);
    
    expect(usage.total).toBe(400); // 100 + 200 + 100 system
    expect(usage.byFile.get("a.md")).toBe(100);
    expect(usage.byFile.get("b.md")).toBe(200);
  });

  it("should detect warning threshold", () => {
    const config = {
      ...DEFAULT_TOKEN_BUDGET,
      maxContextTokens: 1000,
      reserveForResponse: 0,
      warningThreshold: 80,
    };
    const files = [{ path: "test.md", content: "a".repeat(3200) }]; // 800 tokens = 80%
    const usage = calculateTokenUsage(files, 0, config);
    
    expect(usage.isWarning).toBe(true);
    expect(usage.isOverLimit).toBe(false);
  });

  it("should detect over limit", () => {
    const config = {
      ...DEFAULT_TOKEN_BUDGET,
      maxContextTokens: 1000,
      reserveForResponse: 500,
    };
    // Available = 500, using 600
    const files = [{ path: "test.md", content: "a".repeat(2400) }]; // 600 tokens
    const usage = calculateTokenUsage(files, 0, config);
    
    expect(usage.isOverLimit).toBe(true);
  });

  it("should calculate correct available tokens", () => {
    const config = {
      ...DEFAULT_TOKEN_BUDGET,
      maxContextTokens: 10000,
      reserveForResponse: 4000,
    };
    const usage = calculateTokenUsage([], 0, config);
    
    expect(usage.available).toBe(6000);
  });
});

describe("formatTokenCount", () => {
  it("should format small numbers as-is", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(100)).toBe("100");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("should format thousands with k suffix", () => {
    expect(formatTokenCount(1000)).toBe("1.0k");
    expect(formatTokenCount(1500)).toBe("1.5k");
    expect(formatTokenCount(2345)).toBe("2.3k");
  });

  it("should round large numbers", () => {
    expect(formatTokenCount(10000)).toBe("10k");
    expect(formatTokenCount(12500)).toBe("13k");
    expect(formatTokenCount(100000)).toBe("100k");
  });
});

describe("formatTokenBudgetSummary", () => {
  it("should format normal usage", () => {
    const usage = {
      total: 1000,
      byFile: new Map(),
      available: 4000,
      percentUsed: 25,
      isWarning: false,
      isOverLimit: false,
    };
    
    const summary = formatTokenBudgetSummary(usage);
    expect(summary).toBe("1.0k / 4.0k tokens");
  });

  it("should format warning state", () => {
    const usage = {
      total: 3500,
      byFile: new Map(),
      available: 4000,
      percentUsed: 87,
      isWarning: true,
      isOverLimit: false,
    };
    
    const summary = formatTokenBudgetSummary(usage);
    expect(summary).toContain("⚡");
    expect(summary).toContain("87%");
  });

  it("should format over limit state", () => {
    const usage = {
      total: 5000,
      byFile: new Map(),
      available: 4000,
      percentUsed: 125,
      isWarning: true,
      isOverLimit: true,
    };
    
    const summary = formatTokenBudgetSummary(usage);
    expect(summary).toContain("⚠️");
    expect(summary).toContain("over limit");
  });
});

describe("getTokenBudgetForModel", () => {
  it("should return known model limits", () => {
    const gpt4o = getTokenBudgetForModel("gpt-4o");
    expect(gpt4o.maxContextTokens).toBe(128000);
    
    const gpt4 = getTokenBudgetForModel("gpt-4");
    expect(gpt4.maxContextTokens).toBe(8192);
  });

  it("should return default for unknown models", () => {
    const unknown = getTokenBudgetForModel("unknown-model");
    expect(unknown.maxContextTokens).toBe(MODEL_TOKEN_LIMITS["default"]);
  });

  it("should scale maxTokensPerFile based on model capacity", () => {
    const large = getTokenBudgetForModel("gpt-4o");
    const small = getTokenBudgetForModel("gpt-4");
    
    expect(large.maxTokensPerFile).toBeGreaterThan(small.maxTokensPerFile);
  });

  it("should cap maxTokensPerFile at 4000", () => {
    const budget = getTokenBudgetForModel("gpt-4o");
    expect(budget.maxTokensPerFile).toBeLessThanOrEqual(4000);
  });
});

describe("MODEL_TOKEN_LIMITS", () => {
  it("should have entries for common models", () => {
    expect(MODEL_TOKEN_LIMITS["gpt-4o"]).toBeDefined();
    expect(MODEL_TOKEN_LIMITS["gpt-4o-mini"]).toBeDefined();
    expect(MODEL_TOKEN_LIMITS["gpt-4"]).toBeDefined();
    expect(MODEL_TOKEN_LIMITS["claude-3-opus"]).toBeDefined();
  });

  it("should have a default entry", () => {
    expect(MODEL_TOKEN_LIMITS["default"]).toBeDefined();
  });
});

describe("DEFAULT_TOKEN_BUDGET", () => {
  it("should have sensible defaults", () => {
    expect(DEFAULT_TOKEN_BUDGET.maxContextTokens).toBeGreaterThan(0);
    expect(DEFAULT_TOKEN_BUDGET.reserveForResponse).toBeGreaterThan(0);
    expect(DEFAULT_TOKEN_BUDGET.maxTokensPerFile).toBeGreaterThan(0);
    expect(DEFAULT_TOKEN_BUDGET.warningThreshold).toBeGreaterThan(0);
    expect(DEFAULT_TOKEN_BUDGET.warningThreshold).toBeLessThanOrEqual(100);
  });

  it("should reserve reasonable space for response", () => {
    // At least 25% of context should be reserved for response
    const ratio = DEFAULT_TOKEN_BUDGET.reserveForResponse / DEFAULT_TOKEN_BUDGET.maxContextTokens;
    expect(ratio).toBeGreaterThanOrEqual(0.25);
  });
});
