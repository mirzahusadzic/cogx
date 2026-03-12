import * as workerpool from 'workerpool';
import { PGCManager } from '../../pgc/manager.js';
import { StructuralData } from '../../types/structural.js';

interface StructuralJobPacket {
  projectRoot: string;
  symbolName: string;
  filePath: string;
  contentHash: string;
  structuralHash: string;
  structuralData: StructuralData;
  force: boolean;
}

interface StructuralMiningResult {
  status: 'success' | 'skipped' | 'error';
  symbolName: string;
  filePath: string;
  signature?: string; // Structural signature (the body)
  semanticSignature?: string; // Semantic signature (the shadow)
  architecturalRole?: string;
  structuralData?: StructuralData;
  contentHash?: string;
  structuralHash?: string;
  message?: string;
}

// Helper functions (duplicated to keep worker self-contained)

/**
 * Infer architectural role from a SPECIFIC symbol, not the entire file
 */
function inferArchitecturalRole(
  symbolName: string,
  structuralData: StructuralData,
  filePath: string
): string {
  const name = symbolName;
  const path = filePath.toLowerCase();

  // Find the specific symbol in the structural data
  const targetClass = structuralData.classes?.find((c) => c.name === name);
  const targetFunction = structuralData.functions?.find((f) => f.name === name);
  const targetInterface = structuralData.interfaces?.find(
    (i) => i.name === name
  );

  // 1. Commands (CLI or Internal)
  if (path.includes('/commands/') || name.endsWith('Command')) {
    return 'command';
  }

  // 2. UI Components / Views
  if (
    path.includes('/tui/') ||
    path.includes('/components/') ||
    path.includes('/views/') ||
    name.endsWith('View') ||
    name.endsWith('Component')
  ) {
    // React components usually start with Uppercase
    if (/^[A-Z]/.test(name)) return 'view';
  }

  // 3. Hooks
  if (name.startsWith('use') && /^[A-Z]/.test(name.slice(3))) {
    return 'hook';
  }

  // 4. Data Access / Repositories
  if (
    path.includes('/repositories/') ||
    path.includes('/data-access/') ||
    path.includes('/db/') ||
    name.endsWith('Repository') ||
    name.endsWith('Store') ||
    name.endsWith('DAO')
  ) {
    return 'data_access';
  }

  // 5. Classes - specific roles
  if (targetClass) {
    if (name.includes('Service')) return 'service';
    if (name.includes('Controller') || name.includes('Handler'))
      return 'controller';
    if (name.includes('Orchestrator')) return 'orchestrator';
    if (name.includes('Provider') || name.includes('Factory'))
      return 'provider';
    if (name.includes('Manager') || name.includes('Engine')) return 'service';
    return 'component';
  }

  // 6. Functions - specific roles
  if (targetFunction) {
    if (name.includes('Handler')) return 'controller';
    if (
      path.includes('/utils/') ||
      path.includes('/helpers/') ||
      name.includes('Util') ||
      name.includes('Helper')
    ) {
      return 'utility';
    }
    if (path.includes('/services/')) return 'service';
    if (path.includes('/logic/') || path.includes('/core/')) return 'service';

    // Default to utility for functions unless they are in a known architectural path
    return 'utility';
  }

  // 7. Interfaces / Types
  if (targetInterface) {
    if (name.endsWith('Config') || name.endsWith('Options'))
      return 'configuration';
    if (
      name.endsWith('Data') ||
      name.endsWith('Request') ||
      name.endsWith('Response') ||
      name.endsWith('Result') ||
      name.endsWith('DTO') ||
      path.includes('/types/') ||
      path.includes('/interfaces/') ||
      path.includes('/models/')
    ) {
      return 'type';
    }
    return 'type';
  }

  return 'component';
}

/**
 * Generate semantic signature for mission coherence alignment
 * Format: "docstring | type:SymbolName"
 * This is the "shadow" - a semantic projection of the symbol
 */
function generateSemanticSignature(
  symbolName: string,
  structuralData: StructuralData
): string {
  const parts: string[] = [];

  // Find the specific symbol
  const targetClass = structuralData.classes?.find(
    (c) => c.name === symbolName
  );
  const targetFunction = structuralData.functions?.find(
    (f) => f.name === symbolName
  );
  const targetInterface = structuralData.interfaces?.find(
    (i) => i.name === symbolName
  );

  // Extract docstring (semantic meaning)
  let docstring = '';
  if (targetClass && targetClass.docstring) {
    docstring = targetClass.docstring.trim();
  } else if (targetFunction && targetFunction.docstring) {
    docstring = targetFunction.docstring.trim();
  } else if (targetInterface && targetInterface.docstring) {
    docstring = targetInterface.docstring.trim();
  }

  // Include docstring if it exists
  if (docstring) {
    parts.push(docstring);
  }

  // Add type:name for semantic context
  if (targetClass) {
    parts.push(`class:${targetClass.name}`);
  } else if (targetFunction) {
    parts.push(`function:${targetFunction.name}`);
  } else if (targetInterface) {
    parts.push(`interface:${targetInterface.name}`);
  }

  return parts.join(' | ');
}

