export const languages = {
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  en: "English",
  km: "ខ្មែរ",
  es: "Español",
  vi: "Tiếng Việt",
  hi: "हिन्दी",
} as const;
export type Language = keyof typeof languages;
