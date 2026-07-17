import i18n from '@/i18n';
import type { AppLanguage } from '@/i18n';

export const INTL_LOCALES: Record<AppLanguage, string> = {
  pt: 'pt-BR',
  en: 'en-US',
};

export function currentAppLanguage(): AppLanguage {
  return i18n.language.startsWith('pt') ? 'pt' : 'en';
}

export function currentIntlLocale(): string {
  return INTL_LOCALES[currentAppLanguage()];
}
