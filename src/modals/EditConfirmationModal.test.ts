/**
 * EditConfirmationModal tests
 *
 * Tests for the diff preview functionality without requiring DOM.
 * We extract the diff computation logic for unit testing.
 */

import { describe, it, expect } from "vitest";

// Since the diff computation is private, we'll test via extractable logic
// For now, we test the diff algorithm inline

/**
 * Compute LCS - extracted for testing
 */
function computeLCS(
  oldLines: string[],
  newLines: string[]
): Array<{ oldIdx: number; newIdx: number }> {
  const m = oldLines.length;
  const n = newLines.length;
  
  // Build LCS table
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find LCS
  const lcs: Array<{ oldIdx: number; newIdx: number }> = [];
  let i = m;
  let j = n;
  
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      lcs.unshift({ oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

interface DiffLine {
  type: "add" | "del" | "same" | "context";
  text: string;
  oldLineNum?: number;
  newLineNum?: number;
}

/**
 * Compute unified diff - extracted for testing
 */
function computeUnifiedDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const lcs = computeLCS(oldLines, newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const lcsMatch = lcsIdx < lcs.length ? lcs[lcsIdx] : null;
    
    if (lcsMatch && oldIdx === lcsMatch.oldIdx && newIdx === lcsMatch.newIdx) {
      result.push({
        type: "same",
        text: oldLines[oldIdx],
        oldLineNum: oldIdx + 1,
        newLineNum: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else if (lcsMatch && oldIdx < lcsMatch.oldIdx && newIdx < lcsMatch.newIdx) {
      result.push({
        type: "del",
        text: oldLines[oldIdx],
        oldLineNum: oldIdx + 1,
      });
      oldIdx++;
    } else if (lcsMatch && oldIdx < lcsMatch.oldIdx) {
      result.push({
        type: "del",
        text: oldLines[oldIdx],
        oldLineNum: oldIdx + 1,
      });
      oldIdx++;
    } else if (lcsMatch && newIdx < lcsMatch.newIdx) {
      result.push({
        type: "add",
        text: newLines[newIdx],
        newLineNum: newIdx + 1,
      });
      newIdx++;
    } else if (oldIdx < oldLines.length) {
      result.push({
        type: "del",
        text: oldLines[oldIdx],
        oldLineNum: oldIdx + 1,
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      result.push({
        type: "add",
        text: newLines[newIdx],
        newLineNum: newIdx + 1,
      });
      newIdx++;
    }
  }

  return result;
}

describe("EditConfirmationModal", () => {
  describe("computeLCS", () => {
    it("should find LCS for identical lines", () => {
      const oldLines = ["a", "b", "c"];
      const newLines = ["a", "b", "c"];
      const lcs = computeLCS(oldLines, newLines);
      
      expect(lcs).toEqual([
        { oldIdx: 0, newIdx: 0 },
        { oldIdx: 1, newIdx: 1 },
        { oldIdx: 2, newIdx: 2 },
      ]);
    });

    it("should find LCS for simple insertion", () => {
      const oldLines = ["a", "c"];
      const newLines = ["a", "b", "c"];
      const lcs = computeLCS(oldLines, newLines);
      
      expect(lcs).toEqual([
        { oldIdx: 0, newIdx: 0 },
        { oldIdx: 1, newIdx: 2 },
      ]);
    });

    it("should find LCS for simple deletion", () => {
      const oldLines = ["a", "b", "c"];
      const newLines = ["a", "c"];
      const lcs = computeLCS(oldLines, newLines);
      
      expect(lcs).toEqual([
        { oldIdx: 0, newIdx: 0 },
        { oldIdx: 2, newIdx: 1 },
      ]);
    });

    it("should find LCS for replacement", () => {
      const oldLines = ["a", "b", "c"];
      const newLines = ["a", "x", "c"];
      const lcs = computeLCS(oldLines, newLines);
      
      expect(lcs).toEqual([
        { oldIdx: 0, newIdx: 0 },
        { oldIdx: 2, newIdx: 2 },
      ]);
    });

    it("should handle empty old lines", () => {
      const oldLines: string[] = [];
      const newLines = ["a", "b"];
      const lcs = computeLCS(oldLines, newLines);
      
      expect(lcs).toEqual([]);
    });

    it("should handle empty new lines", () => {
      const oldLines = ["a", "b"];
      const newLines: string[] = [];
      const lcs = computeLCS(oldLines, newLines);
      
      expect(lcs).toEqual([]);
    });
  });

  describe("computeUnifiedDiff", () => {
    it("should show no changes for identical content", () => {
      const oldLines = ["line 1", "line 2", "line 3"];
      const newLines = ["line 1", "line 2", "line 3"];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      expect(diff).toHaveLength(3);
      expect(diff.every(d => d.type === "same")).toBe(true);
      expect(diff[0].oldLineNum).toBe(1);
      expect(diff[0].newLineNum).toBe(1);
    });

    it("should show addition at end", () => {
      const oldLines = ["line 1"];
      const newLines = ["line 1", "line 2"];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      expect(diff).toHaveLength(2);
      expect(diff[0]).toEqual({ type: "same", text: "line 1", oldLineNum: 1, newLineNum: 1 });
      expect(diff[1]).toEqual({ type: "add", text: "line 2", newLineNum: 2 });
    });

    it("should show deletion", () => {
      const oldLines = ["line 1", "line 2"];
      const newLines = ["line 1"];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      expect(diff).toHaveLength(2);
      expect(diff[0]).toEqual({ type: "same", text: "line 1", oldLineNum: 1, newLineNum: 1 });
      expect(diff[1]).toEqual({ type: "del", text: "line 2", oldLineNum: 2 });
    });

    it("should show insertion in middle", () => {
      const oldLines = ["a", "c"];
      const newLines = ["a", "b", "c"];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      expect(diff).toHaveLength(3);
      expect(diff[0]).toEqual({ type: "same", text: "a", oldLineNum: 1, newLineNum: 1 });
      expect(diff[1]).toEqual({ type: "add", text: "b", newLineNum: 2 });
      expect(diff[2]).toEqual({ type: "same", text: "c", oldLineNum: 2, newLineNum: 3 });
    });

    it("should show replacement as del+add", () => {
      const oldLines = ["a", "old", "c"];
      const newLines = ["a", "new", "c"];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      expect(diff).toHaveLength(4);
      expect(diff[0].type).toBe("same");
      expect(diff[1].type).toBe("del");
      expect(diff[1].text).toBe("old");
      expect(diff[2].type).toBe("add");
      expect(diff[2].text).toBe("new");
      expect(diff[3].type).toBe("same");
    });

    it("should handle complete replacement", () => {
      const oldLines = ["old1", "old2"];
      const newLines = ["new1", "new2"];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      expect(diff).toHaveLength(4);
      expect(diff.filter(d => d.type === "del")).toHaveLength(2);
      expect(diff.filter(d => d.type === "add")).toHaveLength(2);
    });

    it("should handle new file (empty old)", () => {
      const oldLines: string[] = [];
      const newLines = ["line 1", "line 2"];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      expect(diff).toHaveLength(2);
      expect(diff.every(d => d.type === "add")).toBe(true);
    });

    it("should handle file deletion (empty new)", () => {
      const oldLines = ["line 1", "line 2"];
      const newLines: string[] = [];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      expect(diff).toHaveLength(2);
      expect(diff.every(d => d.type === "del")).toBe(true);
    });

    it("should track line numbers correctly for complex diff", () => {
      const oldLines = ["a", "b", "c", "d"];
      const newLines = ["a", "x", "y", "d"];
      const diff = computeUnifiedDiff(oldLines, newLines);
      
      // Should be: same(a), del(b), del(c), add(x), add(y), same(d)
      const sameA = diff.find(d => d.text === "a");
      const sameD = diff.find(d => d.text === "d");
      
      expect(sameA?.oldLineNum).toBe(1);
      expect(sameA?.newLineNum).toBe(1);
      expect(sameD?.oldLineNum).toBe(4);
      expect(sameD?.newLineNum).toBe(4);
    });
  });

  describe("diff statistics", () => {
    it("should count additions and deletions correctly", () => {
      const diff: DiffLine[] = [
        { type: "same", text: "a", oldLineNum: 1, newLineNum: 1 },
        { type: "del", text: "b", oldLineNum: 2 },
        { type: "add", text: "x", newLineNum: 2 },
        { type: "add", text: "y", newLineNum: 3 },
        { type: "same", text: "c", oldLineNum: 3, newLineNum: 4 },
      ];
      
      const additions = diff.filter(d => d.type === "add").length;
      const deletions = diff.filter(d => d.type === "del").length;
      const same = diff.filter(d => d.type === "same").length;
      
      expect(additions).toBe(2);
      expect(deletions).toBe(1);
      expect(same).toBe(2);
    });
  });
});
