import { ZeroMQBus } from './ZeroMQBus.js';
import { AgentMessage } from './AgentMessage.js';
import * as crypto from 'crypto';

/**
 * Simplifies publishing messages to the ZeroMQ bus for an agent.
 *
 * This class provides a high-level API for an agent to send messages to other
 * agents, abstracting away the details of creating `AgentMessage` objects.
 * It includes methods for direct messaging, broadcasting, and common
 * communication patterns like requesting a code review.
 *
 * @class MessagePublisher
 *
 * @example
 * const bus = new ZeroMQBus();
 * await bus.connect();
 * const publisher = new MessagePublisher(bus, 'gemini-coder-1');
 *
 * // Send a direct message
 * await publisher.sendMessage('opus-reviewer-1', 'Here is the code I finished.');
 *
 * // Broadcast a status update
 * await publisher.broadcast('agent.status', { status: 'idle' });
 */
export class MessagePublisher {
  private bus: ZeroMQBus;
  private fromAgentId: string;

  /**
   * Creates an instance of MessagePublisher.
   *
   * @param {ZeroMQBus} bus The ZeroMQ bus instance.
   * @param {string} fromAgentId The ID of the agent that will be sending messages.
   */
  constructor(bus: ZeroMQBus, fromAgentId: string) {
    this.bus = bus;
    this.fromAgentId = fromAgentId;
  }

  /**
   * Sends a message to a specific agent.
   *
   * @async
   * @param {string} toAgentId The ID of the recipient agent.
   * @param {string} topic The message topic (e.g., "code.review_request").
   * @param {unknown} payload The message payload.
   * @returns {Promise<void>}
   * @throws {Error} If the bus is not started.
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
   * Broadcasts a message to all agents on the bus.
   *
   * @async
   * @param {string} topic The message topic.
   * @param {unknown} payload The message payload.
   * @returns {Promise<void>}
   * @throws {Error} If the bus is not started.
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
   * Notifies another agent that a task is complete.
   *
   * @async
   * @param {string} toAgentId The ID of the agent to notify.
   * @param {string} taskDescription A brief description of the completed task.
   * @returns {Promise<void>}
   * @throws {Error} If the bus is not started.
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
   * Requests a code review from another agent.
   *
   * @async
   * @param {string} toAgentId The ID of the agent to request the review from.
   * @param {string[]} files The list of files to be reviewed.
   * @param {string} [context] Additional context for the reviewer.
   * @returns {Promise<void>}
   * @throws {Error} If the bus is not started.
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
   * Sends a general text message to another agent.
   *
   * @async
   * @param {string} toAgentId The ID of the recipient agent.
   * @param {string} message The text message to send.
   * @returns {Promise<void>}
   * @throws {Error} If the bus is not started.
   */
  async sendMessage(toAgentId: string, message: string): Promise<void> {
    await this.sendTo(toAgentId, 'agent.message', {
      type: 'text',
      message,
    });
  }
}
