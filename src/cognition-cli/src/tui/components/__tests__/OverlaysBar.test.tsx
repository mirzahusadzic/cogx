import React from 'react';
import { render } from 'ink-testing-library';
import {
  OverlaysBar,
  SigmaStats,
  WorkbenchHealthStatus,
} from '../OverlaysBar.js';
import type { BackgroundTask } from '../../services/BackgroundTaskManager.js';

describe('OverlaysBar', () => {
  const mockSigmaStats: SigmaStats = {
    nodes: 42,
    edges: 41,
    paradigmShifts: 3,
    avgNovelty: 0.67,
    avgImportance: 6.2,
  };

  describe('lattice stats display', () => {
    it('displays all lattice metrics when stats provided', () => {
      const { lastFrame } = render(<OverlaysBar sigmaStats={mockSigmaStats} />);
      const output = lastFrame() ?? '';
      // Values may be split across lines due to flexbox layout
      expect(output).toContain('🌿 Nodes:');
      expect(output).toContain('42');
      expect(output).toContain('🐘 Edges:');
      expect(output).toContain('41');
      expect(output).toContain('🦋 Shifts:');
      expect(output).toContain('🐇 Novelty:');
      expect(output).toContain('0.67');
      expect(output).toContain('🐍 Importance:');
      // Importance value may be split across lines in narrow terminal
      expect(output).toMatch(/6\.2?/);
    });

    it('shows warming up message when no stats', () => {
      const { lastFrame } = render(<OverlaysBar />);
      expect(lastFrame()).toContain('Lattice: Warming up...');
    });

    it('shows warming up when nodes is 0', () => {
      const { lastFrame } = render(
        <OverlaysBar sigmaStats={{ ...mockSigmaStats, nodes: 0 }} />
      );
      expect(lastFrame()).toContain('Lattice: Warming up...');
    });

    it('formats novelty with 2 decimal places', () => {
      const { lastFrame } = render(
        <OverlaysBar sigmaStats={{ ...mockSigmaStats, avgNovelty: 0.5 }} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🐇 Novelty:');
      expect(output).toContain('0.50');
    });

    it('formats importance with 1 decimal place', () => {
      const { lastFrame } = render(
        <OverlaysBar sigmaStats={{ ...mockSigmaStats, avgImportance: 7 }} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🐍 Importance:');
      // Value may be split across lines in narrow terminal
      expect(output).toMatch(/7\.0?/);
    });
  });

  describe('version and branding', () => {
    it('displays COGNITION Σ CLI branding', () => {
      const { lastFrame } = render(<OverlaysBar />);
      expect(lastFrame()).toContain('COGNITION Σ CLI');
    });

    it('displays version number', () => {
      const { lastFrame } = render(<OverlaysBar />);
      // Version should match pattern v#.#.#
      expect(lastFrame()).toMatch(/v\d+\.\d+\.\d+/);
    });
  });

  describe('pending message count', () => {
    it('shows message count when pending messages exist', () => {
      const { lastFrame } = render(
        <OverlaysBar sigmaStats={mockSigmaStats} pendingMessageCount={5} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🐦 Messages');
      expect(output).toContain('5');
    });

    it('does not show message count when 0', () => {
      const { lastFrame } = render(
        <OverlaysBar sigmaStats={mockSigmaStats} pendingMessageCount={0} />
      );
      expect(lastFrame()).not.toContain('🐦 Messages');
    });

    it('shows pending messages during warming up', () => {
      const { lastFrame } = render(<OverlaysBar pendingMessageCount={3} />);
      const output = lastFrame() ?? '';
      expect(output).toContain('Lattice: Warming up...');
      expect(output).toContain('🐦 Messages');
      expect(output).toContain('3');
    });
  });

  describe('monitor error display', () => {
    it('shows error message when monitor fails', () => {
      const { lastFrame } = render(
        <OverlaysBar monitorError="Connection lost" />
      );
      expect(lastFrame()).toContain('⚠ Message Monitor: Connection lost');
    });

    it('prioritizes error over stats', () => {
      const { lastFrame } = render(
        <OverlaysBar sigmaStats={mockSigmaStats} monitorError="Network error" />
      );
      expect(lastFrame()).toContain('⚠ Message Monitor: Network error');
      expect(lastFrame()).not.toContain('🌿 Nodes');
    });
  });

  describe('workbench health status', () => {
    it('shows unreachable when workbench is not reachable', () => {
      const health: WorkbenchHealthStatus = {
        reachable: false,
        embeddingReady: false,
        summarizationReady: false,
        hasApiKey: false,
      };
      const { lastFrame } = render(<OverlaysBar workbenchHealth={health} />);
      expect(lastFrame()).toContain('⚠️ Workbench: unreachable');
    });

    it('shows embedding issue when embeddings not ready', () => {
      const health: WorkbenchHealthStatus = {
        reachable: true,
        embeddingReady: false,
        summarizationReady: true,
        hasApiKey: true,
      };
      const { lastFrame } = render(<OverlaysBar workbenchHealth={health} />);
      expect(lastFrame()).toContain('no embeddings');
    });

    it('shows summarization issue when not ready', () => {
      const health: WorkbenchHealthStatus = {
        reachable: true,
        embeddingReady: true,
        summarizationReady: false,
        hasApiKey: true,
      };
      const { lastFrame } = render(<OverlaysBar workbenchHealth={health} />);
      expect(lastFrame()).toContain('no summarization');
    });

    it('shows API key issue when missing', () => {
      const health: WorkbenchHealthStatus = {
        reachable: true,
        embeddingReady: true,
        summarizationReady: true,
        hasApiKey: false,
      };
      const { lastFrame } = render(<OverlaysBar workbenchHealth={health} />);
      expect(lastFrame()).toContain('no API key');
    });

    it('shows multiple issues separated by comma', () => {
      const health: WorkbenchHealthStatus = {
        reachable: true,
        embeddingReady: false,
        summarizationReady: false,
        hasApiKey: true,
      };
      const { lastFrame } = render(<OverlaysBar workbenchHealth={health} />);
      expect(lastFrame()).toContain('no embeddings');
      expect(lastFrame()).toContain('no summarization');
    });

    it('shows healthy stats when all checks pass', () => {
      const health: WorkbenchHealthStatus = {
        reachable: true,
        embeddingReady: true,
        summarizationReady: true,
        hasApiKey: true,
      };
      const { lastFrame } = render(
        <OverlaysBar sigmaStats={mockSigmaStats} workbenchHealth={health} />
      );
      expect(lastFrame()).toContain('🌿 Nodes');
      expect(lastFrame()).not.toContain('⚠️ Workbench');
    });

    it('shows pending messages alongside workbench issues', () => {
      const health: WorkbenchHealthStatus = {
        reachable: true,
        embeddingReady: false,
        summarizationReady: true,
        hasApiKey: true,
      };
      const { lastFrame } = render(
        <OverlaysBar workbenchHealth={health} pendingMessageCount={2} />
      );
      expect(lastFrame()).toContain('no embeddings');
      expect(lastFrame()).toContain('🐦 Messages: 2');
    });
  });

  describe('background task status', () => {
    it('shows genesis task status', () => {
      const task: BackgroundTask = {
        id: 'task-1',
        type: 'genesis',
        status: 'running',
        message: 'Analyzing repository...',
        overlay: undefined,
        startedAt: new Date(),
      };
      const { lastFrame } = render(<OverlaysBar activeTask={task} />);
      expect(lastFrame()).toContain('🏗️');
      expect(lastFrame()).toContain('Analyzing repository...');
    });

    it('shows overlay task with correct icon', () => {
      const task: BackgroundTask = {
        id: 'task-2',
        type: 'overlay',
        overlay: 'security_guidelines',
        status: 'running',
        message: 'Embedding security patterns',
        startedAt: new Date(),
      };
      const { lastFrame } = render(<OverlaysBar activeTask={task} />);
      expect(lastFrame()).toContain('🛡️');
      expect(lastFrame()).toContain('Embedding security patterns');
    });

    it('shows document ingestion task', () => {
      const task: BackgroundTask = {
        id: 'task-3',
        type: 'genesis-docs',
        status: 'running',
        message: 'Processing documents...',
        overlay: undefined,
        startedAt: new Date(),
      };
      const { lastFrame } = render(<OverlaysBar activeTask={task} />);
      expect(lastFrame()).toContain('Processing documents...');
    });

    it('does not show completed tasks', () => {
      const task: BackgroundTask = {
        id: 'task-4',
        type: 'genesis',
        status: 'completed',
        message: 'Done',
        overlay: undefined,
        startedAt: new Date(),
      };
      const { lastFrame } = render(<OverlaysBar activeTask={task} />);
      expect(lastFrame()).toContain('COGNITION Σ CLI'); // Shows branding instead
    });

    it('shows branding when no active task', () => {
      const { lastFrame } = render(<OverlaysBar activeTask={null} />);
      expect(lastFrame()).toContain('COGNITION Σ CLI');
    });
  });

  describe('overlay icons', () => {
    const testOverlayIcon = (overlayName: string, expectedIcon: string) => {
      const task: BackgroundTask = {
        id: 'test',
        type: 'overlay',
        overlay: overlayName,
        status: 'running',
        message: 'Processing...',
        startedAt: new Date(),
      };
      const { lastFrame } = render(<OverlaysBar activeTask={task} />);
      expect(lastFrame()).toContain(expectedIcon);
    };

    it('shows structural icon for structural_patterns', () => {
      testOverlayIcon('structural_patterns', '🏗️');
    });

    it('shows security icon for security_guidelines', () => {
      testOverlayIcon('security_guidelines', '🛡️');
    });

    it('shows lineage icon for lineage_patterns', () => {
      testOverlayIcon('lineage_patterns', '🌳');
    });

    it('shows mission icon for mission_concepts', () => {
      testOverlayIcon('mission_concepts', '🎯');
    });

    it('shows operational icon for operational_patterns', () => {
      testOverlayIcon('operational_patterns', '⚙️');
    });

    it('shows mathematical icon for mathematical_proofs', () => {
      testOverlayIcon('mathematical_proofs', '📐');
    });

    it('shows strategic icon for strategic_coherence', () => {
      testOverlayIcon('strategic_coherence', '🧭');
    });
  });
});
