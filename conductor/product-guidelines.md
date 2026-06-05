# Golive Brand Guidelines Integration

This document defines the product design and communication guidelines for the GoSkills platform, aligning with the **Golive Brand Guidelines (V1.2025)**.

---

## 1. Persona & Tone of Voice
- **Tone**: Professional & Direct. Content and UI copy must be clear, concise, and focused on quick reading to facilitate learning ("making life easier").
- **Voice**: We write using first-person plural ("Somos Golive" / "We at Golive") to maintain closeness and empathy. Avoid unnecessary jargon; write clearly and accessibly.

## 2. Visual Identity & Color Palette
The platform uses the official Golive color scheme to create a cohesive internal experience.

### Primary Colors
- **Rojo Golive** (`#E40032`): Used strictly for the brand symbol/accent highlights, representing dinamismo and action.
- **Negro** (`#000000` / RGB `33, 33, 33`): Used for backgrounds, text, and primary dark panels.
- **Gris** (`#9FABB8`): Used for secondary text, disabled states, and borders.
- **Blanco** (`#FFFFFF`): Used for clean contrast, cards, and highlighted text.

### Secondary Colors
- **Azul Claro** (`#009DEA`): Accent highlights, secondary actions, and informational states.
- **Azul Oscuro** (`#0E358F`): Primary action buttons and state-active indicators.
- **Gris Oscuro** (`#313C4F`): Card backgrounds, navigation panels, and container borders.
- **Granate** (`#9A1212`): Failure alerts and destructive actions.

## 3. Typography
- **Headings & Logo**: Clean sans-serif (such as *Founders Grotesk* or *Montserrat*).
- **Body & Copy**: *Montserrat* (Google Font fallback: `Montserrat, sans-serif`) with regular weights for readability.

## 4. UX & Interaction Principles
- **Minimalist Focus**: Simple, distraction-free layout. Keep the video playback and chapter description central, hiding secondary navigation or settings until requested.
- **Micro-interactions**: Subtle hover states, smooth transitions, and loading shimmers to elevate the experience.
- **Content Hierarchy**: Strong visual separation between course information, chapters, and playback controls.

## 5. Technical Validations & Error States
- **Detailed Troubleshooting Overlays**: In the event of system failures (e.g., Firebase offline, AWS authentication issues), present a concise top-level message to the user with an expandable detail panel containing the exact diagnostic error codes (referencing `docs/diagnostics.md`) for quick troubleshooting.
