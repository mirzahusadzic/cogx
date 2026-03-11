# Phase 2: Introduce DTOs (Data Transfer Objects) Technical Specification

This document outlines the strategy for creating a strict boundary between IPC (Inter-Process Communication) message formats and internal domain models.

## 1. Problem Statement

Currently, `AgentMessage` (defined in `src/ipc/AgentMessage.ts`) serves a dual purpose:

1. **Network Protocol**: The exact JSON structure sent over the ZeroMQ bus.
2. **Domain Model**: The object used by agents and the TUI to represent an event.

This coupling leads to "Domain/Network Conflation," where infrastructure requirements (e.g., protocol versioning, sequence IDs, network headers) leak into the business logic, and changes to the domain model risk breaking network compatibility with older agents.

## 2. Structural Changes

### A. Define `AgentMessageDTO`

Create `src/ipc/dto/agent-message-dto.ts` to define the "wire format." This should be a pure interface representing what is strictly required for transmission.

```typescript
export interface AgentMessageDTO {
  v: string; // Protocol Version (e.g., "1.0")
  mid: string; // Message UUID
  ts: number; // Timestamp
  top: string; // Topic
  src: string; // Source Agent ID
  dst: string; // Destination Agent ID (or '*')
  pay: unknown; // Raw Payload
  meta?: Record<string, string>; // Optional network metadata
}
```

_Note: Using abbreviated keys (`v`, `mid`, `ts`) reduces bandwidth for high-frequency messaging (TUI updates)._

### B. Evolve `AgentMessage` into a Domain Model

Keep `src/ipc/AgentMessage.ts` but treat it as the "Rich Model" used by the application code. It should be descriptive and easy to work with.

### C. Translation Layer (The "Mapper")

Create `src/ipc/mappers/message-mapper.ts` to handle the conversion between DTOs and Domain Models.

```typescript
export class MessageMapper {
  static toDomain(dto: AgentMessageDTO): AgentMessage {
    return {
      id: dto.mid,
      from: dto.src,
      to: dto.dst,
      timestamp: dto.ts,
      topic: dto.top,
      payload: dto.pay,
    };
  }

  static toDTO(message: AgentMessage): AgentMessageDTO {
    return {
      v: '1.0',
      mid: message.id,
      ts: message.timestamp,
      top: message.topic,
      src: message.from,
      dst: message.to,
      pay: message.payload,
    };
  }
}
```

## 3. Implementation Steps

1. **DTO Definition**: Create the `AgentMessageDTO` interface.
2. **Payload Versioning**: Define specific DTOs for complex payloads (e.g., `TaskProgressDTO`).
3. **Mapper Implementation**: Implement the `MessageMapper` with comprehensive unit tests for edge cases (missing fields, malformed JSON).
4. **Bus Integration**:
   - Update `ZeroMQBus.publish` to use `MessageMapper.toDTO` before sending.
   - Update `ZeroMQBus` subscribers to use `MessageMapper.toDomain` after receiving.
5. **Refactor Factory**: Update `MessageFactory` to produce rich domain objects, while the bus handles the DTO conversion.

## 4. Migration Strategy

- **Step 1**: Introduce DTOs and Mappers side-by-side with existing logic.
- **Step 2**: Update the `ZeroMQBus` to perform translation at the boundary.
- **Step 3**: Verify with existing E2E tests (`src/ipc/__tests__/ZeroMQBus.e2e.test.ts`).
- **Step 4**: (Optional) Optimize DTO keys for bandwidth if profiling shows message overhead.

## 5. Success Criteria

- [x] All IPC messages are converted to DTOs before hitting the network.
- [x] No application code outside of `src/ipc` references DTO structures.
- [x] Protocol versioning is explicitly handled in the Mapper.
- [x] Existing E2E tests pass without modification to the test logic itself.
