/**
 * BusCoordinator Tests
 *
 * Covers:
 * - Project-specific bus isolation (default behavior)
 * - Named mesh buses (IPC_SIGMA_BUS)
 * - PID/lock file isolation
 * - Socket path generation
 * - Bus master election
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BusCoordinator } from '../BusCoordinator';
import * as path from 'path';
import * as os from 'os';
import fs from 'fs-extra';

// Helper type to access private fields for testing
type BusCoordinatorPrivate = {
  socketPath: string;
  pidPath: string;
  lockPath: string;
};

describe('BusCoordinator', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let tempDir: string;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temp directory for sandboxing
    tempDir = path.join(
      os.tmpdir(),
      `bus-coord-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);
    process.env.COGNITION_HOME_DIR = tempDir;
  });

  afterEach(async () => {
    // Restore environment
    process.env = originalEnv;

    // Clean up temp directory
    if (tempDir && (await fs.pathExists(tempDir))) {
      await fs.remove(tempDir);
    }
  });

  describe('Socket Path Generation', () => {
    it('should create project-specific socket when IPC_SIGMA_BUS not set', () => {
      delete process.env.IPC_SIGMA_BUS;
      const projectRoot = '/Users/dev/my-project';

      const coordinator = new BusCoordinator(projectRoot);
      const socketPath = (coordinator as unknown as BusCoordinatorPrivate)
        .socketPath;

      // Socket includes UID (user isolation) + basename + hash (collision resistance)
      if (process.platform === 'win32') {
        // Windows: cognition-<username>-<basename>-<hash>
        expect(socketPath).toMatch(
          /^ipc:\/\/\/\/\.\/pipe\/cognition-\w+-my-project-[a-f0-9]{6}$/
        );
      } else {
        // Unix: cognition-<uid>-<basename>-<hash>.sock
        expect(socketPath).toMatch(
          /cognition-\d+-my-project-[a-f0-9]{6}\.sock$/
        );
      }
    });

    it('should create named mesh socket when IPC_SIGMA_BUS is set', () => {
      process.env.IPC_SIGMA_BUS = 'global';
      const projectRoot = '/Users/dev/my-project';

      const coordinator = new BusCoordinator(projectRoot);
      const socketPath = (coordinator as unknown as BusCoordinatorPrivate)
        .socketPath;

      if (process.platform === 'win32') {
        expect(socketPath).toBe('ipc:////./pipe/cognition-global');
      } else {
        expect(socketPath).toMatch(/cognition-global\.sock$/);
      }
    });

    it('should create default socket when no projectRoot and no IPC_SIGMA_BUS', () => {
      delete process.env.IPC_SIGMA_BUS;

      const coordinator = new BusCoordinator();
      const socketPath = (coordinator as unknown as BusCoordinatorPrivate)
        .socketPath;

      // Default socket still includes UID for user isolation
      if (process.platform === 'win32') {
        expect(socketPath).toMatch(/^ipc:\/\/\/\/\.\/pipe\/cognition-\w+-bus$/);
      } else {
        expect(socketPath).toMatch(/cognition-\d+-bus\.sock$/);
      }
    });

    it('should use different sockets for different projects', () => {
      delete process.env.IPC_SIGMA_BUS;

      const coordinator1 = new BusCoordinator('/Users/dev/project-a');
      const coordinator2 = new BusCoordinator('/Users/dev/project-b');

      const socket1 = (coordinator1 as unknown as BusCoordinatorPrivate)
        .socketPath;
      const socket2 = (coordinator2 as unknown as BusCoordinatorPrivate)
        .socketPath;

      expect(socket1).not.toBe(socket2);
      expect(socket1).toContain('project-a');
      expect(socket2).toContain('project-b');
    });

    it('should use same socket for same project', () => {
      delete process.env.IPC_SIGMA_BUS;

      const coordinator1 = new BusCoordinator('/Users/dev/my-project');
      const coordinator2 = new BusCoordinator('/Users/dev/my-project');

      const socket1 = (coordinator1 as unknown as BusCoordinatorPrivate)
        .socketPath;
      const socket2 = (coordinator2 as unknown as BusCoordinatorPrivate)
        .socketPath;

      expect(socket1).toBe(socket2);
    });

    it('should use same socket for same IPC_SIGMA_BUS across projects', () => {
      process.env.IPC_SIGMA_BUS = 'global';

      const coordinator1 = new BusCoordinator('/Users/dev/project-a');
      const coordinator2 = new BusCoordinator('/Users/dev/project-b');

      const socket1 = (coordinator1 as unknown as BusCoordinatorPrivate)
        .socketPath;
      const socket2 = (coordinator2 as unknown as BusCoordinatorPrivate)
        .socketPath;

      expect(socket1).toBe(socket2);
      expect(socket1).toContain('global');
    });
  });

  describe('PID File Isolation', () => {
    it('should create project-specific PID file when IPC_SIGMA_BUS not set', () => {
      delete process.env.IPC_SIGMA_BUS;
      const projectRoot = '/Users/dev/my-project';

      const coordinator = new BusCoordinator(projectRoot);
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;

      // PID file includes basename + hash for collision resistance
      expect(pidPath).toMatch(/bus-my-project-[a-f0-9]{6}-master\.pid$/);
    });

    it('should create named mesh PID file when IPC_SIGMA_BUS is set', () => {
      process.env.IPC_SIGMA_BUS = 'global';
      const projectRoot = '/Users/dev/my-project';

      const coordinator = new BusCoordinator(projectRoot);
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;

      expect(pidPath).toContain('bus-global-master.pid');
    });

    it('should create default PID file when no projectRoot and no IPC_SIGMA_BUS', () => {
      delete process.env.IPC_SIGMA_BUS;

      const coordinator = new BusCoordinator();
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;

      expect(pidPath).toContain('bus-default-master.pid');
    });

    it('should use different PID files for different projects', () => {
      delete process.env.IPC_SIGMA_BUS;

      const coordinator1 = new BusCoordinator('/Users/dev/project-a');
      const coordinator2 = new BusCoordinator('/Users/dev/project-b');

      const pid1 = (coordinator1 as unknown as BusCoordinatorPrivate).pidPath;
      const pid2 = (coordinator2 as unknown as BusCoordinatorPrivate).pidPath;

      expect(pid1).not.toBe(pid2);
      expect(pid1).toContain('project-a');
      expect(pid2).toContain('project-b');
    });

    it('should use different PID files for different IPC_SIGMA_BUS values', () => {
      // First coordinator without IPC_SIGMA_BUS (project-specific)
      delete process.env.IPC_SIGMA_BUS;
      const coordinator1 = new BusCoordinator('/Users/dev/project');

      // Second coordinator with IPC_SIGMA_BUS=global
      process.env.IPC_SIGMA_BUS = 'global';
      const coordinator2 = new BusCoordinator('/Users/dev/project');

      // Third coordinator with IPC_SIGMA_BUS=team
      process.env.IPC_SIGMA_BUS = 'team';
      const coordinator3 = new BusCoordinator('/Users/dev/project');

      const pid1 = (coordinator1 as unknown as BusCoordinatorPrivate).pidPath;
      const pid2 = (coordinator2 as unknown as BusCoordinatorPrivate).pidPath;
      const pid3 = (coordinator3 as unknown as BusCoordinatorPrivate).pidPath;

      expect(pid1).toContain('project');
      expect(pid2).toContain('global');
      expect(pid3).toContain('team');
      expect(pid1).not.toBe(pid2);
      expect(pid2).not.toBe(pid3);
    });
  });

  describe('Lock File Isolation', () => {
    it('should create project-specific lock file when IPC_SIGMA_BUS not set', () => {
      delete process.env.IPC_SIGMA_BUS;
      const projectRoot = '/Users/dev/my-project';

      const coordinator = new BusCoordinator(projectRoot);
      const lockPath = (coordinator as unknown as BusCoordinatorPrivate)
        .lockPath;

      // Lock file includes basename + hash for collision resistance
      expect(lockPath).toMatch(/bus-my-project-[a-f0-9]{6}\.lock$/);
    });

    it('should create named mesh lock file when IPC_SIGMA_BUS is set', () => {
      process.env.IPC_SIGMA_BUS = 'global';
      const projectRoot = '/Users/dev/my-project';

      const coordinator = new BusCoordinator(projectRoot);
      const lockPath = (coordinator as unknown as BusCoordinatorPrivate)
        .lockPath;

      expect(lockPath).toContain('bus-global.lock');
    });

    it('should use different lock files for different projects', () => {
      delete process.env.IPC_SIGMA_BUS;

      const coordinator1 = new BusCoordinator('/Users/dev/project-a');
      const coordinator2 = new BusCoordinator('/Users/dev/project-b');

      const lock1 = (coordinator1 as unknown as BusCoordinatorPrivate).lockPath;
      const lock2 = (coordinator2 as unknown as BusCoordinatorPrivate).lockPath;

      expect(lock1).not.toBe(lock2);
      expect(lock1).toContain('project-a');
      expect(lock2).toContain('project-b');
    });
  });

  describe('Bus Identifier Logic', () => {
    it('should prioritize IPC_SIGMA_BUS over projectRoot', () => {
      process.env.IPC_SIGMA_BUS = 'global';
      const projectRoot = '/Users/dev/my-project';

      const coordinator = new BusCoordinator(projectRoot);
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;
      const lockPath = (coordinator as unknown as BusCoordinatorPrivate)
        .lockPath;
      const socketPath = (coordinator as unknown as BusCoordinatorPrivate)
        .socketPath;

      // Should all use "global", not "my-project"
      expect(pidPath).toContain('global');
      expect(lockPath).toContain('global');
      expect(socketPath).toContain('global');
      expect(pidPath).not.toContain('my-project');
    });

    it('should use projectRoot basename when IPC_SIGMA_BUS not set', () => {
      delete process.env.IPC_SIGMA_BUS;
      const projectRoot = '/Users/dev/some/deep/path/my-project';

      const coordinator = new BusCoordinator(projectRoot);
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;

      expect(pidPath).toContain('my-project');
      expect(pidPath).not.toContain('/Users/dev');
    });

    it('should fallback to "default" when neither IPC_SIGMA_BUS nor projectRoot provided', () => {
      delete process.env.IPC_SIGMA_BUS;

      const coordinator = new BusCoordinator();
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;
      const lockPath = (coordinator as unknown as BusCoordinatorPrivate)
        .lockPath;
      const socketPath = (coordinator as unknown as BusCoordinatorPrivate)
        .socketPath;

      expect(pidPath).toContain('bus-default');
      expect(lockPath).toContain('bus-default');
      // Socket includes UID for user isolation
      if (process.platform === 'win32') {
        expect(socketPath).toMatch(/^ipc:\/\/\/\/\.\/pipe\/cognition-\w+-bus$/);
      } else {
        expect(socketPath).toMatch(/cognition-\d+-bus\.sock$/);
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should isolate two projects running simultaneously', () => {
      delete process.env.IPC_SIGMA_BUS;

      // Two different projects
      const projectA = new BusCoordinator('/Users/dev/project-a');
      const projectB = new BusCoordinator('/Users/dev/project-b');

      // They should have completely different bus infrastructure
      expect(
        (projectA as unknown as BusCoordinatorPrivate).socketPath
      ).not.toBe((projectB as unknown as BusCoordinatorPrivate).socketPath);
      expect((projectA as unknown as BusCoordinatorPrivate).pidPath).not.toBe(
        (projectB as unknown as BusCoordinatorPrivate).pidPath
      );
      expect((projectA as unknown as BusCoordinatorPrivate).lockPath).not.toBe(
        (projectB as unknown as BusCoordinatorPrivate).lockPath
      );
    });

    it('should share bus for agents in same project', () => {
      delete process.env.IPC_SIGMA_BUS;
      const projectRoot = '/Users/dev/my-project';

      // Two agents in same project
      const agent1 = new BusCoordinator(projectRoot);
      const agent2 = new BusCoordinator(projectRoot);

      // They should share the same bus infrastructure
      expect((agent1 as unknown as BusCoordinatorPrivate).socketPath).toBe(
        (agent2 as unknown as BusCoordinatorPrivate).socketPath
      );
      expect((agent1 as unknown as BusCoordinatorPrivate).pidPath).toBe(
        (agent2 as unknown as BusCoordinatorPrivate).pidPath
      );
      expect((agent1 as unknown as BusCoordinatorPrivate).lockPath).toBe(
        (agent2 as unknown as BusCoordinatorPrivate).lockPath
      );
    });

    it('should share bus for global mesh across projects', () => {
      process.env.IPC_SIGMA_BUS = 'global';

      // Agents in different projects
      const agent1 = new BusCoordinator('/Users/dev/project-a');
      const agent2 = new BusCoordinator('/Users/dev/project-b');

      // They should share the same bus infrastructure
      expect((agent1 as unknown as BusCoordinatorPrivate).socketPath).toBe(
        (agent2 as unknown as BusCoordinatorPrivate).socketPath
      );
      expect((agent1 as unknown as BusCoordinatorPrivate).pidPath).toBe(
        (agent2 as unknown as BusCoordinatorPrivate).pidPath
      );
      expect((agent1 as unknown as BusCoordinatorPrivate).lockPath).toBe(
        (agent2 as unknown as BusCoordinatorPrivate).lockPath
      );
    });

    it('should NOT mix default bus with project-specific buses', () => {
      delete process.env.IPC_SIGMA_BUS;

      // Old-style agent (no projectRoot)
      const legacyAgent = new BusCoordinator();

      // New-style agent (with projectRoot)
      const newAgent = new BusCoordinator('/Users/dev/my-project');

      // They should NOT share infrastructure
      expect(
        (legacyAgent as unknown as BusCoordinatorPrivate).socketPath
      ).not.toBe((newAgent as unknown as BusCoordinatorPrivate).socketPath);
      expect(
        (legacyAgent as unknown as BusCoordinatorPrivate).pidPath
      ).not.toBe((newAgent as unknown as BusCoordinatorPrivate).pidPath);
    });

    it('should NOT mix global bus with project-specific bus', () => {
      // Agent on global bus
      process.env.IPC_SIGMA_BUS = 'global';
      const globalAgent = new BusCoordinator('/Users/dev/my-project');

      // Agent on project bus
      delete process.env.IPC_SIGMA_BUS;
      const projectAgent = new BusCoordinator('/Users/dev/my-project');

      // They should have different infrastructure
      expect(
        (globalAgent as unknown as BusCoordinatorPrivate).socketPath
      ).not.toBe((projectAgent as unknown as BusCoordinatorPrivate).socketPath);
      expect(
        (globalAgent as unknown as BusCoordinatorPrivate).pidPath
      ).not.toBe((projectAgent as unknown as BusCoordinatorPrivate).pidPath);
    });
  });

  describe('Edge Cases', () => {
    it('should handle project names with special characters', () => {
      delete process.env.IPC_SIGMA_BUS;
      const projectRoot = '/Users/dev/my-project@v2.0';

      const coordinator = new BusCoordinator(projectRoot);
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;

      // Should use basename which includes special chars
      expect(pidPath).toContain('my-project@v2.0');
    });

    it('should handle deep project paths', () => {
      delete process.env.IPC_SIGMA_BUS;
      const projectRoot = '/Users/dev/workspace/clients/acme/projects/web-app';

      const coordinator = new BusCoordinator(projectRoot);
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;

      // Should only use basename, not full path
      expect(pidPath).toContain('web-app');
      expect(pidPath).not.toContain('clients');
      expect(pidPath).not.toContain('acme');
    });

    it('should handle IPC_SIGMA_BUS with special characters', () => {
      process.env.IPC_SIGMA_BUS = 'team-alpha-v2';

      const coordinator = new BusCoordinator('/Users/dev/project');
      const pidPath = (coordinator as unknown as BusCoordinatorPrivate).pidPath;

      expect(pidPath).toContain('team-alpha-v2');
    });

    it('should isolate projects with same basename but different paths (collision resistance)', () => {
      delete process.env.IPC_SIGMA_BUS;

      // Two projects with the same basename "api" but in different locations
      const apiProject1 = new BusCoordinator('/Users/alice/work/api');
      const apiProject2 = new BusCoordinator('/Users/alice/personal/api');

      const socket1 = (apiProject1 as unknown as BusCoordinatorPrivate)
        .socketPath;
      const socket2 = (apiProject2 as unknown as BusCoordinatorPrivate)
        .socketPath;

      // Both should contain "api" (the basename)
      expect(socket1).toContain('api');
      expect(socket2).toContain('api');

      // But they should be different due to hash of full path
      expect(socket1).not.toBe(socket2);
    });
  });
});
