/**
 * Task Plan Parser
 *
 * Parses AI responses containing task plans into structured TaskPlan objects.
 * Includes validation and sanitization for security.
 *
 * Note: Uses regex-based parsing to work in both browser and Node.js environments.
 */

import {
  TaskPlan,
  TaskStep,
  TaskStepType,
  TaskStepParams,
  TaskPlanValidation,
  TaskExecutorConfig,
  DEFAULT_EXECUTOR_CONFIG,
  generateTaskId,
  generateStepId,
  ModifyNoteParams,
  MoveNoteParams,
} from "./types";

/**
 * Error thrown during parsing
 */
export class ParseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Valid step types for validation
 */
const VALID_STEP_TYPES: TaskStepType[] = [
  "create-note",
  "modify-note",
  "delete-note",
  "add-link",
  "add-tag",
  "move-note",
];

/**
 * Extract task-plan XML from an AI response
 *
 * @param response - Full AI response text
 * @returns Extracted XML string or null if not found
 */
export function extractTaskPlanXml(response: string): string | null {
  // Match <task-plan ...> ... </task-plan>
  const regex = /<task-plan\s[^>]*>[\s\S]*?<\/task-plan>/;
  const match = response.match(regex);

  if (!match) {
    return null;
  }

  // Verify it has a closing tag (basic well-formedness check)
  const xml = match[0];
  if (!xml.includes("</task-plan>")) {
    return null;
  }

  return xml;
}

/**
 * Sanitize and validate a file path
 *
 * @param path - Path to sanitize
 * @returns Sanitized path
 * @throws ParseError if path is invalid or dangerous
 */
export function sanitizePath(path: string): string {
  // Trim whitespace
  const trimmed = path.trim();

  if (!trimmed) {
    throw new ParseError("Path cannot be empty");
  }

  // Normalize separators
  const normalized = trimmed.replace(/\\/g, "/");

  // Check for path traversal
  if (normalized.includes("..")) {
    throw new ParseError(
      `Path traversal attempt detected: ${path}`
    );
  }

  // Check for absolute paths (Unix or Windows)
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new ParseError(
      `Absolute paths not allowed: ${path}`
    );
  }

  return normalized;
}

/**
 * Extract an attribute value from an XML element string
 */
