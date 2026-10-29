---
title: FilterBar
icon: filter
sidebar_position: 509
keywords: [filter bar, sticky, toolbar, filters, docked, FilterBar]
---

# FilterBar

`<FilterBar>` lays the filters inside it out as one bar and keeps it in reach while the reader scrolls. At rest it is part of the page: every filter shows, side by side, wrapping onto a second line when the column is too narrow. Once the reader scrolls past it, the bar sticks under the page header and shrinks to a single Filters button, so it never hides what the reader is reading; a click on the button opens the filters in a card over the page. The bar holds no value of its own: each filter inside it narrows its widgets and writes the page URL exactly as it would outside the bar.

The examples on this page read these queries. A widget names a query by the name after ` ```sql `, so `data="…"` below is always one of these names.

`islands`:

```sql islands echo
select distinct island
from penguins
order by island
```

`species`:

```sql species echo
select distinct species
from penguins
order by species
```

`island_species`:

```sql island_species echo
select island, species, count(*) as penguins
from penguins
group by island, species
order by island, species
```

Every filter on a page shares its URL, so each filter below has its own `id`.

## Examples

### Gather a page's filters

Put the filters inside `<FilterBar>`; the widgets they narrow go after it, anywhere on the page. A bar takes every kind of filter, and lines their labels up on one row, wrapping when the column is narrow. Use one bar per page: it is the page's bar, and a second one would dock on the same line over the first.

`penguin_masses`:

```sql penguin_masses echo
select species, island, sex, body_mass_g
from penguins
where body_mass_g is not null
order by body_mass_g desc
```

```mdx echo
<FilterBar>
  <Dropdown
    id="bar_island"
    data="islands"
    valueColumn="island"
    title="Island"
  />
  <MultiSelect
    id="bar_species"
    data="species"
    valueColumn="species"
    title="Species"
  />
  <ButtonGroup id="bar_sex" options={["female", "male"]} title="Sex" />
  <Slider
    id="bar_mass"
    data="penguin_masses"
    valueColumn="body_mass_g"
    title="Body mass (g)"
  />
</FilterBar>

<Table data="island_species" filters={["bar_island", "bar_species"]} />

<Table
  data="penguin_masses"
  filters={["bar_island", "bar_species", "bar_sex", "bar_mass"]}
  pageSize={5}
/>
```

### Docked

Pick an island, then scroll down: the bar follows as one Filters row under the page header, and the row counts the filters holding a pick, as Filters · 1. Click it to open the filters in a card over the page; press Escape, or click the page around the card, to close it. A bar that docks while a filter inside it has focus docks open, so the field being used never disappears.

The count is read out as the button's description, "1 active", so a screen reader user hears that the hidden filters still narrow the page. A filter that is cleared, switched off or left at its start is not counted.

## Props

`<FilterBar>` takes no props. Its children are the filters it lays out.

## Errors

A `<FilterBar>` has no error of its own. A filter inside it that fails shows its message in its place on the bar, and the other filters still work.
