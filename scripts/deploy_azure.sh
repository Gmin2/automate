#!/bin/sh
# builds the image in azure and runs it on container apps. needs `az login` first.
# rerun it after a change to ship a new version.
set -e
cd "$(dirname "$0")/.."

RG=${RG:-automate-rg}
APP=${APP:-automate}
LOC=${LOC:-centralindia}

az extension add --name containerapp --upgrade --only-show-errors
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

az containerapp up --name "$APP" --resource-group "$RG" --location "$LOC" \
  --source . --ingress external --target-port 8000

# the lathe needs about 0.7 GB once loaded. one copy always on so nobody waits for a cold start
az containerapp update --name "$APP" --resource-group "$RG" \
  --cpu 1 --memory 2Gi --min-replicas 1 --max-replicas 1 --only-show-errors

echo "https://$(az containerapp show --name "$APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
