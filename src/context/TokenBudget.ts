/**
 * Token Budget Management
 *
 * Utilities for estimating and managing token usage in context.
 * Uses character-based estimation (4 chars ≈ 1 token for English).
 */

/**
 * Token budget configuration
 */
export interface TokenBudgetConfig {
  /** Maximum tokens for context (default: model-dependent) */
  maxContextTokens: number;
  /** Reserve tokens for response (default: 4000) */
  reserveForResponse: number;
  /** Maximum tokens per file (default: 2000) */
  maxTokensPerFile: number;
  /** Warning threshold (percentage, default: 80) */
  warningThreshold: number;
}

/**
 * Default configuration for common models
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4": 8192,
  "gpt-4-turbo": 128000,
  "gpt-3.5-turbo": 16385,
  "claude-3-opus": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-haiku": 200000,
  "default": 8192,
};

/**
 * Default token budget configuration
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  maxContextTokens: 8192,
  reserveForResponse: 4000,
  maxTokensPerFile: 2000,
  warningThreshold: 80,
};

/**
 * Estimate token count from text
 * Uses approximate ratio: 4 characters ≈ 1 token for English
 *
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Approximate: 4 chars per token for English
  // This is a rough estimate; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Total estimated tokens used */
  total: number;
  /** Tokens used by each file */
  byFile: Map<string, number>;
  /** Available tokens (context limit - reserve) */
  available: number;
  /** Percentage of budget used */
  percentUsed: number;
  /** Whether over warning threshold */
  isWarning: boolean;
  /** Whether over limit */
  isOverLimit: boolean;
}

/**
 * Calculate token usage for a set of context files
 *
 * @param files - Files with content to calculate
 * @param systemPromptTokens - Tokens used by system prompt
 * @param config - Token budget configuration
 * @returns Token usage breakdown
 */
export function calculateTokenUsage(
  files: Array<{ path: string; content: string }>,
  systemPromptTokens: number,
  config: TokenBudgetConfig = DEFAULT_TOKEN_BUDGET
): TokenUsage {
  const available = config.maxContextTokens - config.reserveForResponse;
  const byFile = new Map<string, number>();

  let fileTokens = 0;
  for (const file of files) {
    const tokens = estimateTokens(file.content);
    byFile.set(file.path, tokens);
    fileTokens += tokens;
  }

  const total = systemPromptTokens + fileTokens;
  const percentUsed = Math.round((total / available) * 100);

  return {
    total,
    byFile,
    available,
    percentUsed,
    isWarning: percentUsed >= config.warningThreshold,
    isOverLimit: total > available,
  };
}

/**
 * Get token budget config for a model
 *
 * @param model - Model name
 * @returns Token budget configuration
 */
export function getTokenBudgetForModel(model: string): TokenBudgetConfig {
  const limit = MODEL_TOKEN_LIMITS[model] || MODEL_TOKEN_LIMITS["default"];
  return {
    ...DEFAULT_TOKEN_BUDGET,
    maxContextTokens: limit,
    // Scale max per file based on model capacity
    maxTokensPerFile: Math.min(4000, Math.floor(limit / 10)),
  };
}

/**
 * Format token count for display
 *
 * @param tokens - Token count
 * @returns Formatted string (e.g., "1.2k", "8k")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    const k = tokens / 1000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Create a human-readable token budget summary
 *
 * @param usage - Token usage information
 * @returns Summary string
 */
export function formatTokenBudgetSummary(usage: TokenUsage): string {
  const used = formatTokenCount(usage.total);
  const available = formatTokenCount(usage.available);

  if (usage.isOverLimit) {
    return `⚠️ ${used} / ${available} tokens (over limit!)`;
  } else if (usage.isWarning) {
    return `⚡ ${used} / ${available} tokens (${usage.percentUsed}%)`;
  } else {
    return `${used} / ${available} tokens`;
  }
}
