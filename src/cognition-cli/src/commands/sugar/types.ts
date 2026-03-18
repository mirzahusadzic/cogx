export interface SugarCommandOptions {
  projectRoot?: string;
  format?: 'table' | 'json' | 'summary';
  limit?: number;
  verbose?: boolean;
  type?: string;
  threshold?: number;
}

export interface SugarCommandConfig {
  name: string;
  description: string;
  overlayType: string;
  queryType?: string;
  itemLabel: string;
  pluralItemLabel: string;
  customQuery?: string;
}
