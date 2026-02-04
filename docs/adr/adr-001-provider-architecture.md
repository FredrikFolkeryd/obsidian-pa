# ADR-001: Provider Architecture

**Status:** Accepted  
**Date:** 2026-01-30  
**Author:** @architect  
**Supersedes:** N/A

## Context

The obsidian-pa plugin needs to support multiple AI backends to give users flexibility in choosing their preferred AI provider. Different providers have varying authentication methods, API formats, capabilities, and cost models.

### Requirements

1. Users should be able to switch between providers without code changes
2. New providers should be easy to add
3. Common functionality (streaming, error handling) should be shared
4. Provider-specific quirks should be encapsulated

### Providers Considered

| Provider | Auth Method | API Format | Notes |
|----------|-------------|------------|-------|
| GitHub Models | PAT token | OpenAI-compatible | Free tier available |
| GitHub Copilot CLI | `gh copilot` | CLI wrapper | Uses existing auth |
| GitHub Copilot Enterprise | OAuth | OpenAI-compatible | Enterprise only |
| OpenAI | API key | Native | Reference implementation |
| Azure OpenAI | API key + endpoint | OpenAI-compatible | Enterprise deployments |
| AWS Bedrock | IAM | Claude/other | Multi-model |

## Decision

Implement a **Strategy Pattern** with abstract base class:

```
BaseProvider (abstract)
├── GitHubModelsProvider
├── GhCopilotCliProvider  
├── GitHubCopilotEnterpriseProvider
├── OpenAIProvider (future)
├── AzureOpenAIProvider (future)
└── AWSBedrockProvider (future)
```

### Core Interface

```typescript
abstract class BaseProvider {
  // Configuration
  abstract get type(): ProviderType;
  abstract get name(): string;
  abstract get capabilities(): ProviderCapabilities;
  
  // Authentication
  abstract setToken(token: string): void;
  abstract isAuthenticated(): boolean;
  
  // Chat operations
  abstract chat(messages: ChatMessage[], options: ChatOptions): Promise<Result<ChatResponse>>;
  abstract chatStream(messages: ChatMessage[], options: ChatOptions, callback: StreamCallback): Promise<Result<void>>;
  
  // Model discovery
  abstract getModels(): Promise<Result<ModelInfo[]>>;
}
```

### Provider Manager

A `ProviderManager` class handles:
- Provider registration and lifecycle
- Active provider switching
- Token management (with 1Password integration)
- Provider capability queries

## Consequences

### Positive

- **Extensibility:** New providers implement `BaseProvider` interface
- **Encapsulation:** Provider quirks hidden behind common interface
- **Testability:** Mock providers easy to create
- **User choice:** Switch providers without plugin changes

### Negative

- **Complexity:** More abstraction than single-provider solution
- **Maintenance:** Each provider needs updates when APIs change
- **Feature parity:** Not all providers support all features

### Risks Mitigated

- **Vendor lock-in:** Users not tied to single AI provider
- **Cost control:** Switch to cheaper providers as needed
- **Availability:** Fallback if primary provider has outages

## Implementation

### Files Created

- `src/api/types.ts` — Shared type definitions
- `src/api/BaseProvider.ts` — Abstract base class
- `src/api/ProviderManager.ts` — Provider orchestration
- `src/api/providers/` — Provider implementations

### Token Resolution

Tokens resolved via priority chain:
1. 1Password CLI (`op read op://vault/item/field`)
2. Environment variable (`GITHUB_TOKEN`, etc.)
3. Manual entry in settings

See [ADR-004: Token Resolution](/docs/adr/adr-004-token-resolution.md) for details.

## Alternatives Considered

### 1. Single Provider (OpenAI only)

**Rejected:** Too limiting for users with different AI access.

### 2. Plugin per Provider

**Rejected:** Fragmented user experience, code duplication.

### 3. Configuration-driven (no code per provider)

**Rejected:** Insufficient flexibility for provider-specific behaviours (e.g., Copilot CLI subprocess management).

## References

- [Strategy Pattern](https://refactoring.guru/design-patterns/strategy)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [GitHub Models Documentation](https://docs.github.com/en/github-models)
