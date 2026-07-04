# 04 · Typography

Type carries most of the app's meaning. It must be readable on cheap Android phones under fluorescent salon lights.

## Font Stack

**Primary (Latin)**: `Manrope` — humanist, warm, excellent number legibility.

**Indian scripts (loaded per language)**:

- Devanagari (Hindi, Marathi): `Anek Devanagari`
- Gujarati: `Anek Gujarati`
- Kannada: `Anek Kannada`
- Tamil: `Anek Tamil`
- Telugu: `Anek Telugu`

**Fallback**: `system-ui, -apple-system, Roboto, sans-serif`

**Monospace (rare)**: `JetBrains Mono, ui-monospace, monospace` — used only for OTP input.

Rules:

- Never load more than 3 weights per language to keep bundle size small.
- Latin and script fonts must share optical size on the same screen.
- Test rendering on Android 8+ and Android Go devices before shipping.

## Type Scale

| Role | Size | Line Height | Weight | Letter Spacing | Token |
| --- | --- | --- | --- | --- | --- |
| Display | 32 | 40 | 700 | -0.4 | `font.style.display` |
| H1 | 24 | 32 | 700 | -0.2 | `font.style.h1` |
| H2 | 20 | 28 | 700 | -0.1 | `font.style.h2` |
| H3 | 18 | 24 | 600 | 0 | `font.style.h3` |
| Body | 16 | 24 | 400 | 0 | `font.style.body` |
| Body Emphasis | 16 | 24 | 600 | 0 | `font.style.bodyEmphasis` |
| Body Small | 14 | 20 | 400 | 0 | `font.style.bodySmall` |
| Caption | 13 | 18 | 500 | 0.1 | `font.style.caption` |
| Overline | 11 | 16 | 700 | 0.6 (uppercase) | `font.style.overline` |
| Button | 16 | 20 | 700 | 0.1 | `font.style.button` |

## Numeric & Currency Styles

Money is the most-read element. It gets its own scale.

| Role | Size | Weight | Use |
| --- | --- | --- | --- |
| Money Hero | 32 | 700 | Dashboard "today's income" |
| Money Large | 24 | 700 | Report totals, transaction detail |
| Money Medium | 20 | 700 | Card values (money card) |
| Money Body | 16 | 600 | List row amounts |
| Money Small | 14 | 600 | Inline amounts within text |

Rules:

- Money always uses **tabular figures** (`font-feature-settings: "tnum"`).
- Currency symbol (₹) is the same weight as the amount.
- Money is left-aligned in forms, right-aligned in list rows and summaries.
- Never use italic for money.
- Never use color to encode positive/negative — use a `+`/`−` sign plus optional icon.

## Semantic Text Roles

| Role | Style | Example |
| --- | --- | --- |
| Screen title | H1 | "Today", "Services", "Reports" |
| Section header | Overline | "RECENT TRANSACTIONS" |
| Card title | H3 | "Suresh Kumar" (employee card) |
| Card supporting | Body Small + `text.secondary` | "Barber · Active" |
| Empty state title | H2 | "No services yet" |
| Empty state body | Body + `text.secondary` | "Add your first service to start recording income." |
| Error title | Body Emphasis + `status.danger` | "Amount is required" |
| Success toast | Body + `text.inverse` on `status.success` | "Saved" |
| Button label | Button style | "Save", "Add income" |
| Input label | Caption + `text.secondary` | "Amount", "Payment mode" |
| Input placeholder | Body + `text.muted` | "Optional remarks" |
| Field help text | Caption + `text.secondary` | "Amount in ₹" |
| Field error text | Caption + `status.danger` | "Enter a valid amount" |
| Timestamp | Caption + `text.muted` | "2 min ago" |

## Responsive Scaling

Salon Khata is mobile-first. The type scale above targets 360–414 dp width.

- On devices below 360 dp, reduce screen padding, not type.
- On tablets (future), do not scale type up — increase whitespace instead.
- Honor the OS text-size setting up to +30% without breaking layout.

## Line Length

- Body copy: aim for 40–60 characters per line.
- Never wrap money values across two lines.
- Long employee/service names truncate with ellipsis after 2 lines, with a bottom sheet showing full text on tap.

## Weights

Only 3 weights ship per language:

- 400 Regular — body copy
- 600 Semibold — emphasis, card titles, money in body context
- 700 Bold — headings, buttons, money hero

Do not use:

- 300 Light or Thin — poor on cheap displays
- 800 Extra Bold — indistinguishable from 700 on target devices
- Italic — reserved; not used in MVP

## Localization Notes

Indian scripts have different x-heights and descenders than Latin. Rules:

- Line height stays proportional to font size (e.g., 1.4× for body).
- Never mix scripts in a single string component — split by locale-aware formatting.
- Test the longest translation (usually German-length or Kannada composite characters) for every UI string.
- Reserve 130% of English string width for other languages when doing layout math.
- Numbers stay Latin digits by default; add locale-native digits as a Phase 3 setting.

## Text Truncation & Wrapping

- Titles: max 2 lines, ellipsize.
- Body descriptions: max 3 lines, ellipsize.
- Money: never truncate. Reduce accompanying text instead.
- Button labels: never wrap. If a translation is too long, use a shorter key.

## Anti-Patterns

- All-caps body text
- Centered paragraphs
- Justified text
- Underlined text that is not a link
- Two font families on the same screen (aside from mono OTP)
- Font size < 12 anywhere in the app

## Do's & Don'ts

**Do**

- Use the semantic role table, not raw sizes.
- Use tabular figures for money.
- Test the longest translation for every string.
- Respect OS text-size settings.

**Don't**

- Don't shrink type to fit more data on screen.
- Don't use color to distinguish text hierarchy — use size + weight.
- Don't invent new sizes per screen.
