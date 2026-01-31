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

/**
 * Plugin settings interface
 */
export interface PASettings {
  /** Whether the user has acknowledged and consented to AI features */
  consentEnabled: boolean;

  /** Consent mode: opt-in (whitelist) or opt-out (blacklist) */
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

    // === SECTION 2: Authentication ===
    this.renderAuthSection(containerEl);

    // === SECTION 3: Model Selection (only after authenticated) ===
    void this.checkAuthAndRenderModelSection(containerEl);
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
            .addOption("opt-in", "Opt-in (whitelist folders)")
            .addOption("opt-out", "Opt-out (blacklist folders)")
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
          });
      })
      .addButton((button) =>
        button
          .setButtonText("Validate & Connect")
          .setCta()
          .onClick(async () => {
            await this.validateCredentialReference();
          })
      );
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
    const hasToken = await this.plugin.getStoredToken();

    if (hasToken) {
      this.renderModelSection(containerEl);
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
   * Render model selection section
   */
  private renderModelSection(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Model Settings" });

    new Setting(containerEl)
      .setName("AI Model")
      .setDesc("Select which model to use for chat completions")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("gpt-4o", "GPT-4o")
          .addOption("gpt-4o-mini", "GPT-4o Mini")
          .addOption("o1", "o1")
          .addOption("o1-mini", "o1 Mini")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
          })
      );

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
