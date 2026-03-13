import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoleClassifier, DEFAULT_ROLE_CONFIG } from '../role-classifier.js';
import * as fs from 'fs';

vi.mock('fs');

describe('RoleClassifier', () => {
  const classifier = new RoleClassifier(DEFAULT_ROLE_CONFIG);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads config from project root if it exists', () => {
    const mockConfig = {
      roles: [
        {
          id: 'custom_role',
          priority: 100,
          rules: [{ name: '.*Custom$' }],
        },
      ],
      defaultRole: 'custom_default',
    };

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockConfig));

    const loadedClassifier = RoleClassifier.loadFromProject('/mock/root');
    expect(loadedClassifier.classify('TestCustom', 'some/path.ts')).toBe(
      'custom_role'
    );
    expect(loadedClassifier.classify('Random', 'some/path.ts')).toBe(
      'custom_default'
    );
  });

  it('uses defaults if roles.json does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const loadedClassifier = RoleClassifier.loadFromProject('/mock/root');
    expect(
      loadedClassifier.classify('PingCommand', 'src/commands/ping.ts')
    ).toBe('command');
  });

  it('classifies commands correctly', () => {
    expect(classifier.classify('PingCommand', 'src/commands/ping.ts')).toBe(
      'command'
    );
    expect(
      classifier.classify('MyCommand', 'src/internal/commands/foo.ts')
    ).toBe('command');
  });

  it('classifies views correctly', () => {
    expect(classifier.classify('AppView', 'src/tui/AppView.tsx')).toBe('view');
    expect(classifier.classify('Button', 'src/components/Button.tsx')).toBe(
      'view'
    );
  });

  it('classifies hooks correctly', () => {
    expect(classifier.classify('useAuth', 'src/hooks/useAuth.ts')).toBe('hook');
  });

  it('classifies data access correctly', () => {
    expect(classifier.classify('UserRepository', 'src/db/user.ts')).toBe(
      'data_access'
    );
    expect(classifier.classify('Store', 'src/data-access/store.ts')).toBe(
      'data_access'
    );
  });

  it('classifies services correctly', () => {
    expect(classifier.classify('AuthService', 'src/services/auth.ts')).toBe(
      'service'
    );
    expect(classifier.classify('ProcessEngine', 'src/core/engine.ts')).toBe(
      'service'
    );
  });

  it('classifies utils correctly', () => {
    expect(classifier.classify('StringUtils', 'src/utils/string.ts')).toBe(
      'utility'
    );
    expect(classifier.classify('MyHelper', 'src/helpers/foo.ts')).toBe(
      'utility'
    );
  });

  it('classifies types correctly', () => {
    expect(classifier.classify('UserDTO', 'src/types/user.ts')).toBe('type');
    expect(classifier.classify('ConfigOptions', 'src/core/config.ts')).toBe(
      'configuration'
    );
  });

  it('defaults to component', () => {
    expect(classifier.classify('MyStuff', 'src/random.ts')).toBe('component');
  });
});
