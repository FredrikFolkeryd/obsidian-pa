# Security Review: GhCopilotCliProvider

**Reviewer**: Security Agent  
**Date**: 2026-02-01  
**Design Document**: [design.md](design.md)  
**Status**: Review Complete - Changes Required

---

## Executive Summary

The `GhCopilotCliProvider` design introduces **shell command execution** to invoke the `gh copilot` CLI. This is a fundamentally different security model from the existing HTTP-based providers and requires careful attention.

**Overall Risk Rating**: **MEDIUM-HIGH** (pending required mitigations)

| Finding | Severity | Status |
|---------|----------|--------|
| Shell injection via user input | **HIGH** | ⚠️ Requires changes |
| Insufficient escaping function | **HIGH** | ⚠️ Requires changes |
| Error message information leakage | **MEDIUM** | ⚠️ Requires changes |
| `exec` vs `spawn` usage | **MEDIUM** | ⚠️ Requires changes |
| Credential delegation model | **LOW** | ✅ Acceptable |
| Timeout/resource exhaustion | **LOW** | ✅ Acceptable |

---

## 1. Shell Command Execution

### 1.1 Finding: Shell Injection Risk (HIGH)

**Location**: Section 6.2, `invokeCopilotCli` implementation

**Issue**: The design proposes two implementations:
1. Using `exec` with string concatenation
2. Using `spawn` with an argument array

The `exec` variant is vulnerable:

```typescript
// DANGEROUS - from design Section 6.2
const command = `gh copilot -p ${escapedPrompt} --model ${model}`;
await execAsync(command, { ... });
```

Even with escaping, this approach:
- Relies on escape function completeness
- Uses shell interpretation of the entire command string
- Is vulnerable to escape sequence bypasses on different shells (bash, zsh, PowerShell, cmd)

**Attack Vector**: A user message containing carefully crafted escape sequences could break out of the quoted string:

```
User input: test" && rm -rf ~ && echo "
After escaping: "test\" && rm -rf ~ && echo \""
Shell sees: gh copilot -p "test\" && rm -rf ~ && echo \"" --model claude
```

While the current escape function handles `"` and `\`, there are additional risks:
- Shell metacharacters: `$`, `` ` ``, `!`, newlines
- Platform differences: Windows cmd.exe vs PowerShell vs Unix shells
- Unicode homoglyphs that may bypass simple escaping

### 1.2 Required Change: Use spawn with Array Arguments (MANDATORY)

**Replace** all uses of `exec` with `spawn` using array arguments and **disable shell interpretation**:

```typescript
import { spawn } from "child_process";

private async invokeCopilotCli(prompt: string, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Arguments as array - never interpreted by shell
    const args = ["copilot", "-p", prompt, "--model", model];
    
    // CRITICAL: shell: false prevents shell interpretation
    const child = spawn("gh", args, {
      shell: false,  // <-- CRITICAL SECURITY SETTING
      timeout: 120000,
      windowsHide: true,  // Prevent window popup on Windows
    });
    
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(this.sanitiseErrorMessage(stderr, code)));
      }
    });
    
    child.on("error", (err) => {
      reject(new Error(this.sanitiseErrorMessage(err.message, null)));
    });
  });
}
```

**Why this is secure**:
- `spawn` with `shell: false` passes arguments directly to the executable
- No shell interpretation means no injection possible
- Each argument is a separate entry in the args array
- User input cannot influence command structure

---

## 2. Input Escaping Analysis

### 2.1 Finding: Escape Function is Insufficient (HIGH)

**Location**: Section 6.2, `escapeShellArg` function

```typescript
// From design - INSUFFICIENT
private escapeShellArg(arg: string): string {
  return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
```

**Problems**:
1. **Does not handle `$`**: Shell variable expansion still works: `"$HOME"` expands
2. **Does not handle backticks**: Command substitution: `` "`whoami`" `` executes
3. **Does not handle `!`**: History expansion in bash: `"!!"` expands
4. **Does not handle newlines**: Can break command structure
5. **Windows incompatible**: Windows uses different escaping rules

### 2.2 Required Change: Remove escapeShellArg Entirely (MANDATORY)

