/**
 * Overlay Status Hook
 *
 * React hook for loading and tracking overlay metadata from the Grounded Context Pool (PGC).
 * Provides real-time status information about which overlays have data and their item counts.
 *
 * DESIGN:
 * This hook bridges the PGC overlay system with React state management:
 * - Loads overlay metadata on mount from OverlayRegistry
 * - Checks data availability for each overlay (O1-O7)
 * - Computes item counts for populated overlays
 * - Updates state with enriched overlay information
 *
 * Use this for dashboard views, status displays, and overlay selection interfaces.
 *
 * @example
 * // Load overlays from PGC root directory
 * const { overlays, loading } = useOverlays({
 *   pgcRoot: '/home/user/project/.open_cognition',
 *   workbenchUrl: 'http://localhost:8000'
 * });
 *
 * @example
 * // Display overlay status in UI
 * {overlays.map(overlay => (
 *   <Box key={overlay.id}>
 *     <Text>{overlay.name}: {overlay.hasData ? `${overlay.itemCount} items` : 'empty'}</Text>
 *   </Box>
 * ))}
 */

import { useEffect, useState, useRef } from 'react';
import { OverlayRegistry } from '../../core/algebra/overlay-registry.js';
import { OverlayInfo } from '../types.js';
import { systemLog } from '../../utils/debug-logger.js';

/**
 * Configuration options for useOverlays hook
 */
interface UseOverlaysOptions {
  /**
   * Path to Grounded Context Pool (PGC) root directory
   * Typically .open_cognition/ in project root
   */
  pgcRoot: string;

  /**
   * URL of workbench embedding service
   * @default 'http://localhost:8000'
   */
  workbenchUrl?: string;
}

/**
 * Loads and tracks overlay status from the Grounded Context Pool (PGC).
 *
 * This hook performs parallel loading of overlay metadata:
 * 1. Retrieves overlay definitions from registry (O1-O7)
 * 2. Checks data availability for each overlay
 * 3. Computes item counts for populated overlays
 * 4. Returns enriched overlay information with loading state
 *
 * ALGORITHM:
 * - Uses Promise.all to check all overlays concurrently
 * - Gracefully handles errors (missing overlays, access failures)
 * - Updates state once all checks complete
 *
 * @param options - Configuration for PGC location and workbench URL
 * @returns Object containing overlay array and loading state
 *
 * @example
 * // Basic usage in TUI component
 * const { overlays, loading } = useOverlays({
 *   pgcRoot: path.join(cwd, '.open_cognition')
 * });
 *
 * if (loading) return <Spinner />;
 *
 * return (
 *   <Box>
 *     {overlays.filter(o => o.hasData).map(overlay => (
 *       <Text key={overlay.id}>
 *         {overlay.name}: {overlay.itemCount} items
 *       </Text>
 *     ))}
 *   </Box>
 * );
 */
export function useOverlays(options: UseOverlaysOptions) {
  // Destructure options to get stable primitive dependencies
  const { pgcRoot, workbenchUrl } = options;
  const [overlays, setOverlays] = useState<OverlayInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Guard to prevent multiple simultaneous loads
  const loadingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      return;
    }

    // Only run once on mount
    if (mountedRef.current) {
      return;
    }

    mountedRef.current = true;
    loadingRef.current = true;

    async function loadOverlays() {
      try {
        const registry = new OverlayRegistry(pgcRoot, workbenchUrl);
        const overlayInfoList = registry.getOverlayInfo();

        const overlaysWithStatus = await Promise.all(
          overlayInfoList.map(async (info) => {
            const hasData = await registry.hasData(info.id);
            let itemCount = 0;

            if (hasData) {
              try {
                const manager = await registry.get(info.id);
                const items = await manager.getAllItems();
                itemCount = items.length;
              } catch {
                // Ignore errors getting item count
              }
            }

            return {
              id: info.id,
              name: info.name,
              description: info.description,
              hasData,
              itemCount,
            };
          })
        );

        setOverlays(overlaysWithStatus);
      } catch (err) {
        systemLog(
          'tui',
          'Failed to load overlays:',
          {
            error: err instanceof Error ? err.message : String(err),
          },
          'error'
        );
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    }

    loadOverlays();
  }, [pgcRoot, workbenchUrl]);

  return { overlays, loading };
}
