export default {
  title: "biac docs",
  theme: "system",
  // GitHub Pages serves a repository's site below /<repo>/. `biac dev`
  // ignores base; `biac build` and `biac preview` use it (ADR-0029).
  base: "/bi-as-code",
  nav: { sidebar: true },
  directories: {
    "pages/components": { title: "Widgets" },
    "pages/layout": { title: "Layout" },
    "pages/filters": { title: "Filters" },
    "pages/crossfilter": { title: "Cross-filter" },
    "pages/pages": { title: "Pages" },
    "pages/sql": { title: "Data" },
    "pages/ship": { title: "Ship" },
  },
  sql: {
    penguins: "data/penguins.csv",
    weather: "data/seattle-weather.csv",
  },
};
