---
name: typescript-strict
description: >
  Provides TypeScript strict mode patterns and best practices for this project.
  Use this skill to ensure type safety, proper error handling, and compliance
  with the project's TypeScript standards.

  Covers explicit typing, interface design, null safety, and common patterns.
---

# TypeScript Strict Mode Patterns

## Purpose

This skill ensures TypeScript code follows strict mode best practices and project standards, including explicit typing, null safety, and proper interface design.

## Compiler Configuration

The project uses strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Explicit Return Types

### Public Methods Must Have Return Types

```typescript
// ✅ Correct: Explicit return type
export function processNote(note: TFile): ProcessResult {
  return { success: true, message: 'Processed' };
}

// ✅ Correct: Async with explicit return type
export async function loadSettings(): Promise<PluginSettings> {
  const data = await this.loadData();
  return { ...DEFAULT_SETTINGS, ...data };
}

// ❌ Wrong: Missing return type on public method
export function processNote(note: TFile) {
  return { success: true, message: 'Processed' };
}
```

### Private Methods Can Infer (But Explicit Is Preferred)

```typescript
// Acceptable for private methods
private calculateHash(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Preferred even for private methods
private calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

## Interface-Driven Design

### Define Interfaces for Data Structures

```typescript
// ✅ Correct: Interface-driven design
interface ProcessResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface AgentConfig {
  name: string;
  timeout: number;
  retryCount: number;
}

function createAgent(config: AgentConfig): Agent {
  // Implementation
}
```

### Use Type for Unions and Simple Types

```typescript
// Type for unions
type AgentStatus = 'idle' | 'running' | 'error' | 'completed';

// Type for function signatures
type EventHandler = (event: CustomEvent) => void;

// Type for mapped types
type Readonly<T> = { readonly [P in keyof T]: T[P] };
```

### Prefer Interfaces for Objects (Extensibility)

```typescript
// Interface can be extended/merged
interface BaseConfig {
  name: string;
}

interface ExtendedConfig extends BaseConfig {
  timeout: number;
}

// Declaration merging works with interfaces
interface PluginSettings {
  apiKey: string;
}

interface PluginSettings {
  timeout: number; // Merges with above
}
```

## Null Safety

### Handle Nullable Values Explicitly

```typescript
// ✅ Correct: Explicit null checks
function getActiveFile(): TFile | null {
  const file = this.app.workspace.getActiveFile();
  return file; // May be null
}

function processActiveFile(): void {
  const file = this.app.workspace.getActiveFile();
  if (file === null) {
    console.log('No active file');
    return;
  }
  // file is now TFile, not TFile | null
  this.processFile(file);
}
```

### Use Optional Chaining and Nullish Coalescing

```typescript
// Optional chaining
const title = cache?.frontmatter?.title;

// Nullish coalescing for defaults
const timeout = settings.timeout ?? 30000;

// Combined
const authorName = note.frontmatter?.author?.name ?? 'Unknown';
```

### Avoid Non-Null Assertions (!)

```typescript
// ❌ Avoid: Non-null assertion
const file = this.app.workspace.getActiveFile()!;

// ✅ Better: Explicit check
const file = this.app.workspace.getActiveFile();
if (!file) {
  throw new Error('No active file');
}

// ✅ Or: Guard clause
const file = this.app.workspace.getActiveFile();
if (!file) return;
```

## Function Typing

### Callback Types

```typescript
// Define callback types explicitly
type OnSuccess = (result: ProcessResult) => void;
type OnError = (error: Error) => void;

function processAsync(
  input: string,
  onSuccess: OnSuccess,
  onError: OnError
): void {
  // Implementation
}
```

### Generic Functions

```typescript
// Generic with constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Generic with default
function createArray<T = string>(length: number, value: T): T[] {
  return Array(length).fill(value);
}
```

### Overloads for Complex Functions

```typescript
// Function overloads
function parse(input: string): ParsedNote;
function parse(input: TFile): Promise<ParsedNote>;
function parse(input: string | TFile): ParsedNote | Promise<ParsedNote> {
  if (typeof input === 'string') {
    return parseString(input);
  }
  return parseFile(input);
}
```

## Error Handling

### Typed Error Classes

```typescript
// Custom error types
class PluginError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

