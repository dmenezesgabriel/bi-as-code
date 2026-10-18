import { type ESTree, parseSync } from "vite";

/** A 1-based line and column, the convention editors and `tsc` print. */
export interface ConfigKeyPosition {
  line: number;
  column: number;
}

/**
 * Finds where the property at `keyPath` is written in a `biac.config.ts`
 * source, by walking the default-exported object literal. Parsing (rather
 * than searching the text for `key:`) cannot misfire on a key spelled in a
 * comment or a string. A key the walk cannot reach statically — spread in,
 * computed, behind a variable, or in a file that does not parse — has no
 * position; an empty path locates the default-exported expression itself.
 *
 * @example
 * findConfigKeyPosition('export default {\n  titel: "x",\n};', ["titel"]);
 * // { line: 2, column: 3 }
 */
export function findConfigKeyPosition(
  source: string,
  keyPath: readonly string[],
): ConfigKeyPosition | undefined {
  const exported = defaultExport(source);
  if (exported === undefined) return undefined;
  let node: ESTree.Node = exported;
  let start = exported.start;
  for (const key of keyPath) {
    const property = findProperty(node, key);
    if (property === undefined) return undefined;
    start = property.key.start;
    node = unwrap(property.value);
  }
  return toLineColumn(source, start);
}

function defaultExport(source: string): ESTree.Node | undefined {
  const parsed = parseSync(CONFIG_PARSE_NAME, source);
  if (parsed.errors.length > 0) return undefined;
  const declaration = parsed.program.body.find(
    (statement) => statement.type === "ExportDefaultDeclaration",
  );
  return declaration === undefined
    ? undefined
    : unwrap(declaration.declaration);
}

// The `.ts` name makes the parser accept `satisfies`/`as` type syntax.
const CONFIG_PARSE_NAME = "biac.config.ts";

/** Sees through `satisfies X`, `as const` and parentheses to the value. */
function unwrap(
  node: ESTree.ExportDefaultDeclarationKind,
): ESTree.ExportDefaultDeclarationKind {
  if (
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "ParenthesizedExpression"
  )
    return unwrap(node.expression);
  return node;
}

function findProperty(
  node: ESTree.Node,
  key: string,
): ESTree.ObjectProperty | undefined {
  if (node.type !== "ObjectExpression") return undefined;
  return node.properties.find(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" &&
      !property.computed &&
      propertyName(property.key) === key,
  );
}

function propertyName(key: ESTree.PropertyKey): string | undefined {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return undefined;
}

function toLineColumn(source: string, offset: number): ConfigKeyPosition {
  const before = source.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  return {
    line: before.split("\n").length,
    column: offset - lineStart + 1,
  };
}
