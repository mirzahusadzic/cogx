import * as fs from 'fs';
import * as path from 'path';

export interface RoleRule {
  path?: string;
  name?: string;
}

export interface RoleConfig {
  id: string;
  priority: number;
  rules: RoleRule[];
  description?: string;
}

export interface RoleClassificationConfig {
  roles: RoleConfig[];
  defaultRole: string;
}

export const DEFAULT_ROLE_CONFIG: RoleClassificationConfig = {
  roles: [
    {
      id: 'configuration',
      priority: 10,
      rules: [{ name: '.*(Config|Options)$' }, { path: '/config/' }],
    },
    {
      id: 'command',
      priority: 10,
      rules: [{ path: '/commands/' }, { name: '.*Command$' }],
    },
    {
      id: 'view',
      priority: 10,
      rules: [
        { path: '/(ui|components|views)/' },
        { name: '.*(View|Component|Widget)$' },
      ],
    },
    {
      id: 'hook',
      priority: 10,
      rules: [{ name: '^use[A-Z].*' }],
    },
    {
      id: 'data_access',
      priority: 10,
      rules: [
        { path: '/(repositories|data-access|db|models|schemas)/' },
        { name: '.*(Repository|Store|DAO|Database|Entity|Schema|Model)$' },
      ],
    },
    {
      id: 'service',
      priority: 5,
      rules: [
        { path: '/(services|logic|core)/' },
        { name: '.*(Service|Manager|Engine|Processor|Registry)$' },
      ],
    },
    {
      id: 'controller',
      priority: 5,
      rules: [{ name: '.*(Controller|Handler|Resolver)$' }],
    },
    {
      id: 'orchestrator',
      priority: 5,
      rules: [{ name: '.*(Orchestrator|Workflow|Saga)$' }],
    },
    {
      id: 'provider',
      priority: 5,
      rules: [{ name: '.*(Provider|Factory|Adapter)$' }],
    },
    {
      id: 'utility',
      priority: 1,
      rules: [
        { path: '/(utils|helpers)/' },
        { name: '.*(Util|Helper|Support)$' },
      ],
    },
    {
      id: 'type',
      priority: 2,
      rules: [
        { path: '/(types|interfaces|dtos)/' },
        { name: '.*(Type|DTO|Interface|Enum)$' },
      ],
    },
    {
      id: 'component',
      priority: 0,
      rules: [],
      description: 'Generic architectural component.',
    },
  ],
  defaultRole: 'component',
};

export class RoleClassifier {
  private config: RoleClassificationConfig;

  constructor(config: RoleClassificationConfig = DEFAULT_ROLE_CONFIG) {
    // Sort roles by priority descending
    this.config = {
      ...config,
      roles: [...config.roles].sort((a, b) => b.priority - a.priority),
    };
  }

  /**
   * Load role classification config from project root or use defaults.
   */
  public static loadFromProject(projectRoot: string): RoleClassifier {
    const configPath = path.join(projectRoot, 'roles.json');
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(content) as RoleClassificationConfig;
        return new RoleClassifier(config);
      } catch {
        console.warn(
          `[RoleClassifier] Failed to parse roles.json at ${configPath}, using defaults.`
        );
      }
    }

    return new RoleClassifier();
  }

  public getConfig(): RoleClassificationConfig {
    return this.config;
  }

  public classify(symbolName: string, filePath: string): string {
    const path = filePath.toLowerCase();

    for (const role of this.config.roles) {
      for (const rule of role.rules) {
        let match = true;

        if (rule.path) {
          const pathRegex = new RegExp(rule.path, 'i');
          if (!pathRegex.test(path)) {
            match = false;
          }
        }

        if (match && rule.name) {
          const nameRegex = new RegExp(rule.name);
          if (!nameRegex.test(symbolName)) {
            match = false;
          }
        }

        if (match && (rule.path || rule.name)) {
          return role.id;
        }
      }
    }

    return this.config.defaultRole;
  }
}