class ValidationError extends PluginError {
  constructor(message: string, public readonly field: string) {
    super(message, 'VALIDATION_ERROR', true);
    this.name = 'ValidationError';
  }
}
```

### Result Types (Alternative to Exceptions)

```typescript
// Result type pattern
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function parseNote(content: string): Result<ParsedNote> {
  try {
    const parsed = JSON.parse(content);
    return { success: true, data: parsed };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// Usage
const result = parseNote(content);
if (result.success) {
  console.log(result.data); // Type is ParsedNote
} else {
  console.error(result.error); // Type is Error
}
```

## Array and Object Patterns

### Safe Array Access

```typescript
// With noUncheckedIndexedAccess: true
const items: string[] = ['a', 'b', 'c'];
const first = items[0]; // Type is string | undefined

// Must check before use
if (first !== undefined) {
  console.log(first.toUpperCase());
}

// Or use at() with check
const last = items.at(-1);
if (last) {
  console.log(last);
}
```

### Safe Object Property Access

```typescript
// Record type with string keys
const map: Record<string, number> = { a: 1, b: 2 };
const value = map['a']; // Type is number | undefined with noUncheckedIndexedAccess

// Check before use
if (value !== undefined) {
  console.log(value * 2);
}

// Use Map for better type safety
const typedMap = new Map<string, number>();
typedMap.set('a', 1);
const mapValue = typedMap.get('a'); // Type is number | undefined (clear)
```

## Const Assertions

### Immutable Objects

```typescript
// Const assertion for literal types
const AGENT_TYPES = ['assistant', 'reviewer', 'developer'] as const;
type AgentType = (typeof AGENT_TYPES)[number]; // 'assistant' | 'reviewer' | 'developer'

// Const assertion for config objects
const CONFIG = {
  maxRetries: 3,
  timeout: 30000,
  endpoints: {
    api: 'https://api.example.com',
  },
} as const;

// Type is deeply readonly
// CONFIG.maxRetries = 5; // Error: Cannot assign to 'maxRetries'
```

## Utility Types

### Common Utility Types

```typescript
// Partial - all properties optional
type PartialSettings = Partial<PluginSettings>;

// Required - all properties required
type RequiredSettings = Required<PluginSettings>;

// Readonly - all properties readonly
type ReadonlySettings = Readonly<PluginSettings>;

// Pick - select specific properties
type NameOnly = Pick<AgentConfig, 'name'>;

// Omit - exclude specific properties
type WithoutId = Omit<AgentConfig, 'id'>;

// Record - typed object
type StatusMap = Record<AgentStatus, string>;
```

### Custom Utility Types

```typescript
// Deep partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Non-nullable properties
type NonNullableProps<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};
```

## JSDoc for Public APIs

```typescript
/**
 * Processes a note file and extracts metadata.
 *
 * @param file - The file to process
 * @param options - Processing options
 * @returns A promise that resolves to the processed result
 * @throws {ValidationError} If the file content is invalid
 *
 * @example
 * ```typescript
 * const result = await processNote(file, { extractTags: true });
 * console.log(result.metadata.tags);
 * ```
 */
export async function processNote(
  file: TFile,
  options: ProcessOptions
): Promise<ProcessResult> {
  // Implementation
}
```

## Best Practices Summary

1. **Always use explicit return types** on public methods
2. **Prefer interfaces** for object shapes (extensibility)
3. **Use type** for unions, intersections, and primitives
4. **Handle null/undefined explicitly** - avoid `!` assertions
5. **Use const assertions** for immutable config objects
6. **Leverage utility types** (Partial, Pick, Omit, etc.)
7. **Add JSDoc comments** for public APIs
8. **Create custom error classes** for domain errors
9. **Consider Result types** for operations that can fail
10. **Enable strict compiler options** and fix all errors
