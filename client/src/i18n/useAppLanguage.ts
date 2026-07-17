import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from './index';

export function useAppLanguage() {
  const { i18n } = useTranslation();
  const language: AppLanguage = i18n.language.startsWith('pt') ? 'pt' : 'en';

  const setLanguage = useCallback(
    (next: AppLanguage) => {
      void i18n.changeLanguage(next);
    },
    [i18n],
  );

  return { language, setLanguage };
}
