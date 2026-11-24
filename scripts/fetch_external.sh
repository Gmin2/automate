#!/bin/sh
# third party test models. no license on the repo, so they are fetched, not committed
set -e
cd "$(dirname "$0")/.."
mkdir -p data/external
curl -sSfL -o data/external/bench_vice.stp \
  https://raw.githubusercontent.com/safwanenadah-eng/bench-vice-catia-v5/main/CAD_STEP/Bench_Vice_Assembly.stp
echo "saved data/external/bench_vice.stp"
