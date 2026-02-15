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
 * 4. Search/Replace blocks for partial edits
 * 5. Diff-style blocks with +/- prefixes
 */

/**
 * Type of edit operation
 */
export type EditType = "full-replace" | "search-replace" | "append" | "prepend";

/**
 * A parsed edit block from an AI response
 */
export interface ParsedEditBlock {
  /** The file path to edit */
  path: string;
  /** The proposed new content (for full replace) */
  content: string;
  /** Start index in the original response */
  startIndex: number;
  /** End index in the original response */
  endIndex: number;
  /** The format that was detected */
  format: "fenced-path" | "xml-edit" | "contextual" | "search-replace" | "diff";
  /** Optional language hint from code block */
  language?: string;
  /** Type of edit operation */
  editType: EditType;
  /** For search-replace: the text to find */
  searchText?: string;
  /** For search-replace: the replacement text */
  replaceText?: string;
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
  const searchReplaceBlocks = parseSearchReplaceBlocks(response, contextFilePath);
  const contextualBlocks = parseContextualBlocks(response, contextFilePath);

  // Combine blocks, avoiding duplicates by checking overlapping ranges
  const allBlocks = [...fencedBlocks, ...xmlBlocks, ...searchReplaceBlocks];

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

  // Match the opening fence with path: ```lang:path/file.ext or ```path/file.ext
  const openingRegex = /```([a-zA-Z0-9_-]*:)?([^\s`]+\.[a-zA-Z0-9]+)\n/g;

  let openMatch;
  while ((openMatch = openingRegex.exec(response)) !== null) {
    const langPart = openMatch[1]?.replace(":", "") || undefined;
    const pathPart = openMatch[2];

    // Validate it looks like a file path (has extension or slash)
    if (!pathPart || (!pathPart.includes("/") && !/\.[a-zA-Z0-9]+$/.test(pathPart))) {
      continue;
    }

    // Find the matching closing fence by counting nested fences
    const contentStart = openMatch.index + openMatch[0].length;
    const closingIndex = findClosingFence(response, contentStart);

    if (closingIndex === -1) {
      // No matching closing fence found
      continue;
    }

    const content = response.substring(contentStart, closingIndex);

    blocks.push({
      path: normalizePath(pathPart),
      content: content.trimEnd(),
      startIndex: openMatch.index,
      endIndex: closingIndex + 3, // +3 for the ```
      format: "fenced-path",
      language: langPart || inferLanguage(pathPart),
      editType: "full-replace",
    });
  }

  return blocks;
}

/**
 * Find the closing fence for a code block, handling nested fences
 * @param text - The text to search in
 * @param startIndex - Where to start searching (after opening fence)
 * @returns The index of the closing fence, or -1 if not found
 */
function findClosingFence(text: string, startIndex: number): number {
  let depth = 1;
  let index = startIndex;

  while (index < text.length) {
    // Look for next fence marker (```)
    const nextFence = text.indexOf("```", index);
    
    if (nextFence === -1) {
      // No more fences found
      return -1;
    }

    // Check if this fence is at the start of a line or has newline before it
    const beforeFence = nextFence > 0 ? text[nextFence - 1] : "\n";
    const isAtLineStart = beforeFence === "\n" || nextFence === 0;

    if (isAtLineStart) {
      // Check if this is an opening or closing fence
      // Opening fence has content after it on the same line (language/path)
      // Closing fence has newline or end of string after it
      const afterFence = nextFence + 3 < text.length ? text[nextFence + 3] : "\n";
      const afterFence2 = nextFence + 4 < text.length ? text.substring(nextFence + 3, nextFence + 10) : "";
      
      // Check if there's text on the same line (opening fence)
      // A closing fence is followed by newline, space, or end of text
      const hasTextAfter = afterFence !== "\n" && afterFence !== "" && afterFence !== " " && 
                          !afterFence2.startsWith("\n");

      if (hasTextAfter) {
        // Opening fence (nested code block)
        depth++;
      } else {
        // Closing fence
        depth--;
        if (depth === 0) {
          return nextFence;
        }
      }
    }

    index = nextFence + 3;
  }

  return -1;
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
      editType: "full-replace",
    });
  }

  return blocks;
}

