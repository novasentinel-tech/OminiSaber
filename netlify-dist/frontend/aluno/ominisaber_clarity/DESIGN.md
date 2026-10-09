---
name: OminiSaber Clarity
colors:
  surface: "#f9f9ff"
  surface-dim: "#cfdaf2"
  surface-bright: "#f9f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f0f3ff"
  surface-container: "#e7eeff"
  surface-container-high: "#dee8ff"
  surface-container-highest: "#d8e3fb"
  on-surface: "#111c2d"
  on-surface-variant: "#464555"
  inverse-surface: "#263143"
  inverse-on-surface: "#ecf1ff"
  outline: "#777587"
  outline-variant: "#c7c4d8"
  surface-tint: "#4d44e3"
  primary: "#3525cd"
  on-primary: "#ffffff"
  primary-container: "#4f46e5"
  on-primary-container: "#dad7ff"
  inverse-primary: "#c3c0ff"
  secondary: "#006c49"
  on-secondary: "#ffffff"
  secondary-container: "#6cf8bb"
  on-secondary-container: "#00714d"
  tertiary: "#3a2cc1"
  on-tertiary: "#ffffff"
  tertiary-container: "#534ada"
  on-tertiary-container: "#dbd8ff"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#e2dfff"
  primary-fixed-dim: "#c3c0ff"
  on-primary-fixed: "#0f0069"
  on-primary-fixed-variant: "#3323cc"
  secondary-fixed: "#6ffbbe"
  secondary-fixed-dim: "#4edea3"
  on-secondary-fixed: "#002113"
  on-secondary-fixed-variant: "#005236"
  tertiary-fixed: "#e3dfff"
  tertiary-fixed-dim: "#c3c0ff"
  on-tertiary-fixed: "#100069"
  on-tertiary-fixed-variant: "#372abf"
  background: "#f9f9ff"
  on-background: "#111c2d"
  surface-variant: "#d8e3fb"
  slate-50: "#F8FAFC"
  slate-100: "#F1F5F9"
  slate-500: "#64748B"
  indigo-50: "#EEF2FF"
  error-red: "#EF4444"
typography:
  headline-lg:
    fontFamily: Poppins
    fontSize: 32px
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Poppins
    fontSize: 24px
    fontWeight: "600"
    lineHeight: "1.3"
  headline-sm:
    fontFamily: Poppins
    fontSize: 18px
    fontWeight: "600"
    lineHeight: "1.4"
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: "1.6"
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: "1.5"
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "700"
    lineHeight: "1"
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Poppins
    fontSize: 26px
    fontWeight: "700"
    lineHeight: "1.2"
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gap-xs: 0.5rem
  gap-md: 1rem
  gap-lg: 1.5rem
  margin-page: 2rem
  padding-card: 1.5rem
---

## Brand & Style

The brand personality is **professional, encouraging, and focused**. It is designed to foster a sense of "Calm Achievement," reducing the cognitive load for students while maintaining a high level of clarity for educators.

The design style is a **Modern Minimalist** approach with **Soft UI** influences. It prioritizes heavy whitespace, high-quality geometric typography, and subtle depth to create a welcoming digital environment. The aesthetic avoids "aggressive" elements, opting for soft corners and a cool-toned neutral palette to ensure the user remains focused on the learning content rather than the interface itself.

## Colors

The color strategy employs a "Slate" foundation to create a sophisticated, low-strain background.

- **Primary (Indigo):** Used for core actions, focus states, and primary navigation. It represents trust and concentration.
- **Secondary (Emerald):** Reserved for gamification, success states, and progress completion. It provides positive reinforcement.
- **Neutral (Slate):** The text hierarchy is built on slates rather than pure blacks to prevent eye fatigue. `slate-800` serves as the primary ink, while `slate-500` handles secondary metadata.
- **Backgrounds:** Use `slate-50` for the main application canvas and pure `#FFFFFF` for interactive surfaces (cards, modals) to create a clean, layered distinction.

## Typography

The system uses a dual-font strategy to balance character with functionality.

- **Headlines (Poppins):** Geometric and friendly. Use `SemiBold` for section headers and `Bold` for page titles.
- **Body (Inter):** A highly legible sans-serif designed for UI. It ensures that long-form educational content and reading assignments are accessible and clear.
- **Visual Hierarchy:** Distinguish information through color shifts (Primary vs. Secondary Slates) as much as size. Labels should use uppercase and increased letter-spacing for categorization.

## Layout & Spacing

The layout follows a **Fluid Grid** system with a 12-column structure for desktop and a single-column stack for mobile.

- **Rhythm:** A 4px base unit drives all spacing. Standard component gaps are set to 16px (`gap-md`), while page-level sections utilize 24px (`gap-lg`) to ensure "breathing room."
- **White Space:** Prioritize generous margins around content blocks to prevent the UI from feeling "crowded," which is essential for student focus.
- **Breakpoints:**
  - **Mobile (<640px):** Single column, 16px page margins.
  - **Tablet (640px - 1024px):** 2-column card grids, 24px margins.
  - **Desktop (>1024px):** 12-column grid, max-width 1280px, 32px margins.

## Elevation & Depth

This design system uses **Tonal Layering** combined with **Ambient Shadows**.

- **Surface Tiers:** The background is `slate-50`. Interactive surfaces like cards sit on the "Base Layer" using white (`#FFFFFF`) with a `slate-100` 1px border.
- **Shadow Profile:** Shadows are diffused and low-opacity.
  - **Default Card:** 0px 4px 6px -1px rgba(0, 0, 0, 0.05).
  - **Hover State:** 0px 10px 15px -3px rgba(0, 0, 0, 0.1).
- **Transitions:** All elevation changes (shadow increases) must use a 300ms ease-in-out transition to provide a tactile, responsive feel.

## Shapes

The shape language is highly rounded to evoke a modern and approachable feel.

- **Cards & Modals:** Use `rounded-xl` (12px) to define the primary containers.
- **Buttons & Inputs:** Use `rounded-lg` (8px) for a slightly more precise but still friendly appearance.
- **Status Elements:** Progress bars and Badges/Chips must use `rounded-full` (pill-shaped) to distinguish them from structural layout elements.

## Components

### Buttons

- **Primary:** Solid `indigo-600` background, white text, 8px radius.
- **Secondary:** `indigo-50` background with `indigo-700` text.
- **Interaction:** On hover, darken the background by 10%. Use 200ms transitions.

### Trilha Cards (Learning Paths)

- **Container:** White background, 12px radius, 1px `slate-100` border, `shadow-sm`.
- **Content:** Title in `headline-sm` (Poppins), description in `body-md` (Inter).
- **Progress Bar:** Track in `slate-100`, fill in `emerald-500`. 10px height, fully rounded. Use `transition-all duration-500` for the width fill.
- **Hover:** Elevate to `shadow-md` and apply a slight Y-axis lift (-2px).

### Input Fields

- **Default:** `slate-100` background, no border.
- **Focus:** `ring-2 ring-indigo-500` with white background.
- **Style:** 8px radius, generous internal padding (12px 16px).

### Badges/Chips

- **Status:** Use the `indigo-50` background with `indigo-700` text for category descriptors.
- **Sizing:** `text-xs` bold uppercase, 4px vertical / 8px horizontal padding.

### Lists

- Clean vertical stacks with 1px `slate-100` dividers. Use `hover:bg-slate-50` for interactive list items.
