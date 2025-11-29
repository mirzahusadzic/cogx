import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { SourceSelectionStep } from './SourceSelectionStep.js';
import { GenesisProgressStep } from './GenesisProgressStep.js';
import { LLMCoCreationStep } from './LLMCoCreationStep.js';
import { OverlayGenerationStep } from './OverlayGenerationStep.js';

/**
 * Wizard step type enum
 *
 * Flow: Source Selection → Genesis → LLM Co-Creation → Overlay Generation
 *
 * NOTE: No separate "doc discovery" step. Documentation MUST be generated
 * via LLM co-creation to conform to extraction patterns in onboard-project.md.
 * Random README.md files won't work - they need specific formatting.
 */
export type WizardStep =
  | 'source-selection'
  | 'genesis'
  | 'llm-cocreation'
  | 'overlay-generation'
  | 'complete';

/**
 * Configuration collected through wizard steps
 */
export interface WizardConfig {
  /** Selected source directories to index */
  sourceDirs: string[];
  /** Generated documentation paths (from LLM co-creation) */
  generatedDocs: string[];
  /** Selected overlays to generate */
  selectedOverlays: string[];
}

/**
 * Props for OnboardingWizard component
 */
export interface OnboardingWizardProps {
  /** Current working directory (repo root) */
  cwd: string;
  /** Workbench URL for genesis/overlays */
  workbenchUrl: string;
  /** LLM provider for co-creation step */
  provider: string;
  /** Callback when wizard completes successfully */
  onComplete: () => void;
  /** Callback when wizard is cancelled */
  onCancel: () => void;
}

/**
 * Step display configuration
 */
const STEP_CONFIG: Record<WizardStep, { title: string; stepNum: number }> = {
  'source-selection': { title: 'Source Selection', stepNum: 1 },
  genesis: { title: 'Building Code Index', stepNum: 2 },
  'llm-cocreation': { title: 'Strategic Documentation', stepNum: 3 },
  'overlay-generation': { title: 'Generating Overlays', stepNum: 4 },
  complete: { title: 'Complete', stepNum: 5 },
};

const TOTAL_STEPS = 4;

/**
 * OnboardingWizard Component
 *
 * Main container for the TUI onboarding wizard. Manages step state machine
 * and configuration collection across steps.
 *
 * **Step Flow**:
 * 1. Source Selection - Choose directories to index
 * 2. Genesis - Build code index with progress
 * 3. LLM Co-Creation - Generate VISION.md, CODING_PRINCIPLES.md with LLM
 *    (MUST follow extraction patterns from onboard-project.md)
 * 4. Overlay Generation - Generate overlay files (O1-O7)
 *
 * NOTE: There is no "doc discovery" step. Random existing docs won't work
 * because they don't follow the required extraction patterns.
 *
 * @component
 */
