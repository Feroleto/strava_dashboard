import commonEn from './locales/en/common.json';
import authEn from './locales/en/auth.json';
import onboardingEn from './locales/en/onboarding.json';
import navEn from './locales/en/nav.json';
import dashboardEn from './locales/en/dashboard.json';
import overviewEn from './locales/en/overview.json';
import activityEn from './locales/en/activity.json';
import analysisEn from './locales/en/analysis.json';

import commonPt from './locales/pt/common.json';
import authPt from './locales/pt/auth.json';
import onboardingPt from './locales/pt/onboarding.json';
import navPt from './locales/pt/nav.json';
import dashboardPt from './locales/pt/dashboard.json';
import overviewPt from './locales/pt/overview.json';
import activityPt from './locales/pt/activity.json';
import analysisPt from './locales/pt/analysis.json';

export const resources = {
  en: {
    common: commonEn,
    auth: authEn,
    onboarding: onboardingEn,
    nav: navEn,
    dashboard: dashboardEn,
    overview: overviewEn,
    activity: activityEn,
    analysis: analysisEn,
  },
  pt: {
    common: commonPt,
    auth: authPt,
    onboarding: onboardingPt,
    nav: navPt,
    dashboard: dashboardPt,
    overview: overviewPt,
    activity: activityPt,
    analysis: analysisPt,
  },
} as const;
