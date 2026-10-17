# A data loader in shell: `biac` runs this file with `sh` and serves its
# stdout as `data/daily-orders.csv`, so a page queries the summary while this
# source stays private. It reads a local file so the example runs offline; a
# real loader would call a CLI or an API here instead.
set -eu

# Loaders run with the project root as their working directory.
echo "order_date,orders"
awk -F, 'NR > 1 { count[$3]++ } END { for (day in count) print day "," count[day] }' \
  data/orders.csv | sort
