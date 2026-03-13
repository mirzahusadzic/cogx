# Onboard Architectural Roles

This command helps you discover the architectural patterns of a new repository and create a tailored `roles.json` for high-fidelity structural analysis via `patterns analyze`.

## Purpose

The `roles.json` file defines heuristics (regex-based name and path matching) used by Cognition Σ to categorize symbols into architectural roles (e.g., service, view, engine). This allows for domain-aware mapping of the codebase, moving beyond generic software engineering terms to project-specific cognitive layers.

## The Process

### Step 1: Structural Discovery

Explore the codebase to identify directory structures and naming conventions. This step is language-agnostic.

```bash
# 1. Get directory distribution (understand subsystem structure)
find . -maxdepth 3 -not -path '*/.*' -type d | sort

# 2. Identify common file suffixes (discover role indicators)
# This finds PascalCase suffixes which often indicate roles (e.g., UserService, AppController)
find src/ -type f -not -path '*/.*' | sed 's/.*\///' | sed 's/\..*//' | grep -E '[A-Z][a-z]+[A-Z]' | sed -E 's/.*([A-Z][a-z]+)$/\1/' | sort | uniq -c | sort -rn | head -20

# 3. List top-level directories in src/ (or project root)
ls -F src/ 2>/dev/null || ls -F
```

### Step 2: Role Mapping Analysis

Analyze the results from Step 1 and map them to architectural roles. Look for patterns in where logic lives and how it is named.

| Pattern              | Example               | Likely Role   |
| -------------------- | --------------------- | ------------- |
| `src/commands/`      | `tui.ts`              | `command`     |
| `src/core/services/` | `role-classifier.ts`  | `service`     |
| `*Controller.java`   | `UserController.java` | `controller`  |
| `src/models/`        | `user.py`             | `data_access` |
| `src/tui/`           | `index.tsx`           | `view`        |
| `src/ipc/`           | `bus.ts`              | `bus`         |

### Step 3: Create roles.json

Create a `roles.json` file in the project root. Use the following template and customize it based on your findings.

**Template**:

```json
{
  "description": "Architectural Role Classification Configuration for [Project Name]. This file defines heuristics to categorize symbols into architectural roles for structural analysis.",
  "roles": [
    {
      "id": "role_id",
      "description": "Human-readable description of the role (shown in patterns analyze)",
      "priority": 10,
      "rules": [
        { "path": "regex_matching_path" },
        { "name": "regex_matching_symbol_name" }
      ]
    }
  ]
}
```

### Step 4: Refinement & Verification

After creating `roles.json`, verify the classification distribution to ensure it accurately reflects the project's architecture.

```bash
# 1. Run patterns analyze to see the new distribution
cognition-cli patterns analyze

# 2. Check for "component" (generic) role count.
# If it's high (>15%), use grep to find what's missing:
# cognition-cli patterns analyze --json | jq '.symbols[] | select(.role == "component")'
```

## Language-Agnostic Examples

### Python (Django/FastAPI)

- `views.py` or `routers/` -> `view` or `controller`
- `models.py` or `schemas/` -> `data_access` or `type`
- `services/` or `logic/` -> `service` or `logic`
- `middleware/` -> `security` or `bus_coordination`

### Rust

- `src/bin/` -> `command_cli`
- `src/api/` -> `controller`
- `src/db/` -> `data_access`
- `src/lib.rs` -> `orchestrator`

### Java (Spring)

- `*Controller.java` -> `controller`
- `*Service.java` -> `service`
- `*Repository.java` -> `data_access`
- `*DTO.java` -> `type_definition`

## Tips for High-Fidelity Mapping

1. **Be Specific**: Instead of just `service`, use `domain_logic` or `infrastructure_adapter` if the project distinguishes them.
2. **Use Descriptions**: Descriptions in `roles.json` are displayed in the `patterns analyze` output. Use them to provide context about what each layer does.
3. **Priority Matters**: Rules are evaluated in order of priority (higher first). Use this to handle overlapping patterns (e.g., a "Service" that is also in "Security").
4. **Path vs Name**: Path-based rules are generally more robust than name-based rules. Combine them for high precision.
