/**
 * Bus Coordinator
 *
 * Prevents race conditions when multiple TUI instances start simultaneously.
 * Uses proper-lockfile (already in package.json) for coordination.
 *
 * Protocol:
 * 1. Acquire lock
 * 2. Check if Bus Master is alive (ping socket)
 * 3. If not alive → Bind (become Bus Master)
 * 4. If alive → Connect (become peer)
 * 5. Release lock
 */

import * as lockfile from 'proper-lockfile';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as zmq from 'zeromq';
import { ZeroMQBus } from './ZeroMQBus.js';

export class BusCoordinator {
  private lockPath: string;
  private socketPath: string;
  private bus: ZeroMQBus | null = null;
  private isBusMaster: boolean = false;

  constructor() {
    // Store lock file in .cognition directory
    const cogniDir = path.join(os.homedir(), '.cognition');
    this.lockPath = path.join(cogniDir, 'bus.lock');
    this.socketPath = this.getSocketPath();
  }

  /**
   * Coordinate bus access with race condition prevention
   */
  async connect(): Promise<ZeroMQBus> {
    // Ensure lock file parent directory exists
    await fs.ensureDir(path.dirname(this.lockPath));

    // Ensure lock file exists
    if (!(await fs.pathExists(this.lockPath))) {
      await fs.writeFile(this.lockPath, '');
    }

    // Acquire lock (blocks if another TUI is coordinating)
    const release = await lockfile.lock(this.lockPath, {
      retries: {
        retries: 5,
        minTimeout: 100,
        maxTimeout: 1000,
      },
    });

    try {
      // Check if Bus Master is alive
      const masterAlive = await this.pingBusMaster();

      if (!masterAlive) {
        // Become Bus Master
        this.bus = new ZeroMQBus({ address: this.socketPath });
        await this.bus.bind();
        this.isBusMaster = true;
        console.log('🚌 Bus Master: Bound to', this.socketPath);
      } else {
        // Connect as peer
        this.bus = new ZeroMQBus({ address: this.socketPath });
        await this.bus.connect();
        this.isBusMaster = false;
        console.log('🔌 Peer: Connected to', this.socketPath);
      }

      return this.bus;
    } finally {
      // Always release lock
      await release();
    }
  }

  /**
   * Check if Bus Master is alive by attempting to connect
   */
  private async pingBusMaster(): Promise<boolean> {
    try {
      // For IPC sockets, check if socket file exists
      if (this.socketPath.startsWith('ipc://')) {
        const socketFile = this.socketPath.replace('ipc://', '');
        const exists = await fs.pathExists(socketFile);

        if (!exists) {
          return false;
        }
      }

      // Try to connect to the socket with a timeout
      const testSocket = new zmq.Request();
      testSocket.connect(this.socketPath);
      testSocket.sendTimeout = 100;
      testSocket.receiveTimeout = 100;

      try {
        // Try to send a ping
        await testSocket.send('ping');

        // Wait for pong (or timeout)
        const response = await testSocket.receive();
        const isPong = response.toString() === 'pong';

        await testSocket.close();
        return isPong;
      } catch {
        // Timeout or connection refused
        await testSocket.close();
        return false;
      }
    } catch {
      // Any error means Bus Master is not alive
      return false;
    }
  }

  /**
   * Get cross-platform socket path
   */
  private getSocketPath(): string {
    if (process.platform === 'win32') {
      // Windows: Use named pipe
      return 'ipc:////./pipe/cognition-bus';
    } else {
      // Unix/Mac: Use IPC socket in /tmp
      return `ipc://${path.join(os.tmpdir(), 'cognition-bus.sock')}`;
    }
  }

  /**
   * Connect with fallback to TCP if IPC fails
   */
  async connectWithFallback(): Promise<ZeroMQBus> {
    try {
      return await this.connect();
    } catch (err) {
      console.warn('⚠️  IPC socket failed, falling back to TCP');
      console.warn(
        '   Error:',
        err instanceof Error ? err.message : String(err)
      );

      // Fallback to TCP on localhost
      this.socketPath = 'tcp://127.0.0.1:5555';
      return await this.connect();
    }
  }

  /**
   * Check if this instance is the Bus Master
   */
  getIsBusMaster(): boolean {
    return this.isBusMaster;
  }

  /**
   * Get the bus instance
   */
  getBus(): ZeroMQBus | null {
    return this.bus;
  }

  /**
   * Cleanup on exit
   */
  async cleanup(): Promise<void> {
    if (this.bus) {
      await this.bus.close();
      this.bus = null;
    }

    // If we were Bus Master, cleanup socket files
    if (this.isBusMaster && this.socketPath.startsWith('ipc://')) {
      try {
        const socketFile = this.socketPath.replace('ipc://', '');
        const subSocketFile = socketFile.replace('.sock', '-sub.sock');

        await fs.remove(socketFile);
        await fs.remove(subSocketFile);

        console.log('🧹 Cleaned up socket files');
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