const OnboardingWizardComponent: React.FC<OnboardingWizardProps> = ({
  cwd,
  workbenchUrl,
  provider,
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] =
    useState<WizardStep>('source-selection');
  const [config, setConfig] = useState<WizardConfig>({
    sourceDirs: [],
    generatedDocs: [],
    selectedOverlays: [],
  });

  // Handle global Escape key to cancel wizard
  useInput((input, key) => {
    if (
      key.escape &&
      currentStep !== 'genesis' &&
      currentStep !== 'overlay-generation'
    ) {
      // Don't allow cancel during long-running operations
      onCancel();
    }
  });

  // Step navigation callbacks
  const handleSourceSelectionComplete = useCallback(
    (selectedDirs: string[]) => {
      setConfig((prev) => ({ ...prev, sourceDirs: selectedDirs }));
      setCurrentStep('genesis');
    },
    []
  );

  const handleGenesisComplete = useCallback(() => {
    // Go directly to LLM co-creation (no doc discovery step)
    setCurrentStep('llm-cocreation');
  }, []);

  const handleGenesisError = useCallback((err: string) => {
    // Exit TUI and print error to console instead of showing inside TUI
    console.error(
      '\n\x1b[31m╔════════════════════════════════════════════════════════════════════════════╗'
    );
    console.error(
      '║                      Onboarding Failed                                     ║'
    );
    console.error(
      '╚════════════════════════════════════════════════════════════════════════════╝\x1b[0m\n'
    );
    console.error(err);
    console.error('\n\x1b[33mTry running manually:\x1b[0m');
    console.error('  1. cognition-cli init');
    console.error(
      '  2. cognition-cli genesis <source-dirs> --workbench <url>\n'
    );
    process.exit(1);
  }, []);

  const handleLLMCoCreationComplete = useCallback(
    (selectedOverlays: string[]) => {
      // MVP: No generated docs yet - will be added via /onboard-project
      setConfig((prev) => ({ ...prev, generatedDocs: [], selectedOverlays }));
      setCurrentStep('overlay-generation');
    },
    []
  );

  const handleLLMCoCreationSkip = useCallback(() => {
    // Skip docs entirely - only generate code-based overlays (O1, O2, O3, O5, O6)
    // O4 (Mission) and O7 (Coherence) require docs
    setConfig((prev) => ({
      ...prev,
      generatedDocs: [],
      selectedOverlays: ['O1', 'O2', 'O3', 'O5', 'O6'],
    }));
    setCurrentStep('overlay-generation');
  }, []);

  const handleOverlayGenerationComplete = useCallback(() => {
    setCurrentStep('complete');
    onComplete();
  }, [onComplete]);

  const handleOverlayGenerationError = useCallback((err: string) => {
    // Exit TUI and print error to console instead of showing inside TUI
    console.error(
      '\n\x1b[31m╔════════════════════════════════════════════════════════════════════════════╗'
    );
    console.error(
      '║                   Overlay Generation Failed                                ║'
    );
    console.error(
      '╚════════════════════════════════════════════════════════════════════════════╝\x1b[0m\n'
    );
    console.error(err);
    console.error('\n\x1b[33mTry running manually:\x1b[0m');
    console.error('  cognition-cli overlay generate <type>\n');
    process.exit(1);
  }, []);

  // Get current step config
  const stepConfig = STEP_CONFIG[currentStep];

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 'source-selection':
        return (
          <SourceSelectionStep
            cwd={cwd}
            onComplete={handleSourceSelectionComplete}
          />
        );
      case 'genesis':
        return (
          <GenesisProgressStep
            cwd={cwd}
            sourceDirs={config.sourceDirs}
            workbenchUrl={workbenchUrl}
            onComplete={handleGenesisComplete}
            onError={handleGenesisError}
          />
        );
      case 'llm-cocreation':
        return (
          <LLMCoCreationStep
            cwd={cwd}
            provider={provider}
            workbenchUrl={workbenchUrl}
            onComplete={handleLLMCoCreationComplete}
            onSkip={handleLLMCoCreationSkip}
          />
        );
      case 'overlay-generation':
        return (
          <OverlayGenerationStep
            cwd={cwd}
            workbenchUrl={workbenchUrl}
            selectedOverlays={config.selectedOverlays}
            onComplete={handleOverlayGenerationComplete}
            onError={handleOverlayGenerationError}
          />
        );
      case 'complete':
        return (
          <Box flexDirection="column" padding={1}>
            <Text color="green" bold>
              Onboarding Complete!
            </Text>
            <Text>Your workspace is ready. Loading TUI...</Text>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Header with step indicator */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text bold color="cyan">
          Step {stepConfig.stepNum}/{TOTAL_STEPS}: {stepConfig.title}
        </Text>
      </Box>

      {/* Step content */}
      <Box>{renderStep()}</Box>

      {/* Footer with navigation hint */}
      {currentStep !== 'genesis' && currentStep !== 'overlay-generation' && (
        <Box marginTop={1}>
          <Text dimColor>[Esc] Cancel wizard</Text>
        </Box>
      )}
    </Box>
  );
};

export const OnboardingWizard = React.memo(OnboardingWizardComponent);
