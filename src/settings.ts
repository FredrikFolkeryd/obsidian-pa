/**
 * Plugin settings and settings tab
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type PAPlugin from "./main";
import { SetupHelpModal } from "./modals/SetupHelpModal";
import {
  validateOnePasswordReference,
  resolveOnePasswordSecret,
  isOnePasswordCliInstalled,
} from "./auth/OnePasswordResolver";
import type { GhCopilotCliProvider } from "./api/providers/GhCopilotCliProvider";
import type { ProviderType } from "./api/types";
import { VIEW_TYPE_CHAT, ChatView } from "./views/ChatView";

/**
 * Plugin settings interface
 */
export interface PASettings {
  /** Whether the user has acknowledged and consented to AI features */
  consentEnabled: boolean;

  /** Consent mode: opt-in (include list) or opt-out (exclude list) */
  consentMode: "opt-in" | "opt-out";

  /** Folders included when in opt-in mode */
  includedFolders: string[];

  /** Folders excluded when in opt-out mode */
  excludedFolders: string[];

  /** Chat-only mode: user explicitly acknowledged no file access */
  chatOnlyMode: boolean;

  /** 1Password credential reference (op://vault/item/field) */
  credentialReference?: string;

  /** GitHub PAT (fallback storage if SecretStorage unavailable) */
  githubToken?: string;

  /** Selected model for chat */
  model: string;

  /** Authentication method: 1password or direct */
  authMethod: "1password" | "direct";

  /** Selected AI provider */
  provider: ProviderType;

  /** Daily usage tracking */
  usageDate: string; // YYYY-MM-DD
  usageRequests: number;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: PASettings = {
  consentEnabled: false,
  consentMode: "opt-in",
  includedFolders: [],
  excludedFolders: [],
  chatOnlyMode: false,
  model: "gpt-4o",
  authMethod: "1password",
  provider: "github-models",
  usageDate: "",
  usageRequests: 0,
};

/**
 * Settings tab for the Personal Assistant plugin
 */
export class PASettingTab extends PluginSettingTab {
  private plugin: PAPlugin;
  private opCliAvailable: boolean | null = null;

  public constructor(app: App, plugin: PAPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Personal Assistant Settings" });

    // Check 1Password CLI status first (async), then render
    void this.checkOpCliStatus().then(() => {
      // Clear everything after the h2 before rendering to prevent duplicates
      const h2 = containerEl.querySelector("h2");
      while (h2 && h2.nextSibling) {
        h2.nextSibling.remove();
      }
      this.renderSettings(containerEl);
    });
  }

  /**
   * Check 1Password CLI availability
   */
  private async checkOpCliStatus(): Promise<void> {
    this.opCliAvailable = await isOnePasswordCliInstalled();
  }

  /**
   * Main render method
   */
  private renderSettings(containerEl: HTMLElement): void {
    // === SECTION 1: Consent & Acknowledgment ===
    this.renderConsentSection(containerEl);

    // Only show rest of settings if consent enabled
    if (!this.plugin.settings.consentEnabled) {
      return;
    }

    // === SECTION 2: Provider Selection ===
    this.renderProviderSection(containerEl);

    // === SECTION 3: Authentication (provider-specific) ===
    this.renderAuthSection(containerEl);

    // === SECTION 4: Model Selection (only after authenticated) ===
    void this.checkAuthAndRenderModelSection(containerEl);
  }

