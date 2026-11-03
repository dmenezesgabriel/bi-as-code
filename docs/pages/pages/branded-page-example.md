---
title: A branded page
icon: layers
sidebar_position: 105
index: false
brand:
  colors:
    primary: { light: "#7c3aed", dark: "#c4b5fd" }
  palette: { light: ["#7c3aed"], dark: ["#c4b5fd"] }
  fonts: { heading: "serif" }
  radius: "1rem"
---

# A branded page

This page sets its own `brand` in front-matter, so its look differs from every other page of this site. Open [Themes and brand](/pages/themes-and-brand) to see the same controls in the project's own colours.

```yaml
brand:
  colors:
    primary: { light: "#7c3aed", dark: "#c4b5fd" }
  palette: { light: ["#7c3aed"], dark: ["#c4b5fd"] }
  fonts: { heading: "serif" }
  radius: "1rem"
```

Four things differ here, and nothing else does:

- The pressed button below is violet: `colors.primary`.
- The first bar series is violet: `palette`.
- The headings and the site title use a serif face: `fonts.heading`.
- Controls and cards have rounder corners: `radius`.

The sidebar, the header and the page background keep the project's colours, because this page does not set them. The theme toggle in the header still switches this page between light and dark, and each mode has its own violet.

```sql species_by_island
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

```sql islands
select distinct island from penguins order by island
```

<ButtonGroup id="island" data="islands" valueColumn="island" />

<BarChart data="species_by_island" x="species" y="penguins" filters="island" title="Penguins by species" />

Leave the page with the sidebar and the project's colours return at once: a page's brand lasts as long as the page is open.
