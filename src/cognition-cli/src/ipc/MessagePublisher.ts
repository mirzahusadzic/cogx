import { ZeroMQBus } from './ZeroMQBus.js';
import { AgentMessage } from './AgentMessage.js';
import * as crypto from 'crypto';

/**
 * MessagePublisher - Helper for publishing messages to other agents
 *
 * Simplifies the process of sending messages via ZeroMQ bus.
 * Provides high-level API for agent-to-agent communication.
 */
export class MessagePublisher {
  private bus: ZeroMQBus;
  private fromAgentId: string;

  /**
   * @param bus ZeroMQ bus instance
   * @param fromAgentId Current agent's ID
   */
  constructor(bus: ZeroMQBus, fromAgentId: string) {
    this.bus = bus;
    this.fromAgentId = fromAgentId;
  }

  /**
   * Send a message to a specific agent
   * @param toAgentId Target agent ID (e.g., "gemini-a123")
   * @param topic Message topic (e.g., "code.review_request")
   * @param payload Message payload
   */
  async sendTo(
    toAgentId: string,
    topic: string,
    payload: unknown
  ): Promise<void> {
    const message: AgentMessage = {
      id: crypto.randomUUID(),
      from: this.fromAgentId,
      to: toAgentId,
      topic,
      payload,
      timestamp: Date.now(),
    };

    await this.bus.publish(topic, message);
  }

  /**
   * Broadcast a message to all agents
   * @param topic Message topic
   * @param payload Message payload
   */
  async broadcast(topic: string, payload: unknown): Promise<void> {
    const message: AgentMessage = {
      id: crypto.randomUUID(),
      from: this.fromAgentId,
      to: '*', // Broadcast to all
      topic,
      payload,
      timestamp: Date.now(),
    };

    await this.bus.publish(topic, message);
  }

  /**
   * Notify another agent that a task is complete
   * @param toAgentId Target agent ID
   * @param taskDescription Brief description of completed task
   */
  async notifyTaskComplete(
    toAgentId: string,
    taskDescription: string
  ): Promise<void> {
    await this.sendTo(toAgentId, 'agent.notification', {
      type: 'task_complete',
      description: taskDescription,
      completedAt: Date.now(),
    });
  }

  /**
   * Request another agent to review code
   * @param toAgentId Target agent ID (e.g., "gemini-a123")
   * @param files Files to review
   * @param context Additional context
   */
  async requestCodeReview(
    toAgentId: string,
    files: string[],
    context?: string
  ): Promise<void> {
    await this.sendTo(toAgentId, 'code.review_request', {
      files,
      context,
      requestedBy: this.fromAgentId,
      requestedAt: Date.now(),
    });
  }

  /**
   * Send a general message to another agent
   * @param toAgentId Target agent ID
   * @param message Message text
   */
  async sendMessage(toAgentId: string, message: string): Promise<void> {
    await this.sendTo(toAgentId, 'agent.message', {
      type: 'text',
      message,
    });
  }
}
