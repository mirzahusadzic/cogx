# Primary Symbol Heuristic

Date: 2025-10-21

## Discussion

During the development of the `overlay` command, a question was raised about the intentionality of extracting only one primary symbol (e.g., a function or class) from a file during the pattern mining process. For example, in `src/commands/genesis.ts`, the `genesisCommand` function is identified as the primary symbol, while other functions like `validatePgcInitialized` are not.

This is the current behavior of the `findPrimarySymbol` method in `overlay-orchestrator.ts`.

## Current Implementation

The `findPrimarySymbol` method uses a heuristic to determine the single most important symbol in a file. The hierarchy is as follows:

1. An exported class that matches the file name (in PascalCase).
2. The first exported class.
3. The first exported function if there is a default export.
4. The first exported interface.
5. The first exported function.
6. If there are no exports, it falls back to the first defined class, function, or interface.

## Architectural Considerations

This approach has both pros and cons:

- **Pros:** It simplifies the system and reduces the number of patterns generated, which can make the pattern database smaller and faster to search.
- **Cons:** It can miss other important symbols in a file that are not considered "primary". For example, a file might contain several important exported functions, but only one will be chosen for pattern generation.

## Future Work

A potential future improvement would be to modify the `overlay-orchestrator.ts` to generate patterns for all exported symbols in a file. This would involve:

1. Modifying `findPrimarySymbol` to return an array of all exported symbols, or removing it altogether.
2. Changing the `processSymbol` function to be `processFile`, which would then loop through all the symbols in the file and generate a pattern for each one.

This would be a significant change to the architecture of the overlay generation, but it would provide a more complete and accurate representation of the codebase.
