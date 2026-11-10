# Design System Inspired by Botchain (working title, from a Flooz-style dark landing reference)

> Source: one landing-page screenshot. Near-black canvas, quiet pill nav, centred headline, and glossy rounded-square app icons orbiting the headline with motion-blur comet trails in each icon's own colour.
> Product requirement: every selected Botchain product logo is shown in the hero as one of those orbiting icons, with the same trail effect.
>
> **Font lock:** Georama + Satoshi only. The reference text is Inter-style; every instance of it becomes Satoshi (UI/body) or Georama (headline). Inter is never used, not even as a fallback.

---

## 1. Visual Theme & Atmosphere

A quiet, dark stage where the only light comes from the products themselves. The page is almost empty: a centred headline, one line of muted copy and one white button. Glossy app icons swing around that text on an invisible orbit, each dragging a long soft comet trail of its own colour that fades into the black. The UI chrome is deliberately small and grey so the icons are the colour. The feeling is calm, premium and slightly mysterious, with a playful flourish in the motion.

**Key Characteristics**
- Near-black canvas (`#0A0A0A`) with a very soft vignette and no visible borders or grid lines.
- Colour comes only from logos. Everything else is white, grey or black.
- Logos are rendered as glossy rounded-square app icons (squircle, about 22% corner radius) with a faint top highlight.
- Each icon trails a tapered, blurred streak in its dominant colour, pointing back along its path and fading to transparent.
- Icons sit at three depths: sharp foreground, softly blurred mid layer, dim far layer. This is what makes the orbit feel 3D.
- Pill shapes for all controls: tabs, search, buttons.
- Headline is medium weight, white, centred, with muted grey supporting copy underneath.
- One white pill CTA is the brightest object on the page, so it always wins attention.
- Text is small and restrained. Large empty areas are intentional.

---

## 2. Color Palette & Roles

### Primary
| Name | Hex | Usage |
|---|---|---|
| Void Black | `#0A0A0A` | Page background. |
| Pure White | `#FFFFFF` | Headline, primary CTA fill, active tab text. |
| Ink Black | `#0A0A0A` | Text on white buttons. |

### Accent Colors
Accents are not brand colours; they are taken from each product logo and drive that icon's trail and glow.

| Name | Hex | Usage |
|---|---|---|
| Trail Red | `#E5383B` | Example trail for a red logo (reference: lucky-cat icon). |
| Trail Blue | `#2E6CF6` | Example trail for a blue logo (reference: fox icon). |
| Trail Green | `#45C35A` | Example trail for a green logo (reference: frog icons). |
| Trail Warm Tan | `#B58A63` | Example trail for a neutral/brown logo. |
| Trail Rule | Auto | Sample each logo's dominant saturated colour and use it for trail and glow. Neutral or white logos fall back to `#B8B8B8`. |

### Interactive
| Name | Hex | Usage |
|---|---|---|
| Action White | `#FFFFFF` | Primary CTA. |
| Action White Hover | `#E9E9E9` | Hover on the CTA. |
| Action White Active | `#D6D6D6` | Pressed. |
| Focus Ring | `rgba(255,255,255,0.55)` | 2px outer ring on every focusable element. |
| Link Muted | `#6B6B6B` | "Browse without connecting" style links; hover to `#FFFFFF`. |
| Error | `#FF6B6B` | Input errors. |
| Success | `#45C35A` | Confirmations. |

### Neutral Scale
| Step | Hex | Usage |
|---|---|---|
| N-950 | `#0A0A0A` | Page. |
| N-900 | `#111111` | Footer, deepest panels. |
| N-850 | `#161616` | Search pill fill, hover surface. |
| N-800 | `#1C1C1C` | Active nav tab fill, secondary button fill. |
| N-700 | `#262626` | Borders, dividers. |
| N-600 | `#3A3A3A` | Disabled fills. |
| N-500 | `#6B6B6B` | Tertiary text, small links. |
| N-400 | `#8A8A8A` | Supporting copy, inactive tabs, placeholders. |
| N-200 | `#CFCFCF` | Secondary text on dark. |
| N-0 | `#FFFFFF` | White. |

