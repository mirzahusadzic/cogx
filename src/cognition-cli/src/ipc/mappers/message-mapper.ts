import { AgentMessage } from '../AgentMessage.js';
import { AgentMessageDTO } from '../dto/agent-message-dto.js';

/**
 * MessageMapper
 *
 * This class is responsible for mapping between the rich internal
 * Domain Model (AgentMessage) and the optimized Wire Format (AgentMessageDTO).
 */
export class MessageMapper {
  private static readonly PROTOCOL_VERSION = '1.0';

  /**
   * Converts a DTO from the network into a Domain Model.
   *
   * @param dto - The raw Data Transfer Object received over the bus
   * @returns A rich AgentMessage domain object
   * @throws {Error} If the DTO is missing required fields
   */
  static toDomain<T = unknown>(dto: AgentMessageDTO<T>): AgentMessage<T> {
    if (!dto.mid || !dto.src || !dto.top || dto.ts === undefined) {
      throw new Error(
        `Invalid AgentMessageDTO: missing required fields (mid=${dto.mid}, src=${dto.src}, top=${dto.top}, ts=${dto.ts})`
      );
    }

    return new AgentMessage(
      dto.mid,
      dto.src,
      dto.dst || '*',
      dto.ts,
      dto.top,
      dto.pay
    );
  }

  /**
   * Converts a Domain Model into a DTO for network transmission.
   *
   * @param message - The rich AgentMessage domain object
   * @returns An optimized AgentMessageDTO for the wire
   */
  static toDTO<T = unknown>(message: AgentMessage<T>): AgentMessageDTO<T> {
    return {
      v: MessageMapper.PROTOCOL_VERSION,
      mid: message.id,
      ts: message.timestamp,
      top: message.topic,
      src: message.from,
      dst: message.to,
      pay: message.payload,
    };
  }
}
