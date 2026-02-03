/**
 * Tests for chat helper functions
 *
 * These test pure logic extracted from UI components.
 */

import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  generateMessageId,
  isFilePathAllowed,
  getTodayDateString,
  shouldResetUsage,
  formatUsageDisplay,
  extractCodeBlockContents,
  buildSystemPrompt,
  formatConversationExport,
  truncateContextFiles,
} from "./helpers";

describe("formatRelativeTime", () => {
  const now = 1700000000000; // Fixed reference point

  it("should return 'just now' for timestamps within the last minute", () => {
    expect(formatRelativeTime(now - 30000, now)).toBe("just now");
    expect(formatRelativeTime(now - 59999, now)).toBe("just now");
    expect(formatRelativeTime(now, now)).toBe("just now");
  });

  it("should return minutes ago for timestamps 1-59 minutes ago", () => {
    expect(formatRelativeTime(now - 60000, now)).toBe("1m ago");
    expect(formatRelativeTime(now - 120000, now)).toBe("2m ago");
    expect(formatRelativeTime(now - 3599999, now)).toBe("59m ago");
  });

  it("should return hours ago for timestamps 1-23 hours ago", () => {
    expect(formatRelativeTime(now - 3600000, now)).toBe("1h ago");
    expect(formatRelativeTime(now - 7200000, now)).toBe("2h ago");
    expect(formatRelativeTime(now - 86399999, now)).toBe("23h ago");
  });

  it("should return formatted date for timestamps more than 24 hours ago", () => {
    const timestamp = now - 86400000; // 1 day ago
    const result = formatRelativeTime(timestamp, now);
    // Should contain month abbreviation
    expect(result).toMatch(/\w+/);
    expect(result).not.toBe("just now");
    expect(result).not.toMatch(/ago$/);
  });

  it("should handle future timestamps", () => {
    expect(formatRelativeTime(now + 60000, now)).toBe("in the future");
  });
});

describe("generateMessageId", () => {
  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateMessageId());
    }
    expect(ids.size).toBe(100);
  });

  it("should start with 'msg-' prefix", () => {
    const id = generateMessageId();
    expect(id.startsWith("msg-")).toBe(true);
  });

  it("should contain timestamp component", () => {
    const id = generateMessageId();
    const parts = id.split("-");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    // Second part should be a number (timestamp)
    expect(Number.isFinite(parseInt(parts[1]))).toBe(true);
  });
});

describe("isFilePathAllowed", () => {
  describe("opt-in mode", () => {
    it("should allow files in included folders", () => {
      expect(
        isFilePathAllowed("notes/daily/2024-01-01.md", "opt-in", ["notes"], [])
      ).toBe(true);
      expect(
        isFilePathAllowed("notes/daily/2024-01-01.md", "opt-in", ["notes/daily"], [])
      ).toBe(true);
    });

    it("should reject files not in included folders", () => {
      expect(
        isFilePathAllowed("private/secrets.md", "opt-in", ["notes"], [])
      ).toBe(false);
      expect(
        isFilePathAllowed("root.md", "opt-in", ["notes"], [])
      ).toBe(false);
    });

    it("should handle exact folder matches", () => {
      expect(
        isFilePathAllowed("notes", "opt-in", ["notes"], [])
      ).toBe(true);
    });

    it("should handle multiple included folders", () => {
      expect(
        isFilePathAllowed("work/project.md", "opt-in", ["notes", "work"], [])
      ).toBe(true);
      expect(
        isFilePathAllowed("notes/idea.md", "opt-in", ["notes", "work"], [])
      ).toBe(true);
    });

    it("should not match partial folder names", () => {
      // "notes" should not match "notes2" folder
      expect(
        isFilePathAllowed("notes2/file.md", "opt-in", ["notes"], [])
      ).toBe(false);
    });
  });

  describe("opt-out mode", () => {
    it("should allow files not in excluded folders", () => {
      expect(
        isFilePathAllowed("notes/daily/2024-01-01.md", "opt-out", [], ["private"])
      ).toBe(true);
    });

    it("should reject files in excluded folders", () => {
      expect(
        isFilePathAllowed("private/secrets.md", "opt-out", [], ["private"])
      ).toBe(false);
    });

    it("should handle nested exclusions", () => {
      expect(
        isFilePathAllowed("private/deep/file.md", "opt-out", [], ["private"])
      ).toBe(false);
    });

    it("should allow root files by default", () => {
      expect(
        isFilePathAllowed("README.md", "opt-out", [], ["private"])
      ).toBe(true);
    });

    it("should handle multiple excluded folders", () => {
      expect(
        isFilePathAllowed("private/file.md", "opt-out", [], ["private", "secret"])
      ).toBe(false);
      expect(
        isFilePathAllowed("secret/file.md", "opt-out", [], ["private", "secret"])
      ).toBe(false);
      expect(
        isFilePathAllowed("public/file.md", "opt-out", [], ["private", "secret"])
      ).toBe(true);
    });
  });
});

