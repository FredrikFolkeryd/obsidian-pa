/**
 * Pure helper functions for chat and UI logic
 *
 * These functions are extracted from UI components to enable unit testing
 * without DOM dependencies.
 */

/**
 * Format a timestamp as a relative time string
 * @param timestamp - Unix timestamp in milliseconds
 * @param now - Current time in milliseconds (for testing)
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp;

  if (diff < 0) {
    return "in the future";
  } else if (diff < 60000) {
    return "just now";
  } else if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  } else {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

/**
 * Generate a unique message ID
 * @returns A unique string ID for messages
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if a file path is allowed based on consent settings
 *
 * @param path - File path to check
 * @param consentMode - Either "opt-in" (allow listed) or "opt-out" (deny listed)
 * @param includedFolders - Folders allowed in opt-in mode
 * @param excludedFolders - Folders blocked in opt-out mode
 * @returns Whether the file is allowed for AI access
 */
export function isFilePathAllowed(
  path: string,
  consentMode: "opt-in" | "opt-out",
  includedFolders: string[],
  excludedFolders: string[]
): boolean {
  if (consentMode === "opt-in") {
    // Only allow if in included folders
    return includedFolders.some(
      (folder) => path.startsWith(folder + "/") || path === folder
    );
  } else {
    // Allow unless in excluded folders
    return !excludedFolders.some(
      (folder) => path.startsWith(folder + "/") || path === folder
    );
  }
}

/**
 * Get today's date as YYYY-MM-DD string in the local timezone
 * @param date - Date to format (defaults to now)
 * @returns Date string YYYY-MM-DD in local time
 */
export function getTodayDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Check if usage should reset based on date comparison
 * @param storedDate - Previously stored date string
 * @param currentDate - Current date string
 * @returns Whether usage counter should reset
 */
export function shouldResetUsage(storedDate: string, currentDate: string): boolean {
  return storedDate !== currentDate;
}

/**
 * Format usage count for display
 * @param count - Number of requests
 * @returns Formatted string like "5 requests today"
 */
export function formatUsageDisplay(count: number): string {
  const reqText = count === 1 ? "request" : "requests";
  return `${count} ${reqText} today`;
}

/**
 * Extract raw code block contents from markdown
 * Matches fenced code blocks and returns their inner content
 *
 * @param markdown - Raw markdown string
 * @returns Array of code block contents (without backticks)
 */
export function extractCodeBlockContents(markdown: string): string[] {
  const codeBlockRegex = /```(?:[^\n]*)\n([\s\S]*?)```/g;
  const contents: string[] = [];
  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    contents.push(match[1].trimEnd());
  }
  return contents;
}

/**
 * Build a system prompt for AI chat
 *
 * @param contextFiles - Array of { basename, path, content } for visible files
 * @param options - Optional configuration
 * @param options.enableTaskPlanning - Whether to include task planning instructions
 * @returns System prompt string
 */
export function buildSystemPrompt(
  contextFiles: Array<{ basename: string; path: string; content: string }>,
  options?: { enableTaskPlanning?: boolean }
): string {
  let systemPrompt =
    "You are a helpful AI assistant integrated into Obsidian. " +
    "Help the user with their notes, writing, and knowledge management.\n\n" +
    "## Edit Capabilities\n" +
    "You CAN edit the user's notes! When asked to edit, create, or modify a file, " +
    "provide your changes in a fenced code block with the file path, like this:\n\n" +
    "```path/to/file.md\n" +
    "The complete new content of the file goes here.\n" +
    "```\n\n" +
    "The user will see an 'Apply Edit' button to review and apply your changes. " +
    "Always include the FULL file path and the COMPLETE new content (not just the changed parts).\n\n" +
    "## Copyable Content\n" +
    "When providing content the user might want to copy (lists, templates, text snippets, etc.), " +
    "wrap it in a fenced code block with 'markdown' as the language:\n\n" +
    "```markdown\n" +
    "Your copyable content here\n" +
    "```\n\n" +
    "Each code block has a copy button that copies the raw content without the backticks. " +
    "Keep your explanations OUTSIDE the code block.";

  // Add task planning capabilities if enabled
  if (options?.enableTaskPlanning) {
    systemPrompt += buildTaskPlanningInstructions();
  }

  if (contextFiles.length > 0) {
    const fileContexts = contextFiles.map((file, idx) => {
      const isPrimary = idx === 0;
      return (
        `### ${isPrimary ? "📝 Active: " : ""}${file.basename}\n` +
        `Path: ${file.path}\n` +
        `\`\`\`\n${file.content}\n\`\`\``
      );
    });

    const fileLabel = contextFiles.length === 1 ? "note" : "notes";
    systemPrompt +=
      `\n\n## Open Notes\n` +
      `You have access to ${contextFiles.length} open ${fileLabel}:\n\n` +
      fileContexts.join("\n\n") +
      `\n\nYou can reference, discuss, and EDIT these notes. ` +
      `The first note marked with 📝 is the currently focused/active note.`;
  } else {
    systemPrompt +=
      `\n\nNo notes are currently visible, or all open notes are in folders the user has excluded from AI access. ` +
      `If the user wants you to see or edit a note's content, ask them to open it in the editor.`;
  }

  return systemPrompt;
}

