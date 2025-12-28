import * as path from 'path';
import type { AgentRequest } from '../agent-provider-interface.js';

export async function getGroundingContext(
  request: AgentRequest
): Promise<string> {
  let groundingContext = '';
  const grounding = await request.grounding;
  if (grounding && grounding.strategy !== 'none') {
    const { strategy, query_hints, overlay_hints } = grounding;
    if (strategy === 'pgc_first' && query_hints && query_hints.length > 0) {
      for (const hint of query_hints) {
        groundingContext += `\n\n### Grounding Evidence: ${hint}\n`;
        try {
          const { WorkspaceManager } =
            await import('../../core/workspace-manager.js');
          const workspaceManager = new WorkspaceManager();
          const projectRoot = workspaceManager.resolvePgcRoot(
            request.cwd || request.projectRoot
          );

          if (projectRoot) {
            const { askCommand } = await import('../../commands/ask.js');
            const result = await askCommand(hint, {
              projectRoot,
              workbench: request.workbenchUrl,
              json: true,
              topK: 3,
            });

            if (result && typeof result === 'object' && 'answer' in result) {
              groundingContext += `${result.answer}\n`;
              if (result.sources && result.sources.length > 0) {
                groundingContext += `Sources: ${result.sources
                  .map((s: { section: string }) => s.section)
                  .join(', ')}\n`;
              }
            }
          }
        } catch (e) {
          groundingContext += `(Failed to gather grounding evidence: ${(e as Error).message})\n`;
        }
      }
    }

    // Also support Sigma cross-session grounding if requested via O7 or similar
    if (
      strategy === 'pgc_first' &&
      overlay_hints?.includes('O7') &&
      query_hints &&
      query_hints.length > 0
    ) {
      groundingContext += `\n\n### Cross-Session Sigma Context\n`;
      try {
        const { findSimilarConversations } =
          await import('../../sigma/cross-session-query.js');
        const sigmaRoot = path.join(
          request.cwd || request.projectRoot || process.cwd(),
          '.sigma'
        );

        const sigmaResults = await findSimilarConversations(
          query_hints[0],
          sigmaRoot,
          {
            workbenchUrl: request.workbenchUrl,
            topK: 3,
          }
        );

        if (sigmaResults.length > 0) {
          for (const res of sigmaResults) {
            groundingContext += `[Session: ${res.session_id}] ${res.content.slice(0, 300)}...\n`;
          }
        }
      } catch (e) {
        groundingContext += `(Sigma grounding skipped: ${(e as Error).message})\n`;
      }
    }
  }
  return groundingContext;
}
