/**
 * GitHub OAuth Device Flow Authentication
 *
 * Implements RFC 8628 Device Authorization Grant for "no-touch" token acquisition.
 * User never handles the raw token - they authenticate via GitHub's trusted UI.
 *
 * Flow:
 * 1. Request device code from GitHub
 * 2. User visits github.com/login/device and enters the code
 * 3. Plugin polls for access token
 * 4. Token stored securely - user never sees it
 *
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

// GitHub OAuth App Client ID
// Note: This is a PUBLIC identifier, not a secret. It identifies the app, not the user.
// You must register your own OAuth App at: https://github.com/settings/applications/new
// Set "Device flow" to enabled in the app settings.
const GITHUB_CLIENT_ID = "YOUR_CLIENT_ID_HERE"; // TODO: Replace with registered OAuth App client ID

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const DEVICE_LOGIN_URL = "https://github.com/login/device";

/**
 * Response from device code request
 */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/**
 * Response from token polling
 */
interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

/**
 * Status of the device flow authentication
 */
export interface AuthStatus {
  status: "pending" | "success" | "error" | "expired" | "cancelled";
  userCode?: string;
  verificationUrl?: string;
  token?: string;
  error?: string;
}

/**
 * Callback for auth status updates
 */
export type AuthStatusCallback = (status: AuthStatus) => void;

/**
 * GitHub Device Flow authenticator
 */
export class GitHubDeviceAuth {
  private clientId: string;
  private abortController: AbortController | null = null;

  public constructor(clientId: string = GITHUB_CLIENT_ID) {
    this.clientId = clientId;
  }

  /**
   * Start the device flow authentication
   *
   * @param onStatus - Callback for status updates
   * @param scope - OAuth scopes to request (default: models:read)
   * @returns Promise that resolves with the access token or rejects on error
   */
  public async authenticate(
    onStatus: AuthStatusCallback,
    scope: string = "models:read"
  ): Promise<string> {
    // Cancel any existing auth flow
    this.cancel();
    this.abortController = new AbortController();

    try {
      // Step 1: Request device code
      const deviceCode = await this.requestDeviceCode(scope);

      // Notify user to visit the verification URL
      onStatus({
        status: "pending",
        userCode: deviceCode.user_code,
        verificationUrl: deviceCode.verification_uri,
      });

      // Step 2: Poll for access token
      const token = await this.pollForToken(
        deviceCode.device_code,
        deviceCode.interval,
        deviceCode.expires_in
      );

      onStatus({ status: "success", token });
      return token;
    } catch (error) {
      if (error instanceof Error && error.message === "cancelled") {
        onStatus({ status: "cancelled" });
        throw error;
      }
      if (error instanceof Error && error.message === "expired") {
        onStatus({ status: "expired", error: "Authentication timed out. Please try again." });
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      onStatus({ status: "error", error: errorMessage });
      throw error;
    }
  }

  /**
   * Cancel an in-progress authentication
   */
  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Request a device code from GitHub
   */
  private async requestDeviceCode(scope: string): Promise<DeviceCodeResponse> {
    const response = await fetch(DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        scope,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to request device code: ${response.status}`);
    }

    const data = (await response.json()) as DeviceCodeResponse;
    return data;
  }

  /**
   * Poll GitHub for the access token
   */
  private async pollForToken(
    deviceCode: string,
    interval: number,
    expiresIn: number
  ): Promise<string> {
    const startTime = Date.now();
    const expiresAt = startTime + expiresIn * 1000;
    let pollInterval = interval * 1000; // Convert to milliseconds

    while (Date.now() < expiresAt) {
      // Check if cancelled
      if (this.abortController?.signal.aborted) {
        throw new Error("cancelled");
      }

      // Wait for the interval
      await this.sleep(pollInterval);

      // Check again after sleep
      if (this.abortController?.signal.aborted) {
        throw new Error("cancelled");
      }

      try {
        const response = await fetch(ACCESS_TOKEN_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: this.clientId,
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
        });

        const data = (await response.json()) as TokenResponse;

        if (data.access_token) {
          return data.access_token;
        }

        // Handle specific errors
        switch (data.error) {
          case "authorization_pending":
            // User hasn't authorized yet, keep polling
            break;
          case "slow_down":
            // We're polling too fast, increase interval
            pollInterval = (data.interval ?? interval + 5) * 1000;
            break;
          case "expired_token":
            throw new Error("expired");
          case "access_denied":
            throw new Error("Access denied by user");
          default:
            if (data.error) {
              throw new Error(data.error_description ?? data.error);
            }
        }
      } catch (error) {
        // Re-throw our known errors
        if (
          error instanceof Error &&
          (error.message === "cancelled" ||
            error.message === "expired" ||
            error.message === "Access denied by user")
        ) {
          throw error;
        }
        // Network errors - continue polling
        console.warn("[DeviceAuth] Poll error, retrying:", error);
      }
    }

    throw new Error("expired");
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the URL where user should authenticate
   */
  public getDeviceLoginUrl(): string {
    return DEVICE_LOGIN_URL;
  }

  /**
   * Check if a client ID has been configured
   */
  public isConfigured(): boolean {
    return this.clientId !== "YOUR_CLIENT_ID_HERE" && this.clientId.length > 0;
  }
}

/**
 * Singleton instance for convenience
 */
export const deviceAuth = new GitHubDeviceAuth();
