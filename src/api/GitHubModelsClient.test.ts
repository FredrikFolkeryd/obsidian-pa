/**
 * Tests for GitHubModelsClient
 */

/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubModelsClient } from "./GitHubModelsClient";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GitHubModelsClient", () => {
  let client: GitHubModelsClient;

  beforeEach(() => {
    client = new GitHubModelsClient("test-token");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("chat", () => {
    it("should send a chat request with correct headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Hello!" } }],
        }),
      });

      await client.chat([{ role: "user", content: "Hi" }]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://models.inference.ai.azure.com/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
        })
      );
    });

    it("should include system prompt when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Response" } }],
        }),
      });

      await client.chat([{ role: "user", content: "Hello" }], {
        systemPrompt: "You are a helpful assistant",
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.messages[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant",
      });
    });

    it("should return the assistant response content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "This is the response" } }],
        }),
      });

      const result = await client.chat([{ role: "user", content: "Test" }]);

      expect(result).toBe("This is the response");
    });

    it("should throw error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          error: { message: "Invalid token" },
        }),
      });

      await expect(client.chat([{ role: "user", content: "Test" }])).rejects.toThrow(
        "Invalid token"
      );
    });

    it("should throw error when no choices returned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      });

      await expect(client.chat([{ role: "user", content: "Test" }])).rejects.toThrow(
        "No response from AI model"
      );
    });

    it("should use correct model from options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Response" } }],
        }),
      });

      await client.chat([{ role: "user", content: "Test" }], {
        model: "gpt-4o-mini",
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.model).toBe("gpt-4o-mini");
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return initial rate limit status", () => {
      const status = client.getRateLimitStatus();

      expect(status.minuteRemaining).toBe(15);
      expect(status.dayRemaining).toBe(150);
    });

    it("should decrement counters after requests", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Response" } }],
        }),
      });

      await client.chat([{ role: "user", content: "Test 1" }]);
      await client.chat([{ role: "user", content: "Test 2" }]);

      const status = client.getRateLimitStatus();
      expect(status.minuteRemaining).toBe(13);
      expect(status.dayRemaining).toBe(148);
    });
  });
});
