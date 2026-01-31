---
name: accessibility
description: >
  Provides accessibility (a11y) guidance for Obsidian plugin UI components per EA-12.
  Use this skill when implementing or reviewing UI elements to ensure WCAG 2.2 AA
  compliance within the constraints of the Obsidian client.

  Covers keyboard navigation, screen reader support, colour contrast, focus
  management, and Obsidian-specific considerations.
---

# Accessibility (a11y) for Obsidian Plugins

## Purpose

This skill ensures UI components meet WCAG 2.2 AA accessibility standards within the context of an Obsidian plugin. Since the plugin runs inside the Obsidian client, accessibility guidance focuses on what plugin developers can control.

## Obsidian Context

### What Obsidian Provides

The Obsidian client already handles:

- Base application keyboard shortcuts
- Window/application-level screen reader announcements
- System-level reduced motion preferences (partially)
- Base theme contrast ratios
- Platform-specific accessibility features

### What Plugin Developers Control

Plugin code is responsible for:

- Modal dialogs and overlays
- Custom views and panels
- Settings tabs and forms
- Command palette entries
- Status bar items
- Custom UI components

## Keyboard Navigation

### Essential Patterns

```typescript
// ✅ Good: All interactive elements are focusable
const button = containerEl.createEl('button', { text: 'Click me' });

// ✅ Good: Custom interactive element with tabindex
const customControl = containerEl.createEl('div', {
  attr: {
    tabindex: '0',
    role: 'button',
  },
});

// ❌ Bad: Non-focusable interactive element
const clickableDiv = containerEl.createEl('div', { text: 'Click me' });
clickableDiv.addEventListener('click', handler);
// Missing tabindex and keyboard handler!
```

### Keyboard Event Handling

```typescript
// ✅ Good: Handle both click and keyboard
element.addEventListener('click', handleAction);
element.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleAction();
  }
});

// ✅ Good: Escape key closes modals
modal.contentEl.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    modal.close();
  }
});
```

### Focus Order

```typescript
// ✅ Good: Logical focus order (follows DOM order)
containerEl.createEl('input', { attr: { placeholder: 'First field' } });
containerEl.createEl('input', { attr: { placeholder: 'Second field' } });
containerEl.createEl('button', { text: 'Submit' });

// ❌ Bad: Disrupted focus order with positive tabindex
containerEl.createEl('button', { attr: { tabindex: '2' } }); // Avoid!
```

## Screen Reader Support

### ARIA Labels

```typescript
// ✅ Good: Descriptive aria-label for icon buttons
const iconButton = containerEl.createEl('button', {
  cls: 'icon-button',
  attr: {
    'aria-label': 'Open settings',
  },
});
iconButton.createEl('span', { cls: 'icon-gear' });

// ✅ Good: aria-describedby for additional context
const input = containerEl.createEl('input', {
  attr: {
    id: 'timeout-input',
    'aria-describedby': 'timeout-help',
  },
});
containerEl.createEl('span', {
  attr: { id: 'timeout-help' },
  text: 'Enter timeout in seconds (1-60)',
});
```

### Live Regions for Dynamic Content

```typescript
// ✅ Good: Announce status changes to screen readers
const statusRegion = containerEl.createEl('div', {
  attr: {
    'aria-live': 'polite',
    'aria-atomic': 'true',
  },
});

// Update status (will be announced)
function updateStatus(message: string): void {
  statusRegion.textContent = message;
}

// ✅ Good: Announce urgent messages immediately
const alertRegion = containerEl.createEl('div', {
  attr: {
    'aria-live': 'assertive',
    role: 'alert',
  },
});
```

### Semantic HTML

```typescript
// ✅ Good: Use semantic elements
containerEl.createEl('h2', { text: 'Settings' });
containerEl.createEl('nav', { cls: 'sidebar-nav' });
containerEl.createEl('main', { cls: 'content' });
containerEl.createEl('button', { text: 'Save' });

// ❌ Bad: Divs for everything
containerEl.createEl('div', { cls: 'heading', text: 'Settings' });
containerEl.createEl('div', { cls: 'nav' });
containerEl.createEl('div', { cls: 'button', text: 'Save' });
```

## Modal Dialogs

### Focus Trapping

```typescript
import { Modal } from 'obsidian';

export class AccessibleModal extends Modal {
  private focusableElements: HTMLElement[] = [];
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;

  onOpen(): void {
    const { contentEl } = this;

    // Set up modal content
    contentEl.createEl('h2', { text: 'Modal Title' });
    const input = contentEl.createEl('input', { type: 'text' });
    const closeButton = contentEl.createEl('button', { text: 'Close' });

    // Gather focusable elements
    this.focusableElements = Array.from(
      contentEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );

    this.firstFocusable = this.focusableElements[0] ?? null;
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1] ?? null;

    // Focus first element
    this.firstFocusable?.focus();

    // Trap focus within modal
    contentEl.addEventListener('keydown', this.handleKeydown.bind(this));

    closeButton.addEventListener('click', () => this.close());
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === this.firstFocusable) {
          e.preventDefault();
          this.lastFocusable?.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === this.lastFocusable) {
          e.preventDefault();
          this.firstFocusable?.focus();
        }
      }
    }

    if (e.key === 'Escape') {
      this.close();
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
```

### Modal ARIA Attributes

```typescript
onOpen(): void {
  const { contentEl, modalEl } = this;

  // Add ARIA attributes to modal
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-labelledby', 'modal-title');

  contentEl.createEl('h2', {
    text: 'Confirm Action',
    attr: { id: 'modal-title' },
  });
}
```

