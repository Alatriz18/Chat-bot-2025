# 🔧 Solución al Error de Deployment en App Runner

## ❌ Problema Original

App Runner estaba fallando en la fase de **build** con el error:
```
Failed to build your application source code. Reason: Failed to execute 'build' command.
```

## 🔍 Causas Identificadas

1. **apprunner.yaml mal configurado:**
   - Comandos `cd backend` redundantes
   - Configuración para Django cuando la app es Flask
   - Puerto incorrecto (8000 vs 5000)

2. **requirements.txt incorrecto:**
   - Contenía dependencias de Django innecesarias
   - Faltaban dependencias clave de Flask y SocketIO

3. **app.py no leía la variable PORT:**
   - El puerto estaba hardcodeado a 5000
   - No se adaptaba al entorno de App Runner

## ✅ Cambios Realizados

### 1. `apprunner.yaml` - Simplificado y Corregido
```yaml
version: 1.0
runtime: python311

build:
  commands:
    build:
      - echo "==================================="
      - echo "Installing Python dependencies..."
      - echo "==================================="
      - pip install --no-cache-dir -r backend/requirements.txt

run:
  runtime-version: 3.11
  command: python backend/app.py
  network:
    port: 5000
    env: PORT
  env:
    - name: PYTHONUNBUFFERED
      value: "1"
    - name: PYTHONDONTWRITEBYTECODE
      value: "1"
```

**Cambios clave:**
- ✅ Eliminados comandos `cd backend` redundantes
- ✅ Ruta correcta: `pip install -r backend/requirements.txt`
- ✅ Comando run correcto: `python backend/app.py`
- ✅ Puerto 5000 (Flask default)

### 2. `backend/requirements.txt` - Actualizado para Flask
```txt
# Flask Framework
Flask==3.0.0
flask-cors==4.0.0
flask-socketio==5.3.5

# Database drivers
psycopg2-binary==2.9.9
pyodbc==5.0.1

# WebSocket support
python-socketio==5.10.0

# Environment and configuration
python-dotenv==1.0.0

# Server (for production)
gunicorn==21.2.0
eventlet==0.33.3

# Security and Auth
pyjwt==2.8.0
cryptography==41.0.7
requests==2.31.0

# File handling
werkzeug==3.0.1
```

**Cambios clave:**
- ✅ Eliminadas dependencias de Django
- ✅ Agregadas dependencias de Flask correctas
- ✅ Incluido `pyodbc` para Informix
- ✅ Agregado `eventlet` para SocketIO

### 3. `backend/app.py` - Puerto Dinámico
```python
if __name__ == '__main__':
    # Obtener el puerto desde la variable de entorno (para App Runner y otros servicios cloud)
    port = int(os.getenv('PORT', 5000))
    debug_mode = os.getenv('DEBUG', 'False').lower() == 'true'
    
    logging.info(f"Starting server on port {port} (Debug: {debug_mode})")
    socketio.run(app, host='0.0.0.0', port=port, debug=debug_mode, allow_unsafe_werkzeug=True)
```

**Cambios clave:**
- ✅ Lee el puerto desde la variable de entorno `PORT`
- ✅ Modo debug configurable desde variable de entorno
- ✅ Logging mejorado

### 4. `Dockerfile` - Mejorado para App Runner
```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

WORKDIR /app

# Instala dependencias del sistema para pyodbc, PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    postgresql-client \
    unixodbc \
    unixodbc-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/
COPY frontend/ /app/../frontend/

RUN mkdir -p /app/uploads && chmod -R 755 /app/uploads

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/api/admins', timeout=2)" || exit 1

CMD ["python", "app.py"]
```

**Mejoras:**
- ✅ Soporte para `pyodbc` (drivers ODBC)
- ✅ Health check incluido
- ✅ Optimizado para producción
- ✅ Estructura correcta de carpetas

## 📋 Próximos Pasos

### 1. App Runner debería hacer auto-deploy
Como configuraste **automatic deployment**, App Runner detectará el nuevo push y desplegará automáticamente.

**Monitorea el deployment:**
1. Ve a la consola de AWS App Runner
2. Selecciona tu servicio
3. Ve a la pestaña **"Deployment"**
4. Observa los logs en tiempo real

