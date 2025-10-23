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
  signature?: string;
  architecturalRole?: string;
  structuralData?: StructuralData;
  contentHash?: string;
  structuralHash?: string;
  message?: string;
}

// Helper functions (duplicated to keep worker self-contained)
function inferArchitecturalRole(structuralData: StructuralData): string {
  if (structuralData.classes && structuralData.classes.length > 0) {
    const className = structuralData.classes[0].name;
    if (className.includes('Repository')) return 'data_access';
    if (className.includes('Service')) return 'service';
    if (className.includes('Controller') || className.includes('Handler'))
      return 'controller';
    if (className.includes('Orchestrator')) return 'orchestrator';
  }
  if (structuralData.functions && structuralData.functions.length > 0) {
    const functionName = structuralData.functions[0].name;
    if (functionName.includes('Handler')) return 'controller';
    if (functionName.includes('Util') || functionName.includes('Helper'))
      return 'utility';
  }
  if (structuralData.type) {
    if (structuralData.type.includes('Repository')) return 'data_access';
    if (structuralData.type.includes('Service')) return 'service';
    if (
      structuralData.type.includes('Controller') ||
      structuralData.type.includes('Handler')
    )
      return 'controller';
    if (structuralData.type.includes('Orchestrator')) return 'orchestrator';
  }
  return 'component';
}

function generateStructuralSignature(structuralData: StructuralData): string {
  const parts: string[] = [];

  if (structuralData.classes && structuralData.classes.length > 0) {
    const cls = structuralData.classes[0];
    parts.push(`class:${cls.name}`);
    if (cls.base_classes && cls.base_classes.length > 0) {
      parts.push(`extends:${cls.base_classes.join(',')}`);
    }
    if (cls.implements_interfaces && cls.implements_interfaces.length > 0) {
      parts.push(`implements:${cls.implements_interfaces.join(',')}`);
    }
    parts.push(`methods:${cls.methods.length}`);
    parts.push(`decorators:${cls.decorators.length}`);
  }

  if (structuralData.functions && structuralData.functions.length > 0) {
    const func = structuralData.functions[0];
    parts.push(`function:${func.name}`);
    parts.push(`params:${func.params.length}`);
    parts.push(`returns:${func.returns}`);
    parts.push(`async:${func.is_async}`);
    parts.push(`decorators:${func.decorators.length}`);
  }

  if (structuralData.interfaces && structuralData.interfaces.length > 0) {
    const iface = structuralData.interfaces[0];
    parts.push(`interface:${iface.name}`);
    parts.push(`properties:${iface.properties.length}`);
  }

  if (structuralData.imports && structuralData.imports.length > 0) {
    parts.push(`imports:${structuralData.imports.length}`);
  }

  if (structuralData.exports && structuralData.exports.length > 0) {
    parts.push(`exports:${structuralData.exports.length}`);
  }

  if (structuralData.type) {
    parts.push(`type:${structuralData.type}`);
  }

  return parts.sort().join(' | ');
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

    // Mine the pattern: generate signature and infer role
    const signature = generateStructuralSignature(structuralData);
    const architecturalRole = inferArchitecturalRole(structuralData);

    return {
      status: 'success',
      message: `Successfully mined ${symbolName}`,
      symbolName,
      filePath,
      signature,
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
