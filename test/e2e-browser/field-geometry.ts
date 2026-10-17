import type { Locator } from "@playwright/test";

/**
 * One `<FilterBar>` input as a reader scans it: the element its label names,
 * the bordered box that holds its value (`null` when it draws none, as the
 * slider's track does), and whether its label sits on a row above the box.
 */
export interface FilterField {
  readonly name: string;
  readonly named: Locator;
  readonly box: Locator | null;
  readonly labelRow: boolean;
}

/** Where a field's label row and control box landed, in page-y px. */
export interface FieldGeometry {
  readonly name: string;
  readonly labelTop: number | undefined;
  readonly control: ControlBounds | undefined;
  /** The extent of the field's flex item, which decides its wrapped line. */
  readonly item: { readonly top: number; readonly bottom: number };
}

interface ControlBounds {
  readonly top: number;
  readonly height: number;
  readonly bottom: number;
}

/**
 * Measures every field's label top, control box and flex-item extent.
 *
 * @example
 * const measured = await measureFields([{ name: "Region", named, box: named, labelRow: true }]);
 */
export function measureFields(
  fields: readonly FilterField[],
): Promise<FieldGeometry[]> {
  return Promise.all(fields.map(measureField));
}

async function measureField(field: FilterField): Promise<FieldGeometry> {
  return {
    name: field.name,
    labelTop: field.labelRow ? await labelTop(field.named) : undefined,
    control: field.box ? await controlBounds(field.box) : undefined,
    item: await flexItemBounds(field.named),
  };
}

/** The top of the element that names `named` — `aria-labelledby` first, then `<label for>`. */
function labelTop(named: Locator): Promise<number> {
  return named.evaluate((el) => {
    const labelledBy = el.getAttribute("aria-labelledby")?.split(" ")[0];
    const label = labelledBy
      ? document.getElementById(labelledBy)
      : (el as HTMLInputElement).labels?.[0];
    if (!label) {
      throw new Error(
        `${el.outerHTML.slice(0, 120)} has no label; expected aria-labelledby or a <label for>`,
      );
    }
    return Math.round(label.getBoundingClientRect().top);
  });
}

function controlBounds(box: Locator): Promise<ControlBounds> {
  return box.evaluate((el) => {
    const { top, height, bottom } = el.getBoundingClientRect();
    return {
      top: Math.round(top),
      height: Math.round(height),
      bottom: Math.round(bottom),
    };
  });
}

/** The bounds of the panel child that holds `named` — the bar's flex item. */
function flexItemBounds(
  named: Locator,
): Promise<{ top: number; bottom: number }> {
  return named.evaluate((el) => {
    const panel = el.closest("[data-filter-bar] > *");
    if (!panel) {
      throw new Error(
        `${el.outerHTML.slice(0, 120)} is outside a filter bar; expected a [data-filter-bar] ancestor`,
      );
    }
    let item: Element = el;
    while (item.parentElement !== panel) item = item.parentElement!;
    const { top, bottom } = item.getBoundingClientRect();
    return { top: Math.round(top), bottom: Math.round(bottom) };
  });
}

/**
 * Groups fields into the lines a wrapping flex row put them on: items on one
 * line overlap vertically, whichever cross-axis alignment the row uses.
 *
 * @example
 * const lines = flexLines(await measureFields(fields));
 */
export function flexLines(
  measured: readonly FieldGeometry[],
): FieldGeometry[][] {
  const lines: FieldGeometry[][] = [];
  const byTop = [...measured].sort((a, b) => a.item.top - b.item.top);
  for (const field of byTop) {
    const line = lines.at(-1);
    const lineBottom = Math.max(...(line ?? []).map((f) => f.item.bottom));
    if (line && field.item.top < lineBottom) line.push(field);
    else lines.push([field]);
  }
  return lines;
}
