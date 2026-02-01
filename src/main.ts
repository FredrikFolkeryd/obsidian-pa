/**
 * Obsidian Personal Assistant Plugin
 *
 * An agentic AI interface for your Obsidian vault, powered by GitHub Copilot.
 *
 * @author Fredrik Folkeryd
 * @license MIT
 */

import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { PASettings, DEFAULT_SETTINGS, PASettingTab } from "./settings";
import { ChatView, VIEW_TYPE_CHAT } from "./views/ChatView";
import { GitHubModelsClient } from "./api/GitHubModelsClient";
import { ProviderManager } from "./api/ProviderManager";
import {
  isOnePasswordReference,
  resolveOnePasswordSecret,
} from "./auth/OnePasswordResolver";

export default class PAPlugin extends Plugin {
  public settings!: PASettings;
  private apiClient: GitHubModelsClient | null = null;
  private settingsTab!: PASettingTab;
  public providerManager: ProviderManager;

  public constructor(app: Parameters<typeof Plugin>[0], manifest: Parameters<typeof Plugin>[1]) {
    super(app, manifest);
    this.providerManager = new ProviderManager();
  }

  public async onload(): Promise<void> {
    console.log("Loading Personal Assistant plugin");

    await this.loadSettings();

    // Register the chat view
    this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

    // Add command to open chat (checks configuration status)
    this.addCommand({
      id: "open-chat",
      name: "Open AI Chat",
      callback: () => {
        this.activateChatView();
      },
    });

    // Add command to open settings directly
    this.addCommand({
      id: "open-settings",
      name: "Open Settings",
      callback: () => {
        const setting = (this.app as unknown as { setting?: { open: () => void; openTabById?: (id: string) => void } }).setting;
        setting?.open();
        setting?.openTabById?.(this.manifest.id);
      },
    });

    // Add ribbon icon (checks configuration status)
    this.addRibbonIcon("message-circle", "Open AI Chat", () => {
      this.activateChatView();
    });

    // Add settings tab
    this.settingsTab = new PASettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    // Initialize API client if configured
    await this.initializeApiClient();

    // First-run detection: if no token and consent not enabled, prompt user
    await this.checkFirstRun();
  }

  public onunload(): void {
    console.log("Unloading Personal Assistant plugin");
  }

  /**
   * Check if this is first run and prompt user to configure
   */
  private async checkFirstRun(): Promise<void> {
    const hasToken = await this.getStoredToken();

    // If no token and no credential reference, this is likely first run
    if (!hasToken && !this.settings.credentialReference) {
      // Use a small delay to ensure UI is ready
      setTimeout(() => {
        new Notice(
          "Welcome to Personal Assistant! Click here to configure.",
          10000
        );
        // Open settings tab
        this.openSettings();
      }, 1000);
    }
  }

  /**
   * Open the plugin settings tab
   */
  public openSettings(): void {
    // Access Obsidian's internal settings API
    const setting = (this.app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } }).setting;
    setting.open();
    setting.openTabById(this.manifest.id);
  }

  /**
   * Load plugin settings from disk
   */
  private async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<PASettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  /**
   * Save plugin settings to disk
   */
  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Initialize the GitHub Models API client
   */
  public async initializeApiClient(): Promise<void> {
    const token = await this.getStoredToken();
    if (token && this.settings.consentEnabled) {
      this.apiClient = new GitHubModelsClient(token);
    } else {
      this.apiClient = null;
    }
  }

  /**
   * Get the API client instance
   */
  public getApiClient(): GitHubModelsClient | null {
    return this.apiClient;
  }

  /**
   * Store the GitHub PAT securely
   */
  public async storeToken(token: string): Promise<void> {
    // Use Obsidian's SecretStorage API (available since 1.11.4)
    // Falls back to settings if not available
    if ("setSecret" in this.app.vault.adapter) {
      await (
        this.app.vault.adapter as { setSecret: (key: string, value: string) => Promise<void> }
      ).setSecret("obsidian-pa-github-token", token);
    } else {
      // Fallback: store in settings (less secure)
      this.settings.githubToken = token;
      await this.saveSettings();
    }
    await this.initializeApiClient();
  }

  /**
   * Retrieve the stored GitHub PAT
   *
   * Resolution order:
   * 1. 1Password reference (op://vault/item/field)
   * 2. Environment variable (GITHUB_TOKEN)
   * 3. SecretStorage
   * 4. Fallback settings (least secure)
   */
  public async getStoredToken(): Promise<string | null> {
    // 1. Try 1Password reference
    if (this.settings.credentialReference) {
      const ref = this.settings.credentialReference;
      if (isOnePasswordReference(ref)) {
        const result = await resolveOnePasswordSecret(ref);
        if (result.success && result.token) {
          return result.token;
        }
        // Log error but continue to fallbacks
        console.warn("[PA] 1Password resolution failed:", result.error);
      }
    }

    // 2. Try environment variable
    const envToken = process.env.GITHUB_TOKEN;
    if (envToken) {
      return envToken;
    }

    // 3. Try SecretStorage
    if ("getSecret" in this.app.vault.adapter) {
      const token = await (
        this.app.vault.adapter as { getSecret: (key: string) => Promise<string | null> }
      ).getSecret("obsidian-pa-github-token");
      if (token) {
        return token;
      }
    }

    // 4. Fallback: retrieve from settings
    return this.settings.githubToken || null;
  }

  /**
   * Clear the stored token
   */
  public async clearToken(): Promise<void> {
    // Clear SecretStorage
    if ("setSecret" in this.app.vault.adapter) {
      await (
        this.app.vault.adapter as { setSecret: (key: string, value: string) => Promise<void> }
      ).setSecret("obsidian-pa-github-token", "");
    }
    // Clear settings token
    this.settings.githubToken = undefined;
    // Also clear 1Password reference so user must re-enter
    this.settings.credentialReference = undefined;
    await this.saveSettings();
    // Clear API client
    this.apiClient = null;
  }

  /**
   * Check if the plugin is fully configured and ready to use
   * Returns true only when authentication is complete for the selected provider
   */
  public async isConfigured(): Promise<boolean> {
    // Must have consent enabled
    if (!this.settings.consentEnabled) {
      return false;
    }

    // Check provider-specific authentication
    const provider = this.providerManager.getActiveProvider();
    if (!provider) {
      return false;
    }

    // For gh-copilot-cli, check CLI status
    if (this.settings.provider === "gh-copilot-cli") {
      const result = await provider.validateToken();
      return result.success;
    }

    // For other providers, check if we have a valid token
    const token = await this.getStoredToken();
    return !!token;
  }

  /**
   * Activate the chat view in the right sidebar
   * Redirects to settings if not configured
   */
  public activateChatView(): void {
    void this.doActivateChatView();
  }

  /**
   * Internal async implementation of chat view activation
   */
  private async doActivateChatView(): Promise<void> {
    // Check if configured first
    const configured = await this.isConfigured();
    if (!configured) {
      new Notice("Please complete setup in settings first", 5000);
      // Open settings tab - use type assertion for internal API
      const setting = (this.app as unknown as { setting?: { open: () => void; openTabById?: (id: string) => void } }).setting;
      setting?.open();
      setting?.openTabById?.(this.manifest.id);
      return;
    }
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

    if (leaves.length > 0) {
      // A leaf with our view already exists, use that
      leaf = leaves[0];
    } else {
      // Create a new leaf in the right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
      }
    }

    // Reveal the leaf
    if (leaf) {
      // revealLeaf returns void in some Obsidian versions
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Promise.resolve(workspace.revealLeaf(leaf));
    }
  }
}