function getAttribute(elementStr: string, attrName: string): string | null {
  // Match both single and double quoted attributes
  const regex = new RegExp(`${attrName}=["']([^"']*)["']`);
  const match = elementStr.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract content between <content>...</content> tags
 */
function extractContentTag(stepStr: string): string | undefined {
  const match = stepStr.match(/<content>([\s\S]*?)<\/content>/);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract text content from a step (excluding <content> blocks)
 */
function extractStepDescription(stepStr: string): string {
  // Remove <content>...</content> blocks
  let text = stepStr.replace(/<content>[\s\S]*?<\/content>/g, "");
  // Remove the opening tag
  text = text.replace(/<step[^>]*>/, "");
  // Remove the closing tag
  text = text.replace(/<\/step>/, "");
  return text.trim();
}

/**
 * Parse a step element string into params based on step type
 */
function parseStepParams(
  type: TaskStepType,
  stepStr: string
): TaskStepParams {
  const path = getAttribute(stepStr, "path");

  if (!path && type !== "add-link") {
    throw new ParseError(`Step type '${type}' requires 'path' attribute`);
  }

  const sanitizedPath = path ? sanitizePath(path) : "";

  switch (type) {
    case "create-note": {
      const content = extractContentTag(stepStr);
      return {
        path: sanitizedPath,
        content: content,
      };
    }

    case "modify-note": {
      const search = getAttribute(stepStr, "search");
      const replace = getAttribute(stepStr, "replace");
      const content = extractContentTag(stepStr);

      const params: ModifyNoteParams = { path: sanitizedPath };

      if (content) {
        params.content = content;
      }
      if (search !== null) {
        params.search = search;
        params.replace = replace || "";
      }

      return params;
    }

    case "delete-note": {
      return { path: sanitizedPath };
    }

    case "add-link": {
      const linkPath = getAttribute(stepStr, "path");
      const target = getAttribute(stepStr, "target");

      if (!linkPath) {
        throw new ParseError("add-link step requires 'path' attribute");
      }
      if (!target) {
        throw new ParseError("add-link step requires 'target' attribute");
      }

      return {
        path: sanitizePath(linkPath),
        target: sanitizePath(target),
        displayText: getAttribute(stepStr, "displayText") || undefined,
        position: (getAttribute(stepStr, "position") as "append" | "prepend" | "section") || undefined,
        section: getAttribute(stepStr, "section") || undefined,
      };
    }

    case "add-tag": {
      const tag = getAttribute(stepStr, "tag");
      if (!tag) {
        throw new ParseError("add-tag step requires 'tag' attribute");
      }

      return {
        path: sanitizedPath,
        tag: tag.replace(/^#/, ""), // Remove leading # if present
      };
    }

    case "move-note": {
      const newPath = getAttribute(stepStr, "newPath");
      if (!newPath) {
        throw new ParseError("move-note step requires 'newPath' attribute");
      }

      return {
        path: sanitizedPath,
        newPath: sanitizePath(newPath),
        updateLinks: getAttribute(stepStr, "updateLinks") !== "false",
      };
    }

    default:
      throw new ParseError(`Unknown step type: ${type as string}`);
  }
}

/**
 * Parse task plan XML into a TaskPlan object
 *
 * Uses regex-based parsing for Node.js compatibility.
 *
 * @param xml - Task plan XML string
 * @returns Parsed TaskPlan
 * @throws ParseError if XML is invalid
 */
export function parseTaskPlan(xml: string): TaskPlan {
  // Extract the task-plan element
  const planMatch = xml.match(/<task-plan([^>]*)>([\s\S]*)<\/task-plan>/);
  if (!planMatch) {
    throw new ParseError("Invalid XML: No valid task-plan element found");
  }

  const planAttrs = planMatch[1];
  const planContent = planMatch[2];

  // Extract name (required)
  const name = getAttribute(`<task-plan${planAttrs}>`, "name");
  if (!name) {
    throw new ParseError("task-plan requires 'name' attribute");
  }

  // Extract description (optional)
  const description = getAttribute(`<task-plan${planAttrs}>`, "description") || "";

  // Parse steps using regex
  const stepRegex = /<step([^>]*)>([\s\S]*?)<\/step>/g;
  const steps: TaskStep[] = [];
  let stepMatch;
  let stepIndex = 0;

  while ((stepMatch = stepRegex.exec(planContent)) !== null) {
    stepIndex++;
    const stepAttrs = stepMatch[1];
    // stepMatch[2] is the step content (unused as we parse from fullStepStr)
    const fullStepStr = stepMatch[0];

    const type = getAttribute(`<step${stepAttrs}>`, "type") as TaskStepType;

    if (!type) {
      throw new ParseError(`Step ${stepIndex} missing 'type' attribute`);
    }

    if (!VALID_STEP_TYPES.includes(type)) {
      throw new ParseError(
        `Unknown step type '${type}' in step ${stepIndex}. Valid types: ${VALID_STEP_TYPES.join(", ")}`
      );
    }

    const params = parseStepParams(type, fullStepStr);
    const stepDescription = extractStepDescription(fullStepStr);

    steps.push({
      id: generateStepId(),
      type,
      description: stepDescription,
      params,
      status: "pending",
    });
  }

  if (steps.length === 0) {
    throw new ParseError("Task plan must have at least one step");
  }

  return {
    id: generateTaskId(),
    name,
    description,
    steps,
    status: "pending",
    createdAt: Date.now(),
  };
}

/**
 * Validate a task plan against configuration limits
 *
 * @param plan - Task plan to validate
 * @param config - Optional executor config (uses defaults if not provided)
 * @returns Validation result with errors and warnings
 */
export function validateTaskPlan(
  plan: TaskPlan,
  config: Partial<TaskExecutorConfig> = {}
): TaskPlanValidation {
  const fullConfig = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check step count
  if (plan.steps.length > fullConfig.maxSteps) {
    errors.push(`Task plan exceeds maximum of ${fullConfig.maxSteps} steps`);
  }

  // Track files for duplicate detection
  const fileOperations = new Map<string, string[]>();

  // Validate each step
  for (const step of plan.steps) {
    const path = "path" in step.params ? (step.params).path : undefined;

    // Check content size
    if ("content" in step.params) {
      const content = (step.params as { content?: string }).content;
      if (typeof content === "string") {
        const contentSize = new TextEncoder().encode(content).length;
        if (contentSize > fullConfig.maxContentSize) {
          errors.push(
            `Step '${step.description}' exceeds maximum content size of ${fullConfig.maxContentSize} bytes`
          );
        }
      }
    }

    // Warn about dangerous operations
    if (step.type === "delete-note" && path) {
      warnings.push(`Plan includes delete operation for: ${path}`);
    }

    if (step.type === "move-note") {
      const moveParams = step.params as MoveNoteParams;
      warnings.push(
        `Plan includes move operation: ${moveParams.path} → ${moveParams.newPath}`
      );
    }

    // Track file operations for duplicate detection
    if (path) {
      const ops = fileOperations.get(path) || [];
      ops.push(step.type);
      fileOperations.set(path, ops);
    }
  }

  // Warn about multiple operations on same file
  for (const [path, ops] of fileOperations) {
    if (ops.length > 1) {
      warnings.push(
        `Multiple operations on ${path}: ${ops.join(", ")}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
