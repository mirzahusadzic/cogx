export interface SugarCommandOptions {
  projectRoot?: string;
  format?: 'table' | 'json' | 'summary';
  limit?: number;
  verbose?: boolean;
  type?: string;
  threshold?: number;
  scoreField?: string;
  [key: string]: unknown;
}

export interface SugarCommandConfig {
  name: string;
  description: string;
  overlayType: string;
  queryType?: string;
  itemLabel: string;
  pluralItemLabel: string;
  customQuery?: string;
  scoreField?: string;
  customHandler?: (options: SugarCommandOptions) => Promise<void>;
}
