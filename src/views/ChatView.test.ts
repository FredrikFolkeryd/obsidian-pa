import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MarkdownRenderer, type WorkspaceLeaf } from "obsidian";
import { ChatView } from "./ChatView";
import type PAPlugin from "../main";

vi.stubGlobal("document", {
  createElement: vi.fn().mockImplementation(() => ({
    appendChild: vi.fn(),
  })),
});

vi.mock("../context", () => ({
  ContextManager: vi.fn().mockImplementation(() => ({
    getSelectedItems: vi.fn().mockReturnValue([]),
    setSelectedItemsDirect: vi.fn(),
  })),
  ContextPickerModal: class MockContextPickerModal {},
  getTokenBudgetForModel: vi.fn().mockReturnValue(10000),
  formatTokenCount: vi.fn().mockReturnValue("0"),
}));

vi.mock("../tasks", () => ({
  createTaskExecutor: vi.fn(),
  TaskHistoryManager: vi.fn().mockImplementation(() => ({})),
}));

type ChatRole = "assistant" | "user" | "system";

interface RenderedMessageElement {
  createDiv: Mock;
}

interface RenderedContentElement {
  setText: Mock;
  addClass: Mock;
  createSpan: Mock;
}

describe("ChatView message content classes", () => {
  let view: ChatView;

  beforeEach(() => {
    vi.clearAllMocks();
    view = new ChatView({} as WorkspaceLeaf, { settings: {} } as PAPlugin);
  });

  function setupMessageContainer(): {
    setOnView: () => void;
    messageEl: RenderedMessageElement;
    contentEl: RenderedContentElement;
  } {
    const copyButton = { dataset: {}, innerHTML: "", addEventListener: vi.fn() };

    const headerEl = {
      createDiv: vi.fn(),
      createEl: vi.fn().mockReturnValue(copyButton),
    };

    const contentEl: RenderedContentElement = {
      setText: vi.fn(),
      addClass: vi.fn(),
      createSpan: vi.fn(),
    };

    const messageEl: RenderedMessageElement = {
      createDiv: vi.fn((options?: { cls?: string }) => {
        if (options?.cls === "pa-chat-message-header") {
          return headerEl;
        }
        return contentEl;
      }),
    };

    const container = {
      createDiv: vi.fn().mockReturnValue(messageEl),
      scrollTop: 0,
      scrollHeight: 100,
    };

    const setOnView = (): void => {
      (
        view as unknown as {
          messagesContainerEl: typeof container;
        }
      ).messagesContainerEl = container;
    };

    return { setOnView, messageEl, contentEl };
  }

  function createMessage(role: ChatRole): {
    id: string;
    role: ChatRole;
    content: string;
    timestamp: Date;
  } {
    return {
      id: `${role}-id`,
      role,
      content: `${role} content`,
      timestamp: new Date(),
    };
  }

  it("applies Obsidian markdown classes for assistant messages in normal render", () => {
    const { setOnView, messageEl } = setupMessageContainer();
    setOnView();
    const markdownRenderSpy = vi.spyOn(MarkdownRenderer, "render").mockResolvedValue(undefined);

    (
      view as unknown as {
        renderMessage: (message: ReturnType<typeof createMessage>) => void;
      }
    ).renderMessage(createMessage("assistant"));

    const contentCall = messageEl.createDiv.mock.calls.find(
      ([options]: [{ cls?: string }]) => options?.cls?.includes("pa-chat-message-content")
    );
    expect(contentCall?.[0]?.cls).toBe("pa-chat-message-content markdown-rendered markdown-preview-view");
    expect(markdownRenderSpy).toHaveBeenCalledOnce();
  });

  it("keeps base class for user and system messages in normal render", () => {
    const user = setupMessageContainer();
    user.setOnView();
    (
      view as unknown as {
        renderMessage: (message: ReturnType<typeof createMessage>) => void;
      }
    ).renderMessage(createMessage("user"));

    const userContentCall = user.messageEl.createDiv.mock.calls.find(
      ([options]: [{ cls?: string }]) => options?.cls?.includes("pa-chat-message-content")
    );
    expect(userContentCall?.[0]?.cls).toBe("pa-chat-message-content");

    const system = setupMessageContainer();
    system.setOnView();
    (
      view as unknown as {
        renderMessage: (message: ReturnType<typeof createMessage>) => void;
      }
    ).renderMessage(createMessage("system"));

    const systemContentCall = system.messageEl.createDiv.mock.calls.find(
      ([options]: [{ cls?: string }]) => options?.cls?.includes("pa-chat-message-content")
    );
    expect(systemContentCall?.[0]?.cls).toBe("pa-chat-message-content");
  });

  it("applies Obsidian markdown classes for assistant messages in streaming render", () => {
    const { setOnView, messageEl, contentEl } = setupMessageContainer();
    setOnView();

    (
      view as unknown as {
        renderStreamingMessage: (message: ReturnType<typeof createMessage>) => HTMLElement;
      }
    ).renderStreamingMessage(createMessage("assistant"));

    const contentCall = messageEl.createDiv.mock.calls.find(
      ([options]: [{ cls?: string }]) => options?.cls?.includes("pa-chat-message-content")
    );
    expect(contentCall?.[0]?.cls).toBe("pa-chat-message-content markdown-rendered markdown-preview-view");
    expect(contentEl.addClass).toHaveBeenCalledWith("pa-chat-streaming");
  });
});
