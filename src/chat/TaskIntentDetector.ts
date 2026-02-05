/**
 * Task Intent Detector
 *
 * Detects task intents from natural language user messages.
 * Used to suggest task plans when users express intent to modify their vault.
 *
 * Supports detection of:
 * - Note creation: "Create a note about...", "Make a new note for..."
 * - Note modification: "Add to the note...", "Update the note..."
 * - Link addition: "Add a link to...", "Link this to..."
 * - Tag addition: "Tag this with...", "Add tag..."
 * - Note movement: "Move this to...", "Put this in folder..."
 * - Note deletion: "Delete the note...", "Remove the note..."
 */

import type { TaskStepType } from "../tasks/types";

/**
 * Detected task intent with extracted parameters
 */
export interface TaskIntent {
  /** The type of task detected */
  type: TaskStepType;
  /** Confidence score 0-1 */
  confidence: number;
  /** Extracted parameters from the message */
  params: TaskIntentParams;
  /** The matched phrase that triggered detection */
  matchedPhrase: string;
  /** Original message for context */
  originalMessage: string;
}

/**
 * Parameters extracted from task intent
 */
export interface TaskIntentParams {
  /** Target file path (if specified or inferable) */
  path?: string;
  /** Content or topic for create/modify */
  content?: string;
  /** Tag name for add-tag */
  tag?: string;
  /** Link target for add-link */
  target?: string;
  /** Destination path for move */
  destination?: string;
}

/**
 * Intent pattern definition
 */
interface IntentPattern {
  type: TaskStepType;
  patterns: RegExp[];
  extractParams: (match: RegExpMatchArray, message: string) => TaskIntentParams;
  confidence: number;
}

/**
 * Intent patterns ordered by specificity
 */
const INTENT_PATTERNS: IntentPattern[] = [
  // Create note patterns
  {
    type: "create-note",
    patterns: [
      /(?:create|make|start|write|draft)\s+(?:a\s+)?(?:new\s+)?note\s+(?:about|on|for|called|named|titled)\s+(.+)/i,
      /(?:new|add)\s+note\s*[:|-]?\s*(.+)/i,
      /(?:i\s+)?(?:want|need)\s+(?:a\s+)?(?:new\s+)?note\s+(?:about|on|for)\s+(.+)/i,
    ],
    extractParams: (match, _message) => ({
      content: match[1]?.trim(),
    }),
    confidence: 0.85,
  },

  // Move note patterns (before modify to avoid "put in" collision)
  {
    type: "move-note",
    patterns: [
      /(?:move|relocate|transfer)\s+(?:this\s+)?(?:note\s+)?(?:to|into)\s+(?:the\s+)?(?:folder\s+)?["']?([^"']+)["']?/i,
      /(?:put|place)\s+(?:this\s+)?(?:note\s+)?(?:in|into)\s+(?:the\s+)?(?:folder\s+)?["']?([^"']+)["']?/i,
      /(?:file|organize)\s+(?:this\s+)?(?:under|in)\s+["']?([^"']+)["']?/i,
    ],
    extractParams: (match, _message) => ({
      destination: match[1]?.trim(),
    }),
    confidence: 0.8,
  },

  // Modify note patterns
  {
    type: "modify-note",
    patterns: [
      /(?:add|append|insert)\s+(?:this\s+)?(?:to|into)\s+(?:the\s+)?note\s+["']?([^"']+)["']?/i,
      /(?:update|edit|modify|change)\s+(?:the\s+)?(?:note\s+)?["']?([^"']+)["']?/i,
      /(?:add|append)\s+(.+)\s+to\s+(?:the\s+)?(?:note|file)/i,
    ],
    extractParams: (match, _message) => ({
      path: match[1]?.trim(),
    }),
    confidence: 0.75,
  },

  // Add link patterns
  {
    type: "add-link",
    patterns: [
      /(?:add|insert|create)\s+(?:a\s+)?link\s+to\s+["']?([^"']+)["']?/i,
      /link\s+(?:this\s+)?(?:to|with)\s+["']?([^"']+)["']?/i,
      /(?:connect|reference)\s+(?:this\s+)?(?:to|with)\s+["']?([^"']+)["']?/i,
    ],
    extractParams: (match, _message) => ({
      target: match[1]?.trim(),
    }),
    confidence: 0.8,
  },

  // Add tag patterns
  {
    type: "add-tag",
    patterns: [
      /(?:add|apply|set)\s+(?:the\s+)?tag\s+#?["']?([^"'\s]+)["']?/i,
      /tag\s+(?:this|it)\s+(?:with|as)\s+#?["']?([^"'\s]+)["']?/i,
      /(?:add|apply)\s+#([^\s]+)/i,
    ],
    extractParams: (match, _message) => ({
      tag: match[1]?.trim().replace(/^#/, ""),
    }),
    confidence: 0.85,
  },

  // Delete note patterns
  {
    type: "delete-note",
    patterns: [
      /(?:delete|remove|trash)\s+(?:the\s+)?(?:note\s+)?["']?([^"']+)["']?/i,
      /(?:get\s+rid\s+of|discard)\s+(?:the\s+)?(?:note\s+)?["']?([^"']+)["']?/i,
    ],
    extractParams: (match, _message) => ({
      path: match[1]?.trim(),
    }),
    confidence: 0.7, // Lower confidence for destructive operations
  },
];

/**
 * Detect task intent from a user message
 *
 * @param message - The user's natural language message
 * @returns Detected intent or null if no task intent found
 */
export function detectIntent(message: string): TaskIntent | null {
  if (!message || typeof message !== "string") {
    return null;
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return null;
  }

  for (const intentPattern of INTENT_PATTERNS) {
    for (const pattern of intentPattern.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          type: intentPattern.type,
          confidence: intentPattern.confidence,
          params: intentPattern.extractParams(match, trimmed),
          matchedPhrase: match[0],
          originalMessage: message,
        };
      }
    }
  }

  return null;
}

