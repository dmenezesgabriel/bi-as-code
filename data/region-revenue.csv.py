# A data loader in Python: `biac` runs this file with `python3` and serves
# its stdout as `data/region-revenue.csv`, so a page queries the summary
# while this source stays private. It reads a local file so the example runs
# offline; a real loader would query a warehouse or an API here instead.
import csv
import sys

totals = {}
# Loaders run with the project root as their working directory.
with open("data/orders.csv", newline="") as orders:
    for row in csv.DictReader(orders):
        count, revenue = totals.get(row["region"], (0, 0))
        totals[row["region"]] = (count + 1, revenue + int(row["amount"]))

writer = csv.writer(sys.stdout, lineterminator="\n")
writer.writerow(["region", "orders", "revenue"])
for region, (count, revenue) in totals.items():
    writer.writerow([region, count, revenue])
