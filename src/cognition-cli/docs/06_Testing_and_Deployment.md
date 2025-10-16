# 06 - Testing and Deployment

This document outlines the procedures for testing the `cognition-cli` and for generating and publishing its documentation. Ensuring code quality and accessible documentation are crucial aspects of the project's development workflow.

## 1. Testing the Cognition CLI

The `cognition-cli` utilizes `vitest` for its unit and integration tests. A comprehensive test suite ensures the reliability and correctness of the CLI's functionalities, especially the integrity of the Grounded Context Pool (PGC) and the structural extraction process.

### Running Tests

To execute the entire test suite, navigate to the `src/cognition-cli` directory and run the following command:

```bash
npm test
```

This command will run all test files (typically those ending with `.test.ts`) using Vitest. The output will indicate the number of passed and failed tests, along with any errors.

### Test-Driven Development (TDD)

New features and bug fixes should always be accompanied by corresponding tests. For bug fixes, regression tests are essential to prevent re-introduction of the same issues.

## 2. Generating and Publishing Documentation

The `cognition-cli`'s documentation is built using VitePress, a static site generator. This allows for easy generation of a static website from Markdown files, which can then be hosted on various platforms.

### Local Development Server

To preview the documentation locally during development, navigate to the `src/cognition-cli` directory and run:

```bash
npm run docs:dev
```

This will start a development server (usually at `http://localhost:5173`), allowing you to view your changes in real-time.

### Building the Documentation for Deployment

To generate the static HTML, CSS, and JavaScript files for your documentation, use the `docs:build` command:

```bash
npm run docs:build
```

This command will create a `dist` directory within `src/cognition-cli/docs/.vitepress/`, containing all the necessary files for your static website.

### Publishing the Documentation

Once the documentation is built, the `dist` directory can be deployed to any static hosting service. Common publishing methods include:

- **GitHub Pages:** Configure your GitHub repository settings to serve content from the `docs/.vitepress/dist` folder.
- **Netlify/Vercel:** These platforms offer continuous deployment. Configure them to use `npm run docs:build` as the build command and `src/cognition-cli/docs/.vitepress/dist` as the publish directory.
- **Static Web Server:** Simply copy the contents of the `docs/.vitepress/dist` directory to any web server that can serve static files.

## 3. Code Quality Checks

Before committing any changes, it's essential to ensure code quality and adherence to project standards. The following commands are used for this purpose:

- **Formatting:**

```bash
npm run format
```

This command uses Prettier to automatically format the codebase.

- **Linting:**

```bash
npm run lint
```

This command uses ESLint (for TypeScript) and markdownlint (for Markdown) to check for code quality issues and potential errors.

- **Building/Type Checking:**

```bash
npm run build
```

This command compiles the TypeScript project using `tsc`, ensuring there are no compilation errors and that type definitions are correct.
