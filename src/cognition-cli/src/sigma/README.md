# SIGMA Module Architecture

## Introduction

This document provides a comprehensive overview of the SIGMA module, the core engine that powers the 'infinite context' and semantic understanding capabilities of `cognition-cli`. SIGMA treats conversation as a graph, not a linear stream, enabling intelligent compression and context injection.

## Core Pipeline

The core pipeline is responsible for processing each conversation turn, from analysis to compression and context injection. It's a 5-stage process that forms the heart of the 'infinite context' loop.

### 1. Analyzer (`analyzer.ts`, `analyzer-with-embeddings.ts`)

The Analyzer's job is to give each conversation turn a deep, semantic meaning. It uses a sophisticated, embedding-based approach to do this.

- **Embedding:** Each turn is converted into a 768-dimensional vector that captures its semantic meaning.
- **Novelty Score:** It calculates a 'novelty score' by comparing the turn's embedding to the last 10 turns. This is how it automatically detects 'paradigm shifts' or changes in topic.
- **Overlay Scoring (The "Meet" Operation):** In a key innovation, it performs a semantic search with the turn's embedding against the 7 project overlays (vector databases of project knowledge). This aligns the conversation with the project's core concepts.
- **Importance Score:** The final importance score is a combination of novelty and project alignment. A turn is important if it's either a new idea or highly relevant to the project's goals.

### 2. Compressor (`compressor.ts`)

The Compressor takes the full conversation history and compresses it to fit within a target token budget, ensuring that high-signal information is never lost.

- **Importance Sorting:** It sorts all turns by their calculated `importance_score`.
- **Budget Allocation:** It then "spends" a token budget on the sorted turns.
  - **Paradigm Shifts** and highly important turns are always kept in full.
  - **Routine Turns** (low importance) are kept but only cost 10% of their original size against the budget.
  - **Medium-Importance Turns** cost 30%.
- **Lattice Construction:** It builds the `ConversationLattice` graph using only the turns that were kept. Discarded turns are dropped from the graph.

### 3. Context Reconstructor (`context-reconstructor.ts`)

The Context Reconstructor is the 'sense-making' engine of Sigma. After a compression event, it creates a tailored summary (a "recap") to inject into the new session, based on the nature of the conversation.

- **Dual-Mode Reconstruction:** It first classifies the conversation as either 'Quest Mode' (task-oriented) or 'Chat Mode' (discussion-oriented).
  - **Quest Mode Recap:** Is structured like a project dashboard, with the main goal, a 'mental map' of the architecture, and the immediate task at hand.
  - **Chat Mode Recap:** Is organized by semantic topics, showing key points grouped by the 7 overlays (e.g., 'Architecture & Design', 'Security Concerns').
- **System Fingerprint:** A crucial feature where a standard header is prepended to every recap. This header explains the Sigma system to the AI, and most importantly, teaches it that truncated messages (`...`) are pointers and that it should use the `recall_past_conversation` tool to get the full details.
- **Pending Task Preservation:** It detects if the AI was in the middle of a task when compression occurred and adds a prominent "⚠️ Assistant's Pending Task" warning to the recap, ensuring continuity.

### 4. Context Injector (`context-injector.ts`)

The Context Injector is the retrieval part of the loop. It finds relevant past context and injects it into the current prompt.

- **Candidate Search:** For each new message, it creates a candidate pool to search from, consisting of:
  - The **last 50 turns**.
  - **All turns ever marked as a 'paradigm shift'**.
- **Relevance Scoring:** It scores each candidate against the new message using a formula that combines:
  - **Semantic Similarity** (cosine similarity of embeddings).
  - The turn's original **Importance Score**.
  - An **Overlay Boost** for turns related to code, workflows, and goals.
- **Injection:** It takes the top 5 most relevant turns, creates short snippets from them, and prepends them to the user's message.

## Data Storage & Management

This group of modules handles the persistence and lifecycle of the conversation lattice.

### Session State (`session-state.ts`)

This module is the backbone of session persistence, allowing a single conversation to span multiple "compressions" and SDK sessions.

- **Anchor ID vs. SDK Session ID:** It uses a two-ID system. The `anchor_id` is the permanent, user-facing ID for the conversation. The `sdk_session_id` is the temporary ID from the AI provider, which changes after each compression.
- **State File:** It manages a `{anchor-id}.state.json` file that maps the permanent anchor ID to the latest, active SDK session ID.
- **History Tracking:** The state file also keeps a `compression_history`, providing a full audit trail of all the SDK sessions that have been part of the conversation.
- **Robustness:** It uses atomic writes to save the state file, preventing data corruption. It also includes logic to migrate state files from older formats.

