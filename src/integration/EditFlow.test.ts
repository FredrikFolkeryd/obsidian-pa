/**
 * Integration tests for the edit flow from chat to vault
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parseEditBlocks, mayContainEdits } from "../chat/EditBlockParser";

// Mock types for SafeVaultAccess simulation
interface MockProposedEdit {
  path: string;
  originalContent: string;
  newContent: string;
  timestamp: number;
  reason: string;
}

interface MockWriteResult {
  success: boolean;
  path: string;
  backupPath?: string;
  error?: string;
}

/**
 * Simulates the edit flow that happens in ChatView
 */
class EditFlowSimulator {
  private pendingEdits: Map<string, MockProposedEdit> = new Map();
  private auditLog: Array<{
    timestamp: number;
    operation: string;
    path: string;
    success: boolean;
  }> = [];
  private fileContents: Map<string, string> = new Map();

  public constructor(initialFiles: Record<string, string>) {
    for (const [path, content] of Object.entries(initialFiles)) {
      this.fileContents.set(path, content);
    }
  }

  public proposeEdit(
    path: string,
    newContent: string,
    reason: string
  ): MockProposedEdit | null {
    const originalContent = this.fileContents.get(path) ?? "";

    const proposed: MockProposedEdit = {
      path,
      originalContent,
      newContent,
      timestamp: Date.now(),
      reason,
    };

    this.pendingEdits.set(path, proposed);
    return proposed;
  }

  public applyEdit(path: string): MockWriteResult {
    const pending = this.pendingEdits.get(path);
    if (!pending) {
      return { success: false, path, error: "No pending edit" };
    }

    // Simulate backup and apply
    this.fileContents.set(path, pending.newContent);
    this.pendingEdits.delete(path);
    this.auditLog.push({
      timestamp: Date.now(),
      operation: "modify",
      path,
      success: true,
    });

    return {
      success: true,
      path,
      backupPath: `.pa-backups/${path}`,
    };
  }

  public cancelEdit(path: string): boolean {
    return this.pendingEdits.delete(path);
  }

  public getFileContent(path: string): string | undefined {
    return this.fileContents.get(path);
  }

  public getAuditLog(): Array<{
    timestamp: number;
    operation: string;
    path: string;
    success: boolean;
  }> {
    return this.auditLog;
  }
}

