/**
 * Tests for EditBlockParser
 */

import { describe, it, expect } from "vitest";
import {
  parseEditBlocks,
  mayContainEdits,
} from "./EditBlockParser";

describe("EditBlockParser", () => {
  describe("parseEditBlocks", () => {
    describe("fenced code blocks with path", () => {
      it("should parse code block with language:path format", () => {
        const response = `Here's the fix:

\`\`\`typescript:src/main.ts
export function hello() {
  return "world";
}
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].path).toBe("src/main.ts");
        expect(result.blocks[0].content).toContain("export function hello");
        expect(result.blocks[0].format).toBe("fenced-path");
        expect(result.blocks[0].language).toBe("typescript");
      });

      it("should parse code block with path-only format", () => {
        const response = `\`\`\`notes/daily.md
# Daily Note

Today's tasks:
- [ ] Review PR
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].path).toBe("notes/daily.md");
        expect(result.blocks[0].language).toBe("markdown");
      });

      it("should parse multiple code blocks", () => {
        const response = `Update these files:

\`\`\`markdown:docs/readme.md
# Readme
Updated content
\`\`\`

\`\`\`typescript:src/index.ts
export default {};
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks).toHaveLength(2);
        expect(result.blocks[0].path).toBe("docs/readme.md");
        expect(result.blocks[1].path).toBe("src/index.ts");
      });

      it("should handle paths without slashes but with extension", () => {
        const response = `\`\`\`config.json
{ "key": "value" }
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks[0].path).toBe("config.json");
      });
    });

    describe("XML edit blocks", () => {
      it("should parse XML edit block with path attribute", () => {
        const response = `<edit path="notes/todo.md">
# Todo List
- [x] Done
</edit>`;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].path).toBe("notes/todo.md");
        expect(result.blocks[0].format).toBe("xml-edit");
      });

      it("should parse XML edit block with file attribute", () => {
        const response = `<edit file="src/util.ts">
export const util = {};
</edit>`;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks[0].path).toBe("src/util.ts");
      });

      it("should handle single quotes in attributes", () => {
        const response = `<edit path='docs/guide.md'>
# Guide
Content here
</edit>`;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks[0].path).toBe("docs/guide.md");
      });
    });

    describe("contextual code blocks", () => {
      it("should parse 'updated file.md:' pattern", () => {
        const response = `I've updated notes/journal.md:

\`\`\`markdown
# Journal Entry
New content here
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].path).toBe("notes/journal.md");
        expect(result.blocks[0].format).toBe("contextual");
      });

      it("should parse 'here is the new content for `file`:' pattern", () => {
        const response = `Here's the new content for \`projects/ideas.md\`:

\`\`\`
# Ideas
- Idea 1
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(true);
        expect(result.blocks[0].path).toBe("projects/ideas.md");
      });

      it("should use context file for implicit edits", () => {
        const response = `Here's the updated content:

\`\`\`markdown
# My Note
Updated version of the note
\`\`\``;

        const result = parseEditBlocks(response, "current/note.md");

        expect(result.hasEdits).toBe(true);
        expect(result.blocks[0].path).toBe("current/note.md");
      });

      it("should not apply implicit edit without context file", () => {
        const response = `Here's the updated content:

\`\`\`markdown
# My Note
Updated version
\`\`\``;

        const result = parseEditBlocks(response);

        // Without explicit path or context, this shouldn't match
        expect(result.hasEdits).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should return no edits for plain text", () => {
        const response = "This is just a regular response without any code blocks.";

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(false);
        expect(result.blocks).toHaveLength(0);
      });

      it("should ignore code blocks without file paths", () => {
        const response = `\`\`\`javascript
console.log("hello");
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(false);
      });

      it("should normalize paths with leading slashes", () => {
        const response = `\`\`\`markdown:/notes/test.md
Content
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.blocks[0].path).toBe("notes/test.md");
      });

      it("should warn about empty content blocks", () => {
        const response = `\`\`\`markdown:empty.md

\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.hasEdits).toBe(false);
        expect(result.warnings).toContain("Edit block for empty.md has empty content");
      });

      it("should handle blocks sorted by position", () => {
        const response = `First \`\`\`a.md
AAA
\`\`\`

Second \`\`\`b.md
BBB
\`\`\``;

        const result = parseEditBlocks(response);

        expect(result.blocks[0].path).toBe("a.md");
        expect(result.blocks[1].path).toBe("b.md");
        expect(result.blocks[0].startIndex).toBeLessThan(result.blocks[1].startIndex);
      });

      it("should not duplicate overlapping blocks", () => {
        // A response that could match multiple patterns for the same block
        const response = `Updated notes/test.md:

\`\`\`markdown:notes/test.md
# Test
Content
\`\`\``;

        const result = parseEditBlocks(response);

        // Should only get one block, not duplicates
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].path).toBe("notes/test.md");
      });
    });
  });

  describe("mayContainEdits", () => {
    it("should return true for fenced path blocks", () => {
      expect(mayContainEdits("```ts:src/file.ts")).toBe(true);
    });

    it("should return true for XML edit blocks", () => {
      expect(mayContainEdits('<edit path="file.md">')).toBe(true);
      expect(mayContainEdits('<edit file="file.md">')).toBe(true);
    });

    it("should return true for contextual patterns", () => {
      expect(mayContainEdits("Updated `file.md`:\n```")).toBe(true);
      expect(mayContainEdits("here's notes/test.md:\n```")).toBe(true);
    });

    it("should return false for plain text", () => {
      expect(mayContainEdits("Just a normal response")).toBe(false);
    });

    it("should return false for regular code blocks", () => {
      expect(mayContainEdits("```javascript\nconsole.log();\n```")).toBe(false);
    });
  });
});
