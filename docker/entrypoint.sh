#!/bin/sh

set -e

# ---------------------------------------------------------------------------
# Wait for PostgreSQL to be ready before doing anything else.
# The healthcheck on the db service already handles this, but we add an
# explicit loop here as a belt-and-suspenders measure.
# ---------------------------------------------------------------------------
echo "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT} ..."

until python -c "
import socket, sys, os
host = os.environ.get('POSTGRES_HOST', 'db')
port = int(os.environ.get('POSTGRES_PORT', 5432))
try:
    socket.create_connection((host, port), timeout=1).close()
    sys.exit(0)
except OSError:
    sys.exit(1)
"; do
    echo "  PostgreSQL not available yet — retrying in 2s"
    sleep 2
done

echo "PostgreSQL is ready."

# ---------------------------------------------------------------------------
# Apply database migrations
# ---------------------------------------------------------------------------
echo "Running database migrations ..."
python manage.py migrate --noinput

# ---------------------------------------------------------------------------
# Collect static files into STATIC_ROOT so Nginx can serve them
# ---------------------------------------------------------------------------
echo "Collecting static files ..."
python manage.py collectstatic --noinput --clear

# ---------------------------------------------------------------------------
# Start the Gunicorn WSGI server
# ---------------------------------------------------------------------------
echo "Starting Gunicorn ..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 1 \
    --reload \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