### Surface & Borders
| Name | Value | Usage |
|---|---|---|
| Stage Vignette | `radial-gradient(ellipse at 50% 45%, #121212 0%, #0A0A0A 55%, #050505 100%)` | Hero background. |
| Card Surface | `#111111` | Product cards below the hero. |
| Hairline | `rgba(255,255,255,0.08)` | Borders on dark. |
| Icon Rim | `inset 0 0 0 1px rgba(255,255,255,0.18)` | Edge on each logo tile. |
| Icon Gloss | `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%)` | Top highlight on each logo tile. |

---

## 3. Typography Rules

### Font Family
**Locked pair. No third font. No Inter.**

- **Primary (display and headings): Georama.** Geometric and friendly, close to the clean round headline in the reference. Weights 400, 500, 600, 700. Google Fonts.
  `font-family: 'Georama', system-ui, -apple-system, 'Segoe UI', sans-serif;`
- **Secondary (UI and body): Satoshi.** Replaces the Inter-style UI text. Weights 400, 500, 700 only. Fontshare.
  `font-family: 'Satoshi', system-ui, -apple-system, 'Segoe UI', sans-serif;`

```css
@import url('https://fonts.googleapis.com/css2?family=Georama:wght@400;500;600;700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap');
:root {
  --font-display: 'Georama', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-ui:      'Satoshi', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
```

### Hierarchy
| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display 1 | Georama | 48px (mobile 32px) | 500 | 1.1 (52px) | -0.025em | Hero headline, white, centred. |
| Display 2 | Georama | 36px (mobile 28px) | 500 | 1.15 (42px) | -0.02em | Section headings. |
| Heading 3 | Georama | 22px | 600 | 1.25 (28px) | -0.01em | Product card titles. |
| Body Large | Satoshi | 17px | 400 | 1.55 (26px) | 0 | Hero supporting copy, `#8A8A8A`, max 440px, centred. |
| Body Regular | Satoshi | 15px | 400 | 1.6 (24px) | 0 | Paragraphs. |
| Link / Nav | Satoshi | 14px | 500 | 1.4 (20px) | 0 | Nav tabs, text links. |
| Button | Satoshi | 14px | 700 | 1 (20px) | 0 | All buttons. |
| Input | Satoshi | 16px | 400 | 1.4 (22px) | 0 | Search and form fields (16px to avoid iOS zoom). |
| Caption | Satoshi | 12px | 500 | 1.4 (16px) | 0.01em | The "browse without connecting" line, labels. |

### Principles
- Georama is only for the headline and titles. Satoshi handles everything else.
- Headline is weight 500, never bold. The restraint is part of the premium feel.
- Supporting copy is always muted (`#8A8A8A`), never white, so the headline leads.
- Buttons are Satoshi 700. Nav tabs are Satoshi 500.
- Tight negative tracking only on large Georama. Everything else is neutral.
- Centre-align hero text. Left-align anything below the hero.
- Keep text short. Headline up to 5 words, support copy up to 2 lines.

---

## 4. Component Stylings

### Buttons

**Primary Button (white pill, "Connect" CTA)**
- Background: `#FFFFFF`
- Text Color: `#0A0A0A`
- Padding: 0 28px
- Border Radius: 999px
- Border: none
- Font: Satoshi 700, 14px, line height 20px
- Height: 44px (nav version 36px, padding 0 18px)
- Hover State: background `#E9E9E9`, `translateY(-1px)`
- Active State: background `#D6D6D6`, `scale(0.97)`

**Secondary / Ghost Button (dark pill, nav "Connect")**
- Background: `#1C1C1C`
- Text Color: `#FFFFFF`
- Padding: 0 18px
- Border Radius: 999px
- Border: `1px solid rgba(255,255,255,0.08)`
- Font: Satoshi 700, 14px
- Height: 36px
- Hover State: background `#262626`
- Active State: `scale(0.97)`

