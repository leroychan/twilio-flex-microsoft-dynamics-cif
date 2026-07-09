/**
 * Localized UI labels for the Dynamics CIF plugin. Mirrors the sibling
 * `twilio-flex-plugin-real-time-transcription` plugin's approach: a per-locale
 * dictionary merged into `manager.strings` at init (see `mergeStrings.ts`).
 *
 * Only strings RENDERED in the Flex UI belong here (currently just the Create
 * Case button). Labels written into the Dataverse note (`mappers/note.ts`) are
 * CRM record content, not UI, and stay in English.
 */
export type DynCifStringKey = 'DynCifCreateCase';

export const RTL_LOCALES: string[] = ['ar'];

export const dynCifStrings: Record<string, Record<DynCifStringKey, string>> = {
  'en-US': { DynCifCreateCase: 'Create Case' },
  'es-MX': { DynCifCreateCase: 'Crear caso' },
  'pt-BR': { DynCifCreateCase: 'Criar caso' },
  'zh-CN': { DynCifCreateCase: '创建案例' },
  'yue': { DynCifCreateCase: '建立個案' },
  'ja': { DynCifCreateCase: 'ケースを作成' },
  'ko': { DynCifCreateCase: '케이스 생성' },
  'sw': { DynCifCreateCase: 'Fungua kesi' },
  'af': { DynCifCreateCase: 'Skep saak' },
  'ar': { DynCifCreateCase: 'إنشاء حالة' },
  'hi': { DynCifCreateCase: 'केस बनाएं' },
  'id': { DynCifCreateCase: 'Buat Kasus' },
  'th': { DynCifCreateCase: 'สร้างเคส' },
  'tl': { DynCifCreateCase: 'Gumawa ng Kaso' },
  'vi': { DynCifCreateCase: 'Tạo hồ sơ' },
};
