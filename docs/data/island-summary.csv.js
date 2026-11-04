// One row per island: its penguins and their mean body mass in grams.
// A loader runs from the project root, so its paths start at `data/`.
import { readFileSync } from "node:fs";

const [header, ...lines] = readFileSync("data/penguins.csv", "utf8")
  .trim()
  .split("\n");
const columns = header.split(",");
const islandAt = columns.indexOf("island");
const massAt = columns.indexOf("body_mass_g");

const byIsland = new Map();
for (const line of lines) {
  const cells = line.split(",");
  const island = byIsland.get(cells[islandAt]) ?? {
    penguins: 0,
    weighed: 0,
    grams: 0,
  };
  island.penguins += 1;
  if (cells[massAt] !== "") {
    island.weighed += 1;
    island.grams += Number(cells[massAt]);
  }
  byIsland.set(cells[islandAt], island);
}

// The loader's stdout is the file, so the CSV goes out on stdout.
console.log("island,penguins,mean_body_mass_g");
for (const [island, { penguins, weighed, grams }] of byIsland) {
  console.log(`${island},${penguins},${Math.round(grams / weighed)}`);
}
