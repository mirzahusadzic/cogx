import { useEffect, useRef } from 'react';
import path from 'path';
import fs from 'fs';
import { systemLog } from '../../../utils/debug-logger.js';
import type { AgentState } from './useAgentState.js';
import type { UseSessionManagerResult } from '../session/useSessionManager.js';
import type { UseTurnAnalysisReturn } from '../analysis/useTurnAnalysis.js';
import type { useTokenCount } from '../tokens/useTokenCount.js';
import type { useSessionTokenCount } from '../tokens/useSessionTokenCount.js';

export function useAgentSync(
  state: AgentState & {
    tokenCounter: ReturnType<typeof useTokenCount>;
    sessionTokenCounter: ReturnType<typeof useSessionTokenCount>;
  },
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
    sessionTokenCounter,
    sigmaTasks,
  } = state;

  const currentSessionIdValue = currentSessionIdRef.current;
  const lastPersistedTasksCountRef = useRef(0);

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
        systemLog(
          'sigma',
          `Failed to load lattice from LanceDB: ${err}`,
          {},
          'warn'
        );
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
          systemLog(
            'sigma',
            `Failed to flush conversation overlays: ${err}`,
            {},
            'error'
          );
        });
    };
  }, [currentSessionIdValue, conversationRegistryRef]);

  // Persist token count and tasks
  useEffect(() => {
    const tasksChanged =
      sigmaTasks.todos.length !== lastPersistedTasksCountRef.current;
    const tokensChanged =
      tokenCounter.count.total !== lastPersistedTokensRef.current;

    if (!tasksChanged && !tokensChanged) {
      return;
    }

    sessionManager.updateTokens(tokenCounter.count);
    sessionManager.updateSessionTokens(sessionTokenCounter.count);
    sessionManager.updateTasks(sigmaTasks.todos);

    lastPersistedTokensRef.current = tokenCounter.count.total;
    lastPersistedTasksCountRef.current = sigmaTasks.todos.length;
  }, [
    tokenCounter.count,
    sessionTokenCounter.count,
    sigmaTasks.todos,
    sessionManager,
    lastPersistedTokensRef,
  ]);

  // Compute overlay scores
  useEffect(() => {
    function computeOverlayScores() {
      if (turnAnalysis.analyses.length === 0) return;

      try {
        const analyses = turnAnalysis.analyses;
        const totalTurns = analyses.length;

        const scores = {
          O1_structural: 0,
          O2_security: 0,
          O3_lineage: 0,
          O4_mission: 0,
          O5_operational: 0,
          O6_mathematical: 0,
          O7_strategic: 0,
        };

        // Accumulate scores from all analyses in memory
        // PERFORMANCE: This avoids O(N) LanceDB queries per update
        for (const analysis of analyses) {
          const os = analysis.overlay_scores;
          scores.O1_structural += os.O1_structural || 0;
          scores.O2_security += os.O2_security || 0;
          scores.O3_lineage += os.O3_lineage || 0;
          scores.O4_mission += os.O4_mission || 0;
          scores.O5_operational += os.O5_operational || 0;
          scores.O6_mathematical += os.O6_mathematical || 0;
          scores.O7_strategic += os.O7_strategic || 0;
        }

        // Calculate averages
        scores.O1_structural /= totalTurns;
        scores.O2_security /= totalTurns;
        scores.O3_lineage /= totalTurns;
        scores.O4_mission /= totalTurns;
        scores.O5_operational /= totalTurns;
        scores.O6_mathematical /= totalTurns;
        scores.O7_strategic /= totalTurns;

        // Only update if scores have actually changed (structural comparison)
        const currentScores = state.overlayScores;
        const hasChanged =
          Math.abs(currentScores.O1_structural - scores.O1_structural) >
            0.001 ||
          Math.abs(currentScores.O2_security - scores.O2_security) > 0.001 ||
          Math.abs(currentScores.O3_lineage - scores.O3_lineage) > 0.001 ||
          Math.abs(currentScores.O4_mission - scores.O4_mission) > 0.001 ||
          Math.abs(currentScores.O5_operational - scores.O5_operational) >
            0.001 ||
          Math.abs(currentScores.O6_mathematical - scores.O6_mathematical) >
            0.001 ||
          Math.abs(currentScores.O7_strategic - scores.O7_strategic) > 0.001;

        if (hasChanged) {
          setOverlayScores(scores);
        }
      } catch (err) {
        debug('Failed to compute overlay scores:', err);
      }
    }

    if (turnAnalysis.stats.totalAnalyzed > 0) {
      computeOverlayScores();
    }
  }, [
    turnAnalysis.stats.totalAnalyzed,
    turnAnalysis.analyses,
    debug,
    setOverlayScores,
    state.overlayScores,
  ]);
}
