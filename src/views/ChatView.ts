/**
 * Chat View - Main AI conversation interface
 */

import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile, MarkdownView, Notice } from "obsidian";
import type PAPlugin from "../main";
import type { ChatMessage } from "../api/GitHubModelsClient";
import { parseEditBlocks, mayContainEdits, type ParsedEditBlock } from "../chat/EditBlockParser";
import { showEditConfirmation } from "../modals/EditConfirmationModal";
import { showEditHistory } from "../modals/EditHistoryModal";

export const VIEW_TYPE_CHAT = "pa-chat-view";

/**
 * Chat message with UI metadata
 */
interface DisplayMessage extends ChatMessage {
  id: string;
  timestamp: Date;
}

/**
 * Chat view for AI conversations
 */
export class ChatView extends ItemView {
  private plugin: PAPlugin;
  private messages: DisplayMessage[] = [];
  private inputEl: HTMLTextAreaElement | null = null;
  private messagesContainerEl: HTMLElement | null = null;
  private sendButtonEl: HTMLButtonElement | null = null;
  private stopButtonEl: HTMLButtonElement | null = null;
  private isLoading = false;
  private abortController: AbortController | null = null;
  private lastActiveFile: TFile | null = null;
  private contextIndicatorEl: HTMLElement | null = null;
  private usageStatsEl: HTMLElement | null = null;
  private modelInfoEl: HTMLElement | null = null;

  public constructor(leaf: WorkspaceLeaf, plugin: PAPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  public getViewType(): string {
    return VIEW_TYPE_CHAT;
  }

  public getDisplayText(): string {
    return "AI Chat";
  }

  public getIcon(): string {
    return "message-circle";
  }

  public async onOpen(): Promise<void> {
    await this.render();
  }

  /**
   * Refresh the view (re-check configuration and re-render)
   * Called when settings change or when navigating back to chat
   */
  public async refresh(): Promise<void> {
    await this.render();
  }

  /**
   * Internal render method - checks configuration and renders appropriate UI
   */
  private async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("pa-chat-container");

    // Check if plugin is configured
    const isConfigured = await this.plugin.isConfigured();
    
    if (!isConfigured) {
      this.renderSetupRequired(container);
      return;
    }

    this.renderChatInterface(container);
  }

  /**
   * Render the setup-required state
   */
  private renderSetupRequired(container: Element): void {
    const setupEl = container.createDiv({ cls: "pa-chat-setup-required" });
    
    setupEl.createEl("div", { cls: "pa-chat-setup-icon", text: "⚙️" });
    setupEl.createEl("h3", { text: "Setup Required" });
    setupEl.createEl("p", { 
      text: "Please complete the plugin configuration in Settings before using the chat." 
    });
    
    const openSettingsBtn = setupEl.createEl("button", {
      cls: "mod-cta",
      text: "Open Settings",
    });
    
    openSettingsBtn.addEventListener("click", () => {
      // Use type assertion for internal Obsidian API
      const setting = (this.app as unknown as { setting?: { open: () => void; openTabById?: (id: string) => void } }).setting;
      setting?.open();
      setting?.openTabById?.(this.plugin.manifest.id);
    });

    // Add styles for setup state
    this.addSetupStyles();
  }

