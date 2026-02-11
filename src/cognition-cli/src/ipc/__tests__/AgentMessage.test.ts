/**
 * Agent Message Tests
 *
 * Tests for the AgentMessage types, Topics constants, and MessageFactory class.
 * Covers message creation, type safety, and topic constants.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MessageFactory,
  Topics,
  type AgentMessage,
  type CodeCompletedPayload,
  type ReviewRequestedPayload,
  type ReviewCompletedPayload,
  type ArchProposalPayload,
  type AgentQuestionPayload,
  type AgentRegisteredPayload,
  type TaskStartedPayload,
  type TaskCompletedPayload,
} from '../AgentMessage.js';

describe('AgentMessage', () => {
  describe('Topics Constants', () => {
    it('should have all code collaboration topics', () => {
      expect(Topics.CODE_COMPLETED).toBe('code.completed');
      expect(Topics.CODE_REVIEW_REQUESTED).toBe('code.review_requested');
      expect(Topics.CODE_REVIEW_COMPLETED).toBe('code.review_completed');
    });

    it('should have all architecture collaboration topics', () => {
      expect(Topics.ARCH_PROPOSAL_READY).toBe('arch.proposal_ready');
      expect(Topics.ARCH_FEEDBACK).toBe('arch.feedback');
    });

    it('should have all agent communication topics', () => {
      expect(Topics.AGENT_QUESTION).toBe('agent.question');
      expect(Topics.AGENT_ANSWER).toBe('agent.answer');
      expect(Topics.AGENT_QUERY_REQUEST).toBe('agent.query_request');
      expect(Topics.AGENT_QUERY_RESPONSE).toBe('agent.query_response');
      expect(Topics.AGENT_REGISTERED).toBe('agent.registered');
      expect(Topics.AGENT_UNREGISTERED).toBe('agent.unregistered');
      expect(Topics.AGENT_STATUS_CHANGED).toBe('agent.status_changed');
    });

    it('should have all task management topics', () => {
      expect(Topics.TASK_STARTED).toBe('task.started');
      expect(Topics.TASK_PROGRESS).toBe('task.progress');
      expect(Topics.TASK_COMPLETED).toBe('task.completed');
      expect(Topics.TASK_FAILED).toBe('task.failed');
    });

    it('should have all user input topics', () => {
      expect(Topics.USER_INPUT_REQUESTED).toBe('user.input_requested');
      expect(Topics.USER_INPUT_PROVIDED).toBe('user.input_provided');
    });

    it('should have meta topics', () => {
      expect(Topics.META_NEW_TOPIC).toBe('meta.new_topic');
    });

    it('should be defined as const (TypeScript immutability)', () => {
      // Topics uses "as const" for TypeScript type-level immutability
      // This ensures the values are narrowed to literal types
      expect(typeof Topics.CODE_COMPLETED).toBe('string');

      // Verify all expected keys exist
      const expectedKeys = [
        'CODE_COMPLETED',
        'CODE_REVIEW_REQUESTED',
        'CODE_REVIEW_COMPLETED',
        'ARCH_PROPOSAL_READY',
        'ARCH_FEEDBACK',
        'AGENT_QUESTION',
        'AGENT_ANSWER',
        'AGENT_QUERY_REQUEST',
        'AGENT_QUERY_RESPONSE',
        'AGENT_REGISTERED',
        'AGENT_UNREGISTERED',
        'AGENT_STATUS_CHANGED',
        'TASK_STARTED',
        'TASK_PROGRESS',
        'TASK_COMPLETED',
        'TASK_FAILED',
        'USER_INPUT_REQUESTED',
        'USER_INPUT_PROVIDED',
        'META_NEW_TOPIC',
      ];

      for (const key of expectedKeys) {
        expect(Topics).toHaveProperty(key);
      }
    });
  });

  describe('MessageFactory', () => {
    beforeEach(() => {
      // Mock crypto.randomUUID for deterministic IDs
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        '12345678-1234-1234-1234-123456789abc'
      );
    });

    describe('create()', () => {
      it('should create a message with all required fields', () => {
        const payload = { custom: 'data' };
        const message = MessageFactory.create(
          'agent-1',
          'agent-2',
          'custom.topic',
          payload
        );

        expect(message.id).toBe('12345678-1234-1234-1234-123456789abc');
        expect(message.from).toBe('agent-1');
        expect(message.to).toBe('agent-2');
        expect(message.topic).toBe('custom.topic');
        expect(message.payload).toEqual(payload);
        expect(message.timestamp).toBeGreaterThan(0);
      });

      it('should create unique IDs for each message', () => {
        vi.spyOn(crypto, 'randomUUID')
          .mockReturnValueOnce('uuid-1')
          .mockReturnValueOnce('uuid-2');

        const msg1 = MessageFactory.create('a', 'b', 't', {});
        const msg2 = MessageFactory.create('a', 'b', 't', {});

        expect(msg1.id).toBe('uuid-1');
        expect(msg2.id).toBe('uuid-2');
      });

      it('should set timestamp to current time', () => {
        const before = Date.now();
        const message = MessageFactory.create('a', 'b', 't', {});
        const after = Date.now();

        expect(message.timestamp).toBeGreaterThanOrEqual(before);
        expect(message.timestamp).toBeLessThanOrEqual(after);
      });

      it('should support broadcast messages (to: "*")', () => {
        const message = MessageFactory.create(
          'agent-1',
          '*',
          'broadcast.topic',
          {
            data: 'for everyone',
          }
        );

        expect(message.to).toBe('*');
      });

      it('should preserve complex payloads', () => {
        const complexPayload = {
          nested: {
            array: [1, 2, 3],
            object: { key: 'value' },
          },
          date: new Date().toISOString(),
        };

        const message = MessageFactory.create('a', 'b', 't', complexPayload);

        expect(message.payload).toEqual(complexPayload);
      });
    });

    describe('codeCompleted()', () => {
      it('should create a code completed message', () => {
        const payload: CodeCompletedPayload = {
          files: ['src/index.ts', 'src/utils.ts'],
          summary: 'Implemented new feature',
          requestReview: true,
          branch: 'feature/new-feature',
        };

        const message = MessageFactory.codeCompleted(
          'gemini-1',
          'opus-1',
          payload
        );

        expect(message.topic).toBe(Topics.CODE_COMPLETED);
        expect(message.from).toBe('gemini-1');
        expect(message.to).toBe('opus-1');
        expect(message.payload).toEqual(payload);
      });

      it('should work without optional branch field', () => {
        const payload: CodeCompletedPayload = {
          files: ['src/index.ts'],
          summary: 'Quick fix',
          requestReview: false,
        };

        const message = MessageFactory.codeCompleted('a', 'b', payload);

        expect(message.payload.branch).toBeUndefined();
        expect(message.payload.requestReview).toBe(false);
      });
    });

    describe('reviewRequested()', () => {
      it('should create a review requested message', () => {
        const payload: ReviewRequestedPayload = {
          files: ['src/critical.ts'],
          context: 'Please check for security vulnerabilities',
          priority: 'high',
        };

        const message = MessageFactory.reviewRequested(
          'dev-1',
          'reviewer-1',
          payload
        );

        expect(message.topic).toBe(Topics.CODE_REVIEW_REQUESTED);
        expect(message.payload.priority).toBe('high');
        expect(message.payload.context).toContain('security');
      });

      it('should support all priority levels', () => {
        const priorities: Array<'low' | 'normal' | 'high'> = [
          'low',
          'normal',
          'high',
        ];

        for (const priority of priorities) {
          const payload: ReviewRequestedPayload = {
            files: ['test.ts'],
            context: 'Test',
            priority,
          };

          const message = MessageFactory.reviewRequested('a', 'b', payload);
          expect(message.payload.priority).toBe(priority);
        }
      });
    });

    describe('reviewCompleted()', () => {
      it('should create a review completed message with approval', () => {
        const payload: ReviewCompletedPayload = {
          files: ['src/index.ts'],
          issues: [],
          approved: true,
          summary: 'LGTM! Great code quality.',
        };

        const message = MessageFactory.reviewCompleted(
          'opus-1',
          'gemini-1',
          payload
        );

        expect(message.topic).toBe(Topics.CODE_REVIEW_COMPLETED);
        expect(message.payload.approved).toBe(true);
        expect(message.payload.issues).toHaveLength(0);
      });

      it('should create a review completed message with issues', () => {
        const payload: ReviewCompletedPayload = {
          files: ['src/buggy.ts'],
          issues: [
            {
              file: 'src/buggy.ts',
              line: 42,
              severity: 'error',
              message: 'Potential null pointer exception',
            },
            {
              file: 'src/buggy.ts',
              line: 100,
              severity: 'warning',
              message: 'Consider adding error handling',
            },
            {
              file: 'src/buggy.ts',
              line: 150,
              severity: 'suggestion',
              message: 'Could be refactored for clarity',
            },
          ],
          approved: false,
          summary: 'Found several issues that need addressing.',
        };

        const message = MessageFactory.reviewCompleted(
          'opus-1',
          'gemini-1',
          payload
        );

        expect(message.payload.approved).toBe(false);
        expect(message.payload.issues).toHaveLength(3);
        expect(message.payload.issues[0].severity).toBe('error');
        expect(message.payload.issues[1].severity).toBe('warning');
        expect(message.payload.issues[2].severity).toBe('suggestion');
      });
    });

    describe('archProposal()', () => {
      it('should create an architecture proposal message', () => {
        const payload: ArchProposalPayload = {
          title: 'Microservices Migration',
          description: 'Proposal to split the monolith into microservices',
          tradeoffs: 'Increased complexity vs better scalability',
          recommendation: 'Proceed with phased migration',
        };

        const message = MessageFactory.archProposal(
          'architect',
          'team',
          payload
        );

        expect(message.topic).toBe(Topics.ARCH_PROPOSAL_READY);
        expect(message.payload.title).toBe('Microservices Migration');
      });

      it('should support diagrams in proposals', () => {
        const payload: ArchProposalPayload = {
          title: 'New Data Flow',
          description: 'Updated data flow architecture',
          diagrams: [
            '```mermaid\ngraph TD\nA-->B\n```',
            '┌───────┐    ┌───────┐\n│ API   │───▶│  DB   │\n└───────┘    └───────┘',
          ],
          tradeoffs: 'None significant',
          recommendation: 'Implement immediately',
        };

        const message = MessageFactory.archProposal('a', 'b', payload);

        expect(message.payload.diagrams).toHaveLength(2);
        expect(message.payload.diagrams![0]).toContain('mermaid');
      });
    });

    describe('agentQuestion()', () => {
      it('should create an agent question message', () => {
        const payload: AgentQuestionPayload = {
          to: 'opus-1',
          question: 'How should I handle authentication?',
          context: 'Building a REST API',
        };

        const message = MessageFactory.agentQuestion(
          'gemini-1',
          'opus-1',
          payload
        );

        expect(message.topic).toBe(Topics.AGENT_QUESTION);
        expect(message.payload.question).toContain('authentication');
      });

      it('should work without context', () => {
        const payload: AgentQuestionPayload = {
          to: 'opus-1',
          question: 'What is the meaning of life?',
        };

        const message = MessageFactory.agentQuestion('a', 'b', payload);

        expect(message.payload.context).toBeUndefined();
      });
    });

    describe('agentRegistered()', () => {
      it('should create an agent registered message', () => {
        const payload: AgentRegisteredPayload = {
          agentId: 'gemini-flash-1',
          model: 'gemini-3-flash-preview',
          type: 'interactive',
          capabilities: ['code_review', 'testing', 'documentation'],
        };

        const message = MessageFactory.agentRegistered(
          'gemini-flash-1',
          '*',
          payload
        );

        expect(message.topic).toBe(Topics.AGENT_REGISTERED);
        expect(message.to).toBe('*'); // Broadcast
        expect(message.payload.capabilities).toContain('code_review');
      });

      it('should support background agent type', () => {
        const payload: AgentRegisteredPayload = {
          agentId: 'background-worker',
          model: 'claude-sonnet',
          type: 'background',
          capabilities: ['long_running_tasks'],
        };

        const message = MessageFactory.agentRegistered(
          'background-worker',
          '*',
          payload
        );

        expect(message.payload.type).toBe('background');
      });

      it('should include project info when provided', () => {
        const payload: AgentRegisteredPayload = {
          agentId: 'project-agent',
          model: 'opus',
          type: 'interactive',
          capabilities: [],
          projectRoot: '/Users/dev/my-project',
          projectName: 'my-project',
        };

        const message = MessageFactory.agentRegistered(
          'project-agent',
          '*',
          payload
        );

        expect(message.payload.projectRoot).toBe('/Users/dev/my-project');
        expect(message.payload.projectName).toBe('my-project');
      });
    });

    describe('taskStarted()', () => {
      it('should create a task started message', () => {
        const payload: TaskStartedPayload = {
          taskId: 'task-12345',
          command: '/onboard-project',
          args: ['--verbose'],
        };

        const message = MessageFactory.taskStarted(
          'worker-1',
          'manager',
          payload
        );

        expect(message.topic).toBe(Topics.TASK_STARTED);
        expect(message.payload.taskId).toBe('task-12345');
        expect(message.payload.command).toBe('/onboard-project');
      });

      it('should work without args', () => {
        const payload: TaskStartedPayload = {
          taskId: 'task-simple',
          command: '/status',
        };

        const message = MessageFactory.taskStarted('a', 'b', payload);

        expect(message.payload.args).toBeUndefined();
      });
    });

    describe('taskCompleted()', () => {
      it('should create a task completed message', () => {
        const payload: TaskCompletedPayload = {
          taskId: 'task-12345',
          command: '/build',
          result: { success: true, artifacts: ['dist/bundle.js'] },
          durationMs: 15000,
        };

        const message = MessageFactory.taskCompleted(
          'worker-1',
          'manager',
          payload
        );

        expect(message.topic).toBe(Topics.TASK_COMPLETED);
        expect(message.payload.durationMs).toBe(15000);
        expect(message.payload.result).toEqual({
          success: true,
          artifacts: ['dist/bundle.js'],
        });
      });
    });
  });

  describe('Type Safety', () => {
    it('should preserve generic payload type in AgentMessage', () => {
      interface CustomPayload {
        customField: string;
        count: number;
      }

      const message: AgentMessage<CustomPayload> = {
        id: 'test-id',
        from: 'sender',
        to: 'receiver',
        timestamp: Date.now(),
        topic: 'custom.topic',
        payload: {
          customField: 'value',
          count: 42,
        },
      };

      // TypeScript should allow accessing typed payload fields
      expect(message.payload.customField).toBe('value');
      expect(message.payload.count).toBe(42);
    });

    it('should allow unknown payload type by default', () => {
      const message: AgentMessage = {
        id: 'test-id',
        from: 'sender',
        to: 'receiver',
        timestamp: Date.now(),
        topic: 'any.topic',
        payload: { anything: 'goes' },
      };

      expect(message.payload).toBeDefined();
    });
  });

  describe('Message Validation Helpers', () => {
    it('should be able to check if message is a broadcast', () => {
      const isBroadcast = (msg: AgentMessage): boolean => msg.to === '*';

      const broadcast = MessageFactory.create('a', '*', 't', {});
      const direct = MessageFactory.create('a', 'b', 't', {});

      expect(isBroadcast(broadcast)).toBe(true);
      expect(isBroadcast(direct)).toBe(false);
    });

    it('should be able to check message age', () => {
      const isStale = (msg: AgentMessage, maxAgeMs: number): boolean =>
        Date.now() - msg.timestamp > maxAgeMs;

      const freshMessage = MessageFactory.create('a', 'b', 't', {});
      expect(isStale(freshMessage, 1000)).toBe(false);

      const oldMessage: AgentMessage = {
        id: 'old',
        from: 'a',
        to: 'b',
        timestamp: Date.now() - 10000, // 10 seconds ago
        topic: 't',
        payload: {},
      };
      expect(isStale(oldMessage, 5000)).toBe(true);
    });

    it('should be able to filter messages by topic', () => {
      const messages = [
        MessageFactory.create('a', 'b', Topics.CODE_COMPLETED, {}),
        MessageFactory.create('a', 'b', Topics.TASK_STARTED, {}),
        MessageFactory.create('a', 'b', Topics.CODE_COMPLETED, {}),
        MessageFactory.create('a', 'b', Topics.AGENT_REGISTERED, {}),
      ];

      const codeMessages = messages.filter(
        (m) => m.topic === Topics.CODE_COMPLETED
      );

      expect(codeMessages).toHaveLength(2);
    });
  });
});
