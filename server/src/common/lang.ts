export type Lang = 'en' | 'pt';

export function resolveLang(acceptLanguage?: string): Lang {
  return acceptLanguage?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function localizedName(name: string, namePt: string | null, lang: Lang): string {
  return lang === 'pt' && namePt ? namePt : name;
}

// instructionsPt reads back as [] (never null) until an exercise has been
// through the pt backfill — treat empty as "not translated yet" and fall
// back to English rather than showing an empty instructions list
export function localizedInstructions(
  instructions: string[],
  instructionsPt: string[],
  lang: Lang,
): string[] {
  return lang === 'pt' && instructionsPt.length > 0 ? instructionsPt : instructions;
}
