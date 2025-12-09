#!/bin/bash

# Script de inicio para AWS App Runner
set -e  # Salir si cualquier comando crítico falla

echo "==================================="
echo "Starting Chatbot Provefut Backend"
echo "==================================="

# Cambiar al directorio del backend
cd "$(dirname "$0")"
echo "Working directory: $(pwd)"
echo "Contents: $(ls -la)"

# Agregar paquetes de pip al PYTHONPATH
export PYTHONPATH="/app/.pip-packages:$PYTHONPATH"
echo "PYTHONPATH: $PYTHONPATH"

# Verificar que DATABASE_URL esté configurada
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set!"
    exit 1
fi

echo "✓ DATABASE_URL is configured"

# Verificar que Python y las dependencias estén disponibles
echo "Checking Python installation..."
python3 --version || { echo "ERROR: Python3 not found"; exit 1; }

echo "Checking Django installation..."
python3 -c "import django; print(f'Django version: {django.__version__}')" || {
    echo "ERROR: Django not installed";
    echo "Installed packages:";
    python3 -m pip list;
    exit 1;
}

echo "✓ Python and Django are available"

# Verificar que el módulo config.asgi esté disponible
echo "Checking ASGI configuration..."
python3 -c "import config.asgi; print('ASGI module loaded successfully')" || {
    echo "ERROR: Cannot import config.asgi"
    echo "Python path: $PYTHONPATH"
    echo "Current directory: $(pwd)"
    exit 1
}

echo "✓ ASGI configuration is valid"

# Ejecutar migraciones (sin esperar a la DB - App Runner puede tardar en conectar)
echo "Running database migrations..."
python3 manage.py migrate --noinput 2>&1 || {
    echo "WARNING: Migrations failed, but continuing..."
    echo "This might be a connection issue with RDS"
}

# Recopilar archivos estáticos (opcional)
echo "Collecting static files..."
python3 manage.py collectstatic --noinput 2>&1 || echo "Warning: collectstatic skipped"

# Obtener el puerto
PORT="${PORT:-8000}"

echo "==================================="
echo "Starting Gunicorn on port $PORT..."
echo "==================================="

# Iniciar Gunicorn con Uvicorn workers
exec python3 -m gunicorn config.asgi:application \
    -k uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
