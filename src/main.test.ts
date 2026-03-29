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
import { WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_CHAT } from "./views/ChatView";

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

  describe("activateChatView", () => {
    it("should call ensureSideLeaf with correct parameters when configured", async () => {
      await plugin.onload();

      // Make isConfigured return true
      vi.spyOn(plugin as unknown as { isConfigured: () => Promise<boolean> }, "isConfigured")
        .mockResolvedValue(true);

      const ensureSpy = vi.fn().mockResolvedValue(new WorkspaceLeaf());
      plugin.app.workspace.ensureSideLeaf = ensureSpy;

      plugin.activateChatView();

      // Allow the async call to settle
      await vi.waitFor(() => {
        expect(ensureSpy).toHaveBeenCalledOnce();
      });

      expect(ensureSpy).toHaveBeenCalledWith(VIEW_TYPE_CHAT, "right", {
        active: true,
        reveal: true,
      });
    });

    it("should not call ensureSideLeaf when not configured", async () => {
      await plugin.onload();

      // Make isConfigured return false
      vi.spyOn(plugin as unknown as { isConfigured: () => Promise<boolean> }, "isConfigured")
        .mockResolvedValue(false);

      const ensureSpy = vi.fn().mockResolvedValue(new WorkspaceLeaf());
      plugin.app.workspace.ensureSideLeaf = ensureSpy;

      plugin.activateChatView();

      // Give time for the async call to settle
      await new Promise((r) => setTimeout(r, 50));

      expect(ensureSpy).not.toHaveBeenCalled();
    });
  });
});