**Tertiary Button (text link)**
- Background: none
- Text Color: `#6B6B6B`
- Padding: 4px 8px
- Border Radius: 8px
- Border: none
- Font: Satoshi 500, 12px
- Height: auto (touch area 44px)
- Hover State: text `#FFFFFF`, underline 1px
- Active State: text `#CFCFCF`

### Cards & Containers

**Standard Card (product card below the hero)**
- Background: `#111111`
- Text Color: `#FFFFFF`, body `#8A8A8A`
- Padding: 24px
- Border Radius: 24px
- Border: `1px solid rgba(255,255,255,0.08)`
- Box Shadow: none
- Contents: the product's logo tile (56px) at top-left, title in Georama 600 22px, one line of Satoshi 15px description, ghost pill link.
- Hover State: border `rgba(255,255,255,0.18)`; logo tile gets a trail pulse (see Logo Tile).
- Active State: `scale(0.99)`

**Feature Card (Wide)**
- Background: `#111111`
- Text Color: `#FFFFFF`
- Padding: 40px
- Border Radius: 32px
- Border: `1px solid rgba(255,255,255,0.08)`
- Width: full container, two-column layout (text left, logos or visual right).
- Box Shadow: none
- Hover State: none
- Active State: none

**Highlighted Container: Orbiting Logo Tile (the hero effect)**
- Tile: 80px square at desktop (64px tablet, 52px mobile), corner radius 22% (about 18px at 80px), logo artwork fills the tile edge to edge. Overlays: Icon Gloss gradient and Icon Rim.
- Tile tilt: each tile rotates ±12–18° in the direction of travel and stays tilted while orbiting.
- **Trail:** a tapered streak behind the tile, along the tangent of the orbit and pointing back along the path.
  - Length 140–180px, height about 40% of tile height at the head tapering to 0 at the tail.
  - Fill `linear-gradient(to left, <logo colour> 0%, transparent 100%)`, opacity 0.7 at head to 0 at tail, plus `filter: blur(10px)`.
  - Rotated to the tangent, origin at the tile centre, positioned behind the tile (z-index below it).
  - Colour comes from the Trail Rule in section 2.
- **Orbit:** an ellipse centred on the headline, about 460px wide and 340px tall at 1440px. Icons travel clockwise. Period 48s, linear. Each icon has a different starting angle (evenly spread, jittered ±15°) so they never align.
- **Depth layers** (assign by product priority):
  | Layer | Blur | Opacity | Scale | Trail | Use |
  |---|---|---|---|---|---|
  | Foreground | 0 | 100% | 1.0 | Full | Up to 4–5 hero products. |
  | Mid | 2–3px | 70% | 0.85 | Shorter, more blurred | Remaining products. |
  | Far | 6–8px | 35% | 0.7 | Barely visible | Extra products, lower area of the hero. |
- **Count and selection:** show every selected Botchain product logo. Up to 5 sit in the foreground, the rest go to mid and far layers. If there are fewer than 5 products, space them evenly and leave a gap on the headline's line of sight.
- **Hover:** hovering a tile slows the whole orbit to 20% speed over 400ms, the hovered tile scales 1.12 and its trail brightens to 100%; a tooltip pill (product name, Satoshi 500 12px, `#1C1C1C`) appears below it. Click opens the product.
- **Clearance:** tiles never cross the headline's bounding box; the orbit ellipse is set larger than the text block plus 40px.
- **Reduced motion:** stop the orbit, place tiles at their start angles, keep static trails at 50% opacity.
- **Logo prep:** each logo needs a square master (at least 256px) with its own background colour. Logos with transparent backgrounds get a `#161616` tile fill.

### Inputs & Forms