**Action**: Delete the `escapeShellArg` function. With `spawn` using `shell: false`, no escaping is needed—arguments are passed directly to the process.

If escaping is ever needed for logging or display purposes, use a simple sanitisation:

```typescript
/**
 * Sanitise string for safe logging (NOT for shell execution)
 */
private sanitiseForLogging(input: string): string {
  // Truncate long inputs
  const maxLen = 500;
  const truncated = input.length > maxLen 
    ? input.substring(0, maxLen) + "...[truncated]" 
    : input;
  
  // Replace control characters
  return truncated.replace(/[\x00-\x1F\x7F]/g, "□");
}
```

---

## 3. Credential Handling

### 3.1 Finding: Delegation Model is Acceptable (LOW)

**Assessment**: The design correctly delegates authentication to the `gh` CLI:

- ✅ No API tokens stored by the plugin
- ✅ No credentials passed in arguments
- ✅ Uses existing system keychain via `gh auth`
- ✅ Respects user's existing GitHub session

**This is the correct approach** and aligns with EA-07 (no hardcoded credentials).

### 3.2 Recommendation: Document Security Model

Add a comment in the provider explaining the security model:

```typescript
/**
 * GitHub Copilot CLI Provider
 *
 * SECURITY MODEL:
 * - Authentication: Delegates to `gh auth` stored credentials (system keychain)
 * - No tokens: This provider never receives, stores, or transmits credentials
 * - Process isolation: Each CLI invocation is a separate process
 * - Shell safety: Uses spawn with shell:false to prevent injection
 */
```

---

## 4. Error Message Exposure

### 4.1 Finding: Error Messages May Leak Information (MEDIUM)

**Location**: Section 9.2, `wrapError` function

**Issue**: The design passes through raw error messages that may contain:
- File paths revealing system structure
- User identifiers from auth errors  
- Internal implementation details
- Partial prompts on timeout errors

Example leaky error:
```
Error: Request failed: /Users/john.doe/.config/gh/hosts.yml: permission denied
```

### 4.2 Required Change: Sanitise Error Messages (MANDATORY)

```typescript
private sanitiseErrorMessage(rawError: string, exitCode: number | null): string {
  // Map known patterns to safe messages
  const patterns: Array<[RegExp, string]> = [
    [/command not found|not recognized/i, 
      "GitHub CLI not found. Install from https://cli.github.com/"],
    [/gh.copilot.*not installed|extension.*not found/i, 
      "gh-copilot extension not installed. Run: gh extension install github/gh-copilot"],
    [/401|unauthorized|not logged in|auth.*failed/i, 
      "Not authenticated with GitHub. Run: gh auth login"],
    [/403|forbidden|access denied|permission/i, 
      "Access denied. Ensure you have a valid Copilot licence."],
    [/429|rate.limit|too many requests/i, 
      "Rate limit exceeded. Please wait a moment and try again."],
    [/timeout|timed out|deadline exceeded/i, 
      "Request timed out. Try a shorter prompt or simpler question."],
    [/model.*not found|invalid model|unknown model/i, 
      "Selected model is not available. Please choose a different model."],
    [/network|connection|ENOTFOUND|ECONNREFUSED/i, 
      "Network error. Please check your internet connection."],
  ];

  const lowerError = rawError.toLowerCase();
  for (const [pattern, safeMessage] of patterns) {
    if (pattern.test(lowerError)) {
      return safeMessage;
    }
  }

  // Generic fallback - never expose raw error
  const exitInfo = exitCode !== null ? ` (exit code: ${exitCode})` : "";
  return `CLI operation failed${exitInfo}. Check that gh copilot is properly configured.`;
}
```

---

## 5. CLI Detection Security

### 5.1 Finding: PATH-based Detection (LOW)

**Location**: Section 4.2, `checkCliStatus`

The design uses `which gh` / `where gh` to find the CLI. This is acceptable but has a minor consideration:

**Risk**: A malicious `gh` binary in PATH could be executed instead of the legitimate one.

**Mitigation**: This is an acceptable risk because:
1. If PATH is compromised, many other attacks are possible
2. The user has already trusted their PATH for `gh auth`
3. Obsidian itself relies on system PATH

**Recommendation** (non-blocking): Optionally allow users to configure explicit gh path in settings:

