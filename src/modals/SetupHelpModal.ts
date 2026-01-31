/**
 * Setup Help Modal
 *
 * Displays information about how to configure the plugin,
 * including 1Password CLI setup instructions.
 */

import { App, Modal } from "obsidian";

export class SetupHelpModal extends Modal {
  public constructor(app: App) {
    super(app);
  }

  public onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "Personal Assistant Setup" });

    // Introduction
    contentEl.createEl("p", {
      text:
        "This plugin uses GitHub Models API for AI features. " +
        "You'll need a GitHub Personal Access Token (PAT) to authenticate.",
    });

    // Why 1Password section
    contentEl.createEl("h3", { text: "🔐 Secure Token Storage" });
    contentEl.createEl("p", {
      text:
        "We recommend using 1Password CLI for secure credential management. " +
        "This keeps your token in your password manager instead of storing it directly.",
    });

    // 1Password Setup Steps
    contentEl.createEl("h3", { text: "Setup with 1Password" });

    const steps = contentEl.createEl("ol");

    // Step 1: Install 1Password CLI
    const step1 = steps.createEl("li");
    step1.createEl("strong", { text: "Install 1Password CLI" });
    step1.createEl("br");
    const cliLink = step1.createEl("a", {
      text: "Download 1Password CLI",
      href: "https://1password.com/downloads/command-line/",
    });
    cliLink.setAttribute("target", "_blank");
    step1.createEl("br");
    step1.createEl("code", { text: "brew install 1password-cli" });
    step1.appendText(" (macOS)");

    // Step 2: Sign in
    const step2 = steps.createEl("li");
    step2.createEl("strong", { text: "Sign in to 1Password CLI" });
    step2.createEl("br");
    step2.createEl("code", { text: "op signin" });

    // Step 3: Create GitHub PAT
    const step3 = steps.createEl("li");
    step3.createEl("strong", { text: "Create a GitHub Personal Access Token" });
    step3.createEl("br");
    const patLink = step3.createEl("a", {
      text: "GitHub → Settings → Personal access tokens (Fine-grained)",
      href: "https://github.com/settings/tokens?type=beta",
    });
    patLink.setAttribute("target", "_blank");

    const substeps = step3.createEl("ol", { attr: { type: "a" } });
    substeps.createEl("li", { text: 'Click "Generate new token"' });
    substeps.createEl("li", { text: "Set a name and expiration date" });
    const permStep = substeps.createEl("li");
    permStep.appendText('Under "Account permissions", find ');
    permStep.createEl("strong", { text: "Models" });
    permStep.appendText(" and set to ");
    permStep.createEl("strong", { text: "Read" });
    substeps.createEl("li", { text: "Click Generate token and copy it" });

    // Step 4: Store in 1Password
    const step4 = steps.createEl("li");
    step4.createEl("strong", { text: "Store the PAT in 1Password" });
    step4.createEl("br");
    step4.appendText("Create an item named ");
    step4.createEl("code", { text: "GitHub-PAT" });
    step4.appendText(" in your vault with the token as the password/credential field.");

    // Step 5: Enter reference
    const step5 = steps.createEl("li");
    step5.createEl("strong", { text: "Enter the 1Password reference" });
    step5.createEl("br");
    step5.appendText("Format: ");
    step5.createEl("code", { text: "op://VaultName/GitHub-PAT/credential" });
    step5.createEl("br");
    step5.appendText("Example: ");
    step5.createEl("code", { text: "op://Personal/GitHub-PAT/credential" });

    // Secret reference docs link
    contentEl.createEl("h4", { text: "📖 More Information" });
    const docsP = contentEl.createEl("p");
    const docsLink = docsP.createEl("a", {
      text: "1Password Secret References Documentation",
      href: "https://developer.1password.com/docs/cli/secret-references",
    });
    docsLink.setAttribute("target", "_blank");

    // Alternative: Environment variable
    contentEl.createEl("h3", { text: "Alternative: Environment Variable" });
    contentEl.createEl("p", {
      text: "You can also set the GITHUB_TOKEN environment variable before launching Obsidian:",
    });
    contentEl.createEl("code", { text: "export GITHUB_TOKEN=ghp_your_token_here" });

    // Close button
    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    const closeButton = buttonContainer.createEl("button", { text: "Got it!" });
    closeButton.addEventListener("click", () => this.close());
    closeButton.addClass("mod-cta");
  }

  public onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