/**
 * Detect all task intents in a message (for multi-intent scenarios)
 *
 * @param message - The user's natural language message
 * @returns Array of detected intents, may be empty
 */
export function detectAllIntents(message: string): TaskIntent[] {
  if (!message || typeof message !== "string") {
    return [];
  }

  const intents: TaskIntent[] = [];
  const trimmed = message.trim();

  for (const intentPattern of INTENT_PATTERNS) {
    for (const pattern of intentPattern.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        intents.push({
          type: intentPattern.type,
          confidence: intentPattern.confidence,
          params: intentPattern.extractParams(match, trimmed),
          matchedPhrase: match[0],
          originalMessage: message,
        });
        break; // Only one match per intent type
      }
    }
  }

  return intents;
}

/**
 * Check if a message might contain a task intent (quick check)
 *
 * @param message - The user's message
 * @returns True if the message might contain a task intent
 */
export function mayContainTaskIntent(message: string): boolean {
  if (!message || typeof message !== "string") {
    return false;
  }

  const keywords = [
    "create",
    "make",
    "new note",
    "add",
    "link",
    "tag",
    "move",
    "delete",
    "remove",
    "update",
    "edit",
    "modify",
  ];

  const lower = message.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

/**
 * Generate a suggested task plan description from intent
 *
 * @param intent - The detected task intent
 * @returns Human-readable description for the task plan
 */
export function generatePlanDescription(intent: TaskIntent): string {
  switch (intent.type) {
    case "create-note":
      return `Create a new note${intent.params.content ? ` about "${intent.params.content}"` : ""}`;
    case "modify-note":
      return `Modify note${intent.params.path ? ` "${intent.params.path}"` : ""}`;
    case "add-link":
      return `Add link to "${intent.params.target ?? "target note"}"`;
    case "add-tag":
      return `Add tag #${intent.params.tag ?? "tag"}`;
    case "move-note":
      return `Move note to "${intent.params.destination ?? "destination"}"`;
    case "delete-note":
      return `Delete note${intent.params.path ? ` "${intent.params.path}"` : ""}`;
    default:
      return "Execute task";
  }
}
