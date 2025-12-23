/**
 * Tool Safety Tests
 *
 * Tests for the tool safety checker that classifies operations by risk level
 * and detects dangerous patterns in bash commands and file operations.
 */

import { describe, it, expect } from 'vitest';
import {
  checkToolSafety,
  extractBaseCommand,
  formatToolInput,
  ToolRiskLevel,
} from '../tool-safety.js';

describe('ToolSafety', () => {
  describe('checkToolSafety()', () => {
    describe('bash commands', () => {
      describe('critical patterns', () => {
        it('should detect rm -rf as critical', () => {
          const result = checkToolSafety('bash', {
            command: 'rm -rf /tmp/test',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.CRITICAL);
          expect(result.requiresConfirmation).toBe(true);
        });

        it('should detect dd as critical', () => {
          const result = checkToolSafety('bash', {
            command: 'dd if=/dev/zero of=/dev/sda',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.CRITICAL);
        });

        it('should detect mkfs as critical', () => {
          const result = checkToolSafety('bash', {
            command: 'mkfs.ext4 /dev/sda1',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.CRITICAL);
        });

        it('should detect fork bomb pattern as critical', () => {
          const result = checkToolSafety('bash', { command: ':(){ :|:& };:' });
          expect(result.riskLevel).toBe(ToolRiskLevel.CRITICAL);
        });
      });

      describe('dangerous patterns', () => {
        it('should detect git push --force as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'git push --force origin main',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
          expect(result.requiresConfirmation).toBe(true);
        });

        it('should detect git push -f as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'git push -f origin main',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect npm publish as dangerous', () => {
          const result = checkToolSafety('bash', { command: 'npm publish' });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect docker rm as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'docker rm container_name',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect docker rmi as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'docker rmi image_name',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect kubectl delete as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'kubectl delete pod my-pod',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect curl DELETE as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'curl -X DELETE http://api.example.com/resource',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect DROP TABLE as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'mysql -e "DROP TABLE users"',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect DELETE FROM as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'psql -c "DELETE FROM users WHERE id=1"',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect TRUNCATE as dangerous', () => {
          const result = checkToolSafety('bash', {
            command: 'mysql -e "TRUNCATE TABLE logs"',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });
      });

      describe('moderate patterns', () => {
        it('should detect git commit as moderate', () => {
          const result = checkToolSafety('bash', {
            command: 'git commit -m "message"',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.MODERATE);
          expect(result.requiresConfirmation).toBe(true);
        });

        it('should detect git push (non-force) as moderate', () => {
          const result = checkToolSafety('bash', {
            command: 'git push origin main',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.MODERATE);
        });

        it('should detect rm (without -rf) as moderate', () => {
          const result = checkToolSafety('bash', { command: 'rm file.txt' });
          expect(result.riskLevel).toBe(ToolRiskLevel.MODERATE);
        });

        it('should detect output redirection as moderate', () => {
          const result = checkToolSafety('bash', {
            command: 'echo "test" > file.txt',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.MODERATE);
        });
      });

      describe('safe patterns', () => {
        it('should detect ls as safe', () => {
          const result = checkToolSafety('bash', { command: 'ls -la' });
          expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
          expect(result.requiresConfirmation).toBe(false);
        });

        it('should detect cat as safe', () => {
          const result = checkToolSafety('bash', { command: 'cat file.txt' });
          expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
        });

        it('should detect git status as safe', () => {
          const result = checkToolSafety('bash', { command: 'git status' });
          expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
        });

        it('should detect pwd as safe', () => {
          const result = checkToolSafety('bash', { command: 'pwd' });
          expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
        });

        it('should detect npm install as safe', () => {
          const result = checkToolSafety('bash', { command: 'npm install' });
          expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
        });
      });

      it('should handle shell tool name', () => {
        const result = checkToolSafety('shell', { command: 'rm -rf /' });
        expect(result.riskLevel).toBe(ToolRiskLevel.CRITICAL);
      });

      it('should handle string input', () => {
        const result = checkToolSafety('bash', 'git push --force');
        expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
      });
    });

    describe('file operations', () => {
      describe('sensitive files', () => {
        it('should detect .env as dangerous', () => {
          const result = checkToolSafety('write_file', {
            file_path: '/app/.env',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
          expect(result.requiresConfirmation).toBe(true);
        });

        it('should detect credentials file as dangerous', () => {
          const result = checkToolSafety('edit_file', {
            file_path: '/home/user/credentials.json',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect secrets file as dangerous', () => {
          const result = checkToolSafety('write_file', {
            file_path: 'config/secrets.yaml',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect .key file as dangerous', () => {
          const result = checkToolSafety('write_file', {
            file_path: 'server.key',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect .pem file as dangerous', () => {
          const result = checkToolSafety('write_file', {
            file_path: 'cert.pem',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect password file as dangerous', () => {
          const result = checkToolSafety('write_file', {
            file_path: 'password.txt',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect config.json as dangerous', () => {
          const result = checkToolSafety('write_file', {
            file_path: 'config.json',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect package.json as dangerous', () => {
          const result = checkToolSafety('edit_file', {
            file_path: 'package.json',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });

        it('should detect package-lock.json as dangerous', () => {
          const result = checkToolSafety('write_file', {
            file_path: 'package-lock.json',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
        });
      });

      describe('safe files', () => {
        it('should detect regular source file as safe', () => {
          const result = checkToolSafety('write_file', {
            file_path: 'src/index.ts',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
          expect(result.requiresConfirmation).toBe(false);
        });

        it('should detect test file as safe', () => {
          const result = checkToolSafety('edit_file', {
            file_path: 'tests/unit.test.ts',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
        });

        it('should detect README as safe', () => {
          const result = checkToolSafety('write_file', {
            file_path: 'README.md',
          });
          expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
        });
      });

      it('should handle string input for file path', () => {
        const result = checkToolSafety('write_file', '.env');
        expect(result.riskLevel).toBe(ToolRiskLevel.DANGEROUS);
      });
    });

    describe('read-only operations', () => {
      it('should mark read_file as safe', () => {
        const result = checkToolSafety('read_file', { file_path: '.env' });
        expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
        expect(result.reason).toBe('Read-only operation');
      });

      it('should mark grep as safe', () => {
        const result = checkToolSafety('grep', { pattern: 'password' });
        expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
      });

      it('should mark glob as safe', () => {
        const result = checkToolSafety('glob', { pattern: '**/*.ts' });
        expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
      });

      it('should mark recall_past_conversation as safe', () => {
        const result = checkToolSafety('recall_past_conversation', {
          query: 'auth',
        });
        expect(result.riskLevel).toBe(ToolRiskLevel.SAFE);
      });
    });

    describe('unknown tools', () => {
      it('should mark unknown tool as moderate risk', () => {
        const result = checkToolSafety('unknown_tool', { data: 'test' });
        expect(result.riskLevel).toBe(ToolRiskLevel.MODERATE);
        expect(result.reason).toBe('Unknown tool type');
        expect(result.requiresConfirmation).toBe(true);
      });
    });
  });

  describe('extractBaseCommand()', () => {
    it('should extract simple command', () => {
      expect(extractBaseCommand('git status')).toBe('git');
    });

    it('should extract command with multiple args', () => {
      expect(extractBaseCommand('npm install --save-dev vitest')).toBe('npm');
    });

    it('should extract cognition-cli', () => {
      expect(extractBaseCommand('cognition-cli patterns list')).toBe(
        'cognition-cli'
      );
    });

    it('should return null for empty string', () => {
      expect(extractBaseCommand('')).toBeNull();
    });

    it('should return null for whitespace only', () => {
      expect(extractBaseCommand('   ')).toBeNull();
    });

    it('should handle leading whitespace', () => {
      expect(extractBaseCommand('  ls -la')).toBe('ls');
    });

    it('should extract command from bash -c', () => {
      expect(extractBaseCommand('bash -c "git status"')).toBe('git');
    });

    it('should extract command from sh -c', () => {
      expect(extractBaseCommand("sh -c 'npm test'")).toBe('npm');
    });

    it('should extract command from zsh -c', () => {
      expect(extractBaseCommand('zsh -c "echo hello"')).toBe('echo');
    });

    it('should return shell if no -c pattern', () => {
      expect(extractBaseCommand('bash script.sh')).toBe('bash');
    });
  });

  describe('formatToolInput()', () => {
    describe('string input', () => {
      it('should return string as-is', () => {
        expect(formatToolInput('any', 'test string')).toBe('test string');
      });
    });

    describe('WebSearch', () => {
      it('should extract request field', () => {
        expect(formatToolInput('WebSearch', { request: 'search query' })).toBe(
          'search query'
        );
      });

      it('should extract query field', () => {
        expect(formatToolInput('WebSearch', { query: 'search query' })).toBe(
          'search query'
        );
      });
    });

    describe('WebFetch', () => {
      it('should extract url field', () => {
        expect(
          formatToolInput('WebFetch', { url: 'https://example.com' })
        ).toBe('https://example.com');
      });
    });

    describe('bash commands', () => {
      it('should extract command field', () => {
        expect(formatToolInput('bash', { command: 'ls -la' })).toBe('ls -la');
      });

      it('should handle non-string command', () => {
        const input = { command: { nested: 'value' } };
        const result = formatToolInput('bash', input);
        expect(result).toContain('nested');
      });
    });

    describe('file operations', () => {
      it('should extract file_path and convert to relative', () => {
        const cwd = process.cwd();
        const result = formatToolInput('read_file', {
          file_path: `${cwd}/src/index.ts`,
        });
        expect(result).toBe('src/index.ts');
      });

      it('should use original path if relative is longer', () => {
        const result = formatToolInput('read_file', { file_path: 'a.ts' });
        expect(result).toBe('a.ts');
      });

      it('should handle non-string file_path', () => {
        const result = formatToolInput('read_file', { file_path: 123 });
        expect(result).toContain('file_path');
      });
    });

    describe('generic objects', () => {
      it('should JSON stringify unknown object', () => {
        const input = { foo: 'bar', num: 42 };
        const result = formatToolInput('unknown', input);
        expect(result).toContain('"foo": "bar"');
        expect(result).toContain('"num": 42');
      });
    });

    describe('non-object input', () => {
      it('should convert number to string', () => {
        expect(formatToolInput('any', 42)).toBe('42');
      });

      it('should convert boolean to string', () => {
        expect(formatToolInput('any', true)).toBe('true');
      });

      it('should convert null to string', () => {
        expect(formatToolInput('any', null)).toBe('null');
      });
    });
  });
});