  /**
   * Render the full chat interface
   */
  private renderChatInterface(container: Element): void {
    // Create header
    const headerEl = container.createDiv({ cls: "pa-chat-header" });
    
    const titleRow = headerEl.createDiv({ cls: "pa-chat-title-row" });
    titleRow.createEl("h4", { text: "Personal Assistant" });
    
    // Model and usage info (unobtrusive subtitle)
    const infoRow = headerEl.createDiv({ cls: "pa-chat-info-row" });
    
    // Model indicator
    this.modelInfoEl = infoRow.createSpan({ cls: "pa-chat-model" });
    this.updateModelDisplay();
    
    // Separator
    infoRow.createSpan({ cls: "pa-chat-info-sep", text: "•" });
    
    // Usage stats
    this.usageStatsEl = infoRow.createSpan({ cls: "pa-chat-usage" });
    this.updateUsageDisplay();

    // Separator
    infoRow.createSpan({ cls: "pa-chat-info-sep", text: "•" });

    // Limitation notice with link
    const limitNotice = infoRow.createEl("a", {
      cls: "pa-chat-limit-notice",
      text: "Read-only mode",
      href: "https://github.com/FredrikFolkeryd/obsidian-pa#known-limitations",
    });
    limitNotice.setAttribute("target", "_blank");
    limitNotice.setAttribute("title", "AI can read notes but cannot edit them. Click to learn more.");

    // Context indicator - shows which files AI can see
    this.contextIndicatorEl = headerEl.createDiv({ cls: "pa-chat-context" });
    this.updateContextIndicator(this.getVisibleContextFiles().filter(f => this.isFileAllowed(f.path)));

    // Create messages container
    this.messagesContainerEl = container.createDiv({ cls: "pa-chat-messages" });

    // Create input area
    const inputContainer = container.createDiv({ cls: "pa-chat-input-container" });

    this.inputEl = inputContainer.createEl("textarea", {
      cls: "pa-chat-input",
      attr: {
        placeholder: "Type your message...",
        rows: "3",
      },
    });

    // Handle Enter to send (Shift+Enter for newline)
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.sendMessage();
      }
    });

    const buttonContainer = inputContainer.createDiv({ cls: "pa-chat-buttons" });

    this.sendButtonEl = buttonContainer.createEl("button", {
      cls: "pa-chat-send-button",
      text: "Send",
    });
    this.sendButtonEl.addEventListener("click", () => {
      void this.sendMessage();
    });

    this.stopButtonEl = buttonContainer.createEl("button", {
      cls: "pa-chat-stop-button",
      text: "Stop",
    });
    this.stopButtonEl.style.display = "none";
    this.stopButtonEl.addEventListener("click", () => {
      this.stopRequest();
    });

    const exportButton = buttonContainer.createEl("button", {
      cls: "pa-chat-export-button",
      text: "Export",
      attr: { title: "Copy conversation to clipboard as markdown" },
    });
    exportButton.addEventListener("click", () => {
      void this.exportConversation();
    });

    const revertButton = buttonContainer.createEl("button", {
      cls: "pa-chat-revert-button",
      text: "Undo Edit",
      attr: { title: "Revert the last AI edit" },
    });
    revertButton.addEventListener("click", () => {
      void this.handleRevertLastEdit();
    });

    const historyButton = buttonContainer.createEl("button", {
      cls: "pa-chat-history-button",
      text: "History",
      attr: { title: "View edit history" },
    });
    historyButton.addEventListener("click", () => {
      void this.handleShowEditHistory();
    });

    const clearButton = buttonContainer.createEl("button", {
      cls: "pa-chat-clear-button",
      text: "Clear",
    });
    clearButton.addEventListener("click", () => {
      this.clearMessages();
    });

    // Add styles
    this.addStyles();

    // Load saved conversation or show welcome
    this.loadConversationHistory();
  }

  /**
   * Handle reverting the last edit
   */
  private async handleRevertLastEdit(): Promise<void> {
    const safeVault = this.plugin.safeVault;
    const auditLog = safeVault.getAuditLog();
    
    // Find the last successful modification
    const lastEdit = [...auditLog]
      .reverse()
      .find((entry) => entry.operation === "modify" && entry.success);
    
    if (!lastEdit) {
      new Notice("No recent edits to revert");
      return;
    }
    
    // Confirm revert
    const confirmed = confirm(
      `Revert the last edit to "${lastEdit.path}"?\n\n` +
      `This will restore the file from backup.`
    );
    
    if (!confirmed) return;
    
    safeVault.enableWrites();
    
    try {
      const result = await safeVault.revertEdit(lastEdit.path);
      
      if (result.success) {
        new Notice(`✓ Reverted ${lastEdit.path}`);
        this.addSystemMessage(`Reverted \`${lastEdit.path}\` to previous version.`);
      } else {
        new Notice(`✗ Failed to revert: ${result.error}`);
        this.addSystemMessage(`Failed to revert: ${result.error}`);
      }
    } finally {
      safeVault.disableWrites();
    }
  }

  /**
   * Show the edit history modal
   */
  private async handleShowEditHistory(): Promise<void> {
    const safeVault = this.plugin.safeVault;
    
    const result = await showEditHistory(this.app, safeVault);
    
    if (result.action === "revert" && result.revertPath) {
      await this.revertSpecificEdit(result.revertPath);
    } else if (result.action === "clear") {
      const confirmed = confirm("Clear all edit history? This cannot be undone.");
      if (confirmed) {
        safeVault.clearAuditLog();
        new Notice("Edit history cleared");
      }
    }
  }

  /**
   * Revert a specific file to its backup
   */
  private async revertSpecificEdit(path: string): Promise<void> {
    const safeVault = this.plugin.safeVault;
    
    safeVault.enableWrites();
    
    try {
      const result = await safeVault.revertEdit(path);
      
      if (result.success) {
        new Notice(`✓ Reverted ${path}`);
        this.addSystemMessage(`Reverted \`${path}\` to previous version.`);
      } else {
        new Notice(`✗ Failed to revert: ${result.error}`);
        this.addSystemMessage(`Failed to revert: ${result.error}`);
      }
    } finally {
      safeVault.disableWrites();
    }
  }

  /**
   * Add styles for the setup-required state
   */
  private addSetupStyles(): void {
    if (document.getElementById("pa-chat-setup-styles")) return;
    
    const styleEl = document.createElement("style");
    styleEl.id = "pa-chat-setup-styles";
    styleEl.textContent = `
      .pa-chat-setup-required {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 24px;
        text-align: center;
      }
      .pa-chat-setup-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .pa-chat-setup-required h3 {
        margin: 0 0 12px 0;
        color: var(--text-normal);
      }
      .pa-chat-setup-required p {
        margin: 0 0 20px 0;
        color: var(--text-muted);
        max-width: 280px;
      }
    `;
    document.head.appendChild(styleEl);
  }

  public async onClose(): Promise<void> {
    // Cleanup
  }

  /**
   * Add custom styles for the chat view
   */
  private addStyles(): void {
    const styleEl = document.createElement("style");
    styleEl.id = "pa-chat-styles";
    styleEl.textContent = `
      .pa-chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 10px;
      }

      .pa-chat-header {
        padding: 10px 0;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .pa-chat-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .pa-chat-header h4 {
        margin: 0;
      }

      .pa-chat-info-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75em;
        color: var(--text-muted);
        margin-top: 4px;
      }

      .pa-chat-model {
        opacity: 0.8;
      }

      .pa-chat-info-sep {
        opacity: 0.4;
      }

      .pa-chat-usage {
        opacity: 0.8;
      }

      .pa-chat-context {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75em;
        color: var(--text-muted);
        margin-top: 6px;
        padding: 4px 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        cursor: help;
      }

      .pa-chat-context-empty {
        font-style: italic;
        opacity: 0.7;
      }

      .pa-chat-context-label {
        opacity: 0.9;
      }

      .pa-chat-context-file {
        color: var(--text-normal);
        font-weight: 500;
      }

      .pa-chat-context-primary {
        color: var(--text-accent);
      }

      .pa-chat-context-sep {
        opacity: 0.5;
      }

      .pa-chat-context-more {
        opacity: 0.7;
        font-style: italic;
      }

      .pa-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 10px 0;
      }

      .pa-chat-message {
        margin-bottom: 15px;
        padding: 10px;
        border-radius: 8px;
      }

      .pa-chat-message-user {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
        margin-left: 20%;
      }

      .pa-chat-message-assistant {
        background-color: var(--background-secondary);
        margin-right: 20%;
      }

      .pa-chat-message-system {
        background-color: var(--background-modifier-message);
        font-style: italic;
        text-align: center;
      }

      .pa-chat-message-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 5px;
      }

      .pa-chat-message-role {
        font-size: 0.8em;
        opacity: 0.7;
      }

      .pa-chat-copy-btn {
        opacity: 0;
        transition: opacity 0.15s ease;
        padding: 2px;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--text-muted);
        border-radius: 4px;
      }

      .pa-chat-message:hover .pa-chat-copy-btn {
        opacity: 0.6;
      }

      .pa-chat-copy-btn:hover {
        opacity: 1 !important;
        color: var(--text-normal);
        background: var(--background-modifier-hover);
      }

      .pa-chat-copy-success {
        color: var(--text-success) !important;
        opacity: 1 !important;
      }

      .pa-chat-message-content {
        line-height: 1.5;
        user-select: text;
        -webkit-user-select: text;
        cursor: text;
      }

      .pa-chat-message-content p:last-child {
        margin-bottom: 0;
      }

      .pa-chat-input-container {
        border-top: 1px solid var(--background-modifier-border);
        padding-top: 10px;
      }

      .pa-chat-input {
        width: 100%;
        resize: none;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
        background-color: var(--background-primary);
        color: var(--text-normal);
        font-family: inherit;
        font-size: inherit;
      }

      .pa-chat-input:focus {
        outline: none;
        border-color: var(--interactive-accent);
      }

      .pa-chat-buttons {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }

      .pa-chat-send-button {
        flex: 1;
        padding: 8px 16px;
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .pa-chat-send-button:hover {
        background-color: var(--interactive-accent-hover);
      }

      .pa-chat-send-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pa-chat-export-button {
        padding: 8px 16px;
        background-color: var(--background-secondary);
        color: var(--text-normal);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        cursor: pointer;
      }

      .pa-chat-export-button:hover {
        background-color: var(--background-modifier-hover);
      }

      .pa-chat-clear-button {
        padding: 8px 16px;
        background-color: var(--background-secondary);
        color: var(--text-normal);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        cursor: pointer;
      }

      .pa-chat-clear-button:hover {
        background-color: var(--background-modifier-hover);
      }

      .pa-chat-stop-button {
        flex: 1;
        padding: 8px 16px;
        background-color: var(--text-error);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .pa-chat-stop-button:hover {
        opacity: 0.9;
      }

      .pa-chat-limit-notice {
        color: var(--text-muted);
        text-decoration: none;
        opacity: 0.8;
        font-size: 0.9em;
      }

      .pa-chat-limit-notice:hover {
        color: var(--text-accent);
        text-decoration: underline;
      }

      .pa-chat-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-muted);
        font-style: italic;
      }

      .pa-chat-loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid var(--background-modifier-border);
        border-top-color: var(--interactive-accent);
        border-radius: 50%;
        animation: pa-spin 1s linear infinite;
      }

      @keyframes pa-spin {
        to { transform: rotate(360deg); }
      }

      .pa-chat-cursor {
        animation: pa-blink 1s step-end infinite;
        color: var(--interactive-accent);
      }

      @keyframes pa-blink {
        50% { opacity: 0; }
      }

      .pa-chat-streaming {
        white-space: pre-wrap;
      }

      .pa-chat-resume-notice {
        text-align: center;
        font-size: 0.75em;
        color: var(--text-muted);
        padding: 8px;
        margin: 8px 0;
        border-top: 1px dashed var(--background-modifier-border);
      }
    `;

    // Only add if not already present
    if (!document.getElementById("pa-chat-styles")) {
      document.head.appendChild(styleEl);
    }
  }

  /**
   * Add a system message
   */
  private addSystemMessage(content: string): void {
    const message: DisplayMessage = {
      id: this.generateId(),
      role: "system",
      content,
      timestamp: new Date(),
    };
    this.messages.push(message);
    this.renderMessage(message);
  }

  /**
   * Send a message to the AI
   */
  private async sendMessage(): Promise<void> {
    if (!this.inputEl || this.isLoading) return;

    const content = this.inputEl.value.trim();
    if (!content) return;

    // CRITICAL: Set loading state and clear input IMMEDIATELY to prevent double-submit
    // This must happen synchronously before any async operations
    this.isLoading = true;
    this.inputEl.value = "";
    this.updateButtonStates();

    // Check network connectivity first - fail fast with clear message
    if (!navigator.onLine) {
      this.restoreInputOnError(content);
      this.addSystemMessage(
        "📡 **Offline** — You appear to be disconnected from the internet. " +
        "Please check your connection and try again. Your message has been restored to the input box."
      );
      return;
    }

    // Check if AI is enabled
    if (!this.plugin.settings.consentEnabled) {
      this.restoreInputOnError(content);
      this.addSystemMessage("Please enable AI features in settings first.");
      return;
    }

    // Check for active provider
    const provider = this.plugin.providerManager?.getActiveProvider();
    if (!provider) {
      this.restoreInputOnError(content);
      this.addSystemMessage("No AI provider configured. Please check settings.");
      return;
    }

    // Add user message IMMEDIATELY for instant feedback
    const userMessage: DisplayMessage = {
      id: this.generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    this.messages.push(userMessage);
    this.renderMessage(userMessage);

    // Show loading spinner with initial "Sending..." state
    const loadingEl = this.showLoading("Sending...");

    // Check if provider is authenticated (use async validateToken for accurate check)
    const authResult = await provider.validateToken();
    if (!authResult.success) {
      // Remove the user message we just added since auth failed
      this.messages.pop();
      const userMsgEls = this.messagesContainerEl?.querySelectorAll(".pa-chat-message-user");
      if (userMsgEls && userMsgEls.length > 0) {
        userMsgEls[userMsgEls.length - 1].remove();
      }
      loadingEl.remove();
      this.restoreInputOnError(content);
      const providerName = this.plugin.settings.provider === "gh-copilot-cli" 
        ? "gh copilot CLI" 
        : "GitHub token";
      this.addSystemMessage(`Please configure ${providerName} in settings. ${authResult.error || ""}`);
      return;
    }

    // Update loading state - now connecting to AI
    this.updateLoadingText(loadingEl, "Connecting...");

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    try {
      // Build conversation history (excluding system UI messages)
      const conversationHistory = this.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      // Get all visible files for context
      const visibleFiles = this.getVisibleContextFiles();
      const allowedFiles = visibleFiles.filter(f => this.isFileAllowed(f.path));
      
      // Update context indicator
      this.updateContextIndicator(allowedFiles);
      
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
        "Always include the FULL file path and the COMPLETE new content (not just the changed parts).";

      if (allowedFiles.length > 0) {
        // Build context from all visible allowed files
        const fileContexts: string[] = [];
        let totalChars = 0;
        const maxTotalChars = 8000; // Limit total context to avoid token overflow
        
        for (const file of allowedFiles) {
          if (totalChars >= maxTotalChars) break;
          
          const fileContent = await this.app.vault.read(file);
          const remainingChars = maxTotalChars - totalChars;
          const truncatedContent = fileContent.slice(0, Math.min(4000, remainingChars));
          totalChars += truncatedContent.length;
          
          const isPrimary = file === allowedFiles[0];
          fileContexts.push(
            `### ${isPrimary ? "📝 Active: " : ""}${file.basename}\n` +
            `Path: ${file.path}\n` +
            `\`\`\`\n${truncatedContent}${truncatedContent.length < fileContent.length ? "\n... (truncated)" : ""}\n\`\`\``
          );
        }
        
        const fileLabel = allowedFiles.length === 1 ? "note" : "notes";
        systemPrompt +=
          `\n\n## Open Notes\n` +
          `You have access to ${allowedFiles.length} open ${fileLabel}:\n\n` +
          fileContexts.join("\n\n") +
          `\n\nYou can reference, discuss, and EDIT these notes. ` +
          `The first note marked with 📝 is the currently focused/active note.`;
      } else {
        systemPrompt +=
          `\n\nNo notes are currently visible, or all open notes are in folders the user has excluded from AI access. ` +
          `If the user wants you to see or edit a note's content, ask them to open it in the editor.`;
      }

      // Call API via provider with streaming
      const capabilities = provider.getCapabilities();
      
      // Update loading state - now waiting for AI response
      this.updateLoadingText(loadingEl, "Thinking...");
      
      // Create the assistant message placeholder for streaming
      const assistantMessage: DisplayMessage = {
        id: this.generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };
      
      // Remove loading spinner - we'll show streaming content instead
      loadingEl.remove();
      
      // Render empty message that we'll update with streamed content
      this.messages.push(assistantMessage);
      const messageEl = this.renderStreamingMessage(assistantMessage);
      
      try {
        if (capabilities.supportsStreaming) {
          // Use streaming - update message content as chunks arrive
          await provider.chatStream(
            conversationHistory,
            { model: this.plugin.settings.model, systemPrompt },
            (chunk) => {
              if (!chunk.done) {
                assistantMessage.content += chunk.content;
                this.updateStreamingMessage(messageEl, assistantMessage.content);
              }
            }
          );
        } else {
          // Fall back to non-streaming
          const response = await provider.chat(conversationHistory, {
            model: this.plugin.settings.model,
            systemPrompt,
          });
          assistantMessage.content = response.content;
          this.updateStreamingMessage(messageEl, assistantMessage.content);
        }

        // Finalize: render with full markdown
        this.finalizeStreamingMessage(messageEl, assistantMessage.content);
      } catch (streamError) {
        // Clean up the failed streaming message element
        messageEl.remove();
        // Remove the failed assistant message from history
        const msgIndex = this.messages.indexOf(assistantMessage);
        if (msgIndex !== -1) {
          this.messages.splice(msgIndex, 1);
        }
        // Re-throw to be handled by outer catch
        throw streamError;
      }

      this.isLoading = false;
      this.abortController = null;
      this.updateButtonStates();

      // Update usage stats (persisted daily counter)
      this.incrementUsage();
      this.updateUsageDisplay();

      // Save conversation for persistence
      this.saveConversationHistory();
    } catch (err: unknown) {
      // Note: loadingEl may already be removed if error occurred during streaming
      if (loadingEl.parentNode) {
        loadingEl.remove();
      }
      this.isLoading = false;
      this.abortController = null;
      this.updateButtonStates();

      // Check if request was aborted
      if (err instanceof Error && err.name === "AbortError") {
        // Don't restore input on intentional cancel
        this.addSystemMessage("Request cancelled.");
        return;
      }

      // Remove the user message that failed (it was already added to messages)
      const userMsgIndex = this.messages.findIndex(m => m.content === content && m.role === "user");
      if (userMsgIndex !== -1) {
        this.messages.splice(userMsgIndex, 1);
        // Remove from DOM - find the last user message element
        const userMsgEls = this.messagesContainerEl?.querySelectorAll(".pa-chat-message-user");
        if (userMsgEls && userMsgEls.length > 0) {
          userMsgEls[userMsgEls.length - 1].remove();
        }
      }

      // Restore the message to input for easy retry
      this.restoreInputOnError(content);

      // Detect network errors specifically
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      const isNetworkError = !navigator.onLine || 
        /network|connection|offline|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(errorMessage);

      if (isNetworkError) {
        this.addSystemMessage(
          "📡 **Connection lost** — The request failed due to a network error. " +
          "Please check your internet connection and try again. " +
          "Your message has been restored to the input box."
        );
      } else {
        this.addSystemMessage(
          `**Error:** ${errorMessage}\n\nYour message has been restored to the input box.`
        );
      }
    }
  }

  /**
   * Restore message to input box on error and reset loading state
   */
  private restoreInputOnError(content: string): void {
    if (this.inputEl) {
      this.inputEl.value = content;
    }
    this.isLoading = false;
    this.updateButtonStates();
  }

  /**
   * Get all visible markdown files from open panes
   * Returns files from all visible splits/panes, not just tabs
   */
  private getVisibleContextFiles(): TFile[] {
    const visibleFiles: TFile[] = [];
    const seenPaths = new Set<string>();

    // Get all markdown leaves (open panes)
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    
    for (const leaf of leaves) {
      const markdownView = leaf.view as MarkdownView;
      const file = markdownView.file;
      
      if (file && !seenPaths.has(file.path)) {
        // Check if the leaf is actually visible (not in a collapsed sidebar, etc.)
        // A leaf is visible if it has dimensions
        const containerEl = leaf.view.containerEl;
        if (containerEl.offsetWidth > 0 && containerEl.offsetHeight > 0) {
          seenPaths.add(file.path);
          visibleFiles.push(file);
          
          // Track the first one as the "active" file for edit context
          if (!this.lastActiveFile) {
            this.lastActiveFile = file;
          }
        }
      }
    }

    // Also check current active file in case it's not in the visible list
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && !seenPaths.has(activeFile.path)) {
      visibleFiles.unshift(activeFile); // Put at front as primary
      this.lastActiveFile = activeFile;
    } else if (activeFile) {
      // Move active file to front if it exists
      const idx = visibleFiles.findIndex(f => f.path === activeFile.path);
      if (idx > 0) {
        visibleFiles.splice(idx, 1);
        visibleFiles.unshift(activeFile);
      }
      this.lastActiveFile = activeFile;
    }

    return visibleFiles;
  }

  /**
   * Get the primary file to use for context (for edit operations)
   * Falls back to last active file when chat has focus
   */
  private getContextFile(): TFile | null {
    const visibleFiles = this.getVisibleContextFiles();
    if (visibleFiles.length > 0) {
      return visibleFiles[0];
    }
    return this.lastActiveFile;
  }

  /**
   * Check if a file path is allowed based on consent settings
   */
  private isFileAllowed(path: string): boolean {
    const { consentMode, includedFolders, excludedFolders } = this.plugin.settings;

    if (consentMode === "opt-in") {
      // Only allow if in included folders
      return includedFolders.some((folder) => path.startsWith(folder + "/") || path === folder);
    } else {
      // Allow unless in excluded folders
      return !excludedFolders.some((folder) => path.startsWith(folder + "/") || path === folder);
    }
  }

  /**
   * Render a message in the UI
   */
  private renderMessage(message: DisplayMessage): void {
    if (!this.messagesContainerEl) return;

    const messageEl = this.messagesContainerEl.createDiv({
      cls: `pa-chat-message pa-chat-message-${message.role}`,
    });

    if (message.role !== "system") {
      const headerEl = messageEl.createDiv({ cls: "pa-chat-message-header" });
      headerEl.createDiv({
        cls: "pa-chat-message-role",
        text: message.role === "user" ? "You" : "Assistant",
      });
      
      // Add copy button for assistant messages
      if (message.role === "assistant") {
        const copyBtn = headerEl.createEl("button", {
          cls: "pa-chat-copy-btn clickable-icon",
          attr: { "aria-label": "Copy message" },
        });
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        copyBtn.addEventListener("click", () => {
          void this.copyMessageContent(message.content, copyBtn);
        });
      }
    }

    const contentEl = messageEl.createDiv({ cls: "pa-chat-message-content" });

    // Render markdown for assistant messages
    if (message.role === "assistant") {
      void MarkdownRenderer.render(this.app, message.content, contentEl, "", this.plugin);
    } else {
      contentEl.setText(message.content);
    }

    // Scroll to bottom
    this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
  }

  /**
   * Render a streaming message placeholder
   * Returns the message element for updating
   */
  private renderStreamingMessage(message: DisplayMessage): HTMLElement {
    if (!this.messagesContainerEl) {
      throw new Error("Messages container not initialized");
    }

    const messageEl = this.messagesContainerEl.createDiv({
      cls: `pa-chat-message pa-chat-message-${message.role}`,
    });

    const headerEl = messageEl.createDiv({ cls: "pa-chat-message-header" });
    headerEl.createDiv({
      cls: "pa-chat-message-role",
      text: "Assistant",
    });
    
    // Add copy button (will work after streaming completes)
    const copyBtn = headerEl.createEl("button", {
      cls: "pa-chat-copy-btn clickable-icon",
      attr: { "aria-label": "Copy message" },
    });
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    // Store message reference for copy - will be updated when finalized
    copyBtn.dataset.messageId = message.id;

    const contentEl = messageEl.createDiv({ cls: "pa-chat-message-content" });
    contentEl.addClass("pa-chat-streaming");
    
    // Show cursor indicator
    contentEl.createSpan({ cls: "pa-chat-cursor", text: "▌" });

    // Scroll to bottom
    this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;

    return messageEl;
  }

  /**
   * Update a streaming message with new content
   */
  private updateStreamingMessage(messageEl: HTMLElement, content: string): void {
    const contentEl = messageEl.querySelector(".pa-chat-message-content");
    if (!contentEl) return;

    // Clear and re-render as plain text (fast update during streaming)
    contentEl.empty();
    contentEl.textContent = content;
    
    // Add cursor
    const cursor = document.createElement("span");
    cursor.className = "pa-chat-cursor";
    cursor.textContent = "▌";
    contentEl.appendChild(cursor);

    // Scroll to bottom
    if (this.messagesContainerEl) {
      this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
    }
  }

  /**
   * Finalize a streaming message - render as full markdown and detect edits
   */
  private finalizeStreamingMessage(messageEl: HTMLElement, content: string): void {
    const contentEl = messageEl.querySelector(".pa-chat-message-content");
    if (!contentEl) return;

    // Remove streaming class and cursor
    contentEl.removeClass("pa-chat-streaming");
    contentEl.empty();

    // Render as full markdown
    void MarkdownRenderer.render(this.app, content, contentEl as HTMLElement, "", this.plugin);

    // Wire up copy button now that we have final content
    const copyBtn = messageEl.querySelector(".pa-chat-copy-btn") as HTMLElement | null;
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        void this.copyMessageContent(content, copyBtn);
      });
    }

    // Check for edit suggestions in the response
    if (mayContainEdits(content)) {
      const contextFile = this.getContextFile();
      const parseResult = parseEditBlocks(content, contextFile?.path);
      
      if (parseResult.hasEdits) {
        this.addEditActions(messageEl, parseResult.blocks);
      }
    }

    // Scroll to bottom
    if (this.messagesContainerEl) {
      this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
    }
  }

  /**
   * Copy message content to clipboard
   */
  private async copyMessageContent(content: string, buttonEl: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      
      // Show feedback
      const originalHTML = buttonEl.innerHTML;
      buttonEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      buttonEl.addClass("pa-chat-copy-success");
      
      setTimeout(() => {
        buttonEl.innerHTML = originalHTML;
        buttonEl.removeClass("pa-chat-copy-success");
      }, 1500);
    } catch {
      new Notice("Could not copy to clipboard");
    }
  }

  /**
   * Add edit action buttons to a message
   */
  private addEditActions(messageEl: HTMLElement, blocks: ParsedEditBlock[]): void {
    const actionsEl = messageEl.createDiv({ cls: "pa-edit-actions" });
    
    for (const block of blocks) {
      const actionRow = actionsEl.createDiv({ cls: "pa-edit-action-row" });
      
      // File indicator
      actionRow.createSpan({ 
        cls: "pa-edit-file-indicator",
        text: `📝 ${block.path}`,
      });
      
      // Apply button
      const applyBtn = actionRow.createEl("button", {
        cls: "pa-edit-apply-btn",
        text: "Apply Edit",
      });
      applyBtn.addEventListener("click", () => {
        void this.handleApplyEdit(block);
      });
    }

    // Add styles for edit actions
    this.addEditActionStyles();
  }

  /**
   * Handle applying an edit from the chat
   */
  private async handleApplyEdit(block: ParsedEditBlock): Promise<void> {
    const safeVault = this.plugin.safeVault;
    
    // Enable writes for this operation
    safeVault.enableWrites();
    
    try {
      // Propose the edit (creates backup internally)
      const proposed = await safeVault.proposeEdit(
        block.path,
        block.content,
        "AI-suggested edit from chat"
      );
      
      if (!proposed) {
        new Notice(`Cannot edit ${block.path} - file not accessible or writes disabled`);
        return;
      }
      
      // Show confirmation modal
      const result = await showEditConfirmation(this.app, proposed);
      
      if (result.confirmed) {
        // Apply the edit
        const writeResult = await safeVault.applyEdit(block.path);
        
        if (writeResult.success) {
          new Notice(`✓ Applied edit to ${block.path}`);
          this.addSystemMessage(`Edit applied to \`${block.path}\`. ${writeResult.backupPath ? "Backup created." : ""}`);
        } else {
          new Notice(`✗ Failed to apply edit: ${writeResult.error}`);
          this.addSystemMessage(`Failed to apply edit: ${writeResult.error}`);
        }
      } else {
        // User cancelled
        safeVault.cancelEdit(block.path);
        this.addSystemMessage("Edit cancelled.");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Error applying edit: ${errorMsg}`);
      this.addSystemMessage(`Error: ${errorMsg}`);
    } finally {
      // Disable writes after operation
      safeVault.disableWrites();
    }
  }

  /**
   * Add styles for edit actions
   */
  private addEditActionStyles(): void {
    if (document.getElementById("pa-edit-action-styles")) return;
    
    const style = document.createElement("style");
    style.id = "pa-edit-action-styles";
    style.textContent = `
      .pa-edit-actions {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--background-modifier-border);
      }

      .pa-edit-action-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }

      .pa-edit-file-indicator {
        flex: 1;
        font-size: 0.9em;
        color: var(--text-muted);
        font-family: var(--font-monospace);
      }

      .pa-edit-apply-btn {
        padding: 4px 12px;
        font-size: 0.85em;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .pa-edit-apply-btn:hover {
        opacity: 0.9;
      }

      .pa-edit-apply-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show loading indicator with customizable text
   */
  private showLoading(text = "Thinking..."): HTMLElement {
    if (!this.messagesContainerEl) {
      throw new Error("Messages container not initialized");
    }

    const loadingEl = this.messagesContainerEl.createDiv({ cls: "pa-chat-loading" });
    loadingEl.createDiv({ cls: "pa-chat-loading-spinner" });
    loadingEl.createSpan({ cls: "pa-chat-loading-text", text });

    this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;

    return loadingEl;
  }

  /**
   * Update loading indicator text
   */
  private updateLoadingText(loadingEl: HTMLElement, text: string): void {
    const textEl = loadingEl.querySelector(".pa-chat-loading-text");
    if (textEl) {
      textEl.textContent = text;
    }
  }

  /**
   * Clear all messages
   */
  private clearMessages(): void {
    this.messages = [];
    if (this.messagesContainerEl) {
      this.messagesContainerEl.empty();
    }
    
    // Clear persisted history
    this.plugin.settings.conversationHistory = [];
    void this.plugin.saveSettings();
    
    this.addSystemMessage("Conversation cleared. How can I help you?");
  }

  /**
   * Generate a unique message ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Update the model display in the header
   */
  private updateModelDisplay(): void {
    if (!this.modelInfoEl) return;
    const model = this.plugin.settings.model;
    // Show a friendly short name
    this.modelInfoEl.setText(model);
  }

  /**
   * Update the usage stats display (persisted daily counter)
   */
  private updateUsageDisplay(): void {
    if (!this.usageStatsEl) return;
    const count = this.getTodayUsage();
    const reqText = count === 1 ? "request" : "requests";
    this.usageStatsEl.setText(`${count} ${reqText} today`);
  }

  /**
   * Update the context indicator showing which files AI can see
   */
  private updateContextIndicator(files: TFile[]): void {
    if (!this.contextIndicatorEl) return;
    
    this.contextIndicatorEl.empty();
    
    if (files.length === 0) {
      this.contextIndicatorEl.createSpan({ 
        cls: "pa-chat-context-empty",
        text: "📄 No notes in context",
      });
      this.contextIndicatorEl.setAttribute("title", "Open notes in visible panes to include them in the conversation");
      return;
    }
    
    const label = this.contextIndicatorEl.createSpan({ cls: "pa-chat-context-label" });
    label.setText(`📄 Context: `);
    
    const fileList = this.contextIndicatorEl.createSpan({ cls: "pa-chat-context-files" });
    
    files.forEach((file, idx) => {
      if (idx > 0) {
        fileList.createSpan({ text: ", ", cls: "pa-chat-context-sep" });
      }
      
      const fileSpan = fileList.createSpan({ 
        cls: idx === 0 ? "pa-chat-context-file pa-chat-context-primary" : "pa-chat-context-file",
        text: file.basename,
      });
      fileSpan.setAttribute("title", file.path);
    });
    
    if (files.length > 3) {
      // Collapse to show only first 3
      fileList.empty();
      files.slice(0, 3).forEach((file, idx) => {
        if (idx > 0) {
          fileList.createSpan({ text: ", ", cls: "pa-chat-context-sep" });
        }
        const fileSpan = fileList.createSpan({ 
          cls: idx === 0 ? "pa-chat-context-file pa-chat-context-primary" : "pa-chat-context-file",
          text: file.basename,
        });
        fileSpan.setAttribute("title", file.path);
      });
      fileList.createSpan({ 
        cls: "pa-chat-context-more",
        text: ` +${files.length - 3} more`,
      });
    }
    
    this.contextIndicatorEl.setAttribute(
      "title", 
      `AI can see: ${files.map(f => f.path).join(", ")}`
    );
  }

  /**
   * Get today's usage count, resetting if it's a new day
   */
  private getTodayUsage(): number {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    if (this.plugin.settings.usageDate !== today) {
      // New day, reset counter
      this.plugin.settings.usageDate = today;
      this.plugin.settings.usageRequests = 0;
      void this.plugin.saveSettings();
    }
    return this.plugin.settings.usageRequests;
  }

  /**
   * Increment today's usage count
   */
  private incrementUsage(): void {
    const today = new Date().toISOString().split("T")[0];
    if (this.plugin.settings.usageDate !== today) {
      this.plugin.settings.usageDate = today;
      this.plugin.settings.usageRequests = 0;
    }
    this.plugin.settings.usageRequests++;
    void this.plugin.saveSettings();
  }

  /**
   * Update button states based on loading status
   */
  private updateButtonStates(): void {
    if (this.sendButtonEl) {
      this.sendButtonEl.disabled = this.isLoading;
      this.sendButtonEl.style.display = this.isLoading ? "none" : "block";
    }
    if (this.stopButtonEl) {
      this.stopButtonEl.style.display = this.isLoading ? "block" : "none";
    }
    if (this.inputEl) {
      this.inputEl.disabled = this.isLoading;
    }
  }

  /**
   * Stop the current request
   */
  private stopRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Load conversation history from settings
   */
  private loadConversationHistory(): void {
    const saved = this.plugin.settings.conversationHistory;
    
    if (saved.length === 0) {
      // No history - show welcome message
      this.addSystemMessage(
        "Hello! I'm your Personal Assistant. How can I help you today?"
      );
      return;
    }

    // Restore messages from history
    for (const msg of saved) {
      const displayMsg: DisplayMessage = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      };
      this.messages.push(displayMsg);
      this.renderMessage(displayMsg);
    }

    // Add a subtle indicator that history was restored
    if (this.messagesContainerEl) {
      const resumeNotice = this.messagesContainerEl.createDiv({ cls: "pa-chat-resume-notice" });
      resumeNotice.setText(`↑ Previous conversation restored (${saved.length} messages)`);
    }
  }

  /**
   * Save conversation history to settings
   */
  private saveConversationHistory(): void {
    const max = this.plugin.settings.maxHistoryMessages;
    
    // Convert to storable format, excluding UI-only system messages
    const toSave = this.messages
      .filter(m => m.role !== "system") // Don't persist system UI messages
      .slice(-max) // Keep only the last N messages
      .map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));
    
    this.plugin.settings.conversationHistory = toSave;
    void this.plugin.saveSettings();
  }

  /**
   * Export conversation to clipboard as markdown
   */
  private async exportConversation(): Promise<void> {
    const conversationMessages = this.messages.filter(m => m.role !== "system");
    
    if (conversationMessages.length === 0) {
      this.addSystemMessage("No conversation to export.");
      return;
    }

    const lines: string[] = [
      "# AI Conversation Export",
      "",
      `Exported: ${new Date().toLocaleString()}`,
      `Model: ${this.plugin.settings.model}`,
      "",
      "---",
      "",
    ];

    for (const msg of conversationMessages) {
      const role = msg.role === "user" ? "**You**" : "**Assistant**";
      const time = msg.timestamp.toLocaleTimeString();
      lines.push(`### ${role} *(${time})*`);
      lines.push("");
      lines.push(msg.content);
      lines.push("");
    }

    const markdown = lines.join("\n");

    try {
      await navigator.clipboard.writeText(markdown);
      this.addSystemMessage(`Exported ${conversationMessages.length} messages to clipboard.`);
    } catch {
      // Fallback for browsers without clipboard API
      this.addSystemMessage("Could not copy to clipboard. Check browser permissions.");
    }
  }
}