```typescript
// Optional future enhancement
interface GhCopilotSettings {
  ghPath?: string;  // Override PATH lookup
}
```

---

## 6. Resource Exhaustion

### 6.1 Finding: Appropriate Limits Set (LOW)

The design includes reasonable limits:
- ✅ 2-minute timeout
- ✅ 10MB buffer limit
- ✅ Single request (no parallel CLI invocations)

### 6.2 Recommendation: Add Process Cleanup

Ensure child processes are cleaned up on plugin unload:

```typescript
private activeProcess: ChildProcess | null = null;

public onUnload(): void {
  if (this.activeProcess) {
    this.activeProcess.kill("SIGTERM");
    this.activeProcess = null;
  }
}

private async invokeCopilotCli(prompt: string, model: string): Promise<string> {
  // Prevent concurrent invocations
  if (this.activeProcess) {
    throw new Error("A request is already in progress. Please wait.");
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn("gh", ["copilot", "-p", prompt, "--model", model], {
      shell: false,
      timeout: 120000,
    });
    
    this.activeProcess = child;
    
    // ... rest of implementation
    
    child.on("close", () => {
      this.activeProcess = null;
      // ... handle result
    });
  });
}
```

---

## 7. Platform-Specific Considerations

### 7.1 Windows Security

**Issue**: Windows has different process spawning behaviour.

**Requirements**:
- Use `windowsHide: true` to prevent command window flash
- Ensure `.exe` extension handling (Node.js handles this automatically)
- Test with PowerShell and CMD

```typescript
const spawnOptions: SpawnOptions = {
  shell: false,
  timeout: 120000,
  windowsHide: true,
  // Windows: Ensure proper environment inheritance
  env: { ...process.env },
};
```

### 7.2 macOS Electron Security

**Issue**: Obsidian on macOS may have hardened runtime restrictions.

**Consideration**: Ensure `gh` is accessible from Electron's sandbox. This should work because:
- Obsidian has necessary entitlements for process spawning
- `gh` is typically in `/usr/local/bin` which is accessible

---

## 8. Summary of Required Changes

### 8.1 Blocking Changes (Must Fix Before Implementation)

| # | Change | Location | Rationale |
|---|--------|----------|-----------|
| 1 | Use `spawn` with `shell: false` | `invokeCopilotCli` | Prevent shell injection |
| 2 | Remove `escapeShellArg` function | Section 6.2 | Unnecessary and insufficient |
| 3 | Add `sanitiseErrorMessage` | Error handling | Prevent info leakage |
| 4 | Remove `exec`/`execAsync` usage | All CLI invocations | Prevent injection |

### 8.2 Recommended Changes (Should Fix)

| # | Change | Location | Rationale |
|---|--------|----------|-----------|
| 5 | Add process cleanup on unload | Provider class | Resource management |
| 6 | Add concurrency guard | `invokeCopilotCli` | Prevent race conditions |
| 7 | Add security model documentation | Class JSDoc | Maintainer awareness |
| 8 | Use `windowsHide: true` | Spawn options | UX on Windows |

---

## 9. Recommended Implementation Pattern

Here is the security-hardened version of the core method:

