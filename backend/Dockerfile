FROM python:3.11-slim

WORKDIR /app

# ✅ CORREGIDO: Usar nombres correctos para Debian Trixie
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero (para cache de Docker)
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar aplicación
COPY . .

# Crear directorios necesarios
RUN mkdir -p /app/uploads /app/uploads/notification_sounds
RUN python manage.py migrate --noinput || true

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Exponer puerto
EXPOSE 8000

# Comando simple para desarrollo
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]