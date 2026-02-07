# Developer Work Item: Context Auto-Update Fix

## Task
Implement automatic context updates when workspace changes in Obsidian.

## Bug Description
Context is not automatically updated when new files are opened in Obsidian. Users have to manually add files to context even when they're visible in the editor.

## Implementation Plan

### 1. Add Event Listener Registration (in `onOpen()`)
- Register `active-leaf-change` event listener
- Register `layout-change` event listener  
- Register `file-open` event listener
- Use `this.registerEvent()` for proper cleanup

### 2. Create Auto-Refresh Handler
- Create `refreshContextIndicator()` method
- Check if manual context is set (via `contextManager.getSelectedItems().length > 0`)
- If no manual context: update indicator with current visible files
- If manual context is set: preserve it (no auto-update)

### 3. Update Context Indicator Logic
- Refactor existing context update logic to use new refresh method
- Ensure manual selection always takes precedence

### 4. Testing Considerations
- Single pane file switching
- Split view with multiple files
- New file creation
- Manual context mode preservation
- Event listener cleanup

## Files to Modify
- `src/views/ChatView.ts` - Main implementation

## Implementation Approach

The key insight is:
- Manual context: `contextManager.getSelectedItems().length > 0`
- Auto context: `contextManager.getSelectedItems().length === 0`

When auto context is active, workspace events should trigger a context indicator refresh.

## Progress

- [x] Add event listener registration in `onOpen()`
- [x] Create `refreshContextIndicator()` method
- [x] Test with single pane switching
- [x] Test with split view
- [x] Test manual context preservation
- [x] Run linter
- [x] Run tests
- [x] Build successfully

## Implementation Summary

### Changes Made

1. **Updated `onOpen()` method** (lines 66-87):
   - Added three event listener registrations using `this.registerEvent()`
   - `active-leaf-change` - fires when user switches between files
   - `layout-change` - fires when workspace splits/panes are modified
   - `file-open` - fires when a new file is opened
   - All listeners call the new `refreshContextIndicator()` method

2. **Added `refreshContextIndicator()` method** (lines 1227-1245):
   - Checks if manual context is set via `contextManager.getSelectedItems()`
   - If manual context exists (length > 0), preserves it and returns early
   - If no manual context (auto mode), updates indicator with current visible files
   - Respects file consent settings via `isFileAllowed()`

### Testing Results

- ✅ Linting: Passed with no errors
- ✅ Tests: All 670 tests passed
- ✅ Build: Successful
- ✅ Coverage: Maintained at 80%+ for core functionality

### How It Works

1. When the chat view opens, workspace event listeners are registered
2. When workspace changes occur (file switch, layout change, new file):
   - `refreshContextIndicator()` is called
   - If user has manual context → no change (preserves user intent)
   - If using auto context → updates to show current visible files
3. Context indicator UI reflects real-time workspace state
4. Event listeners are automatically cleaned up via `this.registerEvent()` when view closes

## Notes
- Using `this.registerEvent()` ensures automatic cleanup when view closes
- The `ContextManager` already tracks selected items, making it easy to distinguish manual vs auto
- Preserving the current behavior for manual selection is critical
- Minimal changes: only 2 additions (event registration + refresh method)
- No breaking changes to existing functionality
