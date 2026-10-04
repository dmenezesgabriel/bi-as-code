import { lstatSync } from "node:fs";

// Prettier refuses to format symbolic links, which would otherwise fail the
// pre-commit hook on any commit that stages them. Filter symlinks out before
// handing paths to the formatters.
const formattable = (files) =>
  files.filter((file) => !lstatSync(file).isSymbolicLink());

export default {
  "*.{ts,tsx,js,mjs,cjs}": (files) => {
    const real = formattable(files);
    if (real.length === 0) return [];
    const paths = real.map((f) => JSON.stringify(f)).join(" ");
    return [`prettier --write ${paths}`, `eslint --fix ${paths}`];
  },
  "*.css": (files) => {
    const real = formattable(files);
    if (real.length === 0) return [];
    const paths = real.map((f) => JSON.stringify(f)).join(" ");
    return [`prettier --write ${paths}`, `stylelint --fix ${paths}`];
  },
  "*.{json,md}": (files) => {
    const real = formattable(files);
    if (real.length === 0) return [];
    return `prettier --write ${real.map((f) => JSON.stringify(f)).join(" ")}`;
  },
};
