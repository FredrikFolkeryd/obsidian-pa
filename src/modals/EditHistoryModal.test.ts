/**
 * EditHistoryModal tests
 *
 * Tests for edit history data processing and filtering logic.
 * The modal itself is DOM-dependent, but we can test the data logic.
 */

import { describe, it, expect } from "vitest";
import type { WriteAuditEntry } from "../vault/SafeVaultAccess";

/**
 * Filter and sort audit entries for display
 * (Extracted logic from EditHistoryModal for testing)
 */
function filterEditsForDisplay(auditLog: WriteAuditEntry[]): WriteAuditEntry[] {
  return [...auditLog]
    .filter((e) => e.operation !== "revert" && e.success)
    .reverse(); // Most recent first
}

/**
 * Format edit count text
 */
function formatEditCount(count: number): string {
  return `${count} edit${count === 1 ? "" : "s"} recorded`;
}

/**
 * Check if an edit can be reverted
 * Only the most recent edit (index 0) can be reverted
 */
function canRevert(index: number): boolean {
  return index === 0;
}

/**
 * Get backup filename from full path
 */
function getBackupFilename(backupPath: string | undefined): string {
  if (!backupPath) return "";
  return backupPath.split("/").pop() || backupPath;
}

describe("EditHistoryModal Logic", () => {
  describe("filterEditsForDisplay", () => {
    it("should filter out revert operations", () => {
      const log: WriteAuditEntry[] = [
        { path: "a.md", operation: "modify", success: true, timestamp: 1000, reason: "test" },
        { path: "a.md", operation: "revert", success: true, timestamp: 2000, reason: "test" },
        { path: "b.md", operation: "create", success: true, timestamp: 3000, reason: "test" },
      ];
      
      const result = filterEditsForDisplay(log);
      expect(result).toHaveLength(2);
      expect(result.every(e => e.operation !== "revert")).toBe(true);
    });

    it("should filter out failed operations", () => {
      const log: WriteAuditEntry[] = [
        { path: "a.md", operation: "modify", success: true, timestamp: 1000, reason: "test" },
        { path: "b.md", operation: "modify", success: false, timestamp: 2000, error: "Failed", reason: "test" },
        { path: "c.md", operation: "create", success: true, timestamp: 3000, reason: "test" },
      ];
      
      const result = filterEditsForDisplay(log);
      expect(result).toHaveLength(2);
      expect(result.every(e => e.success)).toBe(true);
    });

    it("should reverse the order (most recent first)", () => {
      const log: WriteAuditEntry[] = [
        { path: "first.md", operation: "create", success: true, timestamp: 1000, reason: "test" },
        { path: "second.md", operation: "modify", success: true, timestamp: 2000, reason: "test" },
        { path: "third.md", operation: "modify", success: true, timestamp: 3000, reason: "test" },
      ];
      
      const result = filterEditsForDisplay(log);
      expect(result[0].path).toBe("third.md");
      expect(result[2].path).toBe("first.md");
    });

    it("should return empty array for empty log", () => {
      expect(filterEditsForDisplay([])).toEqual([]);
    });

    it("should return empty array when all entries are filtered", () => {
      const log: WriteAuditEntry[] = [
        { path: "a.md", operation: "revert", success: true, timestamp: 1000, reason: "test" },
        { path: "b.md", operation: "modify", success: false, timestamp: 2000, reason: "test" },
      ];
      
      expect(filterEditsForDisplay(log)).toEqual([]);
    });

    it("should not mutate the original array", () => {
      const log: WriteAuditEntry[] = [
        { path: "a.md", operation: "modify", success: true, timestamp: 1000, reason: "test" },
        { path: "b.md", operation: "modify", success: true, timestamp: 2000, reason: "test" },
      ];
      const originalOrder = log.map(e => e.path);
      
      filterEditsForDisplay(log);
      
      expect(log.map(e => e.path)).toEqual(originalOrder);
    });
  });

  describe("formatEditCount", () => {
    it("should use singular for count of 1", () => {
      expect(formatEditCount(1)).toBe("1 edit recorded");
    });

    it("should use plural for count > 1", () => {
      expect(formatEditCount(2)).toBe("2 edits recorded");
      expect(formatEditCount(10)).toBe("10 edits recorded");
      expect(formatEditCount(100)).toBe("100 edits recorded");
    });

    it("should use plural for count of 0", () => {
      expect(formatEditCount(0)).toBe("0 edits recorded");
    });
  });

  describe("canRevert", () => {
    it("should return true for index 0", () => {
      expect(canRevert(0)).toBe(true);
    });

    it("should return false for index > 0", () => {
      expect(canRevert(1)).toBe(false);
      expect(canRevert(5)).toBe(false);
      expect(canRevert(100)).toBe(false);
    });
  });

  describe("getBackupFilename", () => {
    it("should extract filename from path", () => {
      expect(getBackupFilename(".pa-backups/notes/file.md.1700000000.bak"))
        .toBe("file.md.1700000000.bak");
    });

    it("should handle path without directories", () => {
      expect(getBackupFilename("backup.bak")).toBe("backup.bak");
    });

    it("should handle undefined", () => {
      expect(getBackupFilename(undefined)).toBe("");
    });

    it("should handle empty string", () => {
      expect(getBackupFilename("")).toBe("");
    });

    it("should handle path ending with slash", () => {
      // When path ends with slash, pop() returns empty string, so fallback to full path
      const result = getBackupFilename("path/to/");
      // This edge case returns the original path since pop() is empty
      expect(result).toBe("path/to/");
    });
  });

  describe("EditHistoryResult types", () => {
    it("should support close action", () => {
      const result = { action: "close" as const };
      expect(result.action).toBe("close");
    });

    it("should support revert action with path", () => {
      const result = { action: "revert" as const, revertPath: "notes/file.md" };
      expect(result.action).toBe("revert");
      expect(result.revertPath).toBe("notes/file.md");
    });

    it("should support clear action", () => {
      const result = { action: "clear" as const };
      expect(result.action).toBe("clear");
    });
  });

  describe("WriteAuditEntry integration", () => {
    it("should handle all operation types", () => {
      const operations: WriteAuditEntry["operation"][] = ["create", "modify", "revert"];
      
      for (const op of operations) {
        const entry: WriteAuditEntry = {
          path: "test.md",
          operation: op,
          success: true,
          timestamp: Date.now(),
          reason: "test",
        };
        expect(entry.operation).toBe(op);
      }
    });

    it("should handle optional backupPath field", () => {
      const minimalEntry: WriteAuditEntry = {
        path: "test.md",
        operation: "create",
        success: true,
        timestamp: 1000,
        reason: "test",
      };
      
      const fullEntry: WriteAuditEntry = {
        path: "test.md",
        operation: "modify",
        success: true,
        timestamp: 1000,
        reason: "AI-suggested edit",
        backupPath: ".pa-backups/test.md.1000.bak",
      };
      
      expect(minimalEntry.backupPath).toBeUndefined();
      expect(fullEntry.reason).toBe("AI-suggested edit");
      expect(fullEntry.backupPath).toBe(".pa-backups/test.md.1000.bak");
    });

    it("should handle failed entries with error", () => {
      const failedEntry: WriteAuditEntry = {
        path: "test.md",
        operation: "modify",
        success: false,
        timestamp: 1000,
        error: "Permission denied",
        reason: "test",
      };
      
      expect(failedEntry.success).toBe(false);
      expect(failedEntry.error).toBe("Permission denied");
    });
  });
});
