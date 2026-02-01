/**
 * Plugin settings and settings tab
 */

import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type PAPlugin from "./main";
import { SetupHelpModal } from "./modals/SetupHelpModal";
import {
  validateOnePasswordReference,
  resolveOnePasswordSecret,
  isOnePasswordCliInstalled,
} from "./auth/OnePasswordResolver";
import type { GhCopilotCliProvider } from "./api/providers/GhCopilotCliProvider";
import type { ProviderType } from "./api/types";

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
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: PASettings = {
  consentEnabled: false,
  consentMode: "opt-in",
  includedFolders: [],
  excludedFolders: [],
  model: "gpt-4o",
  authMethod: "1password",
  provider: "github-models",
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

    // Check 1Password CLI status first (async)
    void this.checkOpCliStatus().then(() => {
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
          // Reset model when switching providers
          if (value === "gh-copilot-cli") {
            this.plugin.settings.model = "claude-opus-4.5";
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
                await this.plugin.saveSettings();
              })
          );
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

    new Setting(authContainer)
      .setName("CLI Status")
      .setDesc("Check if gh copilot CLI is properly configured")
      .addButton((button) =>
        button
          .setButtonText("Check Status")
          .setCta()
          .onClick(async () => {
            await this.checkGhCopilotStatus();
          })
      );
  }

  /**
   * Check gh copilot CLI status and show results
   */
  private async checkGhCopilotStatus(): Promise<void> {
    new Notice("Checking gh copilot CLI status...");

    try {
      // Get the provider from the manager
      const provider = this.plugin.providerManager?.getProvider("gh-copilot-cli");
      if (!provider) {
        new Notice("❌ Provider not found");
        return;
      }

      // Cast to access the refreshCliStatus method
      const cliProvider = provider as GhCopilotCliProvider;
      if (typeof cliProvider.refreshCliStatus !== "function") {
        // Fall back to validateToken
        const result = await provider.validateToken();
        if (result.success) {
          new Notice("✅ gh copilot CLI is ready to use!");
          this.display(); // Refresh to show model section
        } else {
          new Notice(`❌ ${result.error}`, 10000);
        }
        return;
      }

      const status = await cliProvider.refreshCliStatus();

      if (!status.ghInstalled) {
        new Notice("❌ GitHub CLI (gh) not found. Install from cli.github.com", 10000);
        return;
      }

      if (!status.copilotExtensionInstalled) {
        new Notice("❌ gh-copilot extension not installed. Run: gh extension install github/gh-copilot", 10000);
        return;
      }

      if (!status.authenticated) {
        new Notice("❌ Not logged in to GitHub CLI. Run: gh auth login", 10000);
        return;
      }

      new Notice("✅ gh copilot CLI is ready to use!");
      this.display(); // Refresh to show model section
    } catch (error) {
      new Notice(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
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
    }

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
            // Update button state
            this.updateValidateButtonState(opContainer);
          });
      })
      .addButton((button) => {
        button
          .setButtonText("Validate & Connect")
          .setCta()
          .onClick(async () => {
            await this.validateCredentialReference();
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

    new Setting(directContainer)
      .setName("GitHub Personal Access Token")
      .setDesc("Enter your GitHub PAT with 'models:read' scope")
      .addText((text) => {
        text.setPlaceholder("ghp_xxxxxxxxxxxx");
        text.inputEl.setAttribute("type", "password");
        text.onChange(async (value) => {
          if (value.trim()) {
            await this.plugin.storeToken(value.trim());
            new Notice("Token saved");
            this.display();
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
        } catch (e) {
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
        } catch (e) {
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
            new Notice("Signed out successfully");
            this.display();
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

    new Setting(containerEl)
      .setName("Open Chat")
      .setDesc("Start chatting with your AI assistant")
      .addButton((button) =>
        button
          .setButtonText("Open AI Chat")
          .setCta()
          .onClick(() => {
            this.plugin.activateChatView();
          })
      );
  }

  /**
   * Validate the 1Password credential reference
   */
  private async validateCredentialReference(): Promise<void> {
    const ref = this.plugin.settings.credentialReference;

    if (!ref) {
      new Notice("Enter a 1Password reference first");
      return;
    }

    // Validate format
    const formatCheck = validateOnePasswordReference(ref);
    if (!formatCheck.valid) {
      new Notice(`Invalid format: ${formatCheck.error}`);
      return;
    }

    // Try to resolve
    new Notice("Validating... (1Password may prompt for authentication)");

    const result = await resolveOnePasswordSecret(ref);

    if (result.success) {
      new Notice("✅ Connected successfully!");
      await this.plugin.initializeApiClient();
      this.display();
    } else {
      new Notice(`❌ Validation failed: ${result.error}`);
    }
  }
}
