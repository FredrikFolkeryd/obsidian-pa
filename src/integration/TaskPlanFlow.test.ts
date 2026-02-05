/**
 * Integration Tests for Task Plan Flow
 *
 * Tests the end-to-end flow of task plan detection, approval, and execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseTaskPlanBlocks } from "../chat/TaskPlanBlockParser";
import { createTaskExecutor, TaskHistoryManager } from "../tasks";
import { SafeVaultAccess } from "../vault/SafeVaultAccess";
import { VaultBackup } from "../vault/VaultBackup";
import type { PASettings } from "../settings";
import type { App, TFile, Vault, TFolder } from "obsidian";
import { TFile as MockTFile, Vault as MockVault } from "../__mocks__/obsidian";

describe("Task Plan Flow E2E", () => {
  let settings: PASettings;
  let mockApp: Partial<App>;
  let mockVault: MockVault;
  let safeVault: SafeVaultAccess;
  let vaultBackup: VaultBackup;
  let taskHistory: TaskHistoryManager;
  let fileContents: Record<string, string>;

  // Helper to create mock files
  const createMockFile = (path: string): MockTFile => {
    const file = new MockTFile();
    file.path = path;
    file.basename = path.split("/").pop()?.replace(".md", "") ?? "";
    file.stat = { mtime: Date.now(), ctime: Date.now(), size: 100 };
    return file;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    fileContents = {
      "notes/existing.md": "# Existing Note\n\nSome content here.",
    };

    settings = {
      consentEnabled: true,
      consentMode: "opt-in",
      includedFolders: ["notes", "projects", "archive"],
      excludedFolders: [],
      chatOnlyMode: false,
      model: "gpt-4o",
      authMethod: "direct",
      provider: "github-models",
      usageDate: "",
      usageRequests: 0,
      conversationHistory: [],
      maxHistoryMessages: 50,
    };

    const files = Object.keys(fileContents).map((path) => createMockFile(path));

    mockVault = new MockVault();
    mockVault.read = vi.fn().mockImplementation((file: TFile) => {
      return Promise.resolve(fileContents[file.path] ?? "");
    });
    mockVault.modify = vi.fn().mockImplementation((file: TFile, content: string) => {
      fileContents[file.path] = content;
      return Promise.resolve();
    });
    mockVault.create = vi.fn().mockImplementation((path: string, content: string) => {
      fileContents[path] = content;
      const file = createMockFile(path);
      return Promise.resolve(file);
    });
    mockVault.delete = vi.fn().mockResolvedValue(undefined);
    mockVault.rename = vi.fn().mockResolvedValue(undefined);
    mockVault.getAbstractFileByPath = vi.fn().mockImplementation((path: string) =>
      files.find((f) => f.path === path) ?? null
    );
    mockVault.getMarkdownFiles = vi.fn(() => files) as typeof mockVault.getMarkdownFiles;
    mockVault.getRoot = vi.fn(() => ({ path: "/" }) as TFolder);

    mockApp = {
      vault: mockVault as unknown as Vault,
    };

    safeVault = new SafeVaultAccess(mockApp as App, settings);
    vaultBackup = safeVault.getBackup();
    taskHistory = new TaskHistoryManager();
  });

  describe("Task Plan Detection", () => {
    it("should detect task plan in AI response", () => {
      const aiResponse = `
I'll create a new project structure for you.

\`\`\`task-plan
<task-plan name="Create project notes" description="Create project notes">
  <step type="create-note" path="projects/new-project.md">
    Create new project note
    <content>
# New Project

Initial project structure.
    </content>
  </step>
</task-plan>
\`\`\`

This will set up your project folder.
      `;

      const result = parseTaskPlanBlocks(aiResponse);
      expect(result.hasPlans).toBe(true);
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].plan.description).toBe("Create project notes");
      expect(result.plans[0].plan.steps).toHaveLength(1);
    });

    it("should detect multiple task plans", () => {
      const aiResponse = `
First plan:
<task-plan name="Archive old notes" description="Archive old notes">
  <step type="create-note" path="archive/old.md">
    Archive note
    <content>Archived</content>
  </step>
</task-plan>

Second plan:
<task-plan name="Tag active notes" description="Tag active notes">
  <step type="create-note" path="notes/active.md">
    Active note
    <content>Active</content>
  </step>
</task-plan>
      `;

      const result = parseTaskPlanBlocks(aiResponse);
      expect(result.hasPlans).toBe(true);
      expect(result.plans).toHaveLength(2);
    });

    it("should handle plans with validation issues", () => {
      const aiResponse = `
<task-plan name="Plan with issues" description="Plan with issues">
  <step type="create-note" path="notes/test.md">
    Create note
    <content>Test content</content>
  </step>
</task-plan>
      `;

      const result = parseTaskPlanBlocks(aiResponse);
      // Even if there are warnings, should still detect the plan
      expect(result.hasPlans).toBe(true);
    });
  });

  describe("Task Execution", () => {
    it("should execute create-note step", async () => {
      safeVault.enableWrites();

      const executor = createTaskExecutor(mockApp as App, safeVault, vaultBackup);

      const plan = {
        id: "test-plan-1",
        description: "Create test note",
        status: "pending" as const,
        steps: [
          {
            id: "step-1",
            type: "create-note" as const,
            description: "Create new note",
            status: "pending" as const,
            params: { path: "notes/new.md", content: "# New Note" },
          },
        ],
        createdAt: Date.now(),
      };

      const approved = executor.approve(plan);
      const executed = await executor.execute(approved);

      expect(executed.status).toBe("completed");
      expect(executed.steps[0].status).toBe("completed");
      expect(mockVault.create).toHaveBeenCalledWith("notes/new.md", "# New Note");
    });

    it("should track execution in history", async () => {
      safeVault.enableWrites();

      const executor = createTaskExecutor(mockApp as App, safeVault, vaultBackup);

      const plan = {
        id: "test-plan-2",
        description: "Test history tracking",
        status: "pending" as const,
        steps: [
          {
            id: "step-1",
            type: "create-note" as const,
            description: "Create note",
            status: "pending" as const,
            params: { path: "notes/tracked.md", content: "Tracked content" },
          },
        ],
        createdAt: Date.now(),
      };

      const approved = executor.approve(plan);
      const executed = await executor.execute(approved);

      taskHistory.addEntry(executed, "completed");

      expect(taskHistory.getCount()).toBe(1);
      expect(taskHistory.getEntriesByStatus("completed")).toHaveLength(1);
    });

    it("should emit events during execution", async () => {
      safeVault.enableWrites();

      const executor = createTaskExecutor(mockApp as App, safeVault, vaultBackup);
      const events: string[] = [];

      executor.on((event) => {
        events.push(event.type);
      });

      const plan = {
        id: "test-plan-3",
        description: "Event test",
        status: "pending" as const,
        steps: [
          {
            id: "step-1",
            type: "create-note" as const,
            description: "Create note",
            status: "pending" as const,
            params: { path: "notes/events.md", content: "Event test" },
          },
        ],
        createdAt: Date.now(),
      };

      const approved = executor.approve(plan);
      await executor.execute(approved);

      expect(events).toContain("plan-approved");
      expect(events).toContain("execution-started");
      expect(events).toContain("step-started");
      expect(events).toContain("step-completed");
      expect(events).toContain("execution-completed");
    });

    it("should handle step failure gracefully", async () => {
      safeVault.enableWrites();

      // Make create fail
      mockVault.create = vi.fn().mockRejectedValue(new Error("Disk full"));

      const executor = createTaskExecutor(mockApp as App, safeVault, vaultBackup);

      const plan = {
        id: "test-plan-4",
        description: "Failure test",
        status: "pending" as const,
        steps: [
          {
            id: "step-1",
            type: "create-note" as const,
            description: "Create note",
            status: "pending" as const,
            params: { path: "notes/fail.md", content: "This will fail" },
          },
          {
            id: "step-2",
            type: "create-note" as const,
            description: "This should be skipped",
            status: "pending" as const,
            params: { path: "notes/skipped.md", content: "Skipped" },
          },
        ],
        createdAt: Date.now(),
      };

      const approved = executor.approve(plan);
      const executed = await executor.execute(approved);

      expect(executed.status).toBe("failed");
      expect(executed.steps[0].status).toBe("failed");
      expect(executed.steps[1].status).toBe("skipped");
    });
  });

  describe("Full Flow", () => {
    it("should complete full task plan lifecycle", async () => {
      // 1. AI response with task plan
      const aiResponse = `
I'll help you organize your project.

\`\`\`task-plan
<task-plan name="Set up project structure" description="Set up project structure">
  <step type="create-note" path="projects/readme.md">
    Create README
    <content>
# Project README

This is the main project documentation.
    </content>
  </step>
</task-plan>
\`\`\`
      `;

      // 2. Parse the response
      const parseResult = parseTaskPlanBlocks(aiResponse);
      expect(parseResult.hasPlans).toBe(true);

      const plan = parseResult.plans[0].plan;

      // 3. Create executor
      safeVault.enableWrites();
      const executor = createTaskExecutor(mockApp as App, safeVault, vaultBackup);

      // 4. Approve and execute
      const approved = executor.approve(plan);
      const executed = await executor.execute(approved);

      // 5. Track in history
      if (executed.status === "completed") {
        taskHistory.addEntry(executed, "completed");
      } else {
        taskHistory.addEntry(executed, "failed", executed.error);
      }

      // 6. Verify results
      expect(executed.status).toBe("completed");
      expect(taskHistory.getCount()).toBe(1);

      // Verify file was created
      expect(mockVault.create).toHaveBeenCalled();
    });
  });
});
