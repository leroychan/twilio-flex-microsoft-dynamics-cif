import { resolveLocale } from '../../src/localization/mergeStrings';

describe('resolveLocale', () => {
  const available = ['en-US', 'es-MX', 'pt-BR', 'ja-JP', 'ar'];

  it('returns exact tag when in both dictionary and availableLocales', () => {
    expect(resolveLocale('es-MX', available)).toBe('es-MX');
  });
  it('matches by language prefix (ja ↔ ja-JP)', () => {
    expect(resolveLocale('ja-JP', available)).toBe('ja');
  });
  it('falls back to en-US when active locale is not available', () => {
    expect(resolveLocale('de-DE', available)).toBe('en-US');
  });
  it('falls back to en-US when active is available but we have no strings for it', () => {
    expect(resolveLocale('pt-BR', ['pt-BR'])).toBe('pt-BR'); // we provide pt-BR
    expect(resolveLocale('fr-FR', ['fr-FR'])).toBe('en-US'); // we don't provide fr
  });
  it('resolves ar for RTL', () => {
    expect(resolveLocale('ar', available)).toBe('ar');
  });
});
