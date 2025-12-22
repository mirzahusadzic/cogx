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
import * as crypto from 'crypto';
import fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import chalk from 'chalk';
import { ZeroMQBus } from './ZeroMQBus.js';
import { getHomeDir } from '../utils/home-dir.js';

const DEBUG_IPC = process.env.DEBUG_IPC === '1';

/**
 * Coordinates the creation of a single ZeroMQ bus master.
 *
 * This class prevents race conditions when multiple TUI instances or agents
 * start simultaneously. It uses a file-based lock to ensure that only one
 * process becomes the "bus master" (binding the ZeroMQ sockets), while all
 * other processes connect as peers.
 *
 * @class BusCoordinator
 *
 * @example
 * const coordinator = new BusCoordinator();
 * try {
 *   const bus = await coordinator.connectWithFallback();
 *   console.log('Connected to bus. Master:', coordinator.getIsBusMaster());
 *   // ... use bus
 * } finally {
 *   await coordinator.cleanup();
 * }
 */
export class BusCoordinator {
  private lockPath: string;
  private pidPath: string;
  private socketPath: string;
  private bus: ZeroMQBus | null = null;
  private isBusMaster: boolean = false;

  /**
   * Creates an instance of BusCoordinator.
   *
   * @param projectRoot - Optional project root path. When provided and IPC_SIGMA_BUS is not set,
   *                      creates a project-specific bus to isolate agents by project.
   */
  constructor(projectRoot?: string) {
    // Store lock file in .cognition directory
    const cogniDir = path.join(getHomeDir(), '.cognition');

    // Determine bus identifier:
    // 1. If IPC_SIGMA_BUS is set → use that (e.g., "global", "team")
    // 2. If projectRoot provided → use project name + hash of full path (collision-resistant)
    // 3. Otherwise → use "default" (legacy shared bus)
    const sharedBusName = process.env.IPC_SIGMA_BUS;
    const busIdentifier = sharedBusName
      ? sharedBusName
      : projectRoot
        ? this.getProjectIdentifier(projectRoot)
        : 'default';

    const busPrefix = `bus-${busIdentifier}`;

    this.lockPath = path.join(cogniDir, `${busPrefix}.lock`);
    this.pidPath = path.join(cogniDir, `${busPrefix}-master.pid`);
    this.socketPath = this.getSocketPath(busIdentifier);
  }

  /**
   * Generates a unique, collision-resistant identifier for a project.
   * Uses basename + short hash of full path to ensure:
   * - Same project always gets same identifier (multiple agents can find each other)
   * - Different projects with same name get different identifiers (no collisions)
   *
   * @param projectRoot - The full path to the project root
   * @returns A string like "my-project-a1b2c3" (basename + 6-char hash)
   */
  private getProjectIdentifier(projectRoot: string): string {
    const basename = path.basename(projectRoot);
    const hash = crypto
      .createHash('sha256')
      .update(projectRoot)
      .digest('hex')
      .slice(0, 6);
    return `${basename}-${hash}`;
  }

  /**
   * Establishes a connection to the ZeroMQ bus, coordinating to elect a master.
   *
   * This method acquires a lock, checks if a master process is already running,
   * and then either binds as the new master or connects as a peer.
   *
   * @returns {Promise<ZeroMQBus>} A connected ZeroMQBus instance.
   * @throws {Error} If locking fails after multiple retries.
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
        await this.writePidFile();
        this.isBusMaster = true;
        if (DEBUG_IPC) {
          console.log(chalk.dim('🚌 Bus Master: Bound to', this.socketPath));
        }
      } else {
        // Connect as peer
        this.bus = new ZeroMQBus({ address: this.socketPath });
        await this.bus.connect();
        this.isBusMaster = false;
        if (DEBUG_IPC) {
          console.log(chalk.dim('🔌 Peer: Connected to', this.socketPath));
        }
      }

      return this.bus;
    } finally {
      // Always release lock
      await release();
    }
  }

  /**
   * Checks if the bus master process is alive.
   *
   * It reads the PID from the `bus-master.pid` file and checks if a process
   * with that PID is running. It also cleans up stale PID and socket files if
   * the master process is found to be dead.
   *
   * @private
   * @returns {Promise<boolean>} `true` if the master is alive, `false` otherwise.
   */
  private async pingBusMaster(): Promise<boolean> {
    try {
      // Check if PID file exists
      if (!(await fs.pathExists(this.pidPath))) {
        return false;
      }

      // Read PID from file
      const pidStr = await fs.readFile(this.pidPath, 'utf-8');
      const pid = parseInt(pidStr.trim(), 10);

      if (isNaN(pid)) {
        // Invalid PID file, remove it
        await fs.remove(this.pidPath);
        return false;
      }

      // Check if process is still running
      try {
        // Signal 0 doesn't kill the process, just checks if it exists
        process.kill(pid, 0);
        return true; // Process exists
      } catch {
        // Process doesn't exist, clean up stale files
        await fs.remove(this.pidPath);

        // Also remove stale socket files
        if (this.socketPath.startsWith('ipc://')) {
          const socketFile = this.socketPath.replace('ipc://', '');
          const subSocketFile = socketFile.replace('.sock', '-sub.sock');
          await fs.remove(socketFile).catch(() => {});
          await fs.remove(subSocketFile).catch(() => {});
        }

        return false;
      }
    } catch {
      // Any error means Bus Master is not alive
      return false;
    }
  }

