import type { ReactElement } from "react";
import { WidgetError } from "../markdown/states";
import type { QueryResult } from "../../pages/types";

/**
 * The blocking option-source failure for `data`-backed inputs — the same
 * inline, page-surviving treatment as `<Table>`: a missing `valueColumn`,
 * an undeclared fence name, or a query error replaces the field with an
 * alert. `valueColumnFor` names what the column feeds ("options",
 * "bounds") so the message reads as the input's own contract. `null` when
 * the source is usable.
 */
export function sourceError({
  data,
  valueColumn,
  result,
  id,
  valueColumnFor,
}: {
  data: string | undefined;
  valueColumn: string | undefined;
  result: QueryResult | undefined;
  id: string;
  valueColumnFor: string;
}): ReactElement | null {
  if (data === undefined) return null;
  if (valueColumn === undefined) {
    return (
      <WidgetError
        name={id}
        message={`data is set — valueColumn is required to name the ${valueColumnFor} column`}
      />
    );
  }
  if (result === undefined) {
    return (
      <WidgetError
        name={data}
        message="no sql fence on this page declares this name"
      />
    );
  }
  if (result.status === "error") {
    return <WidgetError name={data} message={result.message} />;
  }
  return null;
}