describe("getTodayDateString", () => {
  it("should return YYYY-MM-DD format", () => {
    const date = new Date("2024-03-15T10:30:00Z");
    const result = getTodayDateString(date);
    expect(result).toBe("2024-03-15");
  });

  it("should handle year boundaries", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    expect(getTodayDateString(date)).toBe("2025-01-01");
  });

  it("should handle leap year dates", () => {
    const date = new Date("2024-02-29T12:00:00Z");
    expect(getTodayDateString(date)).toBe("2024-02-29");
  });
});

describe("shouldResetUsage", () => {
  it("should return true when dates differ", () => {
    expect(shouldResetUsage("2024-01-01", "2024-01-02")).toBe(true);
    expect(shouldResetUsage("2023-12-31", "2024-01-01")).toBe(true);
  });

  it("should return false when dates match", () => {
    expect(shouldResetUsage("2024-01-01", "2024-01-01")).toBe(false);
  });

  it("should handle empty stored date", () => {
    expect(shouldResetUsage("", "2024-01-01")).toBe(true);
  });
});

describe("formatUsageDisplay", () => {
  it("should use singular for count of 1", () => {
    expect(formatUsageDisplay(1)).toBe("1 request today");
  });

  it("should use plural for count > 1", () => {
    expect(formatUsageDisplay(2)).toBe("2 requests today");
    expect(formatUsageDisplay(100)).toBe("100 requests today");
  });

  it("should use plural for count of 0", () => {
    expect(formatUsageDisplay(0)).toBe("0 requests today");
  });
});

describe("extractCodeBlockContents", () => {
  it("should extract single code block", () => {
    const markdown = "Some text\n```js\nconsole.log('hello');\n```\nMore text";
    const result = extractCodeBlockContents(markdown);
    expect(result).toEqual(["console.log('hello');"]);
  });

  it("should extract multiple code blocks", () => {
    const markdown = `
\`\`\`python
def hello():
    pass
\`\`\`

Some text

\`\`\`javascript
const x = 1;
\`\`\`
`;
    const result = extractCodeBlockContents(markdown);
    expect(result).toEqual(["def hello():\n    pass", "const x = 1;"]);
  });

  it("should handle code blocks without language", () => {
    const markdown = "```\nplain code\n```";
    const result = extractCodeBlockContents(markdown);
    expect(result).toEqual(["plain code"]);
  });

  it("should return empty array for no code blocks", () => {
    const markdown = "Just some regular text without code.";
    const result = extractCodeBlockContents(markdown);
    expect(result).toEqual([]);
  });

  it("should preserve indentation in code blocks", () => {
    const markdown = "```\n  indented\n    more indented\n```";
    const result = extractCodeBlockContents(markdown);
    expect(result).toEqual(["  indented\n    more indented"]);
  });

  it("should handle nested backticks in code", () => {
    const markdown = "```markdown\n`inline code`\n```";
    const result = extractCodeBlockContents(markdown);
    expect(result).toEqual(["`inline code`"]);
  });
});