```typescript
import { spawn, type ChildProcess } from "child_process";

/**
 * GitHub Copilot CLI Provider
 *
 * SECURITY MODEL:
 * - Authentication: Delegates to `gh auth` stored credentials (system keychain)
 * - No tokens: This provider never receives, stores, or transmits credentials
 * - Process isolation: Each CLI invocation is a separate process
 * - Shell safety: Uses spawn with shell:false to prevent injection
 */
export class GhCopilotCliProvider extends BaseProvider {
  private activeProcess: ChildProcess | null = null;

  /**
   * Invoke the gh copilot CLI securely
   * 
   * SECURITY: Uses spawn with shell:false - arguments are passed directly
   * to the executable without shell interpretation, preventing injection.
   */
  private async invokeCopilotCli(prompt: string, model: string): Promise<string> {
    if (this.activeProcess) {
      throw new Error("A request is already in progress. Please wait.");
    }

    return new Promise((resolve, reject) => {
      // Arguments passed as array - never shell-interpreted
      const args = ["copilot", "-p", prompt, "--model", model];
      
      const child = spawn("gh", args, {
        shell: false,         // CRITICAL: Prevents shell injection
        timeout: 120000,      // 2 minute timeout
        windowsHide: true,    // No command window on Windows
        env: { ...process.env },
      });

      this.activeProcess = child;
      
      let stdout = "";
      let stderr = "";
      const maxOutput = 10 * 1024 * 1024; // 10MB limit
      
      child.stdout.on("data", (data: Buffer) => {
        if (stdout.length < maxOutput) {
          stdout += data.toString();
        }
      });
      
      child.stderr.on("data", (data: Buffer) => {
        if (stderr.length < maxOutput) {
          stderr += data.toString();
        }
      });
      
      child.on("close", (code) => {
        this.activeProcess = null;
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(this.sanitiseErrorMessage(stderr || `Process exited`, code)));
        }
      });
      
      child.on("error", (err) => {
        this.activeProcess = null;
        reject(new Error(this.sanitiseErrorMessage(err.message, null)));
      });
    });
  }

  /**
   * Clean up on plugin unload
   */
  public onUnload(): void {
    if (this.activeProcess) {
      this.activeProcess.kill("SIGTERM");
      this.activeProcess = null;
    }
  }

  /**
   * Sanitise error messages to prevent information leakage
   * Never expose raw CLI output, file paths, or user identifiers
   */
  private sanitiseErrorMessage(rawError: string, exitCode: number | null): string {
    const patterns: Array<[RegExp, string]> = [
      [/command not found|not recognized|ENOENT/i, 
        "GitHub CLI not found. Install from https://cli.github.com/"],
      [/gh.copilot.*not|extension.*not found/i, 
        "gh-copilot extension not installed. Run: gh extension install github/gh-copilot"],
      [/401|unauthorized|not logged in|auth.*fail/i, 
        "Not authenticated with GitHub. Run: gh auth login"],
      [/403|forbidden|access denied|permission denied/i, 
        "Access denied. Ensure you have a valid Copilot licence."],
      [/429|rate.limit|too many/i, 
        "Rate limit exceeded. Please wait and try again."],
      [/timeout|timed out|ETIMEDOUT/i, 
        "Request timed out. Try a shorter prompt."],
      [/model.*not found|invalid model/i, 
        "Selected model is not available."],
      [/network|connection|ENOTFOUND|ECONNREFUSED|ENETUNREACH/i, 
        "Network error. Check your internet connection."],
    ];

    for (const [pattern, safeMessage] of patterns) {
      if (pattern.test(rawError)) {
        return safeMessage;
      }
    }

    const exitInfo = exitCode !== null ? ` (code: ${exitCode})` : "";
    return `CLI operation failed${exitInfo}. Verify gh copilot is configured correctly.`;
  }
}
```

---

## 10. Ingka Baseline Compliance

| ADR | Requirement | Status |
|-----|-------------|--------|
| EA-03 | Security requirements addressed | ✅ With required changes |
| EA-07 | No hardcoded credentials | ✅ Delegates to gh auth |
| - | Privacy - user consent | ⚠️ Design should note that prompts are sent to GitHub |

**EA-03 Compliance**: With the required changes (spawn, sanitised errors), this design meets security requirements.

**EA-07 Compliance**: The design correctly avoids storing any credentials. Authentication is fully delegated to the `gh` CLI which uses the system keychain.

**Privacy Note**: Add to user-facing documentation that:
> When using the GitHub Copilot CLI provider, your prompts and note content are sent to GitHub's Copilot service. Review GitHub's privacy policy and your organisation's data handling policies before use.

---

## 11. Review Sign-off

**Security Review**: CONDITIONAL APPROVAL

This design is approved for implementation **contingent on implementing the required changes** listed in Section 8.1.

Once implemented, the design should be re-reviewed before release to verify:
- [ ] `spawn` with `shell: false` is used
- [ ] No `exec` or `execAsync` for CLI invocation  
- [ ] Error messages are sanitised
- [ ] Process cleanup on unload

---

**Reviewer**: Security Agent  
**Date**: 2026-02-01  
**Next Action**: Developer to update design and implementation to address required changes
