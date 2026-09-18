# Flint design system

Dark plum surfaces, a rose → peach brand gradient, Manrope headings and Inter text.
Tokens live in `src/theme/index.js`; primitives live in `src/components/ui/`.

## Tokens

```js
import { theme, alpha } from '../theme';        // screens
import { theme as uiTheme, alpha } from '../../theme'; // components
```

### Color roles

| Role | Token | Use |
|---|---|---|
| App background | `colors.background` | Screen backgrounds, status bar |
| Surface | `colors.surface` | Cards, sheets, list groups |
| Elevated | `colors.elevated` / `elevatedHigh` | Inputs, secondary buttons, nested cards, skeletons |
| Primary | `colors.primary`, gradient `gradients.brand` / `brandShort` | Main CTA, active tab, selection |
| Accent | `colors.accent` | Links, focus rings, active icons |
| Secondary | `colors.secondary` | Warm highlight, eyebrow text |
| Text | `text` > `textSecondary` > `muted` > `textTertiary` | Hierarchy, strongest to weakest |
| On primary | `colors.onPrimary` | Text/icons on gradient or solid primary/danger |
| Border | `border`, `borderStrong`, `borderSubtle`, `hairline`, `divider` | Outlines, strong outlines, quiet card edges, dividers |
| Status | `success`, `warning`, `error`, `info`, `danger` (solid destructive button) | Status text/icons |
| Tinted fills | `<role>Soft` + `<role>Border` (primary, secondary, success, warning, error, info, neutral) | Badges, banners, icon wells, selected chips |
| Tiers | `platinum`, `gold`, `plus` | Tinder plan badges only |
| Brand | `colors.tinder` | Only where Tinder itself is represented |
| Overlays | `scrim`, `overlay` | Modal backdrops |

For translucency, use `alpha(theme.colors.X, 0.12)` instead of `rgba()` literals.

**Legacy color mapping** (for replacing raw literals):
- `#FFF`/`#FFFFFF` for text on dark surfaces → `text`; on gradients or solid buttons → `onPrimary`
- Cool purple surfaces (`#221E33`, `#26223B`, `#151322`, `#160B20`, `#170C16`, `#18101E`, `#26182C`) → `surface` / `elevated` / `elevatedHigh`
- Greens (`#00E676`, `#4ECCA3`, `#10B981`, `#16A34A`, `#48CB8D`, `#47D18C`, `#56CE90`, `#6ED2B1`) → `success`
- Pinks (`#FE3C72` when not the Tinder mark, `#EC4899`, `#FF4D6D`, `#E11D48`, `#FF6B8B`, `#FF6584`) → `primary` / `accent`
- Violets (`#C026D3`, `#A855F7`, `#9333EA`, `#8B5CF6`, `#7C3AED`, `#6366F1`, `#B388FF`, `#E040FB`) → `info`
- Ambers/oranges (`#F59E0B`, `#FFCB37`, `#FFB800`, `#FFD166`, `#EA580C`, `#FB923C`, `#FF8E53`) → `warning` (or `secondary` for warm decoration)
- Reds (`#EF4444`, `#DC2626`) → `danger` (solid button) / `error` (text)
- Grays (`#8E8E93`, `#9CA3AF`, `#64748B`, `#55526B`, `#716E89`) → `muted` / `textTertiary`; `#E0E0E6` → `textSecondary`
- Cyans (`#00E5FF`, `#00D0FF`, `#38BDF8`) → `platinum` for tiers, otherwise `info`

### Typography (`theme.type.*`: spread it, then set `color`)

