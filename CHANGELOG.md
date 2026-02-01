# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Changes that will be in the next release._

## [1.0.0-alpha.2]

### 🔄 Changed

- **Migrated to standalone Copilot CLI** — Now uses `copilot` command instead of deprecated `gh copilot` extension
- Updated installation instructions for Copilot CLI (`brew install copilot-cli`)
- Simplified release workflow (removed environments, uses CHANGELOG for release notes)

### 🐛 Fixed

- Copilot CLI provider now works correctly from Obsidian GUI
- Updated model list to match current Copilot CLI offerings

## [1.0.0-alpha.1]

First alpha release of the Obsidian Personal Assistant plugin.

### ✨ Features

- **AI Chat Interface** — Side panel for conversational AI within your vault
- **Multi-Provider Support** — Choose between:
  - **GitHub Models** via 1Password integration or direct API token
  - **gh Copilot CLI** using existing `gh auth` credentials (no token management!)
- **Dynamic Model Selection** — Choose from available models (Claude, GPT, Gemini series)
- **Vault Context Access** — AI can read notes from opt-in folders you specify
- **Usage Tracking** — Daily request counter displayed in chat header
- **Gated Setup Flow** — Chat panel disabled until configuration complete
- **Chat-Only Mode** — Use the plugin without vault access (explicit opt-in)

### 🔒 Security

- No credentials stored in plugin — uses 1Password CLI or gh auth
- Opt-in folder access — you choose which folders AI can read
- Read-only vault access — AI cannot modify your notes

### 📦 Installation

1. Download `obsidian-pa-1.0.0-alpha.1.zip` from releases
2. Extract to `<vault>/.obsidian/plugins/` (creates `obsidian-pa/` folder)
3. Reload Obsidian and enable in **Settings → Community plugins**
4. Configure in **Settings → Personal Assistant**

### ⚠️ Known Limitations

| Limitation | Notes |
|------------|-------|
| No streaming | Responses appear all at once |
| No conversation persistence | Chat history lost on reload |
| macOS/Linux only | Windows paths untested |
| Not in Community plugins | Manual installation required |

### 🔗 Links

- [Documentation](https://github.com/FredrikFolkeryd/obsidian-pa#readme)
- [Report an issue](https://github.com/FredrikFolkeryd/obsidian-pa/issues)
- 