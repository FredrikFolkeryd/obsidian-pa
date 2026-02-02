/**
 * Custom error types for the PA plugin
 *
 * These provide structured error handling with user-friendly messages
 * and categorization for different error scenarios.
 */

/**
 * Base error class for PA plugin errors
 */
export class PAError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly isRetryable: boolean;

  public constructor(
    code: string,
    message: string,
    userMessage: string,
    isRetryable = false
  ) {
    super(message);
    this.name = "PAError";
    this.code = code;
    this.userMessage = userMessage;
    this.isRetryable = isRetryable;
  }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends PAError {
  public constructor(message: string, userMessage?: string) {
    super(
      "AUTH_ERROR",
      message,
      userMessage ?? "Authentication failed. Please check your credentials in settings.",
      false
    );
    this.name = "AuthenticationError";
  }
}

/**
 * Token validation errors
 */
export class TokenValidationError extends PAError {
  public constructor(message: string, userMessage?: string) {
    super(
      "TOKEN_INVALID",
      message,
      userMessage ?? "Your access token is invalid or expired. Please update it in settings.",
      false
    );
    this.name = "TokenValidationError";
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends PAError {
  public readonly retryAfter?: number;

  public constructor(message: string, retryAfter?: number) {
    super(
      "RATE_LIMIT",
      message,
      retryAfter
        ? `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
        : "Rate limit exceeded. Please wait a moment before trying again.",
      true
    );
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends PAError {
  public constructor(message: string, userMessage?: string) {
    super(
      "NETWORK_ERROR",
      message,
      userMessage ?? "Unable to connect to the AI service. Please check your internet connection.",
      true
    );
    this.name = "NetworkError";
  }
}

/**
 * API errors from the provider
 */
export class ApiError extends PAError {
  public readonly statusCode?: number;

  public constructor(message: string, statusCode?: number, userMessage?: string) {
    super(
      "API_ERROR",
      message,
      userMessage ?? `The AI service returned an error: ${message}`,
      statusCode !== undefined && statusCode >= 500
    );
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

/**
 * Provider not configured errors
 */
export class ProviderNotConfiguredError extends PAError {
  public readonly providerType: string;

  public constructor(providerType: string) {
    super(
      "PROVIDER_NOT_CONFIGURED",
      `Provider ${providerType} is not configured`,
      `Please configure ${providerType} in the plugin settings before using it.`,
      false
    );
    this.name = "ProviderNotConfiguredError";
    this.providerType = providerType;
  }
}

/**
 * Vault access errors
 */
export class VaultAccessError extends PAError {
  public readonly path: string;

  public constructor(path: string, reason: string) {
    super(
      "VAULT_ACCESS_DENIED",
      `Access denied to ${path}: ${reason}`,
      `Cannot access file "${path}". Check your vault consent settings.`,
      false
    );
    this.name = "VaultAccessError";
    this.path = path;
  }
}

/**
 * Convert unknown errors to PAError
 * Useful for catch blocks to ensure consistent error handling
 */
export function toUserError(error: unknown): PAError {
  if (error instanceof PAError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("fetch") || message.includes("econnrefused")) {
      return new NetworkError(error.message);
    }

    if (message.includes("401") || message.includes("unauthorized") || message.includes("authentication")) {
      return new AuthenticationError(error.message);
    }

    if (message.includes("429") || message.includes("rate limit") || message.includes("too many requests")) {
      return new RateLimitError(error.message);
    }

    if (message.includes("token") && (message.includes("invalid") || message.includes("expired"))) {
      return new TokenValidationError(error.message);
    }

    // Generic API error
    return new ApiError(error.message);
  }

  // Unknown error type
  return new PAError(
    "UNKNOWN_ERROR",
    String(error),
    "An unexpected error occurred. Please try again.",
    true
  );
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof PAError) {
    return error.isRetryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("rate limit") ||
      message.includes("503") ||
      message.includes("502") ||
      message.includes("500")
    );
  }

  return false;
}

/**
 * Get a user-friendly message from any error
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof PAError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    return toUserError(error).userMessage;
  }

  return "An unexpected error occurred.";
}
