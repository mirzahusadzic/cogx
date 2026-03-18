/**
 * Mathematical Proofs Sugar Commands (O₆ Mathematical Proofs)
 *
 * Provides syntactic convenience for querying mathematical statements from the
 * Grounded Context Pool (PGC). These "sugar" commands translate to lattice
 * algebra expressions, offering a simpler CLI interface for proof exploration.
 *
 * SUGAR CONCEPT:
 * Sugar commands wrap the lattice algebra query language with named commands
 * that are easier to remember and use. Instead of writing:
 *   `cognition-cli lattice "O6[theorem]"`
 * Users can simply write:
 *   `cognition-cli proofs theorems`
 *
 * This improves UX while maintaining the full power of the algebra layer.
 *
 * OVERLAY REFERENCE (O₆):
 * - theorem: Proven mathematical theorems
 * - lemma: Supporting mathematical lemmas
 * - axiom: Foundational mathematical axioms
 * - proof: Detailed proof structures
 * - identity: Mathematical identities and equivalences
 *
 * DESIGN RATIONALE:
 * 1. Mathematical Rigor: O₆ captures formal mathematical knowledge
 * 2. Proof Discovery: Find theorems/lemmas by semantic meaning
 * 3. Mission Alignment: Cross-reference proofs with mission principles (O₄)
 * 4. Type Categorization: Separate queries for different proof types
 *
 * USE CASES:
 * - Research: Find relevant theorems for a mathematical concept
 * - Verification: Check which lemmas support a given theorem
 * - Alignment: Identify proofs that embody mission principles
 * - Documentation: Export mathematical foundations as structured data
 *
 * @example
 * // List all theorems in the system
 * await proofsTheoremsCommand({ projectRoot: '.' });
 * // Translates to: lattice "O6[theorem]"
 *
 * @example
 * // Find proofs aligned with mission principles
 * await proofsAlignedCommand({ projectRoot: '.' });
 * // Translates to: lattice "O6 ~ O4[principle]"
 * // Shows which mathematical statements embody mission values
 *
 * @example
 * // List all mathematical statements (theorems, lemmas, axioms, etc.)
 * await proofsListCommand({
 *   projectRoot: '.',
 *   type: 'identity',
 *   format: 'json'
 * });
 * // Translates to: lattice "O6[identity]"
 */

import { intro, outro, spinner as clackSpinner, log } from '@clack/prompts';
import chalk from 'chalk';
import { createQueryEngine } from '../../core/algebra/query-parser.js';
import {
  OverlayItem,
  OverlayMetadata,
} from '../../core/algebra/overlay-algebra.js';
import { meet } from '../../core/algebra/lattice-operations.js';
import { environmentService } from '../../core/services/environment/EnvironmentService.js';
import { createSugarCommand } from './factory.js';
import { SugarCommandOptions } from './types.js';
import { displayMeetResults } from './utils.js';

type ProofsOptions = SugarCommandOptions;

/**
 * Display all mathematical theorems from O₆ overlay
 *
 * Retrieves and displays proven theorems from the mathematical proofs overlay.
 * Theorems represent established mathematical results with verified proofs.
 *
 * LATTICE TRANSLATION: `O6[theorem]`
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum theorems to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await proofsTheoremsCommand({
 *   projectRoot: '.',
 *   format: 'table',
 *   limit: 20
 * });
 */
export const proofsTheoremsCommand = createSugarCommand({
  name: 'Proofs: Theorems',
  description: 'Loading theorems',
  overlayType: 'O6',
  queryType: 'theorem',
  itemLabel: 'theorem',
  pluralItemLabel: 'theorems',
});

/**
 * Display all mathematical lemmas from O₆ overlay
 *
 * Retrieves and displays lemmas from the mathematical proofs overlay.
 * Lemmas are supporting mathematical results that help prove theorems.
 *
 * LATTICE TRANSLATION: `O6[lemma]`
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum lemmas to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await proofsLemmasCommand({
 *   projectRoot: '.',
 *   format: 'summary'
 * });
 */
export const proofsLemmasCommand = createSugarCommand({
  name: 'Proofs: Lemmas',
  description: 'Loading lemmas',
  overlayType: 'O6',
  queryType: 'lemma',
  itemLabel: 'lemma',
  pluralItemLabel: 'lemmas',
});

