/**
 * Tests for custom error classes
 */

import { describe, it, expect } from "vitest";
import {
  PAError,
  AuthenticationError,
  TokenValidationError,
  RateLimitError,
  NetworkError,
  ApiError,
  ProviderNotConfiguredError,
  VaultAccessError,
  toUserError,
  isRetryableError,
  getUserMessage,
} from "./errors";

describe("Custom Error Classes", () => {
  describe("PAError", () => {
    it("should create error with all properties", () => {
      const error = new PAError("TEST_CODE", "tech message", "user message", true);

      expect(error.code).toBe("TEST_CODE");
      expect(error.message).toBe("tech message");
      expect(error.userMessage).toBe("user message");
      expect(error.isRetryable).toBe(true);
      expect(error.name).toBe("PAError");
    });

    it("should default isRetryable to false", () => {
      const error = new PAError("TEST", "msg", "user msg");
      expect(error.isRetryable).toBe(false);
    });
  });

  describe("AuthenticationError", () => {
    it("should have correct defaults", () => {
      const error = new AuthenticationError("Auth failed");

      expect(error.code).toBe("AUTH_ERROR");
      expect(error.message).toBe("Auth failed");
      expect(error.userMessage).toContain("Authentication failed");
      expect(error.isRetryable).toBe(false);
    });

    it("should allow custom user message", () => {
      const error = new AuthenticationError("Auth failed", "Please log in again");
      expect(error.userMessage).toBe("Please log in again");
    });
  });

  describe("RateLimitError", () => {
    it("should be retryable", () => {
      const error = new RateLimitError("Too many requests");
      expect(error.isRetryable).toBe(true);
    });

    it("should include retry time in message", () => {
      const error = new RateLimitError("Rate limited", 60);
      expect(error.userMessage).toContain("60 seconds");
      expect(error.retryAfter).toBe(60);
    });
  });

  describe("NetworkError", () => {
    it("should be retryable", () => {
      const error = new NetworkError("Connection failed");
      expect(error.isRetryable).toBe(true);
      expect(error.code).toBe("NETWORK_ERROR");
    });
  });

  describe("ApiError", () => {
    it("should be retryable for 5xx errors", () => {
      const error500 = new ApiError("Server error", 500);
      expect(error500.isRetryable).toBe(true);

      const error503 = new ApiError("Service unavailable", 503);
      expect(error503.isRetryable).toBe(true);
    });

    it("should not be retryable for 4xx errors", () => {
      const error400 = new ApiError("Bad request", 400);
      expect(error400.isRetryable).toBe(false);

      const error404 = new ApiError("Not found", 404);
      expect(error404.isRetryable).toBe(false);
    });
  });

  describe("ProviderNotConfiguredError", () => {
    it("should include provider type", () => {
      const error = new ProviderNotConfiguredError("github-models");

      expect(error.providerType).toBe("github-models");
      expect(error.userMessage).toContain("github-models");
      expect(error.userMessage).toContain("settings");
    });
  });

  describe("VaultAccessError", () => {
    it("should include path information", () => {
      const error = new VaultAccessError("private/notes.md", "not in allowed folders");

      expect(error.path).toBe("private/notes.md");
      expect(error.userMessage).toContain("private/notes.md");
      expect(error.userMessage).toContain("consent");
    });
  });
});

describe("Error Utilities", () => {
  describe("toUserError", () => {
    it("should pass through PAError unchanged", () => {
      const original = new NetworkError("test");
      const result = toUserError(original);
      expect(result).toBe(original);
    });

    it("should convert network errors", () => {
      const error = new Error("fetch failed: ECONNREFUSED");
      const result = toUserError(error);

      expect(result).toBeInstanceOf(NetworkError);
      expect(result.code).toBe("NETWORK_ERROR");
    });

    it("should convert auth errors", () => {
      const error = new Error("401 Unauthorized");
      const result = toUserError(error);

      expect(result).toBeInstanceOf(AuthenticationError);
    });

    it("should convert rate limit errors", () => {
      const error = new Error("429 Too Many Requests");
      const result = toUserError(error);

      expect(result).toBeInstanceOf(RateLimitError);
    });

    it("should convert token errors", () => {
      const error = new Error("Token is invalid or expired");
      const result = toUserError(error);

      expect(result).toBeInstanceOf(TokenValidationError);
    });

    it("should convert unknown errors to ApiError", () => {
      const error = new Error("Something went wrong");
      const result = toUserError(error);

      expect(result).toBeInstanceOf(ApiError);
    });

    it("should handle non-Error objects", () => {
      const result = toUserError("string error");

      expect(result).toBeInstanceOf(PAError);
      expect(result.code).toBe("UNKNOWN_ERROR");
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable PAError", () => {
      expect(isRetryableError(new NetworkError("test"))).toBe(true);
      expect(isRetryableError(new RateLimitError("test"))).toBe(true);
    });

    it("should return false for non-retryable PAError", () => {
      expect(isRetryableError(new AuthenticationError("test"))).toBe(false);
    });

    it("should detect retryable patterns in Error", () => {
      expect(isRetryableError(new Error("Network timeout"))).toBe(true);
      expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
    });

    it("should return false for unknown errors", () => {
      expect(isRetryableError(new Error("Invalid input"))).toBe(false);
    });
  });

  describe("getUserMessage", () => {
    it("should return userMessage for PAError", () => {
      const error = new AuthenticationError("tech", "User friendly message");
      expect(getUserMessage(error)).toBe("User friendly message");
    });

    it("should convert and get message for Error", () => {
      const error = new Error("Rate limit exceeded");
      const message = getUserMessage(error);

      expect(message).toContain("Rate limit");
    });

    it("should handle unknown types", () => {
      expect(getUserMessage(null)).toBe("An unexpected error occurred.");
      expect(getUserMessage(undefined)).toBe("An unexpected error occurred.");
    });
  });
});