| Variant | Size/line | Use |
|---|---|---|
| `largeTitle` | 34/41 Manrope 800 | Top-level screen hero |
| `display` | 30/38 Manrope 800 | Auth/onboarding hero |
| `title` | 24/32 Manrope 700 | Screen titles |
| `title2` | 20/27 Manrope 700 | Sheet/modal titles, prominent card titles |
| `section` | 18/26 Manrope 700 | Section and card titles |
| `headline` | 16/22 Inter 600 | Row titles, emphasized body |
| `body` / `bodyStrong` | 15/23, 15/22 | Paragraphs / list titles |
| `callout` | 14/20 | Secondary paragraphs, dialog messages |
| `label` | 14/20 Inter 600 | Form labels |
| `subhead` | 13/18 Inter 500 | Metadata, chip text |
| `caption` / `footnote` | 12 | Hints, timestamps, helper/error text |
| `overline` | 11/14 Inter 700, +1.1 tracking, uppercase | Eyebrows, section labels |
| `button` / `buttonSmall` | 15 / 13 Inter 600 | Buttons |
| `number` | 28/34 Inter 700 | Metrics (add `fontVariant: ['tabular-nums']`) |

Set text sizes through type tokens, not ad-hoc `fontSize`. Ten pixels is the absolute minimum, for tiny badges only.
Custom fonts need `fontWeight: 'normal'`, which the tokens already include. Do not add `fontWeight: '700'` on top of a font family.

### Spacing, radius, elevation
- Spacing (4-pt): `xxs 2, xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, section 32, hero 40`.
- Screen gutter: 20 (16 under 360px wide). Use `useResponsive().gutter`.
- Radius: `xs 6` tiny badges · `sm 10` small controls · `md 14` inputs/buttons (`input`, `button`) · `lg 18` nested cards · `card 20` cards · `xl 24` hero cards · `sheet 28` sheets/dialogs · `pill`.
- Shadows: `theme.shadows.sm | md | lg | glow`. On dark surfaces, prefer a border (`borderSubtle`/`hairline`) over heavy shadows.
- Touch targets are at least 44×44 (`layout.touchTarget`). Buttons are 52 tall (`sm` is 40). Inputs are 52 tall.

### Motion
- `MotionTouchable` (drop-in for TouchableOpacity): scale 0.97 on press, spring back, native driver, honors reduced motion.
- `FadeIn` (entrance, optional `delay` for stagger ≤ 60ms steps), `ContentTransition` (tab/step switch).
- Durations: `motion.fast 160`, `normal 240`, `slow 360`. Every `Animated` call uses `useNativeDriver: true` unless it animates layout or color.
- Respect reduced motion (`useMotionReduced()` from `components/common/Motion`).

## Primitives (`src/components/ui`)

`AppText`, `AppButton` (primary · secondary · outline · ghost · danger · dangerSoft; md/sm; loading, icon), `IconButton`, `IconWell`, `Card` (default · elevated · outline · tinted; `onPress`), `Badge` (tones incl. tiers), `Chip`, `ListRow`, `SectionHeader`, `ScreenHeader`, `Screen`, `BottomSheet`, `Skeleton`/`SkeletonRow` (shimmer sweep), `CountUp` (rolling numbers), `LiveDot` (pulsing live indicator), `Divider`, `FeedbackState` / `LoadingState` / `EmptyState` / `ErrorState`.

## Responsive rules
- Use flexbox, `minWidth: 0` on flexible text columns, and `numberOfLines` on single-line labels.
- Center content columns with `maxWidth: layout.readableMax` (600) or `formMax` (480).
- Avoid fixed widths wider than 280 unless they are capped by `maxWidth` or derived from `useWindowDimensions`.
- Test the mental model at 320, 375 and 430 widths. Rows of 3–4 tiles must wrap or shrink, never overflow.
- Wrap inputs in `KeyboardAvoidingView` (padding on iOS). Put `keyboardShouldPersistTaps="handled"` on scroll views that contain inputs.

## Accessibility
- Every touchable has `accessibilityRole` and a `accessibilityLabel` when its content is icon-only.
- Toggles and tabs expose `accessibilityState` (`selected`, `checked`, `disabled`, `busy`).
- Text keeps a contrast ratio of at least 4.5:1 (enforced for text tokens by `src/theme/__tests__/contrast.test.js`).
- Chrome text (tabs, badges, buttons) caps font scaling at `theme.fontScale.chrome`; body text at `fontScale.body`.

## Verification
```
node scripts/ui-check.js        # parse + undefined identifier + duplicate declaration check
npx jest --watchAll=false       # regression suites
npx expo export --platform all  # bundle check
```
