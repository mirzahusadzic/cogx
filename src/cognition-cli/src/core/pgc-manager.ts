import { ObjectStore } from './object-store.js';
import { TransformLog } from './transform-log.js';
import { Index } from './index.js';
import { ReverseDeps } from './reverse-deps.js';
import path from 'path';

export class PGCManager {
  public objectStore: ObjectStore;
  public transformLog: TransformLog;
  public index: Index;
  public reverseDeps: ReverseDeps;
  private pgcRoot: string;

  constructor(projectRoot: string) {
    this.pgcRoot = path.join(projectRoot, '.open_cognition');
    this.objectStore = new ObjectStore(this.pgcRoot);
    this.transformLog = new TransformLog(this.pgcRoot);
    this.index = new Index(this.pgcRoot);
    this.reverseDeps = new ReverseDeps(this.pgcRoot);
  }
}
