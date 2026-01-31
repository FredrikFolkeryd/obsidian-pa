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
  /** Whether the user has consented to AI features */
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
};

/**
 * Settings tab for the Personal Assistant plugin
 */
export class PASettingTab extends PluginSettingTab {
  private plugin: PAPlugin;

  public constructor(app: App, plugin: PAPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Personal Assistant Settings" });

    // Consent section
    containerEl.createEl("h3", { text: "Privacy & Consent" });

    new Setting(containerEl)
      .setName("Enable AI features")
      .setDesc(
        "When enabled, note content may be sent to GitHub Models API for AI processing. " +
          "No data is shared until you enable this setting."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.consentEnabled).onChange(async (value) => {
          this.plugin.settings.consentEnabled = value;
          await this.plugin.saveSettings();
          await this.plugin.initializeApiClient();
          this.display(); // Refresh to show/hide dependent settings
        })
      );

    if (this.plugin.settings.consentEnabled) {
      new Setting(containerEl)
        .setName("Consent mode")
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
              this.display(); // Refresh to show correct folder setting
            })
        );

      if (this.plugin.settings.consentMode === "opt-in") {
        new Setting(containerEl)
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
        new Setting(containerEl)
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

    // Authentication section
    containerEl.createEl("h3", { text: "Authentication" });

    this.renderAuthSection(containerEl);

    // Model selection
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
  }

  /**
   * Render the authentication section with 1Password support
   */
  private renderAuthSection(containerEl: HTMLElement): void {
    // Check current auth status
    void this.checkAuthStatus(containerEl);
  }

  /**
   * Check authentication status and render appropriate UI
   */
  private async checkAuthStatus(containerEl: HTMLElement): Promise<void> {
    const hasToken = await this.plugin.getStoredToken();
    const hasReference = !!this.plugin.settings.credentialReference;

    if (hasToken) {
      // Show authenticated state with ready-to-use guidance
      new Setting(containerEl)
        .setName("GitHub Authentication")
        .setDesc(
          hasReference
            ? "✅ Authenticated via 1Password. Token resolved at runtime."
            : "✅ Authenticated. Your token is stored securely."
        )
        .addButton((button) =>
          button
            .setButtonText("Sign out")
            .setWarning()
            .onClick(async () => {
              await this.plugin.clearToken();
              new Notice("Signed out successfully");
              this.display();
            })
        )
        .addButton((button) =>
          button.setButtonText("Setup help").onClick(() => {
            new SetupHelpModal(this.app).open();
          })
        );

      // Show "Ready to use" section
      this.renderReadySection(containerEl);
    } else {
      // Show setup UI
      this.renderSetupUI(containerEl);
    }
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
   * Render the credential setup UI
   */
  private renderSetupUI(containerEl: HTMLElement): void {
    // Help button
    new Setting(containerEl)
      .setName("GitHub Authentication")
      .setDesc("Configure how to authenticate with GitHub Models API.")
      .addButton((button) =>
        button
          .setButtonText("Setup help")
          .setCta()
          .onClick(() => {
            new SetupHelpModal(this.app).open();
          })
      );

    // 1Password reference input (recommended)
    new Setting(containerEl)
      .setName("1Password reference (recommended)")
      .setDesc("Enter your 1Password secret reference: op://vault/item/field")
      .addText((text) => {
        text
          .setPlaceholder("op://Personal/GitHub-PAT/credential")
          .setValue(this.plugin.settings.credentialReference || "")
          .onChange(async (value) => {
            // Validate format
            if (value && !value.startsWith("op://")) {
              return; // Let them finish typing
            }
            this.plugin.settings.credentialReference = value || undefined;
            await this.plugin.saveSettings();
          });

        // Add validation button next to input
        return text;
      })
      .addButton((button) =>
        button.setButtonText("Validate").onClick(async () => {
          await this.validateCredentialReference();
        })
      );

    // Check 1Password CLI status
    void this.checkOnePasswordStatus(containerEl);

    // Fallback: direct token entry (less secure)
    new Setting(containerEl)
      .setName("Direct token (fallback)")
      .setDesc(
        "⚠️ Less secure. Enter a GitHub PAT directly. Only use if 1Password is not available."
      );

    // Create collapsible section
    const detailsEl = containerEl.createEl("details", {
      cls: "pa-fallback-details",
    });
    detailsEl.createEl("summary", { text: "Show direct token entry" });

    new Setting(detailsEl).addText((text) => {
      text
        .setPlaceholder("ghp_xxxxxxxxxxxx")
        .setValue("")
        .inputEl.setAttribute("type", "password");
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
   * Check and display 1Password CLI status
   */
  private async checkOnePasswordStatus(containerEl: HTMLElement): Promise<void> {
    const cliInstalled = await isOnePasswordCliInstalled();

    const statusEl = containerEl.createDiv({ cls: "pa-op-status" });

    if (cliInstalled) {
      statusEl.createEl("p", {
        text: "✅ 1Password CLI detected",
        cls: "pa-status-ok",
      });
    } else {
      statusEl.createEl("p", {
        text: "⚠️ 1Password CLI not found",
        cls: "pa-status-warn",
      });
      const linkEl = statusEl.createEl("a", {
        text: "Install 1Password CLI",
        href: "https://1password.com/downloads/command-line/",
      });
      linkEl.setAttribute("target", "_blank");
    }
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
      new Notice("✅ Reference validated successfully!");
      await this.plugin.initializeApiClient();
      this.display();
    } else {
      new Notice(`❌ Validation failed: ${result.error}`);
    }
  }
}