/**
 * Parse search/replace blocks for partial edits
 * Format: SEARCH: ... REPLACE: ... or <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE
 */
function parseSearchReplaceBlocks(
  response: string,
  contextFilePath?: string
): ParsedEditBlock[] {
  const blocks: ParsedEditBlock[] = [];

  // Pattern 1: SEARCH/REPLACE with file path
  // "In `file.md`, replace:" or "file.md:" followed by SEARCH/REPLACE
  const searchReplaceRegex =
    /(?:(?:in\s+)?[`"]?([^\s`"]+\.[a-zA-Z0-9]+)[`"]?\s*[:,]\s*)?(?:replace|change|find)[:\s]*\n*```[a-zA-Z]*\n?([\s\S]*?)```\s*(?:with|to|→|->)[:\s]*\n*```[a-zA-Z]*\n?([\s\S]*?)```/gi;

  let match;
  while ((match = searchReplaceRegex.exec(response)) !== null) {
    const path = match[1] ? normalizePath(match[1]) : contextFilePath;
    const searchText = match[2].trim();
    const replaceText = match[3].trim();

    if (path && searchText) {
      blocks.push({
        path,
        content: replaceText,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        format: "search-replace",
        language: inferLanguage(path),
        editType: "search-replace",
        searchText,
        replaceText,
      });
    }
  }

  // Pattern 2: Git-style conflict markers for search/replace
  const gitStyleRegex =
    /(?:in\s+)?[`"]?([^\s`"]+\.[a-zA-Z0-9]+)[`"]?\s*:\s*\n*<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/gi;

  while ((match = gitStyleRegex.exec(response)) !== null) {
    const path = normalizePath(match[1]);
    const searchText = match[2].trim();
    const replaceText = match[3].trim();

    blocks.push({
      path,
      content: replaceText,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      format: "search-replace",
      language: inferLanguage(path),
      editType: "search-replace",
      searchText,
      replaceText,
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
      editType: "full-replace",
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
        editType: "full-replace",
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
    // Fenced blocks with path-like language hints (lang:path or just path)
    /```(?:[a-zA-Z]*:)?[^\s`]*\/[^\s`]+\.[a-zA-Z]+/.test(response) ||
    // Fenced blocks with file extension (no path separator needed)
    /```[^\s`]+\.(?:md|txt|js|ts|css|html|json|yaml|yml)\n/.test(response) ||
    // XML edit blocks
    /<edit\s+(?:path|file)=/i.test(response) ||
    // Contextual mentions followed by code blocks
    /(?:updated?|here'?s)\s+[`"]?[^\s]+\.[a-zA-Z]+[`"]?\s*:?\s*\n+```/i.test(response) ||
    // Search/replace patterns
    /(?:replace|change|find)[:\s]*\n*```[\s\S]*?```\s*(?:with|to|→|->)/i.test(response) ||
    // Git-style conflict markers
    /<<<<<<< SEARCH[\s\S]*?=======[\s\S]*?>>>>>>> REPLACE/i.test(response)
  );
}

/**
 * Apply a search/replace edit to file content
 *
 * @param originalContent - The original file content
 * @param searchText - Text to find
 * @param replaceText - Text to replace with
 * @returns The modified content, or null if search text not found
 */
export function applySearchReplace(
  originalContent: string,
  searchText: string,
  replaceText: string
): string | null {
  // Try exact match first
  if (originalContent.includes(searchText)) {
    return originalContent.replace(searchText, replaceText);
  }

  // Try with normalized whitespace
  const normalizedSearch = searchText.replace(/\s+/g, " ").trim();
  const normalizedContent = originalContent.replace(/\s+/g, " ");

  if (normalizedContent.includes(normalizedSearch)) {
    // Find the actual position in original content
    // This is a simplified approach - for production, use more robust matching
    const searchLines = searchText.split("\n").map((l) => l.trim()).filter(Boolean);
    const contentLines = originalContent.split("\n");

    for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
      let matches = true;
      for (let j = 0; j < searchLines.length; j++) {
        if (contentLines[i + j].trim() !== searchLines[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        // Found the block - replace it
        const before = contentLines.slice(0, i);
        const after = contentLines.slice(i + searchLines.length);
        return [...before, replaceText, ...after].join("\n");
      }
    }
  }

  return null; // Search text not found
}
