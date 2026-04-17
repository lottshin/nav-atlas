# Nav Atlas Brand Guide

Project scope: repository root

This is a lightweight brand guide for keeping the frontend, favicon system, and share surfaces visually consistent over time.

---

## 1. Brand essence

- **Positioning:** curated directory / knowledge tools / editorial navigation
- **Mood:** restrained, intelligent, paper-like, trustworthy
- **Core idea:** black-and-white editorial system with one controlled accent

### One-line summary

**Nav Atlas should feel like a black-and-white editorial directory with a single vermilion proof mark.**

---

## 2. Visual style

### Primary aesthetic

- Paper-white surfaces
- Deep ink-black structure
- Large editorial headlines
- Clean utility typography
- Quiet separators
- Minimal decorative geometry

The site should feel closer to:

- an editorial index
- a research desk
- a curated archive

It should feel less like:

- a glossy SaaS dashboard
- a consumer app
- a colorful AI startup landing page

### Texture and decoration

Allowed:

- faint lines
- subtle geometric traces
- sparse structural separators
- low-noise background decoration

Avoid:

- heavy gradients
- glassmorphism
- neon glow
- soft blob backgrounds
- loud multicolor accents

---

## 3. Color system

### Core colors

- **Paper:** `#ffffff`
- **Ink:** `#0d0d0d`
- **Muted text:** `#666666`
- **Soft line:** very light neutral separators, not medium-gray blocks

### Accent color

Use one restrained vermilion as the only meaningful accent:

- **Light theme accent:** `#96392d`
- **Dark theme accent:** `#d66d59`

### Accent usage rules

Use accent only for:

- featured emphasis
- editorial proof / confirmation marks
- one-point brand anchors in icons
- selective micro-highlights

Do **not** use accent for:

- large filled surfaces
- rainbow category coding
- repeated CTA saturation
- decorative color for its own sake

---

## 4. Typography

### Display / headline style

- Strong, oversized, compressed-feeling headlines
- Heavy weight is correct
- Tight tracking is acceptable for major headings
- Headlines should feel like mastheads, covers, or index labels

### Supporting typography

- Sans-serif for primary reading/UI content
- Mono only for utility/meta contexts

Good mono use:

- counts
- chips
- labels
- command hints
- metadata

Bad mono use:

- long body paragraphs
- decorative overuse
- making the UI feel like a terminal

### Hierarchy rule

- Hero / H1: loud and immediate
- Section title: clean and editorial
- Description: quieter and lighter
- Utility/meta: mono + muted

---

## 5. Composition rules

- Keep layouts **left-aligned, ordered, and calm**
- White space is part of the brand
- Cards should feel like **paper records**, not app widgets
- Strong content rhythm is preferred:
  1. title
  2. note
  3. meta
  4. structured content blocks

### UI behavior principle

When in doubt, simplify.

The brand gets stronger when surfaces are:

- flatter
- clearer
- quieter
- more index-like

---

## 6. Icon and favicon language

### Icon character

Icons should feel:

- geometric
- bold
- clear at small sizes
- editorial / index-like
- more like a mark than an illustration

Prefer:

- simple silhouettes
- restrained rounding
- strong contrast

Avoid:

- complex detail
- playful mascot energy
- consumer-app emoji style
- generic AI glyph clichés

### Favicon rules

Favicon must work at `16–32px`.

Use:

- circular or seal-like outer structure
- one central symbol
- minimal interior detail
- at most one accent element

Better metaphor:

- stamp
- filing mark
- confirmed note
- editorial seal

Avoid metaphor:

- fan / propeller
- startup starburst
- abstract tech spark
- full text glyphs

### Current favicon direction

- circular seal
- folded-corner document cue
- restrained vermilion proof mark

Primary asset files:

- `app/icon.svg`
- `app/favicon.ico`
- `app/apple-icon.png`

---

## 7. Share-image language

Default share surfaces should feel like an editorial cover, not a product card.

### Approved OG/Twitter composition

- Left content column
- Large black headline
- Subheading / supporting copy
- Mono-style utility strapline
- Right-side low-opacity brand watermark
- One vermilion brand accent

### Share-image concept

**Black-and-white editorial cover + vermilion proof mark**

Primary share image files:

- `app/opengraph-image.png`
- `app/twitter-image.png`

---

## 8. Metadata and platform assets

### Current brand/metadata files

- Root metadata:
  - `app/layout.tsx`
- Manifest:
  - `app/manifest.ts`
- Favicon:
  - `app/icon.svg`
- ICO compatibility icon:
  - `app/favicon.ico`
- Apple touch icon:
  - `app/apple-icon.png`
- Open Graph default image:
  - `app/opengraph-image.png`
- Twitter default image:
  - `app/twitter-image.png`

### What each controls

- `app/layout.tsx`
  - site title / description
  - explicit icon references
  - manifest reference
  - Open Graph and Twitter metadata
  - `metadataBase`

- `app/manifest.ts`
  - install-surface metadata
  - app name / display mode / scope / theme colors
  - icon list for install contexts

- `app/icon.svg`
  - primary modern favicon source

- `app/favicon.ico`
  - broad browser compatibility

- `app/apple-icon.png`
  - iOS / Apple touch icon

- `app/opengraph-image.png`
  - default link preview image

- `app/twitter-image.png`
  - default Twitter/X preview image

---

## 9. Maintenance rules

When the brand mark changes, update these **together**:

1. `app/icon.svg`
2. `app/favicon.ico`
3. `app/apple-icon.png`
4. `app/opengraph-image.png`
5. `app/twitter-image.png`
6. `app/layout.tsx`
7. `app/manifest.ts`

Do not update only one icon surface unless intentionally testing.

### Safe rule

If the favicon changes:

- regenerate `favicon.ico`
- regenerate `apple-icon.png`
- check the share-image watermark/mark still matches

---

## 10. Deployment note

`metadataBase` currently resolves from `NEXTAUTH_URL` when that value is present and valid.

For production, make sure:

- `NEXTAUTH_URL` is set to the real site origin

If `NEXTAUTH_URL` is missing or invalid, the app will omit `metadataBase` instead of forcing a localhost fallback.

---

## 11. Do / Don’t

### Do

- use black, white, muted gray, and one restrained accent
- keep surfaces quiet
- keep typography editorial
- make icons simple and decisive
- design like a curated knowledge object

### Don’t

- don’t drift into glossy SaaS/dashboard language
- don’t overuse gradients, blur, or glow
- don’t introduce multiple unrelated brand colors
- don’t over-detail tiny icons
- don’t let share surfaces feel like generic AI marketing art

---

## 12. Quick review checklist

Before shipping a new visual asset, ask:

1. Does this still feel editorial, not dashboard-like?
2. Is black/white still dominant?
3. Is the accent being used as punctuation, not wallpaper?
4. Does the icon still read clearly at favicon size?
5. Would the share image look intentional if someone pasted the site into chat?
6. Do favicon, Apple icon, and share images still look like the same brand?
