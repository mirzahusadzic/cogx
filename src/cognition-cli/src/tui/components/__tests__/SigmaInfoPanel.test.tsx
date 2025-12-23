import React from 'react';
import { render } from 'ink-testing-library';
import {
  SigmaInfoPanel,
  SigmaStats,
  OverlayScores,
} from '../SigmaInfoPanel.js';

describe('SigmaInfoPanel', () => {
  const mockSigmaStats: SigmaStats = {
    nodes: 24,
    edges: 23,
    paradigmShifts: 2,
    avgNovelty: 0.543,
    avgImportance: 6.8,
  };

  const mockOverlays: OverlayScores = {
    O1_structural: 7.2,
    O2_security: 3.5,
    O3_lineage: 8.1,
    O4_mission: 5.0,
    O5_operational: 4.3,
    O6_mathematical: 2.1,
    O7_strategic: 6.9,
  };

  describe('header', () => {
    it('displays SIGMA STATS header', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      expect(lastFrame()).toContain('SIGMA STATS');
    });
  });

  describe('lattice statistics', () => {
    it('displays Lattice section label', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      expect(lastFrame()).toContain('Lattice:');
    });

    it('displays nodes count', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🌿 Nodes:');
      expect(output).toContain('24');
    });

    it('displays edges count', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🐘 Edges:');
      expect(output).toContain('23');
    });

    it('displays paradigm shifts count', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🦋 Shifts:');
      expect(output).toContain('2');
    });

    it('handles zero values gracefully', () => {
      const zeroStats: SigmaStats = {
        nodes: 0,
        edges: 0,
        paradigmShifts: 0,
        avgNovelty: 0,
        avgImportance: 0,
      };
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={zeroStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🌿 Nodes:');
      expect(output).toContain('0');
    });
  });

  describe('averages section', () => {
    it('displays Averages section label', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      expect(lastFrame()).toContain('Averages:');
    });

    it('displays novelty with 3 decimal places', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🐇 Novelty:');
      expect(output).toContain('0.543');
    });

    it('displays importance with 1 decimal place', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🐍 Importance:');
      expect(output).toContain('6.8');
    });

    it('formats novelty correctly for edge cases', () => {
      const stats = { ...mockSigmaStats, avgNovelty: 1 };
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={stats} overlays={mockOverlays} />
      );
      expect(lastFrame()).toContain('1.000');
    });
  });

  describe('overlay activations', () => {
    it('displays Overlay Activations label', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      expect(lastFrame()).toContain('Overlay Activations:');
    });

    it('displays all 7 overlay labels', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Structural');
      expect(output).toContain('Security');
      expect(output).toContain('Lineage');
      expect(output).toContain('Mission');
      expect(output).toContain('Operational');
      expect(output).toContain('Mathematical');
      expect(output).toContain('Strategic');
    });

    it('displays overlay icons', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('🏗️'); // Structural
      expect(output).toContain('🛡️'); // Security
      expect(output).toContain('🌳'); // Lineage
      expect(output).toContain('🎯'); // Mission
      expect(output).toContain('⚙️'); // Operational
      expect(output).toContain('📐'); // Mathematical
      expect(output).toContain('🧭'); // Strategic
    });

    it('displays overlay scores with /10 suffix', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      expect(lastFrame()).toContain('/10');
    });

    it('displays visual bar indicators', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      const output = lastFrame() ?? '';
      // Bars consist of █ and ░ characters
      expect(output).toContain('█');
      expect(output).toContain('░');
    });
  });

  describe('visual bar rendering', () => {
    it('renders full bar for score of 10', () => {
      const fullOverlays = { ...mockOverlays, O1_structural: 10 };
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={fullOverlays} />
      );
      const output = lastFrame() ?? '';
      // 10/10 should give 5 filled blocks
      expect(output).toContain('█████');
    });

    it('renders empty bar for score of 0', () => {
      const emptyOverlays = { ...mockOverlays, O1_structural: 0 };
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={emptyOverlays} />
      );
      const output = lastFrame() ?? '';
      // 0/10 should give 5 empty blocks
      expect(output).toContain('░░░░░');
    });

    it('renders half bar for score of 5', () => {
      const halfOverlays = { ...mockOverlays, O1_structural: 5 };
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={halfOverlays} />
      );
      const output = lastFrame() ?? '';
      // 5/10 should give ~2-3 filled blocks (rounding)
      expect(output).toMatch(/█{2,3}░{2,3}/);
    });
  });

  describe('footer help text', () => {
    it('displays close instruction', () => {
      const { lastFrame } = render(
        <SigmaInfoPanel sigmaStats={mockSigmaStats} overlays={mockOverlays} />
      );
      expect(lastFrame()).toContain("Press 'i' to close");
    });
  });
});