describe("Edit Flow Integration", () => {
  describe("AI Response to Edit Application", () => {
    let simulator: EditFlowSimulator;

    beforeEach(() => {
      simulator = new EditFlowSimulator({
        "notes/daily.md": "# Daily Note\n\nOriginal content",
        "projects/todo.md": "# Todo\n\n- [ ] Item 1",
      });
    });

    it("should parse edit from AI response and apply it", () => {
      // Simulate AI response with edit suggestion
      const aiResponse = `I've updated your daily note to add the new section:

\`\`\`markdown:notes/daily.md
# Daily Note

Original content

## New Section
Added by AI
\`\`\``;

      // Step 1: Parse the response
      const parseResult = parseEditBlocks(aiResponse);

      expect(parseResult.hasEdits).toBe(true);
      expect(parseResult.blocks).toHaveLength(1);
      expect(parseResult.blocks[0].path).toBe("notes/daily.md");

      // Step 2: Propose the edit
      const block = parseResult.blocks[0];
      const proposed = simulator.proposeEdit(
        block.path,
        block.content,
        "AI-suggested edit from chat"
      );

      expect(proposed).not.toBeNull();
      expect(proposed?.originalContent).toBe("# Daily Note\n\nOriginal content");
      expect(proposed?.newContent).toContain("## New Section");

      // Step 3: Apply the edit (simulating user confirmation)
      const result = simulator.applyEdit(block.path);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();

      // Step 4: Verify file was updated
      const newContent = simulator.getFileContent(block.path);
      expect(newContent).toContain("## New Section");
      expect(newContent).toContain("Added by AI");
    });

    it("should handle multiple edits in one response", () => {
      const aiResponse = `Here are the updates for both files:

\`\`\`markdown:notes/daily.md
# Daily Note

Updated daily content
\`\`\`

\`\`\`markdown:projects/todo.md
# Todo

- [x] Item 1
- [ ] Item 2
\`\`\``;

      const parseResult = parseEditBlocks(aiResponse);

      expect(parseResult.hasEdits).toBe(true);
      expect(parseResult.blocks).toHaveLength(2);

      // Apply each edit
      for (const block of parseResult.blocks) {
        simulator.proposeEdit(block.path, block.content, "Multi-file edit");
        simulator.applyEdit(block.path);
      }

      expect(simulator.getFileContent("notes/daily.md")).toContain("Updated daily content");
      expect(simulator.getFileContent("projects/todo.md")).toContain("[x] Item 1");
    });

    it("should handle cancelled edits", () => {
      const aiResponse = `\`\`\`markdown:notes/daily.md
# Unwanted changes
\`\`\``;

      const parseResult = parseEditBlocks(aiResponse);
      const block = parseResult.blocks[0];

      simulator.proposeEdit(block.path, block.content, "Test");

      // User cancels
      const cancelled = simulator.cancelEdit(block.path);

      expect(cancelled).toBe(true);

      // Original content should remain
      expect(simulator.getFileContent(block.path)).toBe("# Daily Note\n\nOriginal content");
    });

    it("should track edits in audit log", () => {
      const aiResponse = `\`\`\`markdown:notes/daily.md
# Audited edit
\`\`\``;

      const parseResult = parseEditBlocks(aiResponse);
      const block = parseResult.blocks[0];

      simulator.proposeEdit(block.path, block.content, "Audit test");
      simulator.applyEdit(block.path);

      const log = simulator.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].operation).toBe("modify");
      expect(log[0].path).toBe("notes/daily.md");
      expect(log[0].success).toBe(true);
    });
  });

  describe("Quick Edit Detection", () => {
    it("should quickly identify responses with potential edits", () => {
      const withEdit = "Here's the update:\n```markdown:file.md\ncontent\n```";
      const withoutEdit = "Sure, here's some information about markdown.";

      expect(mayContainEdits(withEdit)).toBe(true);
      expect(mayContainEdits(withoutEdit)).toBe(false);
    });

    it("should handle various AI response formats", () => {
      // XML style
      expect(mayContainEdits('<edit path="test.md">content</edit>')).toBe(true);

      // Contextual mention
      expect(mayContainEdits("Updated `notes/test.md`:\n```markdown\ncontent\n```")).toBe(true);

      // Just a code example (not an edit)
      expect(mayContainEdits("```javascript\nconsole.log('hello');\n```")).toBe(false);
    });
  });

  describe("Context File Handling", () => {
    it("should use context file for implicit edits", () => {
      const response = `Here's the updated version:

\`\`\`markdown
# Improved Note
Better content here
\`\`\``;

      // Without context - no match
      const resultNoContext = parseEditBlocks(response);
      expect(resultNoContext.hasEdits).toBe(false);

      // With context - matches to the open file
      const resultWithContext = parseEditBlocks(response, "current/note.md");
      expect(resultWithContext.hasEdits).toBe(true);
      expect(resultWithContext.blocks[0].path).toBe("current/note.md");
    });
  });

  describe("Error Handling", () => {
    it("should warn about empty content blocks", () => {
      const response = `\`\`\`markdown:empty.md

\`\`\``;

      const result = parseEditBlocks(response);

      expect(result.hasEdits).toBe(false);
      expect(result.warnings).toContain("Edit block for empty.md has empty content");
    });

    it("should handle malformed edit blocks gracefully", () => {
      const response = `\`\`\`not-a-file
just some code
\`\`\`

Regular text here.`;

      const result = parseEditBlocks(response);

      // Should not crash, just return no edits
      expect(result.hasEdits).toBe(false);
      expect(result.blocks).toHaveLength(0);
    });
  });
});