**Text Input (search pill, nav)**
- Background: `#161616`
- Text Color: `#FFFFFF`
- Padding: 0 16px 0 40px (search icon 16px at left, `#CFCFCF`)
- Border Radius: 999px
- Border: `1px solid rgba(255,255,255,0.06)`
- Font: Satoshi 400, 16px (14px in the nav)
- Height: 36px nav, 48px standalone
- Placeholder Color: `#8A8A8A`
- Focus State: border `rgba(255,255,255,0.4)`, ring `0 0 0 3px rgba(255,255,255,0.12)`
- Disabled State: opacity 0.4

**Input Label**
- Satoshi 500, 13px, `#CFCFCF`, 8px above the input.

**Input Helper Text**
- Satoshi 400, 12px, `#8A8A8A`, 8px below the input. Error `#FF6B6B`. Success `#45C35A`.

### Navigation

**Primary Navigation**
- Background: transparent (becomes `rgba(10,10,10,0.7)` with `backdrop-filter: blur(16px)` on scroll)
- Text Color: `#8A8A8A` inactive, `#FFFFFF` active
- Height: 64px, padding 0 20px
- Layout: logo mark left, pill tabs next to it, search pill centred, "···" icon button and dark "Connect" pill on the right.
- Mobile: tabs and search collapse behind a menu button; the Connect pill stays.

**Navigation Link (pill tab)**
- Satoshi 500, 14px. Padding 8px 16px, radius 999px. Active: background `#1C1C1C`, text `#FFFFFF`. Inactive: transparent, `#8A8A8A`; hover text `#FFFFFF`.

---

## 5. Layout Principles

### Spacing System
**Base unit:** 4px.

| Token | Value | Use |
|---|---|---|
| space-1 | 4px | Icon gaps |
| space-2 | 8px | Tab gaps, label to input |
| space-3 | 12px | Headline to support copy |
| space-4 | 16px | Nav padding, button padding |
| space-5 | 24px | Card padding, support copy to CTA |
| space-6 | 32px | Card gaps |
| space-7 | 48px | Block gaps |
| space-8 | 64px | Section inner padding |
| space-9 | 96px | Section gaps |
| space-10 | 128px | Hero padding |

### Grid & Container
- Max width 1200px, side padding 24px (mobile 16px).
- **Hero:** full viewport height minus nav. A centred text stack (Display 1 → Body Large → white CTA → muted link, gaps 12 / 24 / 16px) sits at the optical centre, slightly above the middle (45%). The orbit ellipse is centred on this stack. Icons fill the space around it, with a few far-layer icons low and out of focus.
- **Product grid (below hero):** 3 columns of Standard Cards with 24px gaps, then a Feature Card.
- **Content blocks:** centred, max 640px text width.

### Whitespace Philosophy
Large and quiet. The hero holds about five visible elements in a full screen, and the emptiness gives the orbiting icons room to move and trail. Everything is spaced to the centre. Nothing competes with the logos.

### Border Radius Scale
| Step | Value | Use |
|---|---|---|
| Sharp | 0px | Not used. |
| xs | 8px | Tooltips, small chips. |
| sm | 12px | Small inner panels. |
| md | 18px | Logo tiles (80px). Scale at 22% of tile size. |
| lg | 24px | Product cards. |
| xl | 32px | Feature cards, modals. |
| Pill | 999px | Buttons, tabs, search, tooltips. |

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow | Page, nav, text. |
| Subtle | `1px solid rgba(255,255,255,0.08)` | Cards, pills. |
| Base | Subtle + Icon Gloss + Icon Rim | Logo tiles. |
| Glow | `0 0 40px -8px <logo colour at 45%>` | Foreground logo tiles; the trail is the main depth cue. |
| Depth Blur | `filter: blur()` and opacity by layer | Mid and far logo layers. |

No drop shadows on dark. Depth comes from blur, opacity and coloured glow.

---

## 7. Do's and Don'ts

### Do
- Use Georama for the headline and titles, Satoshi for everything else.
- Show every selected Botchain product logo in the hero as an orbiting tile with its own coloured trail.
- Pull each trail colour from its logo's dominant saturated colour.
- Keep the page background `#0A0A0A` and let logos be the only colour.
- Spread tiles at different angles and depth layers so they never line up.
- Keep exactly one white pill CTA in the hero.
- Slow the orbit on hover and show the product name.
- Honour `prefers-reduced-motion`.

