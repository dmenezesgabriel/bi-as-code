---
sidebar_position: 2
---

# Allocation

How the weekly order volume splits across fulfilment channels. This page
deliberately carries no front-matter title — the nav label falls back to
the file name and the document title to the first heading.

| Channel     | Share | Orders |
| ----------- | ----: | -----: |
| Direct      |   46% |    163 |
| Marketplace |   32% |    113 |
| Partner     |   22% |     79 |

```sql channel_mix
select channel, share, orders
from channels
order by orders desc
```

<FilterBar>
  <ButtonGroup id="channel" data="channel_mix" valueColumn="channel" title="Channel" multiple />
  <MultiSelect id="channel" data="channel_mix" valueColumn="channel" title="Channel" />
</FilterBar>

<Table data="channel_mix" filters="channel" />

The button group and the multi-select share the `?channel=` filter — picks
stay in sync either way. Channel mix is stable week over week; marketplace
volume peaks on weekends. [Back to the region detail](/nested/page).