## Colour and Contrast

### Rely on Obsidian CSS Variables

```css
/* ✅ Good: Use Obsidian's CSS variables for consistent theming */
.my-component {
  color: var(--text-normal);
  background-color: var(--background-primary);
  border-color: var(--background-modifier-border);
}

.my-component-muted {
  color: var(--text-muted);
}

.my-component-accent {
  color: var(--text-accent);
}

/* ❌ Bad: Hardcoded colours that may not contrast in all themes */
.my-component {
  color: #333333;
  background-color: #ffffff;
}
```

### Don't Rely Solely on Colour

```typescript
// ✅ Good: Status conveyed with icon AND colour AND text
function createStatusIndicator(status: 'success' | 'error'): HTMLElement {
  const container = createEl('span', { cls: `status-${status}` });

  // Icon
  container.createEl('span', {
    cls: status === 'success' ? 'icon-check' : 'icon-x',
    attr: { 'aria-hidden': 'true' },
  });

  // Text
  container.createEl('span', {
    text: status === 'success' ? 'Success' : 'Error',
  });

  return container;
}

// ❌ Bad: Status conveyed only by colour
function createStatusIndicator(status: string): HTMLElement {
  return createEl('span', {
    cls: status === 'success' ? 'green-dot' : 'red-dot',
  });
}
```

## Reduced Motion

### Respect User Preferences

```css
/* ✅ Good: Respect reduced motion preference */
.animated-element {
  transition: transform 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .animated-element {
    transition: none;
  }
}

/* Or use Obsidian's built-in class */
.animated-element {
  transition: transform 0.3s ease;
}

body.reduced-motion .animated-element {
  transition: none;
}
```

```typescript
// ✅ Good: Check preference in JavaScript
function shouldAnimate(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showElement(el: HTMLElement): void {
  if (shouldAnimate()) {
    el.classList.add('fade-in');
  } else {
    el.style.opacity = '1';
  }
}
```

## Form Accessibility

### Labels and Inputs

```typescript
// ✅ Good: Explicit label association
const label = containerEl.createEl('label', {
  text: 'API Endpoint',
  attr: { for: 'api-endpoint' },
});
const input = containerEl.createEl('input', {
  attr: {
    id: 'api-endpoint',
    type: 'text',
    'aria-required': 'true',
  },
});

// ✅ Good: Using Obsidian's Setting component (handles labels internally)
new Setting(containerEl)
  .setName('API Endpoint')
  .setDesc('The URL for API requests')
  .addText((text) => text.setValue(this.settings.endpoint));
```

### Error Messages

```typescript
// ✅ Good: Accessible error message
const input = containerEl.createEl('input', {
  attr: {
    id: 'timeout',
    'aria-describedby': 'timeout-error',
    'aria-invalid': 'true',
  },
});

const errorEl = containerEl.createEl('span', {
  attr: {
    id: 'timeout-error',
    role: 'alert',
  },
  cls: 'error-message',
  text: 'Timeout must be between 1 and 60 seconds',
});
```

### Required Fields

```typescript
// ✅ Good: Indicate required fields accessibly
const input = containerEl.createEl('input', {
  attr: {
    'aria-required': 'true',
    required: '',
  },
});

const label = containerEl.createEl('label', { text: 'Name' });
label.createEl('span', {
  text: ' (required)',
  cls: 'sr-only', // Visually hidden but announced
});
```

## Testing Accessibility

### Manual Testing Checklist

1. **Keyboard-only navigation**
   - Tab through all interactive elements
   - Verify focus is visible at all times
   - Confirm Enter/Space activates buttons
   - Check Escape closes modals

2. **Screen reader testing**
   - macOS: VoiceOver (Cmd+F5)
   - Windows: NVDA (free) or Narrator
   - Verify all content is announced
   - Check form labels are read

3. **Visual testing**
   - Switch between light and dark themes
   - Check contrast in both modes
   - Verify nothing relies solely on colour

4. **Motion sensitivity**
   - Enable reduced motion in OS settings
   - Verify animations are disabled

### Automated Tools

```bash
# Install axe-core for automated testing
npm install --save-dev @axe-core/playwright

# Or use browser extensions:
# - axe DevTools (Chrome/Firefox)
# - WAVE Evaluation Tool
# - Accessibility Insights
```

## Quick Reference

### ARIA Roles for Common Patterns

| Pattern | Role | Notes |
| ------- | ---- | ----- |
| Modal dialog | `dialog` | Add `aria-modal="true"` |
| Alert message | `alert` | Announced immediately |
| Status update | `status` | Announced politely |
| Tab panel | `tabpanel` | With `tablist` and `tab` |
| Menu | `menu` | With `menuitem` children |
| Toolbar | `toolbar` | Group of controls |

### Keyboard Shortcuts

| Key | Expected Behavior |
| --- | ----------------- |
| Tab | Move to next focusable element |
| Shift+Tab | Move to previous focusable element |
| Enter | Activate button/link |
| Space | Activate button, toggle checkbox |
| Escape | Close modal/dropdown |
| Arrow keys | Navigate within components |

## Checklist for UI Components

Before submitting UI code for review:

- [ ] All interactive elements are keyboard accessible
- [ ] Focus is visible and logical
- [ ] Screen reader announces all content appropriately
- [ ] ARIA labels provided for icon-only buttons
- [ ] Colour is not the only means of conveying information
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Form fields have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Modal dialogs trap focus correctly
- [ ] Uses Obsidian CSS variables for theming
