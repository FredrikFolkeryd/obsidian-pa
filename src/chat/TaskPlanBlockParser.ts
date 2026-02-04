/**
 * Task Plan Block Parser
 *
 * Parses AI responses to detect and extract proposed task plans.
 * Works alongside EditBlockParser but handles multi-step task XML blocks.
 *
 * Supported formats:
 * 1. XML task-plan blocks: <task-plan>...</task-plan>
 * 2. Fenced code blocks with task-plan language hint: ```task-plan
 */

import { parseTaskPlan, validateTaskPlan, ParseError } from "../tasks/TaskPlanParser";
import type { TaskPlan, TaskPlanValidation } from "../tasks/types";

/**
 * A parsed task plan from an AI response
 */
export interface ParsedTaskPlan {
  /** The parsed task plan */
  plan: TaskPlan;
  /** Start index in the original response */
  startIndex: number;
  /** End index in the original response */
  endIndex: number;
  /** The format that was detected */
  format: "xml" | "fenced";
  /** The raw XML content */
  rawXml: string;
}

/**
 * Result of parsing a response for task plans
 */
export interface TaskPlanParseResult {
  /** Whether any task plans were found */
  hasPlans: boolean;
  /** The parsed task plans */
  plans: ParsedTaskPlan[];
  /** Any parsing warnings or errors */
  warnings: string[];
  /** Validation results for each plan */
  validations: TaskPlanValidation[];
}

/**
 * Parse an AI response to extract proposed task plans
 *
 * @param response - The AI response text
 * @returns TaskPlanParseResult with extracted task plans
 */
export function parseTaskPlanBlocks(response: string): TaskPlanParseResult {
  const plans: ParsedTaskPlan[] = [];
  const warnings: string[] = [];
  const validations: TaskPlanValidation[] = [];

  // Try fenced code block format FIRST (to detect ```task-plan blocks)
  const fencedPlans = parseFencedTaskPlans(response);
  plans.push(...fencedPlans.plans);
  warnings.push(...fencedPlans.warnings);

  // Try XML format (outside of fenced blocks)
  const xmlPlans = parseXmlTaskPlans(response);

  // Add XML plans only if they don't overlap with fenced blocks
  for (const xmlPlan of xmlPlans.plans) {
    const overlaps = plans.some(
      (p) =>
        // Check if XML plan is contained within a fenced block
        (xmlPlan.startIndex >= p.startIndex && xmlPlan.endIndex <= p.endIndex) ||
        // Check for any other overlap
        (xmlPlan.startIndex >= p.startIndex && xmlPlan.startIndex < p.endIndex) ||
        (xmlPlan.endIndex > p.startIndex && xmlPlan.endIndex <= p.endIndex)
    );
    if (!overlaps) {
      plans.push(xmlPlan);
    }
  }
  warnings.push(...xmlPlans.warnings);

  // Sort by position in response
  plans.sort((a, b) => a.startIndex - b.startIndex);

  // Validate each plan
  for (const parsedPlan of plans) {
    const validation = validateTaskPlan(parsedPlan.plan);
    validations.push(validation);
    if (!validation.valid) {
      warnings.push(`Plan "${parsedPlan.plan.description ?? parsedPlan.plan.id}": ${validation.errors.join(", ")}`);
    }
  }

  return {
    hasPlans: plans.length > 0,
    plans,
    warnings,
    validations,
  };
}

/**
 * Parse XML-style task plan blocks
 * Looks for: <task-plan>...</task-plan>
 */
function parseXmlTaskPlans(response: string): { plans: ParsedTaskPlan[]; warnings: string[] } {
  const plans: ParsedTaskPlan[] = [];
  const warnings: string[] = [];

  // Regex to find <task-plan>...</task-plan> blocks
  const regex = /<task-plan[^>]*>([\s\S]*?)<\/task-plan>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(response)) !== null) {
    const fullMatch = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    try {
      const plan = parseTaskPlan(fullMatch);
      plans.push({
        plan,
        startIndex,
        endIndex,
        format: "xml",
        rawXml: fullMatch,
      });
    } catch (error) {
      if (error instanceof ParseError) {
        warnings.push(`Failed to parse task plan at position ${startIndex}: ${error.message}`);
      } else {
        warnings.push(`Failed to parse task plan at position ${startIndex}: Unknown error`);
      }
    }
  }

  return { plans, warnings };
}

/**
 * Parse fenced code block task plans
 * Looks for: ```task-plan ... ```
 */
function parseFencedTaskPlans(response: string): { plans: ParsedTaskPlan[]; warnings: string[] } {
  const plans: ParsedTaskPlan[] = [];
  const warnings: string[] = [];

  // Regex to find ```task-plan ... ``` blocks
  const regex = /```task-plan\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(response)) !== null) {
    const content = match[1].trim();
    const fullMatch = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    // Wrap in task-plan tags if not already wrapped
    let xmlContent = content;
    if (!xmlContent.startsWith("<task-plan")) {
      xmlContent = `<task-plan>${content}</task-plan>`;
    }

    try {
      const plan = parseTaskPlan(xmlContent);
      plans.push({
        plan,
        startIndex,
        endIndex,
        format: "fenced",
        rawXml: xmlContent,
      });
    } catch (error) {
      if (error instanceof ParseError) {
        warnings.push(`Failed to parse fenced task plan at position ${startIndex}: ${error.message}`);
      } else {
        warnings.push(`Failed to parse fenced task plan at position ${startIndex}: Unknown error`);
      }
    }
  }

  return { plans, warnings };
}

/**
 * Check if a response likely contains a task plan
 * Quick check before full parsing
 */
export function mayContainTaskPlan(response: string): boolean {
  return (
    response.includes("<task-plan") ||
    response.includes("```task-plan") ||
    // Check for task-related XML elements
    (response.includes("<step") && 
     (response.includes("create-note") ||
      response.includes("modify-note") ||
      response.includes("delete-note") ||
      response.includes("move-note") ||
      response.includes("add-link") ||
      response.includes("add-tag")))
  );
}

/**
 * Extract task plan XML from a response without fully parsing it
 * Useful for displaying raw plan before approval
 */
export function extractRawTaskPlanXml(response: string): string | null {
  // Try XML format
  const xmlMatch = /<task-plan[^>]*>[\s\S]*?<\/task-plan>/i.exec(response);
  if (xmlMatch) {
    return xmlMatch[0];
  }

  // Try fenced format
  const fencedMatch = /```task-plan\s*([\s\S]*?)```/i.exec(response);
  if (fencedMatch) {
    const content = fencedMatch[1].trim();
    return content.startsWith("<task-plan") ? content : `<task-plan>${content}</task-plan>`;
  }

  return null;
}
