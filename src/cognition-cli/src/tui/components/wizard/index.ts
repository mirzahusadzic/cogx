/**
 * TUI Onboarding Wizard Components
 *
 * This module exports all wizard step components used for
 * onboarding new repositories to Cognition.
 */

export { OnboardingWizard } from './OnboardingWizard.js';
export type {
  OnboardingWizardProps,
  WizardStep,
  WizardConfig,
} from './OnboardingWizard.js';

export { SourceSelectionStep } from './SourceSelectionStep.js';
export type { SourceSelectionStepProps } from './SourceSelectionStep.js';

export { GenesisProgressStep } from './GenesisProgressStep.js';
export type { GenesisProgressStepProps } from './GenesisProgressStep.js';

// NOTE: DocDiscoveryStep is NOT exported. Random docs won't work because they
// don't follow extraction patterns. Docs MUST be generated via LLMCoCreationStep.

export { LLMCoCreationStep } from './LLMCoCreationStep.js';
export type { LLMCoCreationStepProps } from './LLMCoCreationStep.js';

export { OverlayGenerationStep } from './OverlayGenerationStep.js';
export type { OverlayGenerationStepProps } from './OverlayGenerationStep.js';
