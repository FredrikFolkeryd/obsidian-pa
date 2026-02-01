/**
 * Chat View - Main AI conversation interface
 */

import { ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
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
  private isLoading = false;

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
    headerEl.createEl("h4", { text: "Personal Assistant" });

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

    const sendButton = buttonContainer.createEl("button", {
      cls: "pa-chat-send-button",
      text: "Send",
    });
    sendButton.addEventListener("click", () => {
      void this.sendMessage();
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

    // Show welcome message
    this.addSystemMessage(
      "Hello! I'm your Personal Assistant. How can I help you today?"
    );
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

      .pa-chat-header h4 {
        margin: 0;
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

    // Check if AI is enabled
    if (!this.plugin.settings.consentEnabled) {
      this.addSystemMessage("Please enable AI features in settings first.");
      return;
    }

    // Check for API client
    const client = this.plugin.getApiClient();
    if (!client) {
      this.addSystemMessage("Please add your GitHub token in settings.");
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

    // Clear input
    this.inputEl.value = "";

    // Show loading
    this.isLoading = true;
    const loadingEl = this.showLoading();

    try {
      // Build conversation history (excluding system UI messages)
      const conversationHistory = this.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      // Add context from active note if available
      const activeFile = this.app.workspace.getActiveFile();
      let systemPrompt =
        "You are a helpful AI assistant integrated into Obsidian. " +
        "Help the user with their notes, writing, and knowledge management.";

      if (activeFile && this.isFileAllowed(activeFile.path)) {
        const fileContent = await this.app.vault.read(activeFile);
        systemPrompt +=
          `\n\nThe user currently has this note open:\n` +
          `Title: ${activeFile.basename}\n` +
          `Content:\n${fileContent.slice(0, 4000)}`; // Limit context size
      }

      // Call API
      const response = await client.chat(conversationHistory, {
        model: this.plugin.settings.model,
        systemPrompt,
      });

      // Remove loading
      loadingEl.remove();
      this.isLoading = false;

      // Add assistant message
      const assistantMessage: DisplayMessage = {
        id: this.generateId(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      this.messages.push(assistantMessage);
      this.renderMessage(assistantMessage);
    } catch (error) {
      loadingEl.remove();
      this.isLoading = false;

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      this.addSystemMessage(`Error: ${errorMessage}`);
    }
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
    this.addSystemMessage("Conversation cleared. How can I help you?");
  }

  /**
   * Generate a unique message ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
