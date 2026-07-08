export interface IntegrationConfig {
  contactSearchFields: string[];
  dispositionFieldName: string;
  dispositionMap: Record<string, number>;
  attr: { callerNumber: string; disposition: string; notes: string; direction: string };
}

const DEFAULTS: IntegrationConfig = {
  contactSearchFields: ['telephone1', 'mobilephone', 'telephone2'],
  dispositionFieldName: 'new_disposition',
  dispositionMap: {},
  attr: {
    callerNumber: 'caller',
    disposition: 'disposition',
    notes: 'wrapUpNotes',
    direction: 'direction',
  },
};

export function getConfig(overrides: Partial<IntegrationConfig> = {}): IntegrationConfig {
  return { ...DEFAULTS, ...overrides };
}
