import path from 'path';
import { Index } from './index.js';
import { ObjectStore } from './object-store.js';
import { TransformLog } from './transform-log.js';
import { ReverseDeps } from './reverse-deps.js';
import { Overlays } from './overlays.js';

/**
 * PGCStoreContext manages the physical location and initialization
 * of the PGC data structures.
 *
 * GROUNDED CONTEXT POOL (PGC Root):
 * All data lives in .open_cognition/:
 * - objects/: Content-addressable blobs (git-style sharding)
 * - index.jsonl: Symbol → hash mapping
 * - transform.jsonl: Transform provenance log
 * - reverse_deps.jsonl: Dependency graph edges
 * - overlays/: Pattern metadata by overlay type
 * - lance/: Vector embeddings (LanceDB)
 */
export class PGCStoreContext {
  public readonly projectRoot: string;
  public readonly pgcRoot: string;
  public readonly index: Index;
  public readonly objectStore: ObjectStore;
  public readonly transformLog: TransformLog;
  public readonly reverseDeps: ReverseDeps;
  public readonly overlays: Overlays;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.pgcRoot = path.join(this.projectRoot, '.open_cognition');

    // Initialize the components
    this.index = new Index(this.pgcRoot);
    this.objectStore = new ObjectStore(this.pgcRoot);
    this.transformLog = new TransformLog(this.pgcRoot);
    this.reverseDeps = new ReverseDeps(this.pgcRoot);
    this.overlays = new Overlays(this.pgcRoot);
  }
}
