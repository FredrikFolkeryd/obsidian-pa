# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-beta.1](https://github.com/FredrikFolkeryd/obsidian-pa/compare/obsidian-pa-v1.0.0-beta.1...obsidian-pa-v2.0.0-beta.1) (2026-03-03)


### ⚠ BREAKING CHANGES

* **providers:** Settings now include `provider` field defaulting to 'github-models'. Users must select their preferred provider.
* **auth:** OAuth device flow removed, now uses 1Password CLI
* **scripts:** scripts/package.sh removed, use scripts/install.sh instead

### ✨ Features

* add structured error handling with custom error types ([0715285](https://github.com/FredrikFolkeryd/obsidian-pa/commit/071528531772eb42f7da4ae89dbc4cf1c53cd3e5))
* add task issue template restricted to maintainers ([#51](https://github.com/FredrikFolkeryd/obsidian-pa/issues/51)) ([dce2195](https://github.com/FredrikFolkeryd/obsidian-pa/commit/dce2195971ff947e077c5f31580ac4be36f43b87))
* **api:** add GitHub Models API client with rate limiting ([22a3c64](https://github.com/FredrikFolkeryd/obsidian-pa/commit/22a3c64b7b7dfb80a70ff56b1ea2e1bb4b80b420))
* **api:** add multi-provider architecture for future extensibility ([8a59c34](https://github.com/FredrikFolkeryd/obsidian-pa/commit/8a59c34727c85a17161f9d3b709fad7117a7fda7))
* **auth:** add OAuth device flow for no-touch token acquisition ([2ae8c97](https://github.com/FredrikFolkeryd/obsidian-pa/commit/2ae8c9783bfb4bbeeb1ad48c224a849b42b19d3c))
* **auth:** replace OAuth with 1Password CLI credential resolution ([abfc8bf](https://github.com/FredrikFolkeryd/obsidian-pa/commit/abfc8bf266043764b317ea1da453195cf009eaad))
* **chat:** add AI chat sidebar view ([ba36c24](https://github.com/FredrikFolkeryd/obsidian-pa/commit/ba36c2432434a493faa18d7d0a2e00bb7f432f5b))
* **chat:** add export button to copy conversation as markdown ([d5cbcb6](https://github.com/FredrikFolkeryd/obsidian-pa/commit/d5cbcb6cb0ad33a9ed42a2db96772243e60f88f8))
* **chat:** add per-code-block copy buttons with raw content ([eb4bf6e](https://github.com/FredrikFolkeryd/obsidian-pa/commit/eb4bf6ef2b4e85d6c758da1f8b7d296b240d71de))
* **chat:** add response streaming for real-time feedback ([9dbc31b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9dbc31b6dd957446461afebe11a78cfd431541d5))
* **chat:** add stop button and limitation notice ([eed24ae](https://github.com/FredrikFolkeryd/obsidian-pa/commit/eed24ae1eda38e72b08e0ca3a918e3bf3272b5a4))
* **chat:** add TaskIntentDetector for NL parsing ([17e3ef4](https://github.com/FredrikFolkeryd/obsidian-pa/commit/17e3ef4ebd478a6bb270c0a4b8e803bf4d74b6bd))
* **chat:** add TaskPlanBlockParser for AI response parsing ([b170958](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b17095828eac1f8cf4f3191724043a51f96fe63d))
* **chat:** add working copy button to assistant messages ([6e2fedc](https://github.com/FredrikFolkeryd/obsidian-pa/commit/6e2fedc8e89dbfc49a6de9177fa41e1b8664a117))
* **chat:** enhance system prompt with task planning instructions ([ec800c2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/ec800c2901eced2e4aa5c4b3c417c5cb04d9fc96))
* **chat:** integrate write operations with chat interface ([6e4bc93](https://github.com/FredrikFolkeryd/obsidian-pa/commit/6e4bc93b5efce150b1c89b8ebc2ab8c9bcce5bcc))
* **chat:** persist conversation history across sessions ([745829a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/745829a2f4cf3cc63bf0d4b5eec4d09ca76710fe))
* **chat:** persist daily usage counter across sessions ([b13b51c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b13b51cf7aff3909f36fc1e7c0734be977212ac6))
* **chat:** show model and session usage in header ([198d1fe](https://github.com/FredrikFolkeryd/obsidian-pa/commit/198d1fe877283bd63b3edc54593b39d4a2e43fd9))
* **chat:** wire task execution to ChatView ([fb2b264](https://github.com/FredrikFolkeryd/obsidian-pa/commit/fb2b264f3a8ed8b00d831af056d274b0a80da9c0))
* **ci:** automate changelog and releases with release-please ([#58](https://github.com/FredrikFolkeryd/obsidian-pa/issues/58)) ([db36397](https://github.com/FredrikFolkeryd/obsidian-pa/commit/db36397ca776f276c46bb7a2664b767e8ee11be6))
* **context-picker:** improve usability of context selector ([#43](https://github.com/FredrikFolkeryd/obsidian-pa/issues/43)) ([fd6d41f](https://github.com/FredrikFolkeryd/obsidian-pa/commit/fd6d41f2035ef8e7635020029af01f020dc373be))
* **context:** add multi-file context picker with token budget ([d4c0056](https://github.com/FredrikFolkeryd/obsidian-pa/commit/d4c00566c57fa40bc575ca47ab3b0d7949a7e124))
* **context:** include all visible panes in AI context ([55db5cd](https://github.com/FredrikFolkeryd/obsidian-pa/commit/55db5cdfe1ce2f0f459228490cd005cdad9fbc5d))
* **core:** add plugin entry point with chat view registration ([ac2da0b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/ac2da0b443e1a346c32a6f1c7ff42f3d7c6d0c6a))
* **edit:** add edit history panel and improve diff preview ([4d44566](https://github.com/FredrikFolkeryd/obsidian-pa/commit/4d445668e6e93a10c72a487a32da9e60eed0d7c7))
* **modals:** add TaskApprovalModal for task plan review ([9f203c1](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9f203c1c2b597a437941748ed21d033a29d131a9))
* **models:** dynamic model selection from API ([b2b9746](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b2b9746314723d71d94a61d36a97baf2aa5e5c40))
* **providers:** add gh copilot CLI as alternative provider ([28792f7](https://github.com/FredrikFolkeryd/obsidian-pa/commit/28792f7706039fa16e68ea93bd8009e21fe19218))
* **providers:** migrate to standalone Copilot CLI ([1581257](https://github.com/FredrikFolkeryd/obsidian-pa/commit/1581257d1f23dbd5033dc1eb3bc642efb68d8f5b))
* **providers:** migrate to standalone Copilot CLI ([4fa2ce2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/4fa2ce2a4c9c6165a52f998426f4e3784c1aa0be))
* release 1.0.0-alpha.8 ([2617d0b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/2617d0b2e538278fa5eec007fd448915bf869980))
* release 1.0.0-alpha.9 ([f16411c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/f16411c5fba36d11f86827f09d00e64ab055cf85))
* **scripts:** add interactive installer with vault auto-detection ([adcea51](https://github.com/FredrikFolkeryd/obsidian-pa/commit/adcea51e440f21f7809de6b9ce6cee513ddb2130))
* **settings:** add consent model and settings UI ([a4749bb](https://github.com/FredrikFolkeryd/obsidian-pa/commit/a4749bb530f8de67beffe58727a0867df769f7f9))
* **settings:** redesign settings UX for clarity and usability ([2b89c76](https://github.com/FredrikFolkeryd/obsidian-pa/commit/2b89c761ab28e61020020c5585de01d543d97165))
* **settings:** require explicit acknowledgment for chat-only mode ([9d21b7f](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9d21b7f47a6c0ac041c68072bffa0d67340e74f8))
* **tasks:** add DeleteNoteHandler and MoveNoteHandler ([648f6af](https://github.com/FredrikFolkeryd/obsidian-pa/commit/648f6af98c6083e284fee3a3b4a7945beeb3a51e))
* **tasks:** add step handlers for vault operations ([522abe2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/522abe254c50ff7a83b452e13976934ec47d2913))
* **tasks:** add task plan types and XML parser ([078b283](https://github.com/FredrikFolkeryd/obsidian-pa/commit/078b2835218b1cbff62429efa138619964cd7e80))
* **tasks:** add TaskExecutor with Plan-Approve-Execute pattern ([7143538](https://github.com/FredrikFolkeryd/obsidian-pa/commit/7143538dbd3e6dfbe05dba4aac8cad9f559853da))
* **tasks:** add TaskHistoryManager for persistent history ([bcc7d1a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/bcc7d1ac08928cb9b93ece003d33a27f65d868ce))
* **ux:** add 'Ready to Use' section with Open Chat button ([b2336a1](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b2336a1524c868561879056f91b235c000de1371))
* **ux:** disable chat panel until configuration complete ([b0f07d9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b0f07d9e2c8654bf8f684b9d0f61eefe08aa411c))
* **vault:** add read-only vault wrapper for data safety ([f3c3e1a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/f3c3e1a764c265382039754e042045dbcbf37c37))
* **vault:** add write operations with safety guardrails ([0695e6c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/0695e6cbe3e544734ee320ea2eff0e063ec7f504))
* verify licence compatibility and add automated licence enforcement ([#57](https://github.com/FredrikFolkeryd/obsidian-pa/issues/57)) ([5e894af](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5e894afd481ae639106512c32b3a8b556638f58a))
* **views:** add TaskHistoryView with rollback capability ([b75e953](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b75e953bf39e5533ecf6c15c301eba8e6e594621))


### 🐛 Bug Fixes

* **auth:** sign out clears 1Password reference and improve error messages ([9461527](https://github.com/FredrikFolkeryd/obsidian-pa/commit/946152753a0990b9483d6ef6164df250608afe06))
* **chat:** always add newly opened files to context ([a50ddb8](https://github.com/FredrikFolkeryd/obsidian-pa/commit/a50ddb82df9a585dddd999b4fcdf575a36f7bb6c))
* **chat:** auto-update context on workspace changes ([883b36c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/883b36c962a3a35e5945e7e69ed4c38955d88750))
* **chat:** auto-update context when workspace changes ([adadbe1](https://github.com/FredrikFolkeryd/obsidian-pa/commit/adadbe1761677507d137101e5f8c81bb7dcf5d08))
* **chat:** clean up streaming message on error ([5a6c9ba](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5a6c9ba3ff81b7297c8cebada7460896208ade43))
* **chat:** context files count not updating correctly ([#3](https://github.com/FredrikFolkeryd/obsidian-pa/issues/3)) ([f9e289f](https://github.com/FredrikFolkeryd/obsidian-pa/commit/f9e289fd74a1e65340a7463124a62509ea8a5222))
* **chat:** enable text selection and clarify file access in prompt ([113011a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/113011aeafaddc4bb47e824bf2dbc7332aaf4b20))
* **chat:** get context file when chat panel has focus ([047743c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/047743c5c9d98685c9c927948fd74febdaab8d9d))
* **chat:** maintain async onClose signature for compatibility ([366e8e4](https://github.com/FredrikFolkeryd/obsidian-pa/commit/366e8e40ddb92cb6ecb009c6b0d19eb201f9bbb7))
* **chat:** model settings take effect immediately in open views ([#29](https://github.com/FredrikFolkeryd/obsidian-pa/issues/29)) ([25fb5cc](https://github.com/FredrikFolkeryd/obsidian-pa/commit/25fb5cce752c87b23fb66c6d16b16642bb2aa3e1))
* **chat:** prevent double-submit on rapid Enter/click ([0c0c4c3](https://github.com/FredrikFolkeryd/obsidian-pa/commit/0c0c4c32913c981d1784814764c34ee24fdbce65))
* **chat:** refresh view when opening from settings ([9590b4b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9590b4bf112f2c792de6a2d1b60389dd681943bc))
* **chat:** restore failed message to input and improve network errors ([8469e99](https://github.com/FredrikFolkeryd/obsidian-pa/commit/8469e993813b868fd73ae435145938577687a646))
* **chat:** restore input and show informative message when request interrupted by app switch ([#47](https://github.com/FredrikFolkeryd/obsidian-pa/issues/47)) ([d4d5b3c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/d4d5b3ca3eb28ed9a915458e353d7b45f62f4d92))
* **chat:** use ISO 8601 timestamps instead of unreliable toLocaleString ([be8eba5](https://github.com/FredrikFolkeryd/obsidian-pa/commit/be8eba5b7a748bbf8b3e95477911a0dd1331bd52))
* **ci:** assign copilot directly instead of using triage label ([75c0d3e](https://github.com/FredrikFolkeryd/obsidian-pa/commit/75c0d3e11b82c907b3229e8aef4b15abbfb5d855))
* context selection updates when assistant panel is re-activated ([#41](https://github.com/FredrikFolkeryd/obsidian-pa/issues/41)) ([9c04888](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9c04888f534b0caf2b675bdf017add1b6d8dc6ac))
* **context:** context files not recognized when added via picker ([#48](https://github.com/FredrikFolkeryd/obsidian-pa/issues/48)) ([9e99589](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9e9958969d052ac81bf4cec1167e3389a48ddd2c))
* correct property name from contextWindow to maxContextTokens in ChatView ([c67b4cf](https://github.com/FredrikFolkeryd/obsidian-pa/commit/c67b4cf5cb2da47a3acaa36959351db204abc0b1))
* correct TokenBudgetConfig property name in context file handling ([c2e42e5](https://github.com/FredrikFolkeryd/obsidian-pa/commit/c2e42e5c22f35dacc1856fd4d3bba7138d27fc98))
* create intermediate backup directories for nested file paths ([#37](https://github.com/FredrikFolkeryd/obsidian-pa/issues/37)) ([e83be23](https://github.com/FredrikFolkeryd/obsidian-pa/commit/e83be2394a0cd61b7700085151d1315423a64cc1)), closes [#36](https://github.com/FredrikFolkeryd/obsidian-pa/issues/36)
* **docs:** correct cross-platform.md link path ([6e4f38f](https://github.com/FredrikFolkeryd/obsidian-pa/commit/6e4f38ffb33922eaacda9e9f8a8cdcdc44354844))
* **docs:** rename test artifact to test-strategy.md ([7e7d414](https://github.com/FredrikFolkeryd/obsidian-pa/commit/7e7d414b7bf3f12313a57ae055a84dd5d8ee5640))
* edits truncated with nested code blocks and unactionable error messages ([#30](https://github.com/FredrikFolkeryd/obsidian-pa/issues/30)) ([fcc0211](https://github.com/FredrikFolkeryd/obsidian-pa/commit/fcc0211f69d788f2fcf938cfab14703d55b995f6))
* **edits:** detect plain path code blocks in mayContainEdits ([e884679](https://github.com/FredrikFolkeryd/obsidian-pa/commit/e884679d21e4f99ed4206af3df8a949551046372))
* ensure open files saved before edit operations to prevent stale content ([#22](https://github.com/FredrikFolkeryd/obsidian-pa/issues/22)) ([c8e2175](https://github.com/FredrikFolkeryd/obsidian-pa/commit/c8e21753f7de187423d2ac69d2fe17fbe5d83ccd))
* **errors:** improve Copilot CLI error messages ([589583b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/589583b1955108af7cf210023b940d235f591b2d))
* **lint:** remove unnecessary type assertion in ChatView ([1727ada](https://github.com/FredrikFolkeryd/obsidian-pa/commit/1727adae14db6ae240b04296df126fe93b26f7a6))
* **prompt:** tell AI about its edit capabilities ([c01bee8](https://github.com/FredrikFolkeryd/obsidian-pa/commit/c01bee8091de04dfa5beac2d23a33c6c50e26367))
* **providers:** auto-fix invalid model selection on load ([7749b5d](https://github.com/FredrikFolkeryd/obsidian-pa/commit/7749b5d2a5e7bea81dee6c13c7ca43e68518fc65))
* **providers:** detect gh copilot as built-in command ([163cf64](https://github.com/FredrikFolkeryd/obsidian-pa/commit/163cf64db229a699f203e03794c5013480b659ce))
* **providers:** resolve gh CLI path for GUI apps ([e5d922a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/e5d922a63dbc66fbf2485c3edf901636798db7c7))
* **providers:** set PATH env for gh copilot CLI invocation ([0800497](https://github.com/FredrikFolkeryd/obsidian-pa/commit/0800497e2c920b7bf79fcdacdbd7e192d4c07af6))
* **providers:** update gh copilot model list and show status feedback ([3b56b32](https://github.com/FredrikFolkeryd/obsidian-pa/commit/3b56b32325be3e9946287745cbe65f259ec6f61d))
* resolve TypeScript and markdown lint errors ([0f45eb5](https://github.com/FredrikFolkeryd/obsidian-pa/commit/0f45eb57d36b9b7c894ffa662f7a374fbef88ff7))
* resolve TypeScript errors and create test strategy ([7404274](https://github.com/FredrikFolkeryd/obsidian-pa/commit/7404274a92d4275c1f8dc232d6f267a44b606860))
* resolve TypeScript errors in handlers, tests, and types ([78d5192](https://github.com/FredrikFolkeryd/obsidian-pa/commit/78d5192572ef2de493432e937d081174a2c0807e))
* **scripts:** correct Obsidian reload instructions ([d891650](https://github.com/FredrikFolkeryd/obsidian-pa/commit/d8916505ad01ffcc814ac31430e1ab84b213298d))
* **scripts:** read vaults from obsidian.json, not vaults.json ([a476424](https://github.com/FredrikFolkeryd/obsidian-pa/commit/a476424860063f571a5be6f1452d05a3cc642de7))
* settings auto-open on restart for configured plugins ([#27](https://github.com/FredrikFolkeryd/obsidian-pa/issues/27)) ([2ab2cd4](https://github.com/FredrikFolkeryd/obsidian-pa/commit/2ab2cd4c8c4817045f700020bd0d3d192d40a790))
* **settings:** add direct chat open from Ready section ([5da8d2a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5da8d2a4b350f4ff6c474b7bc1967f4ce1a582f8))
* **settings:** persist gh CLI status without page refresh ([83bb247](https://github.com/FredrikFolkeryd/obsidian-pa/commit/83bb24719a05e319dbd710248f2e44290d72dd11))
* **settings:** prevent duplicate section rendering ([66c72a5](https://github.com/FredrikFolkeryd/obsidian-pa/commit/66c72a54ea36cbd6a9d310b94dffdd1203313db6))
* **settings:** sync provider to manager and use inline 1Password feedback ([e1c79a1](https://github.com/FredrikFolkeryd/obsidian-pa/commit/e1c79a17338ffbe2c5c98451a9aaf6ec462dcb1a))
* standardise issue template label format and document template chooser flow ([#52](https://github.com/FredrikFolkeryd/obsidian-pa/issues/52)) ([b5969bd](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b5969bdd8349ffc82f037d790455ff42a65f5f94))
* **tasks:** add "recreate" to UndoAction type ([fc752e8](https://github.com/FredrikFolkeryd/obsidian-pa/commit/fc752e888f8198e7fce034582a3deeb1a5094035))
* **tasks:** resolve TypeScript type errors in TaskApprovalModal and TaskPlanBlockParser ([13e1c6e](https://github.com/FredrikFolkeryd/obsidian-pa/commit/13e1c6e0c8143c59d3d85d8537e108b76b2029c8))
* **test:** add required reason property to WriteAuditEntry mocks ([63c6de0](https://github.com/FredrikFolkeryd/obsidian-pa/commit/63c6de042d83eb65c1ec7af90104f1500d32accc))
* **test:** rename vitest config to ESM to silence deprecation warning ([bd1414f](https://github.com/FredrikFolkeryd/obsidian-pa/commit/bd1414f9ad4d0f0deabc171481d65fc0daaeb9d2))
* **test:** resolve TypeScript errors in test files ([c0bebdb](https://github.com/FredrikFolkeryd/obsidian-pa/commit/c0bebdb5a1e685da48436cfb7f0cbe6e8eab66a5))
* **tests:** make CLI path tests platform-agnostic for CI ([bd3740a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/bd3740a907c52b3ff64bd6b7fdc10b36b1649105))
* **ui:** add missing CSS classes for context picker selected items ([#35](https://github.com/FredrikFolkeryd/obsidian-pa/issues/35)) ([56cf666](https://github.com/FredrikFolkeryd/obsidian-pa/commit/56cf666587bb5f44fb658b04ae30211d1ea6020f))
* **ui:** chat icon does not open chat panel ([#26](https://github.com/FredrikFolkeryd/obsidian-pa/issues/26)) ([6e11d0c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/6e11d0c365b3b0aaa2643d9e388fc8a51a5d16fc))
* update deprecated tsconfig options and workflow context access ([c778d07](https://github.com/FredrikFolkeryd/obsidian-pa/commit/c778d071087aafc7899431f429d5d672e80a7950))
* use consistent local time for timestamp + renovate ([dae4a96](https://github.com/FredrikFolkeryd/obsidian-pa/commit/dae4a962bd59783c47d793761a91b954eb6713c5))
* **ux:** show user message immediately with staged loading states ([4f25a96](https://github.com/FredrikFolkeryd/obsidian-pa/commit/4f25a9612dfafe9d46b2806b98727fba7378b6b6))
* **ux:** use inclusive terminology and disable button until valid input ([75f1f78](https://github.com/FredrikFolkeryd/obsidian-pa/commit/75f1f78bf95ce85bb7d016df05f7429ca2aa79a4))
* **ux:** use inline status display instead of toasts for CLI check ([f6c98c2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/f6c98c2ddc0ba1f2196e2cbc4d7f437f21bcf893))


### 📚 Documentation

* add missing ADRs and clear retro debt ([b26b5d7](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b26b5d70fcec4eea73300c107233123cd6c7bbb0))
* add SECURITY.md for responsible vulnerability reporting ([#55](https://github.com/FredrikFolkeryd/obsidian-pa/issues/55)) ([97fe2ee](https://github.com/FredrikFolkeryd/obsidian-pa/commit/97fe2ee11845763cbcbcabdb713bebdf7249ddc4))
* add Sprint 8 planning documents ([0c4d42b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/0c4d42bf9cb42af5fb166902bdb5c2a0322a096c))
* add Sprint 9 planning and test strategy ([def50c4](https://github.com/FredrikFolkeryd/obsidian-pa/commit/def50c407df1ea294371b64585186b85ece34bf9))
* add Sprint 9/beta.1 retro and Sprint 10 plan ([53c4187](https://github.com/FredrikFolkeryd/obsidian-pa/commit/53c41870fab17f368b6341788e2afcb14dd88395))
* **agents:** add comprehensive git best practices to copilot instructions ([96ac55d](https://github.com/FredrikFolkeryd/obsidian-pa/commit/96ac55da5d27994fdca5bbd46d55367016054a7a))
* **agents:** add linting requirements to validation checklists ([10fc7c5](https://github.com/FredrikFolkeryd/obsidian-pa/commit/10fc7c56a8784c3ca3b4d7f106a5136520581ec4))
* **agents:** add security gate and delegation patterns to team-lead ([0dee9f2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/0dee9f267a13f864d523542f900c2a318fda739a))
* mark Sprint 9 complete with 669 tests ([40223bf](https://github.com/FredrikFolkeryd/obsidian-pa/commit/40223bfc5c3dff0c0cfbac21050183209fb4d9d8))
* **plan:** add sprint roadmap and raise coverage thresholds ([a7608ad](https://github.com/FredrikFolkeryd/obsidian-pa/commit/a7608ad67528f7d97eea04fd4d21249c0a141346))
* **plan:** add v1.0 MVP plan with phased approach ([be78a12](https://github.com/FredrikFolkeryd/obsidian-pa/commit/be78a12c83a1931988641acf1dc8b80f8524297f))
* **process:** add retrospective workflow and first retro ([d4289ff](https://github.com/FredrikFolkeryd/obsidian-pa/commit/d4289ff5059834f8f305d0b6c81a1076be3ae94b))
* **process:** add Sprint 4 retro and update process guidance ([60d56d9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/60d56d9b0bfa637014f32e866752b67f916e2e7a))
* **readme:** update for beta.1 release ([1d8b832](https://github.com/FredrikFolkeryd/obsidian-pa/commit/1d8b832e49777542739bb7809c2aa206c7fcdd84))
* reference install script for manual installation ([131c8dc](https://github.com/FredrikFolkeryd/obsidian-pa/commit/131c8dcfd97fc7721660b32b463caf988c78963c))
* **retro:** add Sprint 6 retrospective with coverage recalibration ([dea89ab](https://github.com/FredrikFolkeryd/obsidian-pa/commit/dea89ab620c9f589988e90a696882ad34029e208))
* **retro:** schedule retrospective for coverage threshold breach ([8eff735](https://github.com/FredrikFolkeryd/obsidian-pa/commit/8eff73550a4db7505350fb3121cb9e3f535cb9c6))
* **setup:** clarify PAT creation with explicit Models permission step ([9c49d4c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9c49d4cef59e1457c89ab6fb2b873b7dc7eef4bd))
* simplify issue templates to reduce friction ([#32](https://github.com/FredrikFolkeryd/obsidian-pa/issues/32)) ([5dcb685](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5dcb68531183a48628db981545db1a7f8e061b6f))
* **sprint:** mark Sprint 8 as complete ([3d81979](https://github.com/FredrikFolkeryd/obsidian-pa/commit/3d819794457c49e0e4806f2a6f4a185f5fb0fe1b))
* **sprint:** update Sprint 9 progress ([348dfe9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/348dfe96edac6d98ecee2385ed93c15da220729b))
* update CHANGELOG and README for alpha.3 release ([f510fcd](https://github.com/FredrikFolkeryd/obsidian-pa/commit/f510fcd57845db419c95e02ff7b66e6ddd72b41b))
* update installation instructions for end users ([03d3c9c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/03d3c9c99c7b0270f2eb24214518b2d22780bf4b))
* **work:** finalize developer.md with complete implementation summary ([927731f](https://github.com/FredrikFolkeryd/obsidian-pa/commit/927731fda90f96c39c32050ff9c151dd3804e8b5))
* **workflow:** make test planning a required step ([fd96ef3](https://github.com/FredrikFolkeryd/obsidian-pa/commit/fd96ef349edbe3066a461481c2bdf172744cb1d6))
* **work:** update developer.md with async onClose details ([2270348](https://github.com/FredrikFolkeryd/obsidian-pa/commit/2270348d4ea5a4f7279d1ac5323e22423ecddfe0))


### 🔧 Maintenance

* add dist/ to gitignore ([a38cb1b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/a38cb1b57e5364bcbb879cbcfcaf6afab2b60613))
* bump version to 1.0.0-alpha.3 ([00cf2e3](https://github.com/FredrikFolkeryd/obsidian-pa/commit/00cf2e3cc460b408df9c8c7c9f9fef4c6cec603d))
* bump version to 1.0.0-alpha.4 ([60f4b95](https://github.com/FredrikFolkeryd/obsidian-pa/commit/60f4b95ac2d20c5ae0cc524e599fe5290e44d174))
* **deps:** update actions/checkout action to v6 ([#12](https://github.com/FredrikFolkeryd/obsidian-pa/issues/12)) ([dc1ab72](https://github.com/FredrikFolkeryd/obsidian-pa/commit/dc1ab72b9ccd2d6cb2b1bdba857cd287ceeeefee))
* **deps:** update actions/github-script action to v8 ([#13](https://github.com/FredrikFolkeryd/obsidian-pa/issues/13)) ([b50b1d9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/b50b1d9b76727abdfb899db12bebeeb6c337041f))
* **deps:** update actions/setup-node action to v6 ([#15](https://github.com/FredrikFolkeryd/obsidian-pa/issues/15)) ([28f7c52](https://github.com/FredrikFolkeryd/obsidian-pa/commit/28f7c521cb85c12e21542af0c7fe40f81c1814d8))
* **deps:** update dependency @types/node to v20.19.32 ([#9](https://github.com/FredrikFolkeryd/obsidian-pa/issues/9)) ([9aba68b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9aba68b101be7130b85921b3cf5a314214e3361d))
* **deps:** update dependency @types/node to v20.19.33 ([#14](https://github.com/FredrikFolkeryd/obsidian-pa/issues/14)) ([08ed1c9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/08ed1c9f74d6ffaa11ab67970deb0b5c5e07a716))
* **deps:** update dependency @types/node to v20.19.34 ([#39](https://github.com/FredrikFolkeryd/obsidian-pa/issues/39)) ([7ae30f2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/7ae30f23488429302de04e3b9ab1e280a41084c5))
* **deps:** update dependency @types/node to v20.19.35 ([#44](https://github.com/FredrikFolkeryd/obsidian-pa/issues/44)) ([053b34f](https://github.com/FredrikFolkeryd/obsidian-pa/commit/053b34f2ab384e4775c77342da2f5e0ec87910bc))
* **deps:** update dependency esbuild to ^0.27.0 ([#10](https://github.com/FredrikFolkeryd/obsidian-pa/issues/10)) ([89c7e93](https://github.com/FredrikFolkeryd/obsidian-pa/commit/89c7e93359ac4affe6d5e2e796838ef68265ae3b))
* **deps:** update softprops/action-gh-release action to v2 ([#19](https://github.com/FredrikFolkeryd/obsidian-pa/issues/19)) ([49544e2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/49544e27ed869a2423014e45e9d5a8468b6c3929))
* **deps:** update typescript-eslint monorepo to v8.55.0 ([#23](https://github.com/FredrikFolkeryd/obsidian-pa/issues/23)) ([27fa71f](https://github.com/FredrikFolkeryd/obsidian-pa/commit/27fa71f1dd6a13cace47bf6a25d6fcb13a23ad73))
* **deps:** update typescript-eslint monorepo to v8.56.0 ([#33](https://github.com/FredrikFolkeryd/obsidian-pa/issues/33)) ([02153d2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/02153d206fc3a3277ffd0162457ac993a5dac90f))
* **deps:** update typescript-eslint monorepo to v8.56.1 ([#38](https://github.com/FredrikFolkeryd/obsidian-pa/issues/38)) ([0730bfe](https://github.com/FredrikFolkeryd/obsidian-pa/commit/0730bfe0374d32be9113863a880311cc1cbeaab7))
* **deps:** update typescript-eslint to v8 for TS 5.9 support ([5d16a90](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5d16a90deba8648b02d27a0fc788174e4d65cdfb))
* implement more copilot-setup review comments ([29987ab](https://github.com/FredrikFolkeryd/obsidian-pa/commit/29987abd889701a895005f0d27d9bfa75eac350c))
* implement review changes to agentic setup ([e78ee3c](https://github.com/FredrikFolkeryd/obsidian-pa/commit/e78ee3cb6ac023d40d458351251c27d614e104e7))
* initial commit ([4f74738](https://github.com/FredrikFolkeryd/obsidian-pa/commit/4f74738a3c4088a0e0810c928806b6a824f87585))
* **lint:** clean up console warnings ([4734e71](https://github.com/FredrikFolkeryd/obsidian-pa/commit/4734e718dcbe3f5b4ed9364b356dd1a5e78df8e2))
* markdown lint ([eeb8a4b](https://github.com/FredrikFolkeryd/obsidian-pa/commit/eeb8a4b11283a0688b2506173440dfa022f31d31))
* prepare for public beta release ([#49](https://github.com/FredrikFolkeryd/obsidian-pa/issues/49)) ([5c19d14](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5c19d14dbefced3511178191f27f45a75bb1226a))
* **readme:** remove non-working Codecov and Release badges ([788ed71](https://github.com/FredrikFolkeryd/obsidian-pa/commit/788ed71739f0ce07df651072ceda813f1c7a5f26))
* release 1.0.0-alpha.6 ([aa276c9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/aa276c97da3ef87d817c17e8ce96ddd67180492b))
* **release:** 1.0.0-alpha.2 ([9e13321](https://github.com/FredrikFolkeryd/obsidian-pa/commit/9e13321ab521f6c31c96e333907631ebf36466a0))
* **release:** 1.0.0-beta.1 ([1a0ec54](https://github.com/FredrikFolkeryd/obsidian-pa/commit/1a0ec542b5a23d2ed23e255c8ccddda5d73bd7ac))
* **release:** 1.0.0-beta.2 ([536b3a9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/536b3a950ccdf5931fcf0033061cd584cacfc574))
* **release:** bump version to 1.0.0-alpha.5 ([1145bd7](https://github.com/FredrikFolkeryd/obsidian-pa/commit/1145bd774048967b71bdf49535f355ecb01b41d1))
* **release:** simplify release workflow and add CHANGELOG ([c2afcf4](https://github.com/FredrikFolkeryd/obsidian-pa/commit/c2afcf4c7117d1c8e95f782f1194e625dab6e08d))
* remove accidentally committed dist/ from tracking ([6562bfa](https://github.com/FredrikFolkeryd/obsidian-pa/commit/6562bfa3ce2b7f040b6eb7226ed0a350b4965331))


### ♻️ Code Refactoring

* **chat:** add debouncing to context refresh ([415194d](https://github.com/FredrikFolkeryd/obsidian-pa/commit/415194d22e7da5d87303ee95cfd939946478024d))
* **chat:** deduplicate timestamp formatting and use locale-correct dates ([f732224](https://github.com/FredrikFolkeryd/obsidian-pa/commit/f73222439dbc6e25d795bd15e8b5824f32c87a2b))
* **chat:** use provider system instead of GitHubModelsClient ([5cafc4e](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5cafc4e36b615a7c5dbceb7a5dc8ccd45e5a87b7))
* **ux:** use inline feedback for all settings actions ([f586bdd](https://github.com/FredrikFolkeryd/obsidian-pa/commit/f586bddbeb025a414d8e46a76af5e885bf20a914))


### ✅ Tests

* add E2E integration tests for chat flow ([50f8c66](https://github.com/FredrikFolkeryd/obsidian-pa/commit/50f8c662b13acacbb1fa6df200ac14492118be99))
* add Obsidian module mock for Vitest ([86ede3d](https://github.com/FredrikFolkeryd/obsidian-pa/commit/86ede3dd992e0af3e3eaae34c7f2f48559614242))
* add provider integration tests ([1f31e1a](https://github.com/FredrikFolkeryd/obsidian-pa/commit/1f31e1a968a76ab9e6980aac5988d2c3cf0004d0))
* **integration:** add TaskPlanFlow E2E tests ([734bea9](https://github.com/FredrikFolkeryd/obsidian-pa/commit/734bea93d86fc79b18f01e023cc431f3fd73dd88))
* **sprint3:** add provider tests to reach 45% coverage ([e3b37b1](https://github.com/FredrikFolkeryd/obsidian-pa/commit/e3b37b1e68cf5162e48cf0f5b50a00100c209f4b))
* **sprint6:** add pure helper functions and expand test coverage ([d075cac](https://github.com/FredrikFolkeryd/obsidian-pa/commit/d075cacd9aa79434c908a4ab01740f574124a0f9))
* **tasks:** add handler unit tests (69 tests) ([5bc1cf2](https://github.com/FredrikFolkeryd/obsidian-pa/commit/5bc1cf280411ea7435dcbc514d2c977a5ab6bf17))

## [Unreleased]

_Changes that will be in the next release._

### 🔮 Planned Features (Future Releases)

- **Link suggestions** — AI recommends connections between notes
- **Orphan detection** — Find unlinked notes in vault
- **Performance** — Lazy loading, virtual scrolling for long chats

## [1.0.0-beta.2] - 2026-03-03

### ✨ Features

- **Context picker improvements** — Better usability for selecting context files (#43)
- **Task issue template** — Maintainer-only task template for structured issue creation (#51)
- **Licence enforcement** — Automated licence compatibility checks for dependencies (#57)
- **Release automation** — Changelog and releases via release-please (#58)

### 🐛 Bug Fixes

- **Chat**: restore input and show informative message when request interrupted by app switch (#47)
- **Chat**: model settings take effect immediately in open views (#29)
- **Chat**: context files count not updating correctly (#3)
- **Chat**: always add newly opened files to context
- **Chat**: auto-update context when workspace changes with debounced refresh
- **Chat**: use ISO 8601 timestamps instead of unreliable `toLocaleString`
- **Chat**: maintain async `onClose` signature for compatibility
- **Context**: context files not recognized when added via picker (#48)
- **Context**: selection updates when assistant panel is re-activated (#41)
- **UI**: chat icon does not open chat panel (#26)
- **UI**: add missing CSS classes for context picker selected items (#35)
- **Edits**: truncated with nested code blocks and unactionable error messages (#30)
- **Vault**: create intermediate backup directories for nested file paths (#37)
- Settings auto-open on restart for configured plugins (#27)
- Ensure open files saved before edit operations to prevent stale content (#22)
- Correct property name from `contextWindow` to `maxContextTokens` in ChatView
- Standardise issue template label format (#52)

### ♻️ Code Refactoring

- Deduplicate timestamp formatting and use locale-correct dates
- Add debouncing to context refresh

### 📚 Documentation

- Add SECURITY.md for responsible vulnerability reporting (#55)
- Simplify issue templates to reduce friction (#32)

### 🔧 Maintenance

- Prepare for public beta release (#49)
- Add issue triage workflow and YAML form templates
- Enable Renovate for dependency updates
- Update dependency @types/node to v20.19.32–v20.19.35
- Update typescript-eslint monorepo to v8.55.0–v8.56.1
- Update esbuild to ^0.27.0
- Update actions/checkout to v6, actions/setup-node to v6, actions/github-script to v8
- Update softprops/action-gh-release to v2

## [1.0.0-beta.1] - 2026-02-05

🎉 **First Beta Release** — Full task automation with chat integration!

### ✨ Features

- **Natural Language Task Detection** — Pattern-based intent detection from user messages:
  - `TaskIntentDetector` — Detects 6 intent types (create, modify, delete, move, add-link, add-tag)
  - Confidence scoring for detected intents
  - Helper: `mayContainTaskIntent`, `generatePlanDescription`
  - 49 tests

- **Task History Manager** — Persistent history of executed task plans:
  - Load/export for storage
  - Query by status, date range, or affected file
  - Rollback tracking
  - Helpers: `formatHistoryEntry`, `getHistoryStats`
  - 38 tests

- **Task History View** — Dedicated UI for browsing executed task plans:
  - Filter by status (all, completed, failed, rolled-back)
  - Expandable step details
  - Rollback button with confirmation modal
  - Clear history option
  - "Open Task History" command
  - 12 tests

- **Enhanced System Prompt** — Task planning instructions for AI:
  - `buildTaskPlanningInstructions()` helper
  - `buildSystemPrompt({ enableTaskPlanning: true })` option
  - 7 tests

- **ChatView Task Integration** — Execute task plans directly from chat:
  - `createTaskExecutor()` factory function
  - Task plan detection via `parseTaskPlanBlocks`
  - "Review & Execute" button for valid task plans
  - Real-time step progress feedback
  - History tracking on execution

- **Integration Tests** — E2E flow coverage:
  - Parse → Approve → Execute → History lifecycle
  - 8 integration tests

### 📊 Test Coverage

- **669 tests** (up from 555 in alpha.9)
- **86%+ branch coverage** maintained

## [1.0.0-alpha.9]

### ✨ Features

- **Task Automation Framework** — AI can perform multi-step workflows:
  - `TaskPlanParser` — Parses XML task plans from AI responses
  - `TaskExecutor` — Plan-Approve-Execute pattern with full rollback
  - `TaskApprovalModal` — Review and approve task plans before execution
  - `TaskPlanBlockParser` — Detects task plan blocks in chat responses

- **6 Step Handlers** — Vault operations for task automation:
  - `CreateNoteHandler` — Create new vault notes
  - `ModifyNoteHandler` — Edit existing notes with backup
  - `DeleteNoteHandler` — Delete notes with content backup for undo
  - `MoveNoteHandler` — Rename/move notes via fileManager
  - `AddLinkHandler` — Insert wikilinks into notes
  - `AddTagHandler` — Add frontmatter or inline tags

- **Expanded test coverage** — 555 tests total (up from 375):
  - 98 handler tests with comprehensive edge cases
  - 30 TaskPlanParser tests
  - 21 TaskExecutor tests
  - 21 TaskPlanBlockParser tests
  - 10 TaskApprovalModal tests

### 🔧 Changed

- Branch coverage maintained at 84.57%
- Statement coverage increased to 52.48%
- Sprint plan updated with Sprint 8 completion

## [1.0.0-alpha.8]

### ✨ Features

- **Expanded test coverage** — 330 tests total (up from 232):
  - Pure helper functions extracted to `src/chat/helpers.ts` with 100% coverage
  - Settings validation tests (+15)
  - EditHistoryModal logic tests (+22)
  - SafeVaultAccess edge case tests (+14)
  
- **Branch coverage exceeds 80% target** — Now at 84%

### 📋 Documentation

- **Threat model** for write operations — Comprehensive security review:
  - 9 threat categories analysed (T1–T9)
  - Risk matrix with likelihood/impact assessments
  - All critical controls verified and tested
  - Approved for release by @security, @architect, @team-lead
  
- **Sprint 6 retrospective** — Coverage target recalibration:
  - Industry research (Martin Fowler, Stack Overflow consensus)
  - Revised targets based on UI-heavy architecture
  - E2E testing planned for beta phase

### 🔧 Changed

- Coverage targets recalibrated based on industry best practices
- Pure functions extracted from ChatView for improved testability
- Sprint plan updated with realistic progression table

## [1.0.0-alpha.7]

### ✨ Features

- **Improved diff preview** — Edit confirmation modal now shows:
  - Line numbers for old and new content
  - LCS-based unified diff algorithm for accurate change detection
  - Better handling of large files with context snippets
  - Statistics showing additions, deletions, and unchanged lines
  
- **Edit history panel** — New "History" button in chat toolbar:
  - View all recorded AI edits with timestamps
  - See edit reasons and backup information
  - Revert the most recent edit directly from history
  - Clear edit history when no longer needed

- **Enhanced edit block parsing** — Better detection of AI edit suggestions:
  - Support for SEARCH/REPLACE patterns with git-style markers
  - New edit types: `full-replace`, `search-replace`, `append`, `prepend`
  - `applySearchReplace()` function for partial text replacements
  - Improved `mayContainEdits()` with search/replace pattern detection

### 🧪 Testing

- **232 tests total** — Up from 209
- **16 new tests** for diff algorithm (LCS, unified diff, statistics)
- **7 new tests** for search/replace edit parsing

### 🔧 Changed

- Edit confirmation modal width increased for better diff readability
- Diff lines now hover-highlight for easier reading
- Context lines shown for large file changes

## [1.0.0-alpha.6]

### ✨ Features

- **AI-assisted note editing** — AI can now suggest changes to your vault files:
  - Edit detection: Parses AI responses for code blocks with file paths
  - Supports multiple formats: fenced-path, XML-style, contextual blocks
  - "Apply Edit" button appears on AI messages containing edits
  
- **Diff preview confirmation** — Before any edit is applied:
  - Modal shows file path and reason for the edit
  - Color-coded diff: green for additions, red for deletions
  - Statistics: +N lines added, -N lines removed
  - Accept or Cancel buttons with keyboard support
  
- **Automatic backups** — Every edit creates a backup:
  - Stored in `.pa-backups/` folder (hidden by default)
  - Timestamped backup files for each modification
  - Maximum 10 backups per file, auto-cleanup of old backups
  - 7-day retention policy for backup cleanup
  
- **Undo last edit** — "Undo Edit" button in chat toolbar:
  - Reverts the most recent AI-initiated change
  - Restores from automatic backup
  - Confirmation dialog before reverting
  
- **Audit logging** — Full history of AI-initiated writes:
  - Tracks create, modify, and revert operations
  - Timestamps and reasons recorded
  - Maximum 100 entries maintained
  
- **SafeVaultAccess API** — Secure write layer with:
  - Explicit write enablement (disabled by default)
  - Path-based access control (respects private patterns)
  - Proposal → confirmation → apply workflow

### 🧪 Testing

- **209 tests total** — Up from 178 (+31 new)
- **22 tests** for EditBlockParser covering all edit formats
- **13 tests** for VaultBackup (create, restore, cleanup)
- **13 tests** for SafeVaultAccess (reads, writes, security)
- **9 tests** for E2E edit flow integration

### 🔧 Changed

- Chat view now integrates write operations with SafeVaultAccess
- Plugin initialises SafeVaultAccess on load as `plugin.safeVault`
- Write mode defaults to disabled (must be explicitly enabled per operation)

## [1.0.0-alpha.4]

### ✨ Features

- **Structured error handling** — Custom error classes with user-friendly messages
  - Categorised errors: Authentication, TokenValidation, RateLimit, Network, API errors
  - Retryable error detection for better UX
  - Consistent error messaging across the plugin

### 🧪 Testing

- **Coverage thresholds** — 35% statement, 70% branch coverage required for CI
- **Codecov integration** — Coverage tracking and badges in README
- **Provider integration tests** — 43 new tests for ProviderManager and GitHubModelsProvider
- **E2E integration tests** — 12 tests for full chat flow with mock vault
- **Error handling tests** — 25 tests for custom error classes

### 🔧 Changed

- **CI coverage reporting** — Coverage summary in GitHub Actions job summary
- **ESLint relaxations for tests** — Type safety relaxed in test files for mock compatibility
- **114 tests total** — Up from 77, 42% statement coverage, 82% branch coverage

## [1.0.0-alpha.3]

### ✨ Features

- **Streaming responses** — AI responses now stream in real-time with a blinking cursor
- **Conversation persistence** — Chat history saved across Obsidian sessions (up to 50 messages)
- **Export conversation** — Copy conversation to clipboard as formatted markdown
- **Stop button** — Cancel in-progress AI requests
- **Send button state** — Disabled during AI thinking to prevent duplicate requests

### 🔄 Changed

- Updated README with alpha warning banner and known limitations section
- Added limitation notice link in chat header pointing to documentation

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
