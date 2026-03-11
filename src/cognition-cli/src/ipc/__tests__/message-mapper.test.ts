import { describe, it, expect } from 'vitest';
import { MessageMapper } from '../mappers/message-mapper.js';
import { AgentMessage } from '../AgentMessage.js';
import { AgentMessageDTO } from '../dto/agent-message-dto.js';

describe('MessageMapper', () => {
  it('toDTO() should correctly map a Domain Model to a DTO', () => {
    const domainMsg: AgentMessage<{ text: string }> = {
      id: 'uuid-123',
      from: 'agent-a',
      to: 'agent-b',
      timestamp: 1625097600000,
      topic: 'test.topic',
      payload: { text: 'hello' },
    };

    const dto = MessageMapper.toDTO(domainMsg);

    expect(dto.v).toBe('1.0');
    expect(dto.mid).toBe(domainMsg.id);
    expect(dto.ts).toBe(domainMsg.timestamp);
    expect(dto.top).toBe(domainMsg.topic);
    expect(dto.src).toBe(domainMsg.from);
    expect(dto.dst).toBe(domainMsg.to);
    expect(dto.pay).toEqual(domainMsg.payload);
  });

  it('toDomain() should correctly map a DTO to a Domain Model', () => {
    const dto: AgentMessageDTO<{ text: string }> = {
      v: '1.0',
      mid: 'uuid-456',
      ts: 1625097600001,
      top: 'another.topic',
      src: 'agent-c',
      dst: 'agent-d',
      pay: { text: 'world' },
    };

    const domainMsg = MessageMapper.toDomain(dto);

    expect(domainMsg.id).toBe(dto.mid);
    expect(domainMsg.from).toBe(dto.src);
    expect(domainMsg.to).toBe(dto.dst);
    expect(domainMsg.timestamp).toBe(dto.ts);
    expect(domainMsg.topic).toBe(dto.top);
    expect(domainMsg.payload).toEqual(dto.pay);
  });

  it('should preserve complex payloads through mapping', () => {
    const complexPayload = {
      nested: {
        array: [1, 2, 3],
        obj: { a: 1 },
      },
    };

    const domainMsg: AgentMessage<typeof complexPayload> = {
      id: 'uuid-789',
      from: 'agent-e',
      to: '*',
      timestamp: Date.now(),
      topic: 'complex',
      payload: complexPayload,
    };

    const dto = MessageMapper.toDTO(domainMsg);
    const roundTrip = MessageMapper.toDomain(dto);

    expect(roundTrip).toEqual(domainMsg);
  });

  it('toDomain() should throw if required fields are missing', () => {
    const invalidDto = {
      v: '1.0',
      pay: {},
    } as unknown as AgentMessageDTO<unknown>;

    expect(() => MessageMapper.toDomain(invalidDto)).toThrow(
      'Invalid AgentMessageDTO: missing required fields'
    );
  });
});