### 2. Si el build falla nuevamente

**Problema común: pyodbc requiere drivers Informix**

Si ves errores relacionados con `pyodbc` o Informix ODBC, hay dos opciones:

#### Opción A: Usar Dockerfile (Recomendado)
En App Runner, cambia la configuración:
1. **Source:** Selecciona **"Source code repository"**
2. **Deployment settings:**
   - Configuration: **"Use configuration file"**
   - Configuration file: `apprunner.yaml`

O si quieres usar Docker directamente:
1. En App Runner, selecciona **"Container registry"** en lugar de "Source code"
2. Sube la imagen a Amazon ECR
3. App Runner la desplegará desde ahí

#### Opción B: Temporalmente deshabilitar Informix
Si solo quieres probar que el resto funciona, puedes comentar temporalmente las llamadas a Informix en `app.py`.

### 3. Verificar variables de entorno

Asegúrate de que en App Runner tienes configuradas:

| Variable | Valor Ejemplo |
|----------|---------------|
| `DATABASE_URL` | `postgresql://postgres:password@chatbot-provefut-db.cyfwq6kgermb.us-east-1.rds.amazonaws.com:5432/chatbot_provefut` |
| `DEBUG` | `False` |
| `PORT` | (App Runner lo configura automáticamente) |
| `INFORMIX_HOST` | `172.20.4.51` |
| `INFORMIX_PORT` | `1526` |
| `INFORMIX_DATABASE` | `lasso` |
| `INFORMIX_USER` | `informix` |
| `INFORMIX_PASSWORD` | `Inf0rm1x_2019_lss` |
| `COGNITO_REGION` | `us-east-1` |
| `COGNITO_USER_POOL_ID` | `us-east-1_hERvQ0wWv` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8080,https://tu-dominio.com` |

### 4. Probar el deployment exitoso

Una vez que App Runner muestre **"Running"**:

```bash
# Obtén la URL de App Runner (ejemplo)
curl https://abc123xyz.us-east-1.awsapprunner.com/api/admins

# Deberías ver una lista de administradores (o error 401 si requiere auth)
```

## 🚨 Troubleshooting

### Error: "Could not find a version that satisfies the requirement pyodbc"

**Solución:**
El sistema necesita drivers ODBC compilados. Usa el Dockerfile mejorado que incluye `unixodbc-dev`.

### Error: "Address already in use" o "Port 5000 is already allocated"

**Solución:**
App Runner maneja esto automáticamente. Asegúrate de que:
- El `PORT` esté configurado como variable de entorno en `apprunner.yaml`
- Tu app lea `os.getenv('PORT')` correctamente

### Error: "Database connection failed"

**Solución:**
1. Verifica que el Security Group de RDS permita conexiones desde App Runner
2. Verifica que `DATABASE_URL` esté correctamente configurada
3. Verifica que la base de datos esté activa

### Error: "Cannot connect to Informix"

**Solución temporal:**
Si Informix está en una red privada (172.20.4.51), App Runner NO podrá accederla directamente a menos que:
1. Configures un **VPC Connector** en App Runner
2. O uses un **VPN/Bastion** para acceso
3. O migres la autenticación solo a PostgreSQL/Cognito

## 📊 Monitoreo del Deployment

Espera estos mensajes en los logs de App Runner:

✅ **Build Success:**
```
[AppRunner] Successfully validate configuration file.
[AppRunner] Starting source code build.
[AppRunner] Successfully built your application source code.
```

✅ **Deployment Success:**
```
[AppRunner] Creating service with image.
[AppRunner] Successfully created service.
[AppRunner] Service status is set to RUNNING.
```

## 📞 Soporte

Si el error persiste:
1. Copia los logs exactos de App Runner
2. Verifica el output del comando `pip install` en los logs de build
3. Verifica que todas las variables de entorno estén configuradas

---

**Cambios aplicados:** ✅ Committed y pushed al branch `main`
**Estado:** Esperando auto-deploy de App Runner
**Tiempo estimado:** 5-10 minutos

**Siguiente:** Monitorea la consola de App Runner para ver el nuevo deployment.
