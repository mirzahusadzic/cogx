/**
 * Wizard Confirmation Modal Component
 *
 * Dual-mode dialog for onboarding wizard:
 * - confirm: Simple Y/N confirmation
 * - select: Multi-select with arrow/space/enter
 *
 * Uses same visual style as ToolConfirmationModal for consistency.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { systemLog } from '../../utils/debug-logger.js';
import type { WizardConfirmationState } from '../hooks/useOnboardingWizard.js';

export interface WizardConfirmationModalProps {
  state: WizardConfirmationState;
}

/**
 * Wizard Confirmation Modal
 *
 * Keyboard handling is done by parent component (index.tsx).
 * Includes scrolling support for long lists (like CommandDropdown).
 */
const WizardConfirmationModalComponent: React.FC<
  WizardConfirmationModalProps
> = ({ state }) => {
  const {
    mode,
    title,
    message,
    confirmLabel,
    denyLabel,
    items,
    selectedIndex,
  } = state;

  const { stdout } = useStdout();
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate max visible items (max 1/3 of terminal height for selection lists)
  const maxHeight = useMemo(
    () => Math.min(8, Math.floor((stdout?.rows || 24) / 3)),
    [stdout?.rows]
  );

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (mode !== 'select') return;

    const currentIndex = selectedIndex ?? 0;

    // Use functional update to read current scrollOffset without adding to deps
    setScrollOffset((prevOffset) => {
      // Scroll down if selected item is below visible window
      if (currentIndex >= prevOffset + maxHeight) {
        return currentIndex - maxHeight + 1;
      }
      // Scroll up if selected item is above visible window
      else if (currentIndex < prevOffset) {
        return currentIndex;
      }
      // No change needed
      return prevOffset;
    });
  }, [selectedIndex, maxHeight]);

  // DEBUG: Log items to systemLog
  if (mode === 'select' && items && process.env.DEBUG_WIZARD) {
    systemLog(
      'tui',
      `[WizardModal] Rendering ${items.length} items: ${items.map((i) => i.label).join(', ')}`,
      {
        selectedIndex,
        highlighted: items[selectedIndex || 0]?.label,
        scrollOffset,
      },
      'error'
    );
  }

  if (mode === 'select' && items) {
    // Calculate visible window with scroll offset
    const totalItems = items.length;
    const maxOffset = Math.max(0, totalItems - maxHeight);
    const actualOffset = Math.min(scrollOffset, maxOffset);
    const visibleItems = items.slice(actualOffset, actualOffset + maxHeight);
    const hasMore = totalItems > maxHeight;

    // DEBUG: Log visible items calculation
    if (process.env.DEBUG_WIZARD) {
      systemLog(
        'tui',
        `[WizardModal] totalItems: ${totalItems}, maxHeight: ${maxHeight}, actualOffset: ${actualOffset}`,
        {},
        'error'
      );
      systemLog(
        'tui',
        `[WizardModal] visibleItems: ${visibleItems.map((it, idx) => `${idx}:${it.label}`).join(', ')}`,
        {},
        'error'
      );
    }

    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
      >
        {/* Title */}
        <Box>
          <Text color="yellow" bold>
            [?]{' '}
          </Text>
          <Text bold>{title}</Text>
        </Box>

        {/* Selection list - single Text block with nested colored Text to avoid Ink layout bugs */}
        <Box marginLeft={2} marginY={1}>
          <Text>
            {visibleItems.map((item, visibleIdx) => {
              const actualIdx = actualOffset + visibleIdx;
              const isHighlighted = actualIdx === selectedIndex;

              // DEBUG: Log each visible item being rendered
              if (process.env.DEBUG_WIZARD) {
                systemLog(
                  'tui',
                  `[WizardModal] Rendering visible item ${visibleIdx} (actualIdx ${actualIdx}): "${item.label}" description="${item.description}" highlighted=${isHighlighted}`,
                  {},
                  'error'
                );
              }

              const prefix = isHighlighted ? '▸ ' : '  ';
              const checkbox = item.selected ? '[x]' : '[ ]';
              const desc = item.description ? ` - ${item.description}` : '';
              const line = `${prefix}${checkbox} ${item.label}${desc}`;

              if (process.env.DEBUG_WIZARD && item.label === 'dev') {
                systemLog(
                  'tui',
                  `[WizardModal] DEV item line: "${line}"`,
                  {},
                  'error'
                );
              }

              return (
                <Text key={item.id} color={isHighlighted ? 'green' : 'white'}>
                  {line}
                  {'\n'}
                </Text>
              );
            })}
          </Text>
        </Box>

        {/* Footer with scroll indicators */}
        <Box borderTop justifyContent="space-between">
          <Text color="gray" dimColor>
            ↑↓ Navigate | Space Toggle | Enter {confirmLabel} | Esc {denyLabel}
          </Text>
          {hasMore && (
            <Text color="gray" dimColor>
              {actualOffset > 0 && `↑${actualOffset} `}
              {actualOffset < maxOffset && `↓${maxOffset - actualOffset}`}
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  // Confirm mode (simple Y/N)
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      <Box flexDirection="column">
        <Box>
          <Text color="yellow" bold>
            [?]{' '}
          </Text>
          <Text bold>{title}</Text>
        </Box>
        <Box marginLeft={4}>
          <Text dimColor>{message}</Text>
        </Box>
      </Box>

      <Box borderTop justifyContent="space-between" marginTop={1}>
        <Text color="gray" dimColor>
          {confirmLabel} | {denyLabel} | Esc Cancel
        </Text>
      </Box>
    </Box>
  );
};

// Memoize to prevent re-renders from parent cursor blink
export const WizardConfirmationModal = React.memo(
  WizardConfirmationModalComponent,
  (prev, next) => {
    // Only re-render if state actually changed
    if (
      prev.state.pending !== next.state.pending ||
      prev.state.mode !== next.state.mode ||
      prev.state.title !== next.state.title ||
      prev.state.message !== next.state.message ||
      prev.state.selectedIndex !== next.state.selectedIndex ||
      prev.state.items?.length !== next.state.items?.length
    ) {
      return false; // Re-render
    }

    // Deep check items for selection changes and identity
    if (prev.state.items && next.state.items) {
      for (let i = 0; i < prev.state.items.length; i++) {
        if (
          prev.state.items[i].selected !== next.state.items[i].selected ||
          prev.state.items[i].id !== next.state.items[i].id ||
          prev.state.items[i].label !== next.state.items[i].label ||
          prev.state.items[i].description !== next.state.items[i].description
        ) {
          return false; // Re-render if any item changed
        }
      }
    }

    return true; // Skip re-render
  }
);
