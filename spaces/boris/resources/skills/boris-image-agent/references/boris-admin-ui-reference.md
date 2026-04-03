# Bóris Admin UI Reference

Use this file when the request involves dashboards, admin panels, analytics screens, control-center views, or mockups for the Boris ecosystem.

## Source
- Derived from user-provided screenshots of the "Central de Comando" / Boris admin.
- Treat this as the current UI reference until the user provides newer screenshots.

## Product Feel
- Quiet, premium, operational SaaS interface.
- Warm neutral base instead of stark white.
- Orange is the main accent, used with restraint for highlights, active states, badges, and emphasis.
- Data-dense but calm: large breathing room, low visual noise, clear hierarchy.

## Layout System
- Fixed left sidebar with section headers in uppercase and simple line icons.
- Top bar with page title, subtitle/description, breadcrumbs when needed, and user profile at top-right.
- Main canvas built from large rounded cards with subtle borders.
- Content usually sits in one of these patterns:
  - KPI summary row with 3-4 cards.
  - Filter bar above the primary list or chart.
  - Two-column analytical section.
  - Timeline or list rail on the left with detail panel on the right.

## Visual Tokens
- Background: light warm gray / off-white.
- Primary accent: orange.
- Secondary states: green for positive signals, soft red for negative attention, beige/sand for neutral warnings.
- Borders: very light, thin, rounded.
- Radius: medium to large on cards, inputs, and chips.
- Shadows: minimal or absent; separation comes mostly from borders and background contrast.

## Typography
- Clean sans-serif.
- Strong page titles with medium-to-bold weight.
- Supporting copy is muted gray and compact.
- Labels often appear uppercase with generous letter spacing for section headers and metric labels.

## Components Seen In Reference Screens
- Sidebar navigation with active row highlight and orange icon/accent.
- Breadcrumbs above page content.
- Rounded filter inputs and dropdowns.
- Action buttons with outline style and subtle icon usage.
- Status chips for states like unread, active, top result, or category.
- KPI cards with very large numbers and small trend pills.
- Table/list rows inside soft bordered containers.
- Donut chart blocks, metric legends, and explanatory footnotes.
- Topic/insight cards with semantic background tint.

## Screen Patterns From The Uploaded Prints
- Alerts page:
  - Filter panel at top.
  - Summary block with result count and chips.
  - List/table of alerts with status, message preview, timestamp, and occurrences.
- Group dashboard:
  - Hero summary with member count, last activity, and 24h messages.
  - Period selector above KPI cards.
  - Large main metric card plus smaller companion cards.
  - Narrative summary card below metrics.
- People/engagement view:
  - Featured member spotlight card.
  - Ranked participant list.
  - Donut chart with recurrence categories and explanatory delta text.
- Daily insights:
  - Left vertical day timeline.
  - Right detail area for selected day.
  - Summary chips and semantic cards for pain, opportunity, and objection.
  - Topic cards with long-form explanatory text.
- Polls:
  - Search and period filters.
  - Poll result card with CTA on the right.
  - Progress bars and vote counts in a clean stacked layout.

## Prompt Guidance
- Mention "Central de Comando do Boris" when you want the generation to inherit this system's visual language.
- Use phrases such as:
  - "warm neutral SaaS admin"
  - "rounded analytics cards with restrained orange accents"
  - "left navigation and airy operational dashboard layout"
  - "calm high-end control center UI"
- If the user asks for a new screen, keep consistency with the patterns above instead of inventing a radically different design system.

## Avoid
- Dark mode unless requested.
- Saturated gradients dominating the layout.
- Heavy shadows, glossy cards, or glassmorphism.
- Neon colors or startup-generic purple accents.
- Crowded enterprise tables with tiny text.
- Mobile-first framing unless requested; the reference is desktop admin.
