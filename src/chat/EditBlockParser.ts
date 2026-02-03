/**
 * Edit Block Parser
 *
 * Parses AI responses to detect and extract proposed file edits.
 * Supports various formats that an AI might use to suggest changes.
 *
 * Supported formats:
 * 1. Fenced code blocks with file path in language hint: ```markdown:path/to/file.md
 * 2. XML-style edit blocks: <edit path="file.md">content</edit>
 * 3. Markdown code blocks with preceding file indicator
 */

/**
 * A parsed edit block from an AI response
 */
export interface ParsedEditBlock {
  /** The file path to edit */
  path: string;
  /** The proposed new content */
  content: string;
  /** Start index in the original response */
  startIndex: number;
  /** End index in the original response */
  endIndex: number;
  /** The format that was detected */
  format: "fenced-path" | "xml-edit" | "contextual";
  /** Optional language hint from code block */
  language?: string;
}

/**
 * Result of parsing a response for edits
 */
export interface ParseResult {
  /** Whether any edit blocks were found */
  hasEdits: boolean;
  /** The parsed edit blocks */
  blocks: ParsedEditBlock[];
  /** Any parsing warnings or notes */
  warnings: string[];
}

/**
 * Parse an AI response to extract proposed edits
 *
 * @param response - The AI response text
 * @param contextFilePath - The currently open file (used for contextual edits)
 * @returns ParseResult with extracted edit blocks
 */
export function parseEditBlocks(response: string, contextFilePath?: string): ParseResult {
  const blocks: ParsedEditBlock[] = [];
  const warnings: string[] = [];

  // Try each parser in order of specificity
  const fencedBlocks = parseFencedPathBlocks(response);
  const xmlBlocks = parseXmlEditBlocks(response);
  const contextualBlocks = parseContextualBlocks(response, contextFilePath);

  // Combine blocks, avoiding duplicates by checking overlapping ranges
  const allBlocks = [...fencedBlocks, ...xmlBlocks];

  // Add contextual blocks only if they don't overlap with explicit blocks
  for (const contextBlock of contextualBlocks) {
    const overlaps = allBlocks.some(
      (b) =>
        (contextBlock.startIndex >= b.startIndex && contextBlock.startIndex < b.endIndex) ||
        (contextBlock.endIndex > b.startIndex && contextBlock.endIndex <= b.endIndex)
    );
    if (!overlaps) {
      allBlocks.push(contextBlock);
    }
  }

  // Sort by position in response
  allBlocks.sort((a, b) => a.startIndex - b.startIndex);

  // Validate blocks
  for (const block of allBlocks) {
    if (!block.path) {
      warnings.push("Found edit block without file path");
      continue;
    }
    if (!block.content.trim()) {
      warnings.push(`Edit block for ${block.path} has empty content`);
      continue;
    }
    blocks.push(block);
  }

  return {
    hasEdits: blocks.length > 0,
    blocks,
    warnings,
  };
}

/**
 * Parse fenced code blocks with file path in language hint
 * Format: ```language:path/to/file.ext or ```path/to/file.ext
 */
