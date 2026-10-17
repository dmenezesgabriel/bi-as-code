// A data loader: `biac` runs this file and serves its stdout as
// `data/weekly-orders.csv`, so a page queries the summary while this source
// stays private. It reads a local file so the example runs offline; a real
// loader would query a warehouse or an API here instead.
import { readFileSync } from "node:fs";

// Loaders run with the project root as their working directory.
const lines = readFileSync("data/orders.csv", "utf8").trim().split("\n");
const totals = new Map();
for (const line of lines.slice(1)) {
  const [, week, , , amount] = line.split(",");
  const total = totals.get(week) ?? { orders: 0, revenue: 0 };
  totals.set(week, {
    orders: total.orders + 1,
    revenue: total.revenue + Number(amount),
  });
}

process.stdout.write("week,orders,revenue\n");
for (const [week, { orders, revenue }] of totals) {
  process.stdout.write(`${week},${orders},${revenue}\n`);
}
