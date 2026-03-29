/**
 * Tests for PAPlugin onload behaviour
 *
 * Verifies that the plugin defers expensive async work (CLI spawns,
 * token resolution) until after the workspace layout is ready, so
 * onload() returns quickly and Obsidian does not show a slow-load
 * warning.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import PAPlugin from "./main";

// Stub document for addRibbonIcon (node environment has no DOM)
vi.stubGlobal("document", {
  createElement: vi.fn().mockReturnValue({}),
});

describe("PAPlugin", () => {
  let plugin: PAPlugin;
  let triggerLayoutReady: () => void;

  beforeEach(() => {
    // Construct the plugin (the mock Plugin class creates its own App)
    plugin = new PAPlugin(
      undefined as never,
      { id: "obsidian-pa", version: "0.0.0" } as never,
    );

    // Override onLayoutReady on the plugin's actual app to capture the callback
    let layoutReadyCallback: (() => void) | null = null;
    plugin.app.workspace.onLayoutReady = (cb: () => void): void => {
      layoutReadyCallback = cb;
    };
    triggerLayoutReady = () => {
      layoutReadyCallback?.();
    };

    // Stub out vault adapter so getStoredToken / storeToken don't blow up
    (plugin.app.vault as unknown as Record<string, unknown>).adapter = {};
  });

  describe("onload", () => {
    it("should not call initializeApiClient during onload", async () => {
      const initSpy = vi.spyOn(plugin, "initializeApiClient");

      await plugin.onload();

      // initializeApiClient must NOT have been called synchronously
      expect(initSpy).not.toHaveBeenCalled();
    });

    it("should call initializeApiClient after layout is ready", async () => {
      const initSpy = vi.spyOn(plugin, "initializeApiClient").mockResolvedValue();

      await plugin.onload();
      expect(initSpy).not.toHaveBeenCalled();

      // Simulate layout becoming ready
      triggerLayoutReady();

      // Allow the fire-and-forget promise to settle
      await vi.waitFor(() => {
        expect(initSpy).toHaveBeenCalledOnce();
      });
    });
  });
});