### Don't
- Don't use Inter or any third font, including in fallbacks.
- Don't put icons over the headline or CTA.
- Don't add colour to the UI chrome (tabs, search, borders stay grey).
- Don't use sharp-corner logo tiles or flat logos with no gloss and rim.
- Don't draw trails as hard-edged shapes. They must be blurred and fade to fully transparent.
- Don't run the orbit faster than one revolution per 40 seconds. It should feel drifting, not spinning.
- Don't use drop shadows or heavy borders on dark.
- Don't make the headline bold or all caps.

---

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 640px | Display 1 at 32px. Orbit ellipse shrinks to about 300 × 240px, tiles 52px, trails 80px. Foreground limited to 3 icons, others far layer. Search moves behind the menu. |
| Tablet | 640–1023px | Display 1 at 40px. Tiles 64px, trails 120px. Search pill narrows to 160px. |
| Desktop | 1024–1439px | Full hero, tiles 80px. |
| Wide | ≥ 1440px | Container capped at 1200px, orbit ellipse stays 460 × 340px; extra width stays black. |

### Touch Targets
- Minimum 44 × 44px, recommended 48px. Orbiting tiles are tap targets, and a tap pauses the orbit and shows the name pill. 8px minimum gap between controls.

### Collapsing Strategy
- **Hero:** text stack stays centred and the orbit scales with the viewport width. Below 640px, reduce visible tiles to keep clearance around the text, moving the rest to the far layer at 25% opacity.
- **Nav:** tabs and search collapse into a menu; the dark Connect pill remains.
- **Cards:** 3 → 2 → 1 column.
- **Buttons:** the hero CTA is full-width up to 320px on mobile.
- **Spacing:** space-9 and space-10 shrink to 64px and 80px.

---

## 9. Agent Prompt Guide

### Quick Color Reference
- Background: `#0A0A0A`, vignette `#121212` → `#050505`
- Primary CTA: `#FFFFFF` with `#0A0A0A` text
- Nav pill active: `#1C1C1C`, inactive text `#8A8A8A`
- Search pill: `#161616`
- Supporting copy: `#8A8A8A`, small links `#6B6B6B`
- Hairline: `rgba(255,255,255,0.08)`
- Trail colour: dominant colour of each Botchain logo
- Fonts: Georama (display) + Satoshi (UI). Nothing else.

### Iteration Guide
1. Load only Georama (400/500/600/700) and Satoshi (400/500/700). Never reference Inter.
2. Page background is `#0A0A0A` with the Stage Vignette in the hero.
3. Hero text stack: Georama 500 48px headline, Satoshi 17px `#8A8A8A` copy, white pill CTA (44px), 12px muted link, all centred.
4. Render every selected Botchain logo as an 80px squircle tile with 22% radius, Icon Gloss and Icon Rim.
5. Give each tile a trail: 140–180px tapered gradient in the logo's dominant colour, `blur(10px)`, opacity 0.7 to 0, rotated along the orbit tangent and placed behind the tile.
6. Orbit tiles clockwise on a 460 × 340px ellipse centred on the headline with a 48s period, with distinct start angles.
7. Split tiles across foreground (sharp), mid (2–3px blur, 70%) and far (6–8px blur, 35%) layers; no more than 5 in the foreground.
8. Keep tiles clear of the headline box (plus 40px margin).
9. On hover, slow the orbit to 20%, scale the tile to 1.12, brighten the trail and show a name pill. Click opens the product.
10. All controls are pills: tabs, search and buttons use `border-radius: 999px`. Cards use 24px.
11. No colour in the UI chrome and no drop shadows. Depth comes from blur, opacity and coloured glow.
12. With `prefers-reduced-motion`, freeze the orbit and show static trails at 50% opacity.
