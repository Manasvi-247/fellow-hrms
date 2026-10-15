#!/bin/sh
set -e
# Set RUN_MIGRATIONS=false when a separate job (for example a Helm hook) owns migrations.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  python -m app.bootstrap
fi
exec "$@"
