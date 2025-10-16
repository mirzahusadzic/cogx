# Cognition CLI

The Cognition Command-Line Interface (`cognition-cli`) is the primary tool for interacting with the Cognition project's core functionalities. It enables developers to manage and process their codebase to create a verifiable, content-addressable data structure representing the project's knowledge graph.

## Features

- **Initialize Project (`init` command):** Sets up the necessary `.open_cognition` directory structure within your project. This directory serves as the local knowledge base for your codebase, storing structural metadata, object hashes, and transformation logs.

### Usage

```bash
cognition-cli init
```

This command creates the `.open_cognition` directory and its subdirectories (`objects`, `transforms`, `index`, `reverse_deps`, `overlays`), along with a `metadata.json` file and a `.gitignore` entry to prevent committing generated artifacts.

- **Generate Genesis (`genesis` command):** Populates the `.open_cognition` directory by extracting structural metadata from your project's source code. This process involves parsing files, hashing their content, and logging transformations to build the initial knowledge graph.

### Genesis Command Usage

```bash
cognition-cli genesis <path-to-source-code>
```

Replace `<path-to-source-code>` with the directory containing the source files you wish to process. The `genesis` command will recursively scan the specified path, extract relevant information, and store it in the `.open_cognition` directory.

## Project Goal

The overarching goal of the Cognition CLI is to facilitate the creation of a robust, verifiable, and well-tested implementation of the CogX blueprint. By transforming raw source code into a structured, queryable knowledge graph, we aim to enable advanced code analysis, automated reasoning, and intelligent software development workflows.

## Build and Run

To build and run the `cognition-cli`, follow these steps:

1. **Navigate to the CLI directory:**

   ```bash
   cd src/cognition-cli
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

   This compiles the TypeScript code into JavaScript, placing the output in the `dist` directory.

After building, you can run the CLI in several ways:

- **Using `npm start` (recommended for built version):**

  ```bash
  npm start -- <command> [args]
  # Example: npm start -- init
  # Example: npm start -- genesis .
  ```

- **Directly using the compiled executable:**

  ```bash
  node dist/cli.js <command> [args]
  # Example: node dist/cli.js init
  # Example: node dist/cli.js genesis .
  ```

- **In development mode (without building, using `tsx`):**

  ```bash
  npm run dev -- <command> [args]
  # Example: npm run dev -- init
  # Example: npm run dev -- genesis .
  ```

  This uses `tsx` to run the TypeScript files directly and watches for changes.

## Dependencies

For processing non-native TypeScript files and other languages not natively supported by the CLI's AST parsers, the `genesis` command relies on the `eGemma` server. `eGemma` provides advanced parsing capabilities and must be running and accessible at `http://localhost:8000` for full functionality. You can find more information about `eGemma` at [https://github.com/mirzahusadzic/egemma](https://github.com/mirzahusadzic/egemma).