/**
 * Display all mathematical statements from O₆ overlay
 *
 * Retrieves all mathematical content from O₆, including theorems, lemmas,
 * axioms, proofs, and identities. Optionally filters by specific type.
 *
 * LATTICE TRANSLATION:
 * - Default: `O6` (all mathematical statements)
 * - With type: `O6[<type>]` (e.g., O6[axiom])
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json' | 'summary'
 * @param options.limit - Maximum items to display
 * @param options.verbose - Enable verbose error output
 * @param options.type - Filter by type: 'theorem' | 'lemma' | 'axiom' | 'proof' | 'identity'
 * @returns Promise that resolves when display is complete
 *
 * @example
 * // List all mathematical statements
 * await proofsListCommand({ projectRoot: '.' });
 *
 * @example
 * // List only mathematical identities
 * await proofsListCommand({
 *   projectRoot: '.',
 *   type: 'identity',
 *   format: 'json'
 * });
 */
export const proofsListCommand = createSugarCommand({
  name: 'Proofs: All Mathematical Statements',
  description: 'Loading mathematical statements',
  overlayType: 'O6',
  itemLabel: 'statement',
  pluralItemLabel: 'statements',
});

/**
 * Display mathematical proofs aligned with mission principles
 *
 * Performs semantic alignment between mathematical statements (O₆) and
 * mission principles (O₄) to identify proofs that embody or support
 * core mission values through formal mathematical reasoning.
 *
 * LATTICE TRANSLATION: `O6 ~ O4[principle]`
 *
 * The ~ (meet) operator finds semantic similarities between mathematical
 * content and mission principles, revealing philosophical-mathematical connections.
 *
 * @param options - Command options
 * @param options.projectRoot - Root directory of the project
 * @param options.format - Output format: 'table' | 'json'
 * @param options.limit - Maximum alignment pairs to display
 * @param options.verbose - Enable verbose error output
 * @returns Promise that resolves when display is complete
 *
 * @example
 * await proofsAlignedCommand({
 *   projectRoot: '.',
 *   format: 'table',
 *   limit: 10
 * });
 * // Shows:
 * // Similarity: 82.1%
 * //   Proof: commutativity_theorem
 * //     Demonstrates order-independence in operations
 * //   Principle: fairness
 * //     All inputs should be treated equally regardless of order
 */
export async function proofsAlignedCommand(
  options: ProofsOptions
): Promise<void> {
  const threshold = options.threshold ?? 0.5;
  const useJson =
    options.format === 'json' || process.env.COGNITION_FORMAT === 'json';

  if (!useJson) {
    intro(
      chalk.bold(
        `Proofs: Aligned with Mission (threshold: ${(threshold * 100).toFixed(0)}%)`
      )
    );
  }

  let pgcRoot;
  try {
    pgcRoot = environmentService.resolvePgcDir(options.projectRoot || '.');
  } catch {
    if (!useJson) {
      log.error(chalk.red('No .open_cognition workspace found.'));
    }
    process.exit(1);
  }

  const s = clackSpinner();
  if (!useJson) {
    s.start('Finding proofs aligned with mission principles');
  }

  try {
    const workbenchUrl = process.env.WORKBENCH_URL || 'http://localhost:8000';
    const engine = createQueryEngine(pgcRoot, workbenchUrl);

    const o6Items = await engine.execute('O6');
    const o4Items = await engine.execute('O4[principle]');

    const extractItems = (result: unknown): OverlayItem<OverlayMetadata>[] => {
      if (Array.isArray(result)) {
        if (result.length === 0) return [];
        if (result[0] && 'id' in result[0] && 'embedding' in result[0]) {
          return result as OverlayItem<OverlayMetadata>[];
        }
      }
      return [];
    };

    const proofsArray = extractItems(o6Items);
    const principlesArray = extractItems(o4Items);

    if (proofsArray.length === 0 || principlesArray.length === 0) {
      if (!useJson) {
        s.stop('No proofs or principles found');
      } else {
        console.log(JSON.stringify([], null, 2));
      }
      return;
    }

    const result = await meet(proofsArray, principlesArray, {
      threshold,
      topK: 10,
    });

    if (!useJson) {
      s.stop('Analysis complete');
    }

    displayMeetResults(result, 'mathematical alignment', options);

    if (!useJson) {
      outro(chalk.green('✓ Alignment analysis complete'));
    }
  } catch (error) {
    if (!useJson) {
      s.stop(`Analysis failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}