  /**
   * Writes the current process ID to the PID file.
   * This is called when this instance becomes the bus master.
   * @private
   */
  private async writePidFile(): Promise<void> {
    await fs.writeFile(this.pidPath, process.pid.toString());
  }

  /**
   * Removes the PID file.
   * @private
   */
  private async removePidFile(): Promise<void> {
    try {
      await fs.remove(this.pidPath);
    } catch {
      // Ignore removal errors
    }
  }

  /**
   * Determines the appropriate cross-platform socket path.
   *
   * Supports IPC_SIGMA_BUS environment variable for custom shared bus naming:
   * - If IPC_SIGMA_BUS is set, uses: ipc-sigma-<value>.sock (Unix) or cognition-sigma-<value> (Windows)
   * - If not set, uses default: cognition-bus.sock (Unix) or cognition-bus (Windows)
   *
   * This allows multiple "meshes" of agents to be isolated by using different
   * values for IPC_SIGMA_BUS, or unified by using the same value.
   *
   * @example
   * // Default shared bus (all agents on same machine)
   * // No IPC_SIGMA_BUS set → /tmp/cognition-bus.sock
   *
   * @example
   * // Custom mesh for project group
   * // IPC_SIGMA_BUS=frontend → /tmp/ipc-sigma-frontend.sock
   *
   * @example
   * // Global mesh across all projects
   * // IPC_SIGMA_BUS=global → /tmp/ipc-sigma-global.sock
   *
   * @private
   * @returns {string} The IPC or TCP socket path.
   */
  private getSocketPath(busIdentifier: string): string {
    // Socket naming strategy:
    // - IPC_SIGMA_BUS set → shared mesh, no UID (intentional cross-user/cross-project sharing)
    // - IPC_SIGMA_BUS not set → project-specific, include UID for user isolation
    const isSharedMesh = !!process.env.IPC_SIGMA_BUS;

    if (process.platform === 'win32') {
      // Windows: Use named pipe
      if (isSharedMesh) {
        // Shared mesh: use bus name directly for cross-project discovery
        return `ipc:////./pipe/cognition-${busIdentifier}`;
      } else {
        // Project-specific: include username for user isolation
        const username = os.userInfo().username;
        const pipeName =
          busIdentifier === 'default'
            ? `cognition-${username}-bus`
            : `cognition-${username}-${busIdentifier}`;
        return `ipc:////./pipe/${pipeName}`;
      }
    } else {
      // Unix/Mac: Use IPC socket in /tmp
      if (isSharedMesh) {
        // Shared mesh: use bus name directly for cross-project discovery
        return `ipc://${path.join(os.tmpdir(), `cognition-${busIdentifier}.sock`)}`;
      } else {
        // Project-specific: include UID for user isolation
        const uid = process.getuid?.() ?? os.userInfo().uid;
        const socketName =
          busIdentifier === 'default'
            ? `cognition-${uid}-bus.sock`
            : `cognition-${uid}-${busIdentifier}.sock`;
        return `ipc://${path.join(os.tmpdir(), socketName)}`;
      }
    }
  }

  /**
   * Connects to the bus with a fallback to TCP if IPC fails.
   *
   * This is the recommended method for connecting, as it provides resilience
   * against potential issues with IPC sockets on certain systems.
   *
   * @returns {Promise<ZeroMQBus>} A connected ZeroMQBus instance.
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
   * Checks if this instance is the bus master.
   *
   * @returns {boolean} `true` if this instance is the master, `false` otherwise.
   */
  getIsBusMaster(): boolean {
    return this.isBusMaster;
  }

  /**
   * Retrieves the underlying ZeroMQBus instance.
   *
   * @returns {ZeroMQBus | null} The bus instance, or `null` if not connected.
   */
  getBus(): ZeroMQBus | null {
    return this.bus;
  }

  /**
   * Cleans up resources, such as closing the bus connection.
   *
   * If this instance was the bus master, it also removes the PID and socket files.
   * This should be called on application exit to ensure a clean shutdown.
   *
   */
  async cleanup(): Promise<void> {
    if (this.bus) {
      await this.bus.close();
      this.bus = null;
    }

    // If we were Bus Master, cleanup socket and PID files
    if (this.isBusMaster) {
      await this.removePidFile();

      if (this.socketPath.startsWith('ipc://')) {
        try {
          const socketFile = this.socketPath.replace('ipc://', '');
          const subSocketFile = socketFile.replace('.sock', '-sub.sock');

          await fs.remove(socketFile);
          await fs.remove(subSocketFile);

          if (DEBUG_IPC) {
            console.log('🧹 Cleaned up socket files');
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}
