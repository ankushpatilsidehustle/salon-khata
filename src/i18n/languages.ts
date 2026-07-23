/**
 * Supported app languages.
 *
 * Codes match `salons.language` (short BCP-47 primary tags).
 * Display names are always in the language's own script — never translate
 * these labels via i18n (a Hindi UI still shows "English", not "अंग्रेज़ी").
 */
export type AppLanguageCode = "en" | "hi" | "mr" | "gu" | "bn" | "ta" | "kn";

export type AppLanguage = {
  code: AppLanguageCode;
  /** Native-script name shown in pickers. */
  nativeName: string;
  /** Intl locale used for dates / number grouping (digits stay Latin). */
  intlLocale: string;
};

export const APP_LANGUAGES: readonly AppLanguage[] = [
  { code: "en", nativeName: "English", intlLocale: "en-IN" },
  { code: "hi", nativeName: "हिन्दी", intlLocale: "hi-IN" },
  { code: "mr", nativeName: "मराठी", intlLocale: "mr-IN" },
  { code: "gu", nativeName: "ગુજરાતી", intlLocale: "gu-IN" },
  { code: "bn", nativeName: "বাংলা", intlLocale: "bn-IN" },
  { code: "ta", nativeName: "தமிழ்", intlLocale: "ta-IN" },
  { code: "kn", nativeName: "ಕನ್ನಡ", intlLocale: "kn-IN" }
] as const;

const BY_CODE = new Map(APP_LANGUAGES.map((l) => [l.code, l]));

export function isAppLanguageCode(value: string): value is AppLanguageCode {
  return BY_CODE.has(value as AppLanguageCode);
}

export function getAppLanguage(code: string): AppLanguage {
  return BY_CODE.get(code as AppLanguageCode) ?? APP_LANGUAGES[0];
}

export function intlLocaleFor(code: string): string {
  return getAppLanguage(code).intlLocale;
}