### Conversation Lance Store (`conversation-lance-store.ts`)

This module is the data access layer for the conversation history, providing a robust and performant interface to the LanceDB vector store.

- **Rich Schema:** It defines a strict schema for the conversation turns, storing not just the text but also the 768-dimensional embedding, all Sigma metrics (novelty, importance), and all 7 overlay alignment scores for every turn.
- **Optimized Storage:** It uses LanceDB's `mergeInsert` feature for efficient "upsert" operations, which prevents the database from bloating with many versions of the same record.
- **Powerful Semantic Search:** The `similaritySearch` method allows for finding the most similar past turns to a given query, with a rich set of filters (e.g., by session, importance, or overlay alignment). This is the engine that powers the `ContextInjector`.

### LanceDB Compaction (`compact-lancedb.ts`)

This is a crucial database maintenance utility that solves the problem of "version bloat" in LanceDB.

- **Problem:** A previous `delete` + `add` pattern for updates was creating thousands of unnecessary historical versions, causing the database size to swell (e.g., 700MB for ~2MB of data).
- **Solution:** The `compactConversationLanceDB` function reads all records, deduplicates them in memory to keep only the latest version of each turn, and then completely rebuilds the database table with the clean data. This results in a massive (99%+) reduction in storage size.
- **Maturity:** The existence of this tool, which includes a `--dryRun` mode for safety, demonstrates a focus on production-level stability and performance.

### Conversation Populator (`conversation-populator.ts`)

This module acts as the bridge between the `Analyzer` and the conversation's data storage, transforming the flat list of conversation turns into a rich, multi-faceted knowledge base.

- **Multi-Dimensional Strategy:** It implements a key design pattern where every single conversation turn is added to **all 7 conversation overlays**.
- **Perspective-Based Storage:** When a turn is added to a specific overlay (e.g., the 'Security' overlay), it's stored along with its specific alignment score for that dimension. This allows the same conversation history to be queried from different perspectives, for example, searching for "authentication" in the 'Structural' overlay to find architectural discussions, or in the 'Security' overlay to find security-focused discussions.

### Conversation Overlay Registry (`conversation-registry.ts`)

This module is the central manager for all 7 conversation overlays, providing a single point of access and control.

- **Central Registry:** It acts as a factory for the different conversation overlay managers (Structural, Security, etc.).
- **Lazy Loading:** For efficiency, it only creates an overlay manager the first time it's needed.
- **Lifecycle Management:** It handles the lifecycle of the overlays, with methods to `flushAll()` (save to disk), `clearAllMemory()`, and `setCurrentSession()` to ensure all overlays are filtering for the correct active session.

## Querying & Retrieval

This group of modules provides the interfaces for searching and retrieving information from the conversation lattice.

### Conversation Query (`query-conversation.ts`)

This module provides the main functions for searching the conversation history.

- **High-Level Query (`queryConversationLattice`):** This function answers natural language questions using a sophisticated three-stage pipeline:
  1. **Query Deconstruction:** An SLM analyzes the user's intent and refines the query.
  2. **Multi-Overlay Search:** The refined query is used to perform a semantic search across all 7 conversation overlays in parallel.
  3. **Answer Synthesis:** The top results are enriched with metadata and passed to an LLM to generate a comprehensive, synthesized answer.
- **Fast Filter (`filterConversationByAlignment`):** This is a simpler, faster function that does not use any LLMs. It's used for generating static recaps by directly filtering conversation turns based on their alignment score for each overlay.

### Cross-Session Query (`cross-session-query.ts`)

This module provides powerful tools for searching across the _entire_ conversation history, not just the current session.

- **`findSimilarConversations`:** The main semantic search function. It can find relevant turns from any session, and can be scoped to include or exclude specific sessions.
- **`findAllParadigmShifts`:** Retrieves all major "aha moments" or breakthroughs from the entire history, providing a timeline of key decisions.
- **`findByOverlayAlignment`:** Finds all conversations that were focused on a specific theme (e.g., all security-focused discussions).
- **`queryByDateRange`:** Enables time-based searches (e.g., "show me all conversations from last week").

### Recall Tool (`recall-tool.ts`)

This module gives the AI agent itself the ability to query its own long-term memory.

- **Tool Creation:** It uses the Anthropic SDK to create a `recall_past_conversation` tool that the AI can choose to use.
- **Teaching the AI:** The tool's description explicitly teaches the AI that the context it sees is truncated and that the `...` is a signal to use this tool to get the full details.
- **Closing the Loop:** When the AI uses the tool, it directly calls the `queryConversationLattice` function, allowing the agent to actively retrieve information from its memory on its own initiative. This is a key part of the human-AI symbiotic design.
