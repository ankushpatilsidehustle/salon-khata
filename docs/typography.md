# Typography

Typography should make the app readable on small and older phones while feeling premium.

## Font Guidance

Use a font with strong Android rendering and Indian language support. Recommended direction:

- English MVP: use a clean, humanist sans such as `Manrope` or `Anek Latin`.
- Future Indian languages: evaluate `Anek Devanagari`, `Anek Gujarati`, `Anek Kannada`, `Anek Tamil`, and `Anek Telugu`.

The selected stack must be tested on low-cost Android devices before release.

## Type Scale

| Token | Size | Line Height | Weight | Use |
| --- | --- | --- | --- | --- |
| Display | 32 | 40 | 700 | Rare high-level totals |
| H1 | 24 | 32 | 700 | Screen titles |
| H2 | 20 | 28 | 700 | Section titles |
| H3 | 18 | 24 | 600 | Card titles |
| Body | 16 | 24 | 400 | Primary reading text |
| Caption | 13 | 18 | 500 | Metadata and helper text |
| Button | 16 | 20 | 700 | Button labels |

Letter spacing should be `0` unless a specific font requires adjustment after testing.

## Usage Rules

- Use large numbers for dashboard amounts.
- Keep form labels readable and short.
- Avoid all-caps labels.
- Do not shrink text to fit crowded layouts; simplify the layout.
- Long translations must wrap without overlapping controls.

## Currency Display

- Store money as integer minor units.
- Format display with locale-aware utilities.
- Use consistent placement for currency symbols.

## Translation Readiness

All text examples in implementation must use keys:

```ts
t("dashboard.netCollection")
t("income.selectEmployee")
t("settings.language")
```
