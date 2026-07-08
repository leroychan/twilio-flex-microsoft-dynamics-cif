export type TranscriptSource = 'sync-rtt' | 'conversation' | 'none';

export interface ChannelConfig {
  /** Task-attribute path holding the customer's identifier (phone) for this channel. */
  identifierAttr: string;
  /** Where the interaction transcript comes from for this channel. */
  transcriptSource: TranscriptSource;
}

export interface IntegrationConfig {
  contactSearchFields: string[];
  /** Optional label lookup for a disposition code (written into the note body). */
  dispositionMap: Record<string, string>;
  attr: { callerNumber: string; disposition: string; notes: string; direction: string };
  /** Channels handled by the plugin, keyed by taskChannelUniqueName. */
  channels: Record<string, ChannelConfig>;
}

const DEFAULTS: IntegrationConfig = {
  contactSearchFields: ['telephone1', 'mobilephone', 'telephone2'],
  dispositionMap: {},
  attr: {
    callerNumber: 'caller',
    disposition: 'disposition',
    notes: 'wrapUpNotes',
    direction: 'direction',
  },
  channels: {
    voice: { identifierAttr: 'caller', transcriptSource: 'sync-rtt' },
    whatsapp: { identifierAttr: 'from', transcriptSource: 'conversation' },
  },
};

export function getConfig(overrides: Partial<IntegrationConfig> = {}): IntegrationConfig {
  return {
    ...DEFAULTS,
    ...overrides,
    attr: { ...DEFAULTS.attr, ...(overrides.attr ?? {}) },
    dispositionMap: { ...DEFAULTS.dispositionMap, ...(overrides.dispositionMap ?? {}) },
    // A channels override replaces the whole map (admins specify the full set they run).
    // Deep-copy so callers never share/mutate the DEFAULTS nested objects.
    channels: Object.fromEntries(
      Object.entries(overrides.channels ?? DEFAULTS.channels).map(([k, v]) => [k, { ...v }]),
    ),
  };
}
