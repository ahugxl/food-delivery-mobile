/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#17241B',
    tint: '#E45B3F',

    // Core surfaces
    background: '#FFFBF5',
    foreground: '#17241B',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#17241B',

    // Primary action color (buttons, links, active states)
    primary: '#E45B3F',
    primaryForeground: '#FFF9F2',
    tabActive: '#159E98',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#F3E7DC',
    secondaryForeground: '#352820',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#F1EBE3',
    mutedForeground: '#827A71',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#E5F0E5',
    accentForeground: '#21422B',

    // Destructive actions (delete, error states)
    destructive: '#B93D2D',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#EFE5DA',
    input: '#EFE5DA',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 20,
};

export default colors;