/**
 * Format conversation for export as markdown
 *
 * @param messages - Array of messages with role, content, timestamp
 * @param model - Model name for header
 * @returns Formatted markdown string
 */
export function formatConversationExport(
  messages: Array<{ role: string; content: string; timestamp: Date }>,
  model: string
): string {
  const lines: string[] = [
    "# AI Conversation Export",
    "",
    `Exported: ${new Date().toLocaleString()}`,
    `Model: ${model}`,
    "",
    "---",
    "",
  ];

  for (const msg of messages) {
    const role = msg.role === "user" ? "**You**" : "**Assistant**";
    const time = msg.timestamp.toLocaleTimeString();
    lines.push(`### ${role} *(${time})*`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Truncate context files to fit within token budget
 *
 * @param files - Array of { path, content }
 * @param maxTotalChars - Maximum total characters
 * @param maxPerFileChars - Maximum characters per file
 * @returns Array of truncated file contexts
 */
export function truncateContextFiles(
  files: Array<{ basename: string; path: string; content: string }>,
  maxTotalChars = 8000,
  maxPerFileChars = 4000
): Array<{ basename: string; path: string; content: string; truncated: boolean }> {
  const result: Array<{ basename: string; path: string; content: string; truncated: boolean }> = [];
  let totalChars = 0;

  for (const file of files) {
    if (totalChars >= maxTotalChars) break;

    const remainingChars = maxTotalChars - totalChars;
    const allowedChars = Math.min(maxPerFileChars, remainingChars);
    const truncatedContent = file.content.slice(0, allowedChars);
    const truncated = truncatedContent.length < file.content.length;

    result.push({
      basename: file.basename,
      path: file.path,
      content: truncated ? truncatedContent + "\n... (truncated)" : file.content,
      truncated,
    });

    totalChars += truncatedContent.length;
  }

  return result;
}

/**
 * Build task planning instructions for the system prompt
 *
 * @returns Task planning instruction string
 */
export function buildTaskPlanningInstructions(): string {
  return `

## Multi-Step Task Plans

For complex requests that require multiple vault operations (creating, editing, moving, linking, or tagging files), you can provide a structured task plan that the user can review and execute with one click.

When appropriate, wrap your plan in a task-plan XML block:

\`\`\`task-plan
<task-plan description="Brief description of what this plan does">
  <step type="create-note" path="path/to/new-note.md">
    <content>
The full content of the new note.
Supports markdown.
    </content>
  </step>
  <step type="modify-note" path="path/to/existing.md">
    <content>
The complete new content for this file.
    </content>
  </step>
  <step type="add-tag" path="path/to/note.md" tag="project" />
  <step type="add-link" path="path/to/note.md" target="related-note.md" display="Related Note" />
  <step type="move-note" path="old/location.md" destination="new/location.md" />
  <step type="delete-note" path="path/to/remove.md" />
</task-plan>
\`\`\`

### Available Step Types

| Type | Required Attributes | Description |
|------|---------------------|-------------|
| \`create-note\` | \`path\` | Create a new file with the given content |
| \`modify-note\` | \`path\` | Replace file content entirely |
| \`add-tag\` | \`path\`, \`tag\` | Add a tag to frontmatter (creates frontmatter if needed) |
| \`add-link\` | \`path\`, \`target\` | Append a wikilink at the end of the file |
| \`move-note\` | \`path\`, \`destination\` | Rename or move a file |
| \`delete-note\` | \`path\` | Delete a file (backup created automatically) |

### When to Use Task Plans

- Creating multiple related notes (e.g., project structure)
- Batch operations on several files
- Complex refactoring across notes
- Setting up templates with links and tags

For single file edits, prefer the simple fenced code block format instead.`;
}
