import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";
import gu from "./locales/gu.json";
import bn from "./locales/bn.json";
import ta from "./locales/ta.json";
import kn from "./locales/kn.json";

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  },
  lng: "en",
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    mr: { translation: mr },
    gu: { translation: gu },
    bn: { translation: bn },
    ta: { translation: ta },
    kn: { translation: kn }
  }
});

export { i18n };
