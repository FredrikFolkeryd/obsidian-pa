/**
 * Chat View - Main AI conversation interface
 */

import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile, MarkdownView } from "obsidian";
import type PAPlugin from "../main";
import type { ChatMessage } from "../api/GitHubModelsClient";

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

      .pa-chat-message-role {
        font-size: 0.8em;
        opacity: 0.7;
        margin-bottom: 5px;
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

    // Check if AI is enabled
    if (!this.plugin.settings.consentEnabled) {
      this.addSystemMessage("Please enable AI features in settings first.");
      this.isLoading = false;
      this.updateButtonStates();
      return;
    }

    // Check for active provider
    const provider = this.plugin.providerManager?.getActiveProvider();
    if (!provider) {
      this.addSystemMessage("No AI provider configured. Please check settings.");
      this.isLoading = false;
      this.updateButtonStates();
      return;
    }

    // Check if provider is authenticated (use async validateToken for accurate check)
    const authResult = await provider.validateToken();
    if (!authResult.success) {
      const providerName = this.plugin.settings.provider === "gh-copilot-cli" 
        ? "gh copilot CLI" 
        : "GitHub token";
      this.addSystemMessage(`Please configure ${providerName} in settings. ${authResult.error || ""}`);
      this.isLoading = false;
      this.updateButtonStates();
      return;
    }

    // Add user message
    const userMessage: DisplayMessage = {
      id: this.generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    this.messages.push(userMessage);
    this.renderMessage(userMessage);

    // Show loading spinner
    const loadingEl = this.showLoading();

    // Create abort controller for cancellation
    this.abortController = new AbortController();

    try {
      // Build conversation history (excluding system UI messages)
      const conversationHistory = this.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      // Add context from active note if available
      // Use tracked last active file since getActiveFile() returns null when chat has focus
      const contextFile = this.getContextFile();
      let systemPrompt =
        "You are a helpful AI assistant integrated into Obsidian. " +
        "Help the user with their notes, writing, and knowledge management.";

      if (contextFile && this.isFileAllowed(contextFile.path)) {
        const fileContent = await this.app.vault.read(contextFile);
        systemPrompt +=
          `\n\nYou have access to the user's currently open note:\n` +
          `Filename: ${contextFile.basename}\n` +
          `Path: ${contextFile.path}\n` +
          `Content:\n---\n${fileContent.slice(0, 4000)}\n---\n` +
          `\nYou can reference and discuss this note's content. ` +
          `If the user asks about their notes without a file open, let them know they can open a note for you to see it.`;
      } else {
        systemPrompt +=
          `\n\nNo note is currently open, or the active note is in a folder the user has excluded from AI access. ` +
          `If the user wants you to see a note's content, ask them to open it in the editor.`;
      }

      // Call API via provider with streaming
      const capabilities = provider.getCapabilities();
      
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

      this.isLoading = false;
      this.abortController = null;
      this.updateButtonStates();

      // Update usage stats (persisted daily counter)
      this.incrementUsage();
      this.updateUsageDisplay();

      // Save conversation for persistence
      this.saveConversationHistory();
    } catch (err: unknown) {
      loadingEl.remove();
      this.isLoading = false;
      this.abortController = null;
      this.updateButtonStates();

      // Check if request was aborted
      if (err instanceof Error && err.name === "AbortError") {
        this.addSystemMessage("Request cancelled.");
        return;
      }

      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      this.addSystemMessage(`Error: ${errorMessage}`);
    }
  }

  /**
   * Get the file to use for context
   * Tries getActiveFile first, falls back to finding a markdown leaf, or last tracked file
   */
  private getContextFile(): TFile | null {
    // First try the standard method - works when a markdown pane has focus
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.lastActiveFile = activeFile;
      return activeFile;
    }

    // If chat has focus, getActiveFile returns null
    // Find the most recent markdown view leaf
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    if (leaves.length > 0) {
      // Get the file from the first markdown leaf (most recently focused)
      const markdownView = leaves[0].view as MarkdownView;
      if (markdownView.file) {
        this.lastActiveFile = markdownView.file;
        return markdownView.file;
      }
    }

    // Fall back to last known active file
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
      messageEl.createDiv({
        cls: "pa-chat-message-role",
        text: message.role === "user" ? "You" : "Assistant",
      });
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

    messageEl.createDiv({
      cls: "pa-chat-message-role",
      text: "Assistant",
    });

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
   * Finalize a streaming message - render as full markdown
   */
  private finalizeStreamingMessage(messageEl: HTMLElement, content: string): void {
    const contentEl = messageEl.querySelector(".pa-chat-message-content");
    if (!contentEl) return;

    // Remove streaming class and cursor
    contentEl.removeClass("pa-chat-streaming");
    contentEl.empty();

    // Render as full markdown
    void MarkdownRenderer.render(this.app, content, contentEl as HTMLElement, "", this.plugin);

    // Scroll to bottom
    if (this.messagesContainerEl) {
      this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
    }
  }

  /**
   * Show loading indicator
   */
  private showLoading(): HTMLElement {
    if (!this.messagesContainerEl) {
      throw new Error("Messages container not initialized");
    }

    const loadingEl = this.messagesContainerEl.createDiv({ cls: "pa-chat-loading" });
    loadingEl.createDiv({ cls: "pa-chat-loading-spinner" });
    loadingEl.createSpan({ text: "Thinking..." });

    this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;

    return loadingEl;
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
