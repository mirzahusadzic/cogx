import { parentPort } from 'worker_threads';
import { PGCManager } from '../../pgc/manager.js';
import { LanceVectorStore } from '../vector-db/lance-store.js';
import { WorkbenchClient } from '../../executors/workbench-client.js';
import {
  StructuralData,
  StructuralPatternMetadata,
  StructuralPatternMetadataSchema,
  ClassData,
  FunctionData,
  InterfaceData,
} from '../../types/structural.js';
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL_NAME,
} from '../../../config.js';
import { EmbedResponse } from '../../types/workbench.js';
import {
  LineagePatternMetadata,
  PatternJobPacket,
  PatternResultPacket,
  StructuralSymbolType,
} from './types.js';
import { LineageQueryResult } from './manager.js';

// This class encapsulates the logic a worker can perform.
class WorkerLogic {
  constructor(
    private pgc: PGCManager,
    private vectorDB: LanceVectorStore,
    private workbench: WorkbenchClient
  ) {}

  private _formatAsLineageJSON(lineageResult: LineageQueryResult): object {
    const rootSymbol =
      lineageResult.initialContext[0]?.classes?.[0]?.name ||
      lineageResult.initialContext[0]?.functions?.[0]?.name ||
      lineageResult.initialContext[0]?.interfaces?.[0]?.name ||
      '';

    const lineage = lineageResult.dependencies.map((dep) => {
      const depSymbol =
        dep.structuralData.classes?.[0]?.name ||
        dep.structuralData.functions?.[0]?.name ||
        dep.structuralData.interfaces?.[0]?.name ||
        '';
      return {
        type: depSymbol,
        relationship: 'uses',
        depth: dep.depth,
      };
    });

    return { symbol: rootSymbol, lineage: lineage };
  }

  private _determineMaxDepth(
    structuralData: StructuralData,
    filePath: string
  ): number {
    const MAX_OVERALL_DEPTH = 5;
    let baseDepth = 1;
    if (
      structuralData.classes?.some(
        (c: ClassData) => (c.methods?.length || 0) > 0
      ) ||
      structuralData.functions?.some(
        (f: FunctionData) => (f.params?.length || 0) > 0
      ) ||
      structuralData.interfaces?.some(
        (i: InterfaceData) => (i.properties?.length || 0) > 0
      )
    ) {
      baseDepth = 2;
    }

    const srcIndex = filePath.indexOf('src/');
    let calculatedDepth = baseDepth;

    if (srcIndex !== -1) {
      const relativePath = filePath.substring(srcIndex + 4);
      const pathSegments = relativePath.split('/').filter(Boolean);
      calculatedDepth = Math.max(
        1,
        MAX_OVERALL_DEPTH - pathSegments.length + 1
      );
    }
    return Math.max(baseDepth, calculatedDepth);
  }

  public async generateAndStoreLineagePattern(
    symbolName: string,
    symbolType: StructuralSymbolType,
    structuralData: StructuralData,
    filePath: string,
    sourceHash: string
  ): Promise<void> {
    await this.vectorDB.initialize('lineage_patterns');
    const maxDepth = this._determineMaxDepth(structuralData, filePath);

    // THE DECLARATIVE CALL: The worker simply ASKS the PGC for the lineage.
    // It no longer knows HOW the traversal is done.
    const lineageResult = await this.pgc.getLineageForSymbol(symbolName, {
      maxDepth,
    });

    const lineageJson = this._formatAsLineageJSON(lineageResult);
    const signature = JSON.stringify(lineageJson, null, 2);
    const lineageDataHash = this.pgc.objectStore.computeHash(signature);

    const embedResponse: EmbedResponse = await this.workbench.embed({
      signature,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    });
    const embedding =
      embedResponse[`embedding_${DEFAULT_EMBEDDING_DIMENSIONS}d`];
    if (!embedding) {
      throw new Error(
        `Could not find embedding for dimension ${DEFAULT_EMBEDDING_DIMENSIONS} in response for ${symbolName}`
      );
    }
    const embeddingHash = this.pgc.objectStore.computeHash(
      JSON.stringify(embedding)
    );

    const vectorId = `pattern_${filePath.replace(/[^a-zA-Z0-9_]/g, '_')}_${symbolName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    await this.vectorDB.storeVector(vectorId, embedding, {
      symbol: symbolName,
      symbolType: symbolType,
      structural_signature: signature,
      architectural_role: 'lineage_pattern',
      computed_at: new Date().toISOString(),
      lineage_hash: lineageDataHash,
    });

    const metadata: LineagePatternMetadata = {
      symbol: symbolName,
      symbolType: symbolType,
      anchor: filePath,
      lineageHash: lineageDataHash,
      embeddingHash,
      lineageSignature: signature,
      computed_at: new Date().toISOString(),
      validation: {
        sourceHash: sourceHash,
        embeddingModelVersion: DEFAULT_EMBEDDING_MODEL_NAME,
      },
      vectorId: vectorId,
    };

    const overlayKey = `${filePath}#${symbolName}`;
    await this.pgc.overlays.update('lineage_patterns', overlayKey, metadata);
    await this.pgc.overlays.updateManifest(
      'lineage_patterns',
      symbolName,
      filePath
    );
  }
}

async function processJob(job: PatternJobPacket): Promise<PatternResultPacket> {
  const { pgcRoot, projectRoot, symbolName, filePath, symbolType, force } = job;

  try {
    // Worker creates its own instances of the core systems.
    const pgc = new PGCManager(projectRoot);
    const vectorDB = new LanceVectorStore(pgcRoot);
    const workbench = new WorkbenchClient('http://localhost:8000'); // This should be configurable
    const logic = new WorkerLogic(pgc, vectorDB, workbench);

    // The rest of the logic is the same...
    const overlayKey = `${filePath}#${symbolName}`;
    if (!force && (await pgc.overlays.exists('lineage_patterns', overlayKey))) {
      return {
        status: 'skipped',
        message: `Pattern for ${symbolName} already exists.`,
        symbolName,
        filePath,
      };
    }

    const structuralPatternMeta =
      await pgc.overlays.get<StructuralPatternMetadata>(
        'structural_patterns',
        `${filePath}#${symbolName}`,
        StructuralPatternMetadataSchema
      );

    if (!structuralPatternMeta) {
      throw new Error(`Structural metadata not found for ${symbolName}.`);
    }

    const structuralDataBuffer = await pgc.objectStore.retrieve(
      structuralPatternMeta.symbolStructuralDataHash
    );

    if (!structuralDataBuffer) {
      throw new Error(`Structural data object not found for ${symbolName}.`);
    }

    const structuralData = JSON.parse(
      structuralDataBuffer.toString()
    ) as StructuralData;

    await logic.generateAndStoreLineagePattern(
      symbolName,
      symbolType,
      structuralData,
      filePath,
      structuralPatternMeta.validation.sourceHash
    );

    return {
      status: 'success',
      message: `Successfully generated pattern for ${symbolName}.`,
      symbolName,
      filePath,
    };
  } catch (error: unknown) {
    return {
      status: 'error',
      message: `Error processing ${symbolName}: ${(error as Error).message}`,
      symbolName,
      filePath,
    };
  }
}

parentPort?.on('message', async (job: PatternJobPacket) => {
  const result = await processJob(job);
  parentPort?.postMessage(result);
});
