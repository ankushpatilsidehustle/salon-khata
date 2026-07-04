# 14 · Localization

Salon Khata is built for Indian salon owners across languages. Localization is a first-class design constraint, not a translation task at the end.

## Supported Languages (MVP)

| Language | Code | Script | Direction |
| --- | --- | --- | --- |
| English (India) | `en-IN` | Latin | LTR |
| हिन्दी (Hindi) | `hi-IN` | Devanagari | LTR |
| मराठी (Marathi) | `mr-IN` | Devanagari | LTR |
| ગુજરાતી (Gujarati) | `gu-IN` | Gujarati | LTR |
| ಕನ್ನಡ (Kannada) | `kn-IN` | Kannada | LTR |
| தமிழ் (Tamil) | `ta-IN` | Tamil | LTR |
| తెలుగు (Telugu) | `te-IN` | Telugu | LTR |

**Fallback**: English.

## Post-MVP

Bengali, Punjabi, Malayalam, Odia.

## Principles

1. **Every visible string is a key.** Never hard-code text.
2. **Design for the longest translation.** German-style pessimism: assume the string will grow 40%.
3. **Fonts matter.** Devanagari and Tamil have different metrics — the type stack must handle both.
4. **Numbers stay Latin.** Business owners across all Indian languages expect Latin digits for money.
5. **Currency and dates follow locale, not just language.**

## Font Stack

From [04-typography.md](04-typography.md):

- Latin & digits: **Manrope**.
- Indic scripts: **Anek** (Anek Devanagari, Anek Gujarati, Anek Kannada, Anek Tamil, Anek Telugu).

Rules:

- Never render Devanagari in a Latin-only font.
- Line height for Indic scripts uses `lineHeight.relaxed` (1.6) even for body text — glyphs stack taller.
- Do not force uppercase on Indic scripts (they do not have case).

## Translation Keys

Key format: `feature.context.description`.

Examples:

- `income.entry.selectEmployee`
- `expense.list.emptyTitle`
- `common.save`
- `common.cancel`
- `settings.language.title`

Rules:

- Keys are English lowercase with dot separators.
- Keys never contain the translation text.
- Keys are stable — renaming a key is a breaking change.
- One key per user-facing string; no reuse across contexts (a `common.save` shared everywhere is fine when the meaning is identical, but `common.delete` may render differently in different contexts).

## String Length Assumptions

| Context | Design width | Longest expected translation |
| --- | --- | --- |
| Button label | ≤ 20 chars | ≤ 30 chars |
| App bar title | ≤ 25 chars | ≤ 35 chars |
| Bottom nav label | ≤ 12 chars | ≤ 18 chars |
| Snackbar | ≤ 60 chars | ≤ 90 chars |
| Empty state title | ≤ 30 chars | ≤ 45 chars |
| Empty state body | ≤ 100 chars | ≤ 150 chars |

Design mockups must be tested with the longest-language string, not the shortest.

## Truncation

- Truncate with an ellipsis only when full text is available via tap (detail sheet).
- Never truncate a critical value (money, dates, employee name in a header).
- Bottom nav labels never truncate — pick short translation keys.

## Pluralization

Use ICU-style plurals via i18next:

```
{
  "transactions.count": "{{count}} transaction",
  "transactions.count_plural": "{{count}} transactions"
}
```

Rules:

- Every count string has both singular and plural.
- Some Indic languages have additional plural forms — i18next handles them if the translation file provides them.

## Number Formatting

- All money uses locale grouping (`en-IN`: `₹1,25,000`; `hi-IN`: same grouping, Latin digits).
- No Devanagari or Tamil digit rendering in MVP — stick with Latin digits (0–9) for business clarity.
- Percentages: `24%` in all locales.
- Negative values: leading `−` (minus sign) universally.

## Date Formatting

- Short format: `04 Jul 2026` (English), `04 जुल 2026` (Hindi), etc.
- Do not use `MM/DD/YYYY` — ambiguous.
- Do not use ordinal suffixes (`4th July`) — hard to translate.
- Relative dates (`Today`, `Yesterday`) always come from translation keys.
- Never mix formats within one screen.

## Currency

- Default currency: INR (₹).
- Currency symbol always appears before the number (`₹1,250`).
- Store amount in minor units (paise) regardless of locale.
- Display uses locale grouping.

## RTL Readiness

MVP does not ship RTL scripts, but layout code must be RTL-safe for future:

- Use logical properties (`marginStart` / `marginEnd`) not physical (`marginLeft` / `marginRight`) when the design system code is built later.
- Icons that convey direction (`arrow-left`, `chevron-right`) must be flippable in future RTL contexts.
- Numbers stay LTR even in RTL layouts.

## Language Selection

- First launch: detect device locale, offer the language picker with detected language pre-selected.
- User can switch language anytime from Settings → Language.
- Change is instant, no restart.
- Each language row displays its name in that language:
  - `English` (not "अंग्रेजी")
  - `हिन्दी` (not "Hindi")
  - `தமிழ்` (not "Tamil")

## Translation Workflow

- Source of truth: `src/i18n/locales/en.json`.
- All keys must exist in `en.json` before shipping.
- Missing keys fall back to English; log a warning in development.
- New keys added must ship with translations for **all** supported languages before release.
- Never ship a screen with untranslated keys.

## Voice & Tone Across Languages

- Formal register in Indic languages (आप, तुम्ही, તમે, ನೀವು, நீங்கள், మీరు) — business context.
- Never use informal singular pronouns.
- Avoid English loanwords unless they are business standard (WhatsApp, UPI, OK).

## Anti-Patterns

- Concatenating strings ("Save " + noun) — order changes across languages.
- Assuming word count between languages is similar.
- Uppercase on Indic scripts.
- Font stack that renders `ॐ` as a Latin fallback.
- Hard-coding "₹" — use Currency Display which reads locale.
- Truncating employee or service names in headers.

## Do's

- Test every screen in the longest-language.
- Use ICU plurals.
- Localize dates and currency via the formatting helpers.
- Ship all translations before release.

## Don'ts

- Don't concatenate translated strings.
- Don't uppercase Indic text.
- Don't mix digit systems.
- Don't reuse keys across different meanings.