function parseFencedPathBlocks(response: string): ParsedEditBlock[] {
  const blocks: ParsedEditBlock[] = [];

  // Match: ```lang:path/file.ext or ```path/file.ext
  // The path must contain at least one / or end with a known extension
  const fencedRegex = /```([a-zA-Z0-9_-]*:)?([^\s`]+\.[a-zA-Z0-9]+)\n([\s\S]*?)```/g;

  let match;
  while ((match = fencedRegex.exec(response)) !== null) {
    const langPart = match[1]?.replace(":", "") || undefined;
    const pathPart = match[2];
    const content = match[3];

    // Validate it looks like a file path (has extension or slash)
    if (pathPart && (pathPart.includes("/") || /\.[a-zA-Z0-9]+$/.test(pathPart))) {
      blocks.push({
        path: normalizePath(pathPart),
        content: content.trimEnd(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        format: "fenced-path",
        language: langPart || inferLanguage(pathPart),
      });
    }
  }

  return blocks;
}

/**
 * Parse XML-style edit blocks
 * Format: <edit path="file.md">content</edit>
 */
function parseXmlEditBlocks(response: string): ParsedEditBlock[] {
  const blocks: ParsedEditBlock[] = [];

  // Match: <edit path="...">...</edit> or <edit file="...">...</edit>
  const xmlRegex = /<edit\s+(?:path|file)=["']([^"']+)["']>([\s\S]*?)<\/edit>/gi;

  let match;
  while ((match = xmlRegex.exec(response)) !== null) {
    const path = match[1];
    const content = match[2];

    blocks.push({
      path: normalizePath(path),
      content: content.trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      format: "xml-edit",
      language: inferLanguage(path),
    });
  }

  return blocks;
}

/**
 * Parse contextual code blocks that follow a file mention
 * Format: "Here's the updated `file.md`:" followed by a code block
 */
function parseContextualBlocks(
  response: string,
  contextFilePath?: string
): ParsedEditBlock[] {
  const blocks: ParsedEditBlock[] = [];

  // Match patterns like "updated file.md:" or "here's the new content for `notes/todo.md`:"
  // followed by a code block
  const contextualRegex =
    /(?:updated?|modified?|new content for|here'?s?\s+(?:the\s+)?(?:updated?|new)?)\s+[`"]?([^`"\n:]+\.[a-zA-Z0-9]+)[`"]?\s*:?\s*\n+```[a-zA-Z]*\n([\s\S]*?)```/gi;

  let match;
  while ((match = contextualRegex.exec(response)) !== null) {
    const mentionedPath = match[1].trim();
    const content = match[2];

    blocks.push({
      path: normalizePath(mentionedPath),
      content: content.trimEnd(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      format: "contextual",
      language: inferLanguage(mentionedPath),
    });
  }

  // If we have a context file and there's a standalone code block with markdown,
  // it might be an edit for the current file
  if (contextFilePath && blocks.length === 0) {
    // Look for "Here's the updated content:" followed by markdown code block
    const implicitRegex =
      /(?:here'?s?\s+(?:the\s+)?(?:updated?|revised|new)\s+(?:content|version|note)[^:]*:)\s*\n+```(?:markdown|md)?\n([\s\S]*?)```/gi;

    let implicitMatch;
    while ((implicitMatch = implicitRegex.exec(response)) !== null) {
      blocks.push({
        path: normalizePath(contextFilePath),
        content: implicitMatch[1].trimEnd(),
        startIndex: implicitMatch.index,
        endIndex: implicitMatch.index + implicitMatch[0].length,
        format: "contextual",
        language: "markdown",
      });
    }
  }

  return blocks;
}

/**
 * Normalize a file path (remove leading slashes, handle common issues)
 */
function normalizePath(path: string): string {
  return path
    .replace(/^\/+/, "") // Remove leading slashes
    .replace(/\/+/g, "/") // Normalize multiple slashes
    .trim();
}

/**
 * Infer language from file extension
 */
function inferLanguage(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    md: "markdown",
    markdown: "markdown",
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    css: "css",
    html: "html",
    py: "python",
  };
  return ext ? langMap[ext] : undefined;
}

/**
 * Check if a response likely contains edit suggestions
 * (fast check before full parsing)
 */
export function mayContainEdits(response: string): boolean {
  // Quick heuristics - check for common patterns
  return (
    // Fenced blocks with path-like language hints
    /```[a-zA-Z]*:[^\s`]+\.[a-zA-Z]+/.test(response) ||
    // XML edit blocks
    /<edit\s+(?:path|file)=/i.test(response) ||
    // Contextual mentions followed by code blocks
    /(?:updated?|here'?s)\s+[`"]?[^\s]+\.[a-zA-Z]+[`"]?\s*:?\s*\n+```/i.test(response)
  );
}
