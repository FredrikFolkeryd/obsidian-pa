/**
 * 1Password CLI credential resolver
 *
 * Resolves credentials from 1Password using the `op` CLI and secret references.
 * Secret references have the format: op://vault/item/field
 *
 * @see https://developer.1password.com/docs/cli/secret-references
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Result of credential resolution
 */
export interface CredentialResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Check if a string is a 1Password secret reference
 */
export function isOnePasswordReference(value: string): boolean {
  return value.startsWith("op://");
}

/**
 * Check if the 1Password CLI is installed
 */
export async function isOnePasswordCliInstalled(): Promise<boolean> {
  try {
    await execAsync("op --version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the user is signed in to 1Password CLI
 */
export async function isOnePasswordSignedIn(): Promise<boolean> {
  try {
    // `op account list` returns accounts if signed in
    const { stdout } = await execAsync("op account list --format=json");
    const accounts = JSON.parse(stdout) as unknown[];
    return accounts.length > 0;
  } catch {
    return false;
  }
}

/**
 * Resolve a 1Password secret reference to its actual value
 *
 * @param reference - The op:// reference (e.g., op://Personal/GitHub-PAT/credential)
 * @returns The resolved credential or an error
 */
export async function resolveOnePasswordSecret(
  reference: string
): Promise<CredentialResult> {
  if (!isOnePasswordReference(reference)) {
    return {
      success: false,
      error: "Not a valid 1Password reference. Must start with op://",
    };
  }

  // Check if op CLI is installed
  const cliInstalled = await isOnePasswordCliInstalled();
  if (!cliInstalled) {
    return {
      success: false,
      error:
        "1Password CLI (op) is not installed. Install it from https://1password.com/downloads/command-line/",
    };
  }

  // Check if signed in
  const signedIn = await isOnePasswordSignedIn();
  if (!signedIn) {
    return {
      success: false,
      error:
        "Not signed in to 1Password CLI. Run 'op signin' in your terminal first.",
    };
  }

  try {
    // Use op read to get the secret
    const { stdout, stderr } = await execAsync(`op read "${reference}"`);

    if (stderr && !stdout.trim()) {
      return {
        success: false,
        error: stderr.trim(),
      };
    }

    const token = stdout.trim();
    if (!token) {
      return {
        success: false,
        error: "Secret reference resolved to empty value",
      };
    }

    return {
      success: true,
      token,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read secret";

    // Parse common errors
    if (message.includes("isn't a vault")) {
      return {
        success: false,
        error: `Vault not found in reference: ${reference}`,
      };
    }
    if (message.includes("isn't an item")) {
      return {
        success: false,
        error: `Item not found in reference: ${reference}`,
      };
    }
    if (message.includes("isn't a field")) {
      return {
        success: false,
        error: `Field not found in reference: ${reference}`,
      };
    }
    if (message.includes("authorization prompt dismissed")) {
      return {
        success: false,
        error: "1Password authorization was dismissed. Please try again.",
      };
    }

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Validate that a 1Password reference is correctly formatted
 */
export function validateOnePasswordReference(reference: string): {
  valid: boolean;
  error?: string;
} {
  if (!reference.startsWith("op://")) {
    return { valid: false, error: "Must start with op://" };
  }

  // Expected format: op://vault/item/field
  const parts = reference.slice(5).split("/");
  if (parts.length < 3) {
    return {
      valid: false,
      error: "Format must be op://vault/item/field",
    };
  }

  const [vault, item, field] = parts;
  if (!vault || !item || !field) {
    return {
      valid: false,
      error: "Vault, item, and field are all required",
    };
  }

  return { valid: true };
}