describe("buildSystemPrompt", () => {
  it("should include base instructions", () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain("helpful AI assistant");
    expect(prompt).toContain("Edit Capabilities");
    expect(prompt).toContain("Copyable Content");
  });

  it("should mention no notes when context is empty", () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain("No notes are currently visible");
  });

  it("should include single file context", () => {
    const files = [
      { basename: "test", path: "notes/test.md", content: "Hello world" },
    ];
    const prompt = buildSystemPrompt(files);
    expect(prompt).toContain("1 open note");
    expect(prompt).toContain("📝 Active: test");
    expect(prompt).toContain("Path: notes/test.md");
    expect(prompt).toContain("Hello world");
  });

  it("should include multiple file contexts", () => {
    const files = [
      { basename: "main", path: "main.md", content: "Main content" },
      { basename: "other", path: "other.md", content: "Other content" },
    ];
    const prompt = buildSystemPrompt(files);
    expect(prompt).toContain("2 open notes");
    expect(prompt).toContain("📝 Active: main");
    expect(prompt).not.toContain("📝 Active: other");
  });
});

describe("formatConversationExport", () => {
  it("should include header with model", () => {
    const result = formatConversationExport([], "gpt-4o");
    expect(result).toContain("# AI Conversation Export");
    expect(result).toContain("Model: gpt-4o");
  });

  it("should format user messages", () => {
    const messages = [
      { role: "user", content: "Hello", timestamp: new Date("2024-01-01T10:00:00") },
    ];
    const result = formatConversationExport(messages, "test");
    expect(result).toContain("**You**");
    expect(result).toContain("Hello");
  });

  it("should format assistant messages", () => {
    const messages = [
      { role: "assistant", content: "Hi there!", timestamp: new Date("2024-01-01T10:01:00") },
    ];
    const result = formatConversationExport(messages, "test");
    expect(result).toContain("**Assistant**");
    expect(result).toContain("Hi there!");
  });

  it("should include timestamps", () => {
    const messages = [
      { role: "user", content: "Test", timestamp: new Date("2024-01-01T10:30:00") },
    ];
    const result = formatConversationExport(messages, "test");
    expect(result).toMatch(/\(\d+:\d+/); // Time format
  });
});

describe("truncateContextFiles", () => {
  it("should not truncate small files", () => {
    const files = [
      { basename: "small", path: "small.md", content: "Short content" },
    ];
    const result = truncateContextFiles(files);
    expect(result[0].truncated).toBe(false);
    expect(result[0].content).toBe("Short content");
  });

  it("should truncate large files", () => {
    const longContent = "x".repeat(5000);
    const files = [
      { basename: "large", path: "large.md", content: longContent },
    ];
    const result = truncateContextFiles(files, 8000, 4000);
    expect(result[0].truncated).toBe(true);
    expect(result[0].content).toContain("(truncated)");
    expect(result[0].content.length).toBeLessThan(longContent.length);
  });

  it("should respect total character limit across files", () => {
    const files = [
      { basename: "a", path: "a.md", content: "x".repeat(5000) },
      { basename: "b", path: "b.md", content: "y".repeat(5000) },
      { basename: "c", path: "c.md", content: "z".repeat(5000) },
    ];
    const result = truncateContextFiles(files, 8000, 4000);
    
    // First two files should be included (truncated to fit)
    expect(result.length).toBe(2);
  });

  it("should exclude files that exceed remaining budget", () => {
    const files = [
      { basename: "a", path: "a.md", content: "x".repeat(8000) },
      { basename: "b", path: "b.md", content: "Small" },
    ];
    const result = truncateContextFiles(files, 8000, 4000);
    
    // First file fills budget, second excluded
    expect(result.length).toBe(2);
  });

  it("should handle empty file array", () => {
    const result = truncateContextFiles([]);
    expect(result).toEqual([]);
  });

  it("should use custom limits", () => {
    const files = [
      { basename: "a", path: "a.md", content: "x".repeat(200) },
    ];
    const result = truncateContextFiles(files, 100, 50);
    expect(result[0].truncated).toBe(true);
    expect(result[0].content.length).toBeLessThanOrEqual(70); // 50 chars + truncation notice
  });
});