  /**
   * Render provider selection section
   */
  private renderProviderSection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "AI Provider" });

    const providerInfo = containerEl.createDiv({ cls: "pa-provider-info" });
    providerInfo.createEl("p", {
      text: "Choose how to connect to AI models:",
    });

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("Select your preferred AI provider")
      .addDropdown((dropdown) => {
        dropdown.addOption("github-models", "GitHub Models (free tier, needs PAT)");
        dropdown.addOption("gh-copilot-cli", "GitHub Copilot CLI (premium models, needs gh CLI)");

        dropdown.setValue(this.plugin.settings.provider);
        dropdown.onChange(async (value) => {
          this.plugin.settings.provider = value as ProviderType;
          // Reset model when switching providers to a valid default
          if (value === "gh-copilot-cli") {
            this.plugin.settings.model = "claude-sonnet-4";
          } else {
            this.plugin.settings.model = "gpt-4o";
          }
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // Provider-specific info boxes
    if (this.plugin.settings.provider === "gh-copilot-cli") {
      this.renderGhCopilotInfo(containerEl);
    } else {
      this.renderGitHubModelsInfo(containerEl);
    }
  }

  /**
   * Render GitHub Models provider info
   */
  private renderGitHubModelsInfo(containerEl: HTMLElement): void {
    const infoBox = containerEl.createDiv({ cls: "pa-provider-detail" });
    infoBox.createEl("strong", { text: "GitHub Models" });
    infoBox.createEl("p", {
      text: "Free tier access to GPT-4o, Llama, Mistral, and more. Requires a GitHub Personal Access Token with 'Models: Read' permission.",
    });
    const limits = infoBox.createEl("p", { cls: "pa-hint" });
    limits.setText("Rate limits: 15 requests/min, 150 requests/day");
  }

  /**
   * Render GitHub Copilot CLI provider info
   */
  private renderGhCopilotInfo(containerEl: HTMLElement): void {
    const infoBox = containerEl.createDiv({ cls: "pa-provider-detail" });
    infoBox.createEl("strong", { text: "GitHub Copilot CLI" });
    infoBox.createEl("p", {
      text: "Access premium models like Claude Opus 4.5 and o1 through the gh copilot CLI. " +
        "Requires a Copilot Business or Enterprise licence.",
    });

    const requirements = infoBox.createEl("div", { cls: "pa-cli-requirements" });
    requirements.createEl("p", { text: "Requirements:" });
    const list = requirements.createEl("ol");
    list.createEl("li").createEl("a", {
      text: "GitHub CLI (gh)",
      href: "https://cli.github.com/",
    }).setAttribute("target", "_blank");
    list.createEl("li", { text: "Login: gh auth login" });
    list.createEl("li", { text: "Install extension: gh extension install github/gh-copilot" });
    list.createEl("li", { text: "Copilot Business or Enterprise licence" });
  }

  /**
   * Render consent/acknowledgment section
   */
  private renderConsentSection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Acknowledgment & Privacy" });

    // Create info box for explanation
    const infoBox = containerEl.createDiv({ cls: "pa-consent-info" });
    infoBox.createEl("p", {
      text:
        "This plugin sends note content to GitHub Models API for AI processing. " +
        "By enabling this plugin, you acknowledge that:",
    });

    const list = infoBox.createEl("ul");
    list.createEl("li", {
      text: "Note content you choose to share will be sent to external AI services",
    });
    list.createEl("li", {
      text: "You can control which folders are shared using the settings below",
    });
    list.createEl("li", {
      text: "No data is sent until you explicitly enable the plugin",
    });

    infoBox.createEl("p", {
      text: "If you do not accept these terms, please disable or uninstall this plugin.",
      cls: "pa-consent-warning",
    });

    new Setting(containerEl)
      .setName("I acknowledge and enable AI features")
      .setDesc("Required to use the Personal Assistant")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.consentEnabled).onChange(async (value) => {
          this.plugin.settings.consentEnabled = value;
          await this.plugin.saveSettings();
          await this.plugin.initializeApiClient();
          this.display(); // Refresh to show/hide dependent settings
        })
      );

    // Data scope settings - visually nested under consent
    if (this.plugin.settings.consentEnabled) {
      const scopeContainer = containerEl.createDiv({ cls: "pa-scope-settings" });
      scopeContainer.createEl("h4", { text: "Data Sharing Scope" });

      new Setting(scopeContainer)
        .setName("Sharing mode")
        .setDesc(
          "Opt-in: Only specified folders are shared. Opt-out: All folders except specified are shared."
        )
        .addDropdown((dropdown) =>
          dropdown
            .addOption("opt-in", "Opt-in (include only specified)")
            .addOption("opt-out", "Opt-out (exclude specified)")
            .setValue(this.plugin.settings.consentMode)
            .onChange(async (value) => {
              this.plugin.settings.consentMode = value as "opt-in" | "opt-out";
              // Reset chatOnlyMode when changing consent mode
              this.plugin.settings.chatOnlyMode = false;
              await this.plugin.saveSettings();
              this.display();
            })
        );

      if (this.plugin.settings.consentMode === "opt-in") {
        new Setting(scopeContainer)
          .setName("Included folders")
          .setDesc("Comma-separated list of folders to include for AI context")
          .addText((text) =>
            text
              .setPlaceholder("folder1, folder2")
              .setValue(this.plugin.settings.includedFolders.join(", "))
              .onChange(async (value) => {
                this.plugin.settings.includedFolders = value
                  .split(",")
                  .map((f) => f.trim())
                  .filter((f) => f.length > 0);
                // Reset chatOnlyMode when folders change
                this.plugin.settings.chatOnlyMode = false;
                await this.plugin.saveSettings();
                this.display();
              })
          );

        // Show warning if opt-in with no folders
        if (this.plugin.settings.includedFolders.length === 0) {
          const warningEl = scopeContainer.createDiv({ cls: "pa-scope-warning" });
          warningEl.createEl("p", {
            text: "⚠️ No folders specified — the AI cannot access any note content.",
          });
          warningEl.createEl("p", {
            text: "This is fine for general chat (Ask mode), but the AI won't be able to help with your specific notes.",
            cls: "pa-scope-warning-detail",
          });

          // Acknowledgment toggle
          new Setting(warningEl)
            .setName("Chat-only mode")
            .setDesc("I understand the AI won't have access to my notes")
            .addToggle((toggle) =>
              toggle
                .setValue(this.plugin.settings.chatOnlyMode)
                .onChange(async (value) => {
                  this.plugin.settings.chatOnlyMode = value;
                  await this.plugin.saveSettings();
                })
            );
        }
      } else {
        new Setting(scopeContainer)
          .setName("Excluded folders")
          .setDesc("Comma-separated list of folders to exclude from AI context")
          .addText((text) =>
            text
              .setPlaceholder("private, journal")
              .setValue(this.plugin.settings.excludedFolders.join(", "))
              .onChange(async (value) => {
                this.plugin.settings.excludedFolders = value
                  .split(",")
                  .map((f) => f.trim())
                  .filter((f) => f.length > 0);
                await this.plugin.saveSettings();
              })
          );
      }
    }
  }

  /**
   * Render authentication section
   */
  private renderAuthSection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Authentication" });

    // Different auth flow for gh-copilot-cli
    if (this.plugin.settings.provider === "gh-copilot-cli") {
      this.renderGhCopilotAuth(containerEl);
      return;
    }

    // GitHub Models auth flow
    // Help link
    const helpEl = containerEl.createDiv({ cls: "pa-auth-help" });
    helpEl.createEl("p", {
      text: "A GitHub Personal Access Token is required to use GitHub Models API.",
    });
    const helpLink = helpEl.createEl("a", {
      text: "View setup instructions",
      cls: "pa-help-link",
    });
    helpLink.addEventListener("click", (e) => {
      e.preventDefault();
      new SetupHelpModal(this.app).open();
    });

    // Auth method selector
    new Setting(containerEl)
      .setName("Authentication method")
      .setDesc("Choose how to provide your GitHub token")
      .addDropdown((dropdown) => {
        dropdown.addOption("1password", "1Password CLI (recommended)");
        dropdown.addOption("direct", "Direct token entry");

        // If 1Password CLI not available, show that
        if (this.opCliAvailable === false) {
          dropdown.selectEl.querySelector('option[value="1password"]')?.setAttribute(
            "disabled",
            "true"
          );
        }

        dropdown.setValue(this.plugin.settings.authMethod);
        dropdown.onChange(async (value) => {
          this.plugin.settings.authMethod = value as "1password" | "direct";
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // 1Password CLI status warning
    if (this.opCliAvailable === false && this.plugin.settings.authMethod === "1password") {
      const warningEl = containerEl.createDiv({ cls: "pa-cli-warning" });
      warningEl.createEl("span", { text: "⚠️ 1Password CLI not detected. " });
      const installLink = warningEl.createEl("a", {
        text: "Install 1Password CLI",
        href: "https://1password.com/downloads/command-line/",
      });
      installLink.setAttribute("target", "_blank");

      // Auto-switch to direct method
      this.plugin.settings.authMethod = "direct";
      void this.plugin.saveSettings();
    }

    // Render the selected auth method
    if (this.plugin.settings.authMethod === "1password") {
      this.renderOnePasswordAuth(containerEl);
    } else {
      this.renderDirectTokenAuth(containerEl);
    }
  }

  /**
   * Render gh-copilot-cli authentication (uses gh auth, no token needed)
   */
  private renderGhCopilotAuth(containerEl: HTMLElement): void {
    const authContainer = containerEl.createDiv({ cls: "pa-gh-copilot-auth" });

    authContainer.createEl("p", {
      text: "The Copilot CLI uses your existing GitHub CLI authentication. No additional token is needed.",
    });

    // Status display area (inline feedback instead of toasts)
    const statusEl = authContainer.createDiv({ cls: "pa-cli-status" });

    // Check status on render to show current state
    void this.showInitialCliStatus(statusEl);

    new Setting(authContainer)
      .setName("CLI Status")
      .setDesc("Check if gh copilot CLI is properly configured")
      .addButton((button) =>
        button
          .setButtonText("Re-check Status")
          .onClick(async () => {
            await this.checkGhCopilotStatus(statusEl, button.buttonEl);
          })
      );
  }

  /**
   * Show initial CLI status on settings render (no refresh after)
   */
  private async showInitialCliStatus(statusEl: HTMLElement): Promise<void> {
    const provider = this.plugin.providerManager?.getProvider("gh-copilot-cli");
    if (!provider) return;

    const result = await provider.validateToken();
    if (result.success) {
      this.showCliStatus(statusEl, "success", "✓ gh copilot CLI is configured and ready");
    }
    // Don't show error on initial load - let user click "Re-check Status" if needed
  }

  /**
   * Check gh copilot CLI status and show results inline
   */
  private async checkGhCopilotStatus(statusEl: HTMLElement, buttonEl: HTMLButtonElement): Promise<void> {
    // Show loading state
    statusEl.empty();
    statusEl.removeClass("pa-cli-status-error", "pa-cli-status-success");
    statusEl.addClass("pa-cli-status-checking");
    statusEl.setText("⏳ Checking gh copilot CLI status...");
    buttonEl.disabled = true;

    try {
      // Get the provider from the manager
      const provider = this.plugin.providerManager?.getProvider("gh-copilot-cli");
      if (!provider) {
        this.showCliStatus(statusEl, "error", "Provider not found");
        buttonEl.disabled = false;
        return;
      }

      // Cast to access the refreshCliStatus method
      const cliProvider = provider as GhCopilotCliProvider;
      if (typeof cliProvider.refreshCliStatus !== "function") {
        // Fall back to validateToken
        const result = await provider.validateToken();
        if (result.success) {
          this.showCliStatus(statusEl, "success", "gh copilot CLI is ready to use!");
          this.display(); // Refresh to show model section
        } else {
          this.showCliStatus(statusEl, "error", result.error || "Validation failed");
        }
        buttonEl.disabled = false;
        return;
      }

      const status = await cliProvider.refreshCliStatus();

      if (!status.ghInstalled) {
        this.showCliStatus(statusEl, "error", "GitHub CLI (gh) not found. Install from cli.github.com");
        buttonEl.disabled = false;
        return;
      }

      if (!status.copilotExtensionInstalled) {
        this.showCliStatus(statusEl, "error", "gh copilot not available. Update gh CLI or run: gh extension install github/gh-copilot");
        buttonEl.disabled = false;
        return;
      }

      if (!status.authenticated) {
        this.showCliStatus(statusEl, "error", "Not logged in to GitHub CLI. Run: gh auth login");
        buttonEl.disabled = false;
        return;
      }

      this.showCliStatus(statusEl, "success", "✓ gh copilot CLI is configured and ready");
      buttonEl.disabled = false;
      // No display refresh needed - status persists and model section shows on next settings open
    } catch (error) {
      this.showCliStatus(statusEl, "error", error instanceof Error ? error.message : "Unknown error");
      buttonEl.disabled = false;
    }
  }

  /**
   * Show CLI status inline in the settings panel
   */
  private showCliStatus(statusEl: HTMLElement, type: "success" | "error", message: string): void {
    statusEl.empty();
    statusEl.removeClass("pa-cli-status-checking", "pa-cli-status-error", "pa-cli-status-success");
    statusEl.addClass(type === "success" ? "pa-cli-status-success" : "pa-cli-status-error");
    
    const icon = type === "success" ? "✅" : "❌";
    statusEl.setText(`${icon} ${message}`);
  }

  /**
   * Render 1Password authentication option
   */
  private renderOnePasswordAuth(containerEl: HTMLElement): void {
    const opContainer = containerEl.createDiv({ cls: "pa-auth-method active" });

    if (this.opCliAvailable) {
      opContainer.createEl("p", {
        text: "✅ 1Password CLI detected",
        cls: "pa-status-ok",
      });
    } else if (this.opCliAvailable === false) {
      opContainer.createEl("p", {
        text: "⚠️ 1Password CLI not found. Install from 1password.com/downloads/command-line",
        cls: "pa-status-warn",
      });
    }

    // Status display area (inline feedback instead of toasts)
    const statusEl = opContainer.createDiv({ cls: "pa-cli-status" });

    new Setting(opContainer)
      .setName("1Password secret reference")
      .setDesc("Enter your secret reference: op://vault/item/field")
      .addText((text) => {
        text
          .setPlaceholder("op://Personal/GitHub-PAT/credential")
          .setValue(this.plugin.settings.credentialReference || "")
          .onChange(async (value) => {
            if (value && !value.startsWith("op://")) {
              return; // Let them finish typing
            }
            this.plugin.settings.credentialReference = value || undefined;
            await this.plugin.saveSettings();
            // Update button state and clear status
            this.updateValidateButtonState(opContainer);
            statusEl.empty();
          });
      })
      .addButton((button) => {
        button
          .setButtonText("Validate & Connect")
          .setCta()
          .onClick(async () => {
            await this.validateCredentialReference(statusEl, button.buttonEl);
          });
        // Set initial disabled state
        button.buttonEl.addClass("pa-validate-btn");
      });

    // Set initial button state
    this.updateValidateButtonState(opContainer);
  }

  /**
   * Update the Validate button enabled state based on input
   */
  private updateValidateButtonState(container: HTMLElement): void {
    const btn = container.querySelector<HTMLButtonElement>(".pa-validate-btn");
    if (!btn) return;

    const ref = this.plugin.settings.credentialReference;
    const isValid = ref && ref.startsWith("op://") && ref.split("/").length >= 4;

    btn.disabled = !isValid;
    if (isValid) {
      btn.removeClass("is-disabled");
    } else {
      btn.addClass("is-disabled");
    }
  }

  /**
   * Render direct token authentication option
   */
  private renderDirectTokenAuth(containerEl: HTMLElement): void {
    const directContainer = containerEl.createDiv({ cls: "pa-auth-method active" });

    directContainer.createEl("p", {
      text: "⚠️ Direct token storage is less secure. Consider using 1Password CLI instead.",
      cls: "pa-status-warn",
    });

    // Status display area (inline feedback)
    const statusEl = directContainer.createDiv({ cls: "pa-cli-status" });

    new Setting(directContainer)
      .setName("GitHub Personal Access Token")
      .setDesc("Enter your GitHub PAT with 'models:read' scope")
      .addText((text) => {
        text.setPlaceholder("ghp_xxxxxxxxxxxx");
        text.inputEl.setAttribute("type", "password");
        text.onChange(async (value) => {
          if (value.trim()) {
            await this.plugin.storeToken(value.trim());
            this.showCliStatus(statusEl, "success", "Token saved");
            // Brief delay so user sees the feedback before refresh
            setTimeout(() => this.display(), 500);
          }
        });
      });
  }

  /**
   * Check auth status and render model section if authenticated
   */
  private async checkAuthAndRenderModelSection(containerEl: HTMLElement): Promise<void> {
    // For gh-copilot-cli, check CLI status instead of token
    if (this.plugin.settings.provider === "gh-copilot-cli") {
      const provider = this.plugin.providerManager?.getProvider("gh-copilot-cli");
      if (provider) {
        const result = await provider.validateToken();
        if (result.success) {
          await this.renderModelSection(containerEl);
          this.renderReadySection(containerEl);
          return;
        }
      }
      // Show hint that CLI setup is required
      const hintEl = containerEl.createDiv({ cls: "pa-auth-required-hint" });
      hintEl.createEl("p", {
        text: "Click 'Check Status' above to verify your gh copilot CLI setup.",
        cls: "pa-hint",
      });
      return;
    }

    // For GitHub Models, check token
    const hasToken = await this.plugin.getStoredToken();

    if (hasToken) {
      await this.renderModelSection(containerEl);
      this.renderReadySection(containerEl);
    } else {
      // Show hint that auth is required
      const hintEl = containerEl.createDiv({ cls: "pa-auth-required-hint" });
      hintEl.createEl("p", {
        text: "Complete authentication above to configure model settings and start using the assistant.",
        cls: "pa-hint",
      });
    }
  }

  /**
   * Render model selection section with dynamic model list
   */
  private async renderModelSection(containerEl: HTMLElement): Promise<void> {
    containerEl.createEl("h3", { text: "Model Settings" });

    // Create placeholder while loading
    const modelSettingEl = containerEl.createDiv({ cls: "pa-model-setting" });
    modelSettingEl.createEl("p", {
      text: "Loading available models...",
      cls: "pa-hint",
    });

    // Get models from the active provider
    let models: Array<{ name: string; displayName: string }> = [];

    if (this.plugin.settings.provider === "gh-copilot-cli") {
      // Get models from gh-copilot-cli provider
      const provider = this.plugin.providerManager?.getProvider("gh-copilot-cli");
      if (provider) {
        try {
          const providerModels = await provider.getModels();
          models = providerModels.map((m) => ({
            name: m.id,
            displayName: m.name,
          }));
        } catch {
          console.warn("[PA] Could not fetch models from CLI provider");
        }
      }
      // Fallback defaults for CLI
      if (models.length === 0) {
        models = [
          { name: "claude-opus-4.5", displayName: "Claude Opus 4.5" },
          { name: "claude-sonnet-4", displayName: "Claude Sonnet 4" },
          { name: "gpt-4o", displayName: "GPT-4o" },
        ];
      }
    } else {
      // Get models from GitHub Models client (legacy)
      const client = this.plugin.getApiClient();
      models = [
        { name: "gpt-4o", displayName: "GPT-4o" },
        { name: "gpt-4o-mini", displayName: "GPT-4o Mini" },
      ];

      if (client) {
        try {
          const availableModels = await client.getAvailableModels();
          if (availableModels.length > 0) {
            models = availableModels.map((m) => ({
              name: m.name,
              displayName: m.displayName,
            }));
          }
        } catch {
          console.warn("[PA] Could not fetch models, using defaults");
        }
      }
    }

    // Clear placeholder and render dropdown
    modelSettingEl.empty();

    new Setting(modelSettingEl)
      .setName("AI Model")
      .setDesc(`Select which model to use (${models.length} available)`)
      .addDropdown((dropdown) => {
        // Add all available models
        for (const model of models) {
          dropdown.addOption(model.name, model.displayName);
        }

        // Set current value (default to first if current not available)
        const currentModel = this.plugin.settings.model;
        const isCurrentAvailable = models.some((m) => m.name === currentModel);
        if (isCurrentAvailable) {
          dropdown.setValue(currentModel);
        } else if (models.length > 0) {
          dropdown.setValue(models[0].name);
          // Update settings to valid model
          this.plugin.settings.model = models[0].name;
          void this.plugin.saveSettings();
        }

        dropdown.onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        });
      });

    // Status display for sign out feedback
    const signOutStatusEl = containerEl.createDiv({ cls: "pa-cli-status" });

    // Sign out button
    new Setting(containerEl)
      .setName("Sign out")
      .setDesc("Clear stored credentials")
      .addButton((button) =>
        button
          .setButtonText("Sign out")
          .setWarning()
          .onClick(async () => {
            await this.plugin.clearToken();
            this.showCliStatus(signOutStatusEl, "success", "Signed out successfully");
            // Brief delay so user sees the feedback before refresh
            setTimeout(() => this.display(), 500);
          })
      );
  }

  /**
   * Render the "Ready to use" section after successful authentication
   */
  private renderReadySection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "🎉 Ready to Use" });

    const infoEl = containerEl.createDiv({ cls: "pa-ready-info" });
    infoEl.createEl("p", {
      text: "Your Personal Assistant is configured and ready! Here's how to use it:",
    });

    const list = infoEl.createEl("ul");
    list.createEl("li", { text: "Click the chat icon in the left ribbon" });
    list.createEl("li", { text: "Or use Command Palette (Cmd+P) → 'Open AI Chat'" });
    list.createEl("li", { text: "The chat will use your currently open note as context" });

    // Status area for feedback
    const statusEl = containerEl.createDiv({ cls: "pa-cli-status" });

    new Setting(containerEl)
      .setName("Open Chat")
      .setDesc("Start chatting with your AI assistant")
      .addButton((button) =>
        button
          .setButtonText("Open AI Chat")
          .setCta()
          .onClick(async () => {
            // We're in the Ready section, so auth should be valid
            // Open chat directly without re-checking (avoids double 1Password prompts)
            await this.openChatDirectly(statusEl);
          })
      );
  }

  /**
   * Open the chat view directly, with inline error feedback
   */
  private async openChatDirectly(statusEl: HTMLElement): Promise<void> {
    const { workspace } = this.plugin.app;

    try {
      let leaf = workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];
      const existingLeaf = !!leaf;

      if (!leaf) {
        leaf = workspace.getRightLeaf(false);
        if (leaf) {
          await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
        }
      }

      if (leaf) {
        // If it was an existing leaf, refresh it to re-check configuration
        if (existingLeaf) {
          const view = leaf.view as ChatView;
          await view.refresh();
        }
        await Promise.resolve(workspace.revealLeaf(leaf));
        // Close settings modal if open
        const setting = (this.plugin.app as unknown as { setting?: { close: () => void } }).setting;
        setting?.close();
      } else {
        this.showCliStatus(statusEl, "error", "Could not open chat panel");
      }
    } catch (error) {
      this.showCliStatus(statusEl, "error", error instanceof Error ? error.message : "Failed to open chat");
    }
  }

  /**
   * Validate the 1Password credential reference (inline feedback)
   */
  private async validateCredentialReference(statusEl: HTMLElement, buttonEl: HTMLButtonElement): Promise<void> {
    const ref = this.plugin.settings.credentialReference;

    if (!ref) {
      this.showCliStatus(statusEl, "error", "Enter a 1Password reference first");
      return;
    }

    // Validate format
    const formatCheck = validateOnePasswordReference(ref);
    if (!formatCheck.valid) {
      this.showCliStatus(statusEl, "error", `Invalid format: ${formatCheck.error}`);
      return;
    }

    // Show loading state
    statusEl.empty();
    statusEl.removeClass("pa-cli-status-error", "pa-cli-status-success");
    statusEl.addClass("pa-cli-status-checking");
    statusEl.setText("⏳ Validating... (1Password may prompt for authentication)");
    buttonEl.disabled = true;

    const result = await resolveOnePasswordSecret(ref);

    buttonEl.disabled = false;

    if (result.success) {
      this.showCliStatus(statusEl, "success", "Connected successfully!");
      await this.plugin.initializeApiClient();
      this.display();
    } else {
      this.showCliStatus(statusEl, "error", result.error || "Validation failed");
    }
  }
}