/**
 * Generate structural signature for architectural pattern matching
 * CRITICAL: This must only process the target symbol, not all symbols in the file!
 * Format: Pure structural metadata without docstrings
 */
function generateStructuralSignature(
  symbolName: string,
  structuralData: StructuralData
): string {
  const parts: string[] = [];

  // Find the specific symbol we're creating a signature for
  const targetClass = structuralData.classes?.find(
    (c) => c.name === symbolName
  );
  const targetFunction = structuralData.functions?.find(
    (f) => f.name === symbolName
  );
  const targetInterface = structuralData.interfaces?.find(
    (i) => i.name === symbolName
  );

  // Generate signature ONLY for the target symbol
  if (targetClass) {
    parts.push(`class:${targetClass.name}`);
    if (targetClass.base_classes && targetClass.base_classes.length > 0) {
      parts.push(`extends:${targetClass.base_classes.join(',')}`);
    }
    if (
      targetClass.implements_interfaces &&
      targetClass.implements_interfaces.length > 0
    ) {
      parts.push(`implements:${targetClass.implements_interfaces.join(',')}`);
    }
    parts.push(`methods:${targetClass.methods.length}`);
    parts.push(`decorators:${targetClass.decorators.length}`);
  } else if (targetFunction) {
    parts.push(`function:${targetFunction.name}`);
    parts.push(`params:${targetFunction.params.length}`);
    parts.push(`returns:${targetFunction.returns}`);
    parts.push(`async:${targetFunction.is_async}`);
    parts.push(`decorators:${targetFunction.decorators.length}`);
  } else if (targetInterface) {
    parts.push(`interface:${targetInterface.name}`);
    parts.push(`properties:${targetInterface.properties.length}`);

    // Include property types for better signature
    const propertyTypes = targetInterface.properties
      .map((p) => `${p.name}:${p.type}${p.optional ? '?' : ''}`)
      .join(',');
    if (propertyTypes) {
      parts.push(`shape:{${propertyTypes}}`);
    }
  }

  // Add file-level context (imports/exports count)
  if (structuralData.imports && structuralData.imports.length > 0) {
    parts.push(`imports:${structuralData.imports.length}`);
  }
  if (structuralData.exports && structuralData.exports.length > 0) {
    parts.push(`exports:${structuralData.exports.length}`);
  }

  return parts.join(' | ');
}

async function processStructuralPattern(
  job: StructuralJobPacket
): Promise<StructuralMiningResult> {
  const pgc = new PGCManager(job.projectRoot);

  try {
    const {
      symbolName,
      filePath,
      contentHash,
      structuralHash,
      structuralData,
      force,
    } = job;

    const overlayKey = `${filePath}#${symbolName}`;
    const overlayExists = await pgc.overlays.exists(
      'structural_patterns',
      overlayKey
    );

    if (!force && overlayExists) {
      return {
        status: 'skipped',
        message: `Pattern for ${symbolName} already exists.`,
        symbolName,
        filePath,
      };
    }

    // Mine the pattern: generate BOTH signatures and infer role for THIS SPECIFIC SYMBOL
    const signature = generateStructuralSignature(symbolName, structuralData);
    const semanticSignature = generateSemanticSignature(
      symbolName,
      structuralData
    );
    const architecturalRole = inferArchitecturalRole(
      symbolName,
      structuralData,
      filePath
    );

    return {
      status: 'success',
      message: `Successfully mined ${symbolName}`,
      symbolName,
      filePath,
      signature,
      semanticSignature, // The Shadow
      architecturalRole,
      structuralData,
      contentHash,
      structuralHash,
    };
  } catch (error: unknown) {
    const errorMsg = `Error mining ${job.symbolName}: ${(error as Error).message}`;
    console.error(`[StructuralWorker] ${errorMsg}`);
    return {
      status: 'error',
      message: errorMsg,
      symbolName: job.symbolName,
      filePath: job.filePath,
    };
  }
}

workerpool.worker({
  processStructuralPattern,
});
