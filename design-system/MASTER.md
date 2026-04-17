# Nav Website Design System

## Product Shape
- Product type: standard website directory for AI, design, video, dev, and productivity links
- Primary behavior: category-first browsing with fast search and command palette shortcuts
- Content density: medium on public pages, higher in admin

## UI/UX Pro Max Inputs Used
- Pattern: Marketplace / Directory
- Style mix: Swiss Modernism 2.0 + Exaggerated Minimalism + E-Ink / Paper
- Accessibility bias: high contrast, keyboard-first, reduced-motion support, visible focus states

## Visual Direction
- Keep the reference homepage's black-and-white confidence, mono accents, sketch illustration, particle field, and glass command palette
- Remove personal-homepage storytelling; replace it with directory IA, category chips, featured picks, and grouped cards
- Use a paper background in light mode and a graphite background in dark mode
- Use a single accent color only for focus, featured markers, and active states

## Typography
- Headings: Inter with heavy weights and tight tracking
- Utility text and shortcuts: JetBrains Mono
- Body copy: Inter with generous line height

## Layout Rules
- Public pages use a 12-column Swiss-style grid with deliberate asymmetry
- Home page order: utility header, hero, category index, featured links, grouped category sections
- Category page order: breadcrumb/back affordance, title, summary, filtered card grid
- Admin pages reuse the same palette but compress spacing and increase information density

## Components
- Header with logo, search input, command trigger, theme toggle, and admin entry
- Sketch emblem instead of avatar, tied to the directory concept
- Link card with linear icon, domain, concise description, hover lift, and featured rail
- Glass command palette modal with grouped results and keyboard navigation
- Admin forms with strong labels, visible focus rings, and inline save/delete actions

## Motion
- Keep animation transform/opacity based
- Respect `prefers-reduced-motion`
- Particle field, sketch stroke draw, and subtle hover motion are allowed
- Avoid heavy parallax and non-essential scroll tricks

## Accessibility
- Minimum 16px body text on mobile
- 44x44 minimum touch targets
- Skip link present
- All icon-only buttons require aria labels
- Keyboard shortcuts: `/` focus search, `Cmd/Ctrl + K` open palette, `Escape` close overlays
