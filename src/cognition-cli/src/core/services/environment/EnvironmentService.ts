import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * EnvironmentService handles OS detection, process management, and path resolution.
 */
export class EnvironmentService {
  private static instance: EnvironmentService;

  private constructor() {}

  /**
   * Get the singleton instance of EnvironmentService.
   */
  public static getInstance(): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService();
    }
    return EnvironmentService.instance;
  }

  /**
   * Returns the current working directory.
   */
  public getCwd(): string {
    return process.cwd();
  }

  /**
   * Returns an environment variable value.
   */
  public getEnv(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Detects the root of the current git repository.
   *
   * @param cwd - Optional directory to start searching from
   */
  public getRepoRoot(cwd: string = this.getCwd()): string {
    try {
      return execSync('git rev-parse --show-toplevel', {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
    } catch {
      // Fallback to CWD if not in a git repo
      return cwd;
    }
  }

  /**
   * Resolves the .sigma directory.
   *
   * Behavior:
   * - If IPC_SIGMA_BUS is NOT set → use project-local .sigma (${repoRoot}/.sigma)
   * - If IPC_SIGMA_BUS=global → use ~/.cognition/sigma-global
   * - If IPC_SIGMA_BUS=team → use ~/.cognition/sigma-team
   * - If IPC_SIGMA_BUS=<custom> → use ~/.cognition/sigma-<custom>
   *
   * @param projectRoot - Optional project root to override auto-detection
   */
  public resolveSigmaDir(projectRoot?: string): string {
    const busName = this.getEnv('IPC_SIGMA_BUS');

    if (busName) {
      // Shared .sigma directory in user's home
      return path.join(this.getHomeDir(), '.cognition', `sigma-${busName}`);
    } else {
      // Project-local .sigma directory
      const root = projectRoot || this.getRepoRoot();
      return path.join(root, '.sigma');
    }
  }

  /**
   * Find PGC root by walking up directory tree.
   *
   * Searches for .open_cognition directory starting from startDir
   * and moving upward until found or filesystem root reached.
   *
   * @param startDir - Directory to start search from (default: process.cwd())
   * @returns Path to project root (containing .open_cognition) or null if not found
   */
  public findProjectRoot(startDir: string = this.getCwd()): string | null {
    let currentDir = path.resolve(startDir);
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const pgcPath = path.join(currentDir, '.open_cognition');
      if (fs.existsSync(pgcPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    // Check root directory too
    const pgcPath = path.join(root, '.open_cognition');
    if (fs.existsSync(pgcPath)) {
      return root;
    }

    return null;
  }

  /**
   * Resolves the .open_cognition (PGC) directory.
   *
   * @param projectRoot - Optional project root to override auto-detection
   */
  public resolvePgcDir(projectRoot?: string): string {
    const root = projectRoot || this.findProjectRoot() || this.getRepoRoot();
    return path.join(root, '.open_cognition');
  }

  /**
   * Resolves an absolute path from a potentially relative path.
   */
  public resolvePath(
    filePath: string,
    baseDir: string = this.getCwd()
  ): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.resolve(baseDir, filePath);
  }

  /**
   * Checks if the current environment is a workbench.
   */
  public isWorkbench(): boolean {
    return !!(
      this.getEnv('WORKBENCH_URL') || this.getEnv('COGNITION_OPENAI_MODEL')
    );
  }

  /**
   * Detects the type of shell being used.
   */
  public getShellType(): string {
    const shellPath =
      this.getEnv('SHELL') || (this.isWindows() ? 'cmd.exe' : '/bin/sh');
    return path.basename(shellPath);
  }

  /**
   * OS detection helpers.
   */
  public isWindows(): boolean {
    return process.platform === 'win32';
  }

  public isMac(): boolean {
    return process.platform === 'darwin';
  }

  public isLinux(): boolean {
    return process.platform === 'linux';
  }

  /**
   * Get the current user's home directory.
   * Respects COGNITION_HOME_DIR for testing and isolation.
   */
  public getHomeDir(): string {
    return this.getEnv('COGNITION_HOME_DIR') || os.homedir();
  }

  /**
   * Checks if running in a CI environment.
   */
  public isCI(): boolean {
    return this.getEnv('CI') === 'true';
  }

  /**
   * Returns the terminal width.
   */
  public getTerminalWidth(): number {
    return process.stdout.columns || 80;
  }

  /**
   * Checks if interactive prompts are allowed.
   */
  public isInteractive(): boolean {
    // Respect --no-input flag
    if (this.getEnv('COGNITION_NO_INPUT') === '1') return false;

    // Not interactive if stdin is not a TTY
    if (!process.stdin.isTTY) return false;

    // Disable in CI environments
    return !this.isCI();
  }
}

/**
 * Exported singleton instance of EnvironmentService.
 */
export const environmentService = EnvironmentService.getInstance();
