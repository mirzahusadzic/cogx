import { useEffect, useState } from 'react';
import { OverlayRegistry } from '../../core/algebra/overlay-registry.js';
import { OverlayInfo } from '../types.js';

interface UseOverlaysOptions {
  pgcRoot: string;
  workbenchUrl?: string;
}

/**
 * Hook to load overlay statuses
 */
export function useOverlays(options: UseOverlaysOptions) {
  const [overlays, setOverlays] = useState<OverlayInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOverlays() {
      try {
        const registry = new OverlayRegistry(
          options.pgcRoot,
          options.workbenchUrl
        );
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
        console.error('Failed to load overlays:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOverlays();
  }, [options.pgcRoot, options.workbenchUrl]);

  return { overlays, loading };
}
