/**
 * Plugin settings and settings tab
 */

import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type PAPlugin from "./main";
import { GitHubDeviceAuth } from "./auth/GitHubDeviceAuth";

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
   * Render the authentication section with device flow
   */
  private renderAuthSection(containerEl: HTMLElement): void {
    const deviceAuth = new GitHubDeviceAuth();
    const isConfigured = deviceAuth.isConfigured();

    // Check if we have a token
    void this.plugin.getStoredToken().then((hasToken) => {
      if (hasToken) {
        // Show authenticated state
        new Setting(containerEl)
          .setName("GitHub Authentication")
          .setDesc("✅ Authenticated with GitHub. Your token is stored securely.")
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
      } else if (!isConfigured) {
        // OAuth App not configured - show manual token fallback with warning
        new Setting(containerEl)
          .setName("GitHub Authentication")
          .setDesc(
            "⚠️ OAuth App not configured. Using manual token entry (less secure). " +
              "For production, register an OAuth App and update the client ID."
          )
          .addText((text) => {
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
      } else {
        // Show device flow button
        new Setting(containerEl)
          .setName("GitHub Authentication")
          .setDesc(
            "Sign in with GitHub to enable AI features. " +
              "You'll be redirected to GitHub to authorize this app."
          )
          .addButton((button) =>
            button.setButtonText("Sign in with GitHub").onClick(() => {
              void this.startDeviceFlow(containerEl, deviceAuth);
            })
          );
      }
    });
  }

  /**
   * Start the OAuth device flow authentication
   */
  private async startDeviceFlow(
    containerEl: HTMLElement,
    deviceAuth: GitHubDeviceAuth
  ): Promise<void> {
    // Create status display
    const statusEl = containerEl.createDiv({ cls: "pa-auth-status" });
    statusEl.createEl("p", { text: "Starting authentication..." });

    try {
      const token = await deviceAuth.authenticate((status) => {
        statusEl.empty();

        switch (status.status) {
          case "pending": {
            statusEl.createEl("p", {
              text: "To authenticate, visit:",
              cls: "pa-auth-instruction",
            });
            const linkEl = statusEl.createEl("a", {
              text: status.verificationUrl ?? "https://github.com/login/device",
              href: status.verificationUrl ?? "https://github.com/login/device",
              cls: "pa-auth-link",
            });
            linkEl.setAttribute("target", "_blank");

            statusEl.createEl("p", { text: "And enter this code:" });
            statusEl.createEl("code", {
              text: status.userCode ?? "",
              cls: "pa-auth-code",
            });

            statusEl.createEl("p", {
              text: "Waiting for authorization...",
              cls: "pa-auth-waiting",
            });

            // Add cancel button
            const cancelBtn = statusEl.createEl("button", { text: "Cancel" });
            cancelBtn.addEventListener("click", () => {
              deviceAuth.cancel();
            });
            break;
          }

          case "success":
            statusEl.createEl("p", { text: "✅ Authentication successful!" });
            break;

          case "error": {
            statusEl.createEl("p", {
              text: `❌ Error: ${status.error ?? "Unknown error"}`,
              cls: "pa-auth-error",
            });
            break;
          }

          case "expired":
            statusEl.createEl("p", {
              text: "⏰ Authentication timed out. Please try again.",
              cls: "pa-auth-error",
            });
            break;

          case "cancelled":
            statusEl.createEl("p", { text: "Authentication cancelled." });
            break;
        }
      });

      // Store the token
      await this.plugin.storeToken(token);
      new Notice("Successfully authenticated with GitHub!");

      // Refresh settings display
      this.display();
    } catch (error) {
      // Error already displayed via callback
      console.error("[Settings] Device flow error:", error);
    }
  }
}
