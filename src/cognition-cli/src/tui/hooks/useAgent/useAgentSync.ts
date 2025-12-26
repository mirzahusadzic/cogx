import { useEffect } from 'react';
import path from 'path';
import fs from 'fs';
import type { AgentState } from './useAgentState.js';
import type { UseSessionManagerResult } from '../session/useSessionManager.js';
import type { UseTurnAnalysisReturn } from '../analysis/useTurnAnalysis.js';
import type { useTokenCount } from '../tokens/useTokenCount.js';

export function useAgentSync(
  state: AgentState & { tokenCounter: ReturnType<typeof useTokenCount> },
  sessionManager: UseSessionManagerResult,
  turnAnalysis: UseTurnAnalysisReturn,
  cwd: string,
  anchorId: string,
  debug: (message: string, ...args: unknown[]) => void
) {
  const {
    latticeLoadedRef,
    setInjectedRecap,
    setMessages,
    conversationRegistryRef,
    lastPersistedTokensRef,
    setOverlayScores,
    currentSessionIdRef,
    tokenCounter,
  } = state;

  const currentSessionIdValue = currentSessionIdRef.current;

  // Load existing conversation lattice
  useEffect(() => {
    const loadLattice = async () => {
      const currentResumeId = sessionManager.getResumeSessionId();
      const sessionId = currentResumeId || anchorId;

      if (latticeLoadedRef.current.has(sessionId)) return;
      latticeLoadedRef.current.add(sessionId);

      try {
        const { rebuildTurnAnalysesFromLanceDB } =
          await import('../../../sigma/lattice-reconstructor.js');

        const restoredAnalyses = await rebuildTurnAnalysesFromLanceDB(
          sessionId,
          cwd
        );

        if (restoredAnalyses.length === 0) return;

        turnAnalysis.setAnalyses(restoredAnalyses);

        const recapPath = path.join(cwd, '.sigma', `${sessionId}.recap.txt`);
        if (fs.existsSync(recapPath)) {
          const recapContent = fs.readFileSync(recapPath, 'utf-8');
          const recapLines = recapContent.split('\n');
          const recapStartIdx = recapLines.findIndex((line) =>
            line.startsWith('='.repeat(80))
          );
          if (recapStartIdx >= 0) {
            setInjectedRecap(recapLines.slice(recapStartIdx + 2).join('\n'));
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            content: `🕸️  Resumed session with ${restoredAnalyses.length} turns from LanceDB`,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        console.warn('Failed to load lattice from LanceDB:', err);
      }
    };

    loadLattice();
  }, [
    anchorId,
    cwd,
    sessionManager,
    latticeLoadedRef,
    turnAnalysis,
    setInjectedRecap,
    setMessages,
  ]);

  // Session lifecycle - flush overlays
  useEffect(() => {
    conversationRegistryRef.current?.setCurrentSession(currentSessionIdValue);
    return () => {
      conversationRegistryRef.current
        ?.flushAll(currentSessionIdValue)
        .catch((err: Error) => {
          console.error('Failed to flush conversation overlays:', err);
        });
    };
  }, [currentSessionIdValue, conversationRegistryRef]);

  // Persist token count
  useEffect(() => {
    if (tokenCounter.count.total === lastPersistedTokensRef.current) return;

    sessionManager.updateTokens(tokenCounter.count);
    lastPersistedTokensRef.current = tokenCounter.count.total;
  }, [tokenCounter.count, sessionManager, lastPersistedTokensRef]);

  // Compute overlay scores
  useEffect(() => {
    async function computeOverlayScores() {
      if (!conversationRegistryRef.current || !currentSessionIdValue) return;

      try {
        const registry = conversationRegistryRef.current;
        const scores = {
          O1_structural: 0,
          O2_security: 0,
          O3_lineage: 0,
          O4_mission: 0,
          O5_operational: 0,
          O6_mathematical: 0,
          O7_strategic: 0,
        };

        const overlayIds: Array<
          'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7'
        > = ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'];

        for (const overlayId of overlayIds) {
          try {
            const manager = await registry.get(overlayId);
            const items = await manager.getAllItems();

            if (items.length > 0) {
              const total = items.reduce((sum: number, item) => {
                return (
                  sum +
                  ((item.metadata as { project_alignment_score?: number })
                    .project_alignment_score || 0)
                );
              }, 0);
              const avg = total / items.length;

              const key =
                `${overlayId}_${overlayId === 'O1' ? 'structural' : overlayId === 'O2' ? 'security' : overlayId === 'O3' ? 'lineage' : overlayId === 'O4' ? 'mission' : overlayId === 'O5' ? 'operational' : overlayId === 'O6' ? 'mathematical' : 'strategic'}` as keyof typeof scores;
              scores[key] = avg;
            }
          } catch (err) {
            debug(`Failed to compute ${overlayId} scores: ${err}`);
          }
        }

        setOverlayScores(scores);
      } catch (err) {
        debug('Failed to compute overlay scores:', err);
      }
    }

    if (turnAnalysis.stats.totalAnalyzed > 0) {
      computeOverlayScores();
    }
  }, [
    turnAnalysis.stats.totalAnalyzed,
    currentSessionIdValue,
    debug,
    conversationRegistryRef,
    setOverlayScores,
  ]);
}
