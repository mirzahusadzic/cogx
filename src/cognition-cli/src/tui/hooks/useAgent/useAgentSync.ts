import { useEffect, useRef } from 'react';
import path from 'path';
import fs from 'fs';
import { systemDiagnosticsService } from '../../../core/services/diagnostics/SystemDiagnosticsService.js';
import { useAgentBaseContext } from '../../contexts/AgentContext.js';
import {
  tuiSyncManager,
  TUISyncManager,
} from '../../../core/state/tui-sync/TUISyncManager.js';

export function useAgentSync() {
  const {
    state,
    sessionManager,
    turnAnalysis,
    options,
    anchorId,
    tokenCounter,
    sessionTokenCounter,
  } = useAgentBaseContext();

  const { cwd } = options;
  const {
    latticeLoadedRef,
    setInjectedRecap,
    setMessages,
    conversationRegistryRef,
    lastPersistedTokensRef,
    setOverlayScores,
    currentSessionIdRef,
    sigmaTasks,
  } = state;

  const currentSessionIdValue = currentSessionIdRef.current;
  const lastPersistedTasksCountRef = useRef(0);

  // Load existing conversation lattice
  useEffect(() => {
    const loadLattice = async () => {
      const currentResumeId = sessionManager.getResumeSessionId();
      const sessionId = currentResumeId || anchorId || 'initial';

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
        systemDiagnosticsService.systemLog(
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
          systemDiagnosticsService.systemLog(
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

  // Compute and Sync overlay scores and stats
  useEffect(() => {
    if (turnAnalysis.stats.totalAnalyzed > 0) {
      const scores = TUISyncManager.computeOverlayScores(turnAnalysis.analyses);

      // Only update if scores have actually changed (structural comparison)
      const currentScores = state.overlayScores;
      const hasChanged =
        Math.abs(currentScores.O1_structural - scores.O1_structural) > 0.001 ||
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
        // Sync to the state machine
        tuiSyncManager.handleEvent({ type: 'OVERLAY_SCORES_UPDATE', scores });
      }

      // Sync sigma stats to state machine
      tuiSyncManager.handleEvent({
        type: 'SIGMA_STATS_UPDATE',
        stats: {
          nodes: turnAnalysis.stats.totalAnalyzed,
          edges: Math.max(0, turnAnalysis.stats.totalAnalyzed - 1),
          paradigmShifts: turnAnalysis.stats.paradigmShifts,
          avgNovelty: turnAnalysis.stats.avgNovelty,
          avgImportance: turnAnalysis.stats.avgImportance,
        },
      });
    }
  }, [
    turnAnalysis.stats,
    turnAnalysis.analyses,
    setOverlayScores,
    state.overlayScores,
  ]);
}
