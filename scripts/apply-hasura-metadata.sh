#!/bin/sh
set -eu

until curl -s http://hasura_tp_coord_front_back:8080/healthz >/dev/null; do
  echo "waiting for hasura..."
  sleep 2
done

{
  printf '{"type":"replace_metadata","args":{"allow_inconsistent_metadata":false,"metadata":'
  cat /metadata.json
  printf '}}'
} | curl -s -o /dev/stderr -w "%{http_code}" \
  -X POST http://hasura_tp_coord_front_back:8080/v1/metadata \
  -H "X-Hasura-Admin-Secret: myadminsecretkey" \
  -H "Content-Type: application/json" \
  --data-binary @-
