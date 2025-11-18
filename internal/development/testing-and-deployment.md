# 06 - Project Health: Testing, Documentation, and Quality

A system designed to create verifiable truth for others must, above all, be verifiable itself. This document outlines the core workflows for maintaining the health, integrity, and clarity of the `cognition-cli` project.

These are not just development chores; they are the primary **Oracles** we use to verify the quality of our own work. Testing is the `Oracle` of our logic. Documentation is the `Oracle` of our clarity. And code quality is the `Oracle` of our discipline.

## 1. Verifying the Logic (Testing)

- **The Philosophy:** _In the CogX ecosystem, a feature without a test is a hallucination. It is an unverified transformation. Our comprehensive test suite is the ultimate `StructuralOracle` for the CLI itself, ensuring every component behaves exactly as the blueprint dictates._

The project uses **Vitest** for its unit and integration tests. All new contributions, whether new features or bug fixes, must be accompanied by corresponding tests to be considered complete.

### **To run the entire test suite:**

Navigate to the `src/cognition-cli` directory and execute:

```bash
npm test
```

## 2. Verifying the Understanding (Documentation)

- **The Philosophy:** _The code builds the lattice, but the documentation is what makes it legible to other human minds. Clear, coherent documentation is an act of empathy and a core requirement for a project dedicated to fighting superficiality._

The project's documentation is a static site built with **VitePress**. This allows us to treat our documentation like code, ensuring it is versioned and maintained with the same rigor.

### **To preview the documentation locally:**

This command starts a live development server, allowing you to see your changes as you make them.

```bash
npm run docs:dev
```

#### **To build the static documentation site for deployment:**

This command compiles the Markdown files into a complete, static website in the `docs/.vitepress/dist` directory.

```bash
npm run docs:build
```

The resulting `dist` folder can be deployed to any static hosting service like GitHub Pages, Vercel, or Netlify.

## 3. Maintaining Coherence (Code Quality)

- **The Philosophy:** _A clean, consistent, and well-structured codebase is the physical manifestation of a clear and coherent architecture. These tools are the automated "grooming" commands that maintain the PGC of our own source code._

Before committing any changes, please run the following quality checks to ensure your contribution aligns with the project's standards.

### **To automatically format the code:**

Uses **Prettier** to enforce a consistent style.

```bash
npm run format
```

### **To lint the code for potential errors:**

Uses **ESLint** for TypeScript and **markdownlint** for documentation to catch quality issues.

```bash
npm run lint
```

### **To perform a full build and type-check:**

Uses the **TypeScript Compiler (`tsc`)** to ensure the project is free of compilation and type errors.

```bash
npm run build
```
