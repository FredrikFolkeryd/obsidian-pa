/**
 * TaskIntentDetector Tests
 *
 * Tests for natural language task intent detection.
 */

import { describe, it, expect } from "vitest";
import {
  detectIntent,
  detectAllIntents,
  mayContainTaskIntent,
  generatePlanDescription,
  type TaskIntent,
} from "./TaskIntentDetector";

describe("TaskIntentDetector", () => {
  describe("detectIntent", () => {
    describe("create-note intents", () => {
      it("should detect 'create a note about X'", () => {
        const result = detectIntent("Create a note about meeting notes");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("create-note");
        expect(result?.params.content).toBe("meeting notes");
        expect(result?.confidence).toBeGreaterThan(0.8);
      });

      it("should detect 'make a new note for X'", () => {
        const result = detectIntent("Make a new note for project ideas");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("create-note");
        expect(result?.params.content).toBe("project ideas");
      });

      it("should detect 'new note: X'", () => {
        const result = detectIntent("new note: daily standup");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("create-note");
        expect(result?.params.content).toBe("daily standup");
      });

      it("should detect 'I want a note about X'", () => {
        const result = detectIntent("I want a note about recipes");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("create-note");
        expect(result?.params.content).toBe("recipes");
      });

      it("should detect 'write a note on X'", () => {
        const result = detectIntent("Write a note on TypeScript best practices");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("create-note");
        expect(result?.params.content).toBe("TypeScript best practices");
      });
    });

    describe("add-link intents", () => {
      it("should detect 'add a link to X'", () => {
        const result = detectIntent("Add a link to the project page");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("add-link");
        expect(result?.params.target).toBe("the project page");
      });

      it("should detect 'link this to X'", () => {
        const result = detectIntent("Link this to my daily notes");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("add-link");
        expect(result?.params.target).toBe("my daily notes");
      });

      it("should detect 'connect this to X'", () => {
        const result = detectIntent("Connect this to the main index");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("add-link");
        expect(result?.params.target).toBe("the main index");
      });
    });

    describe("add-tag intents", () => {
      it("should detect 'add tag #X'", () => {
        const result = detectIntent("Add tag #important");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("add-tag");
        expect(result?.params.tag).toBe("important");
      });

      it("should detect 'tag this with X'", () => {
        const result = detectIntent("Tag this with urgent");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("add-tag");
        expect(result?.params.tag).toBe("urgent");
      });

      it("should detect 'apply the tag X'", () => {
        const result = detectIntent("Apply the tag todo");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("add-tag");
        expect(result?.params.tag).toBe("todo");
      });

      it("should strip # from tag name", () => {
        const result = detectIntent("Add the tag #work");
        expect(result?.params.tag).toBe("work");
      });
    });

    describe("move-note intents", () => {
      it("should detect 'move this to folder X'", () => {
        const result = detectIntent("Move this to folder archive");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("move-note");
        expect(result?.params.destination).toBe("archive");
      });

      it("should detect 'put this in X'", () => {
        const result = detectIntent("Put this in the projects folder");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("move-note");
        expect(result?.params.destination).toBe("projects folder");
      });

      it("should detect 'file this under X'", () => {
        const result = detectIntent("File this under reference");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("move-note");
        expect(result?.params.destination).toBe("reference");
      });
    });

    describe("delete-note intents", () => {
      it("should detect 'delete the note X'", () => {
        const result = detectIntent("Delete the note old-draft.md");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("delete-note");
        expect(result?.params.path).toBe("old-draft.md");
      });

      it("should detect 'remove the note X'", () => {
        const result = detectIntent("Remove the note scratch.md");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("delete-note");
        expect(result?.params.path).toBe("scratch.md");
      });

      it("should have lower confidence for delete", () => {
        const result = detectIntent("Delete the note test.md");
        expect(result?.confidence).toBeLessThan(0.8);
      });
    });

    describe("modify-note intents", () => {
      it("should detect 'add to the note X'", () => {
        const result = detectIntent("Add this to the note daily.md");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("modify-note");
        expect(result?.params.path).toBe("daily.md");
      });

      it("should detect 'update the note X'", () => {
        const result = detectIntent("Update the note readme.md");
        expect(result).not.toBeNull();
        expect(result?.type).toBe("modify-note");
        expect(result?.params.path).toBe("readme.md");
      });
    });

    describe("non-task messages", () => {
      it("should return null for general questions", () => {
        const result = detectIntent("What is the capital of France?");
        expect(result).toBeNull();
      });

      it("should return null for greetings", () => {
        const result = detectIntent("Hello, how are you?");
        expect(result).toBeNull();
      });

      it("should return null for empty string", () => {
        const result = detectIntent("");
        expect(result).toBeNull();
      });

      it("should return null for null input", () => {
        const result = detectIntent(null as unknown as string);
        expect(result).toBeNull();
      });

      it("should return null for undefined input", () => {
        const result = detectIntent(undefined as unknown as string);
        expect(result).toBeNull();
      });

      it("should return null for non-string input", () => {
        const result = detectIntent(123 as unknown as string);
        expect(result).toBeNull();
      });
    });

    describe("intent metadata", () => {
      it("should include matched phrase", () => {
        const result = detectIntent("Create a note about testing");
        expect(result?.matchedPhrase).toContain("Create a note about testing");
      });

      it("should include original message", () => {
        const message = "  Create a note about testing  ";
        const result = detectIntent(message);
        expect(result?.originalMessage).toBe(message);
      });
    });
  });

  describe("detectAllIntents", () => {
    it("should return empty array for non-task messages", () => {
      const result = detectAllIntents("Hello world");
      expect(result).toEqual([]);
    });

    it("should return empty array for empty string", () => {
      const result = detectAllIntents("");
      expect(result).toEqual([]);
    });

    it("should return empty array for null", () => {
      const result = detectAllIntents(null as unknown as string);
      expect(result).toEqual([]);
    });

    it("should detect single intent", () => {
      const result = detectAllIntents("Create a note about testing");
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("create-note");
    });

    it("should return array even for single intent", () => {
      const result = detectAllIntents("Add tag #test");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });
  });

  describe("mayContainTaskIntent", () => {
    it("should return true for 'create' keyword", () => {
      expect(mayContainTaskIntent("I want to create something")).toBe(true);
    });

    it("should return true for 'new note' phrase", () => {
      expect(mayContainTaskIntent("Make a new note")).toBe(true);
    });

    it("should return true for 'tag' keyword", () => {
      expect(mayContainTaskIntent("Can you tag this?")).toBe(true);
    });

    it("should return true for 'link' keyword", () => {
      expect(mayContainTaskIntent("Add a link here")).toBe(true);
    });

    it("should return true for 'delete' keyword", () => {
      expect(mayContainTaskIntent("Please delete this")).toBe(true);
    });

    it("should return false for unrelated messages", () => {
      expect(mayContainTaskIntent("What's the weather?")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(mayContainTaskIntent("")).toBe(false);
    });

    it("should return false for null", () => {
      expect(mayContainTaskIntent(null as unknown as string)).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(mayContainTaskIntent("CREATE A NOTE")).toBe(true);
      expect(mayContainTaskIntent("Delete This")).toBe(true);
    });
  });

  describe("generatePlanDescription", () => {
    it("should generate description for create-note", () => {
      const intent: TaskIntent = {
        type: "create-note",
        confidence: 0.85,
        params: { content: "meeting notes" },
        matchedPhrase: "create a note about meeting notes",
        originalMessage: "create a note about meeting notes",
      };
      expect(generatePlanDescription(intent)).toBe('Create a new note about "meeting notes"');
    });

    it("should generate description for create-note without content", () => {
      const intent: TaskIntent = {
        type: "create-note",
        confidence: 0.85,
        params: {},
        matchedPhrase: "create a note",
        originalMessage: "create a note",
      };
      expect(generatePlanDescription(intent)).toBe("Create a new note");
    });

    it("should generate description for add-link", () => {
      const intent: TaskIntent = {
        type: "add-link",
        confidence: 0.8,
        params: { target: "index.md" },
        matchedPhrase: "add link to index.md",
        originalMessage: "add link to index.md",
      };
      expect(generatePlanDescription(intent)).toBe('Add link to "index.md"');
    });

    it("should generate description for add-tag", () => {
      const intent: TaskIntent = {
        type: "add-tag",
        confidence: 0.85,
        params: { tag: "urgent" },
        matchedPhrase: "add tag urgent",
        originalMessage: "add tag urgent",
      };
      expect(generatePlanDescription(intent)).toBe("Add tag #urgent");
    });

    it("should generate description for move-note", () => {
      const intent: TaskIntent = {
        type: "move-note",
        confidence: 0.8,
        params: { destination: "archive" },
        matchedPhrase: "move to archive",
        originalMessage: "move to archive",
      };
      expect(generatePlanDescription(intent)).toBe('Move note to "archive"');
    });

    it("should generate description for delete-note", () => {
      const intent: TaskIntent = {
        type: "delete-note",
        confidence: 0.7,
        params: { path: "old.md" },
        matchedPhrase: "delete old.md",
        originalMessage: "delete old.md",
      };
      expect(generatePlanDescription(intent)).toBe('Delete note "old.md"');
    });

    it("should handle unknown type gracefully", () => {
      const intent: TaskIntent = {
        type: "unknown" as TaskIntent["type"],
        confidence: 0.5,
        params: {},
        matchedPhrase: "",
        originalMessage: "",
      };
      expect(generatePlanDescription(intent)).toBe("Execute task");
    });
  });
});
