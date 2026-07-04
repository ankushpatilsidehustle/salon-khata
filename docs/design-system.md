# Design System

The design system exists to keep Salon Khata fast, consistent, and premium without making screens feel complex.

## Design Qualities

- Calm
- Fast
- Spacious
- Familiar
- Trustworthy
- Premium but not decorative

## Visual Direction

Salon Khata should feel like a modern financial utility for daily business. Use clear hierarchy, restrained color, strong typography, and confident spacing.

Avoid:

- Crowded dashboards
- Complex tables
- Heavy borders
- Tiny controls
- Excessive color coding
- ERP-style forms

## Foundations

- 8-point spacing system
- Large touch targets, minimum 48 x 48 dp
- Rounded but not playful surfaces
- Clear active, loading, disabled, and error states
- Smooth bottom sheets and transitions
- Translation-ready labels

## Component Rule

Screens must use reusable components. Raw primitives should be wrapped by the component library before screen use.

Examples:

- Use `Button`, not raw `Pressable` with ad hoc styles.
- Use `MoneyCard`, not custom dashboard boxes.
- Use `BottomSheetSelect`, not a new picker pattern on each screen.

## Accessibility Baseline

- Minimum text contrast meets WCAG AA.
- Tap areas are at least 48 dp.
- Critical actions have labels, not color alone.
- Text should scale gracefully within supported device settings.
- Error states include plain-language explanation.

## i18n Baseline

Every visible string comes from translation resources:

```ts
t("save")
t("income.addIncome")
t("dashboard.todayIncome")
```

Do not hardcode visible copy in components or screens.
