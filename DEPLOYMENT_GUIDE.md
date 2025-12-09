# Guía de Despliegue en AWS App Runner

Esta guía te llevará paso a paso para desplegar la aplicación **Chatbot Provefut** en AWS App Runner.

## Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (S3 + CloudFront / Amplify Hosting)          │
│  - Archivos estáticos HTML/CSS/JS                      │
│  - Configuración dinámica de API URL                   │
└────────────────┬────────────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Backend (AWS App Runner)                               │
│  - Django REST API                                      │
│  - WebSockets (Channels)                                │
│  - Puerto 8000                                          │
│  - Auto-scaling                                         │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│  RDS         │      │  Cognito         │
│  PostgreSQL  │      │  Autenticación   │
└──────────────┘      └──────────────────┘
```

---

## Prerequisitos

1. **Cuenta de AWS** con permisos para:
   - AWS App Runner
   - Amazon RDS (ya configurado)
   - Amazon Cognito (ya configurado)
   - IAM (para crear roles)
   - ECR (Elastic Container Registry) o conexión a GitHub

2. **Git** instalado localmente

3. **AWS CLI** instalado y configurado (opcional pero recomendado)
   ```bash
   aws configure
   ```

4. **Repositorio Git** (GitHub, GitLab, o Bitbucket)

---

## Paso 1: Preparar el Repositorio

### 1.1 Asegurar que todos los archivos estén en Git

```bash
cd c:\Users\samue\OneDrive\Documentos\GitHub\chatbot_provefut

# Verificar estado
git status

# Agregar los nuevos archivos de configuración
git add backend/apprunner.yaml
git add backend/start.sh
git add backend/.env.example
git add backend/Dockerfile
git add DEPLOYMENT_GUIDE.md

# Commit
git commit -m "Add AWS App Runner configuration files"

# Push al repositorio remoto
git push origin PoC_NYX_AWS
```

### 1.2 Verificar que el branch esté en GitHub/GitLab

Asegúrate de que tu código esté disponible en un repositorio remoto.

---

## Paso 2: Configurar Security Groups para RDS

Tu base de datos RDS debe permitir conexiones desde App Runner.

### 2.1 Obtener el Security Group ID de tu RDS

1. Ve a la consola de AWS RDS
2. Selecciona tu base de datos: `chatbot-provefut-db`
3. En la pestaña **"Connectivity & security"**, anota el **Security Group ID**

### 2.2 Modificar el Security Group

1. Ve a **EC2 → Security Groups**
2. Busca el Security Group de tu RDS
3. **Editar Inbound Rules**
4. Agrega una regla:
   - **Type:** PostgreSQL
   - **Protocol:** TCP
   - **Port:** 5432
   - **Source:** Custom → Busca el Security Group que App Runner creará (o usa `0.0.0.0/0` temporalmente para pruebas)

   ⚠️ **IMPORTANTE:** En producción, restringe el acceso solo al Security Group de App Runner.

---

## Paso 3: Crear el Servicio en AWS App Runner

### Opción A: Desde la Consola de AWS (Recomendado para principiantes)

#### 3.1 Acceder a App Runner

1. Inicia sesión en la [Consola de AWS](https://console.aws.amazon.com/)
2. Busca **"App Runner"** en el buscador de servicios
3. Haz clic en **"Create service"**

#### 3.2 Configurar el Origen (Source)

**Step 1: Source and deployment**

1. **Source type:** Selecciona **"Source code repository"**
2. **Connect to GitHub** (o tu proveedor):
   - Haz clic en **"Add new"**
   - Autoriza AWS App Runner a acceder a tu repositorio
   - Selecciona tu repositorio: `chatbot_provefut`
   - Branch: `PoC_NYX_AWS` (o tu branch principal)

3. **Deployment trigger:**
   - Selecciona **"Automatic"** (App Runner desplegará automáticamente cuando hagas push)

4. Haz clic en **"Next"**

#### 3.3 Configurar Build (Construcción)

**Step 2: Configure build**

1. **Configuration file:** Selecciona **"Use a configuration file"**
   - App Runner buscará `apprunner.yaml` en la raíz del repositorio
   - **IMPORTANTE:** Asegúrate de que `apprunner.yaml` esté en `backend/apprunner.yaml`

   Si tu `apprunner.yaml` NO está en la raíz, necesitas:
   - Mover `apprunner.yaml` a la raíz del proyecto, O
   - Seleccionar **"Configure all settings here"** y configurar manualmente:
     - **Runtime:** Python 3
     - **Build command:**
       ```bash
       cd backend && pip install -r requirements.txt
       ```
     - **Start command:**
       ```bash
       cd backend && sh start.sh
       ```

2. Haz clic en **"Next"**

#### 3.4 Configurar el Servicio

**Step 3: Configure service**

1. **Service name:** `chatbot-provefut-backend`

2. **Virtual CPU & memory:**
   - Selecciona **1 vCPU & 2 GB** (puedes ajustar después)

3. **Environment variables** (Variables de entorno):
   Haz clic en **"Add environment variable"** y agrega:

   | Name | Value | Type |
   |------|-------|------|
   | `DJANGO_SECRET_KEY` | `tu-clave-secreta-muy-larga-y-aleatoria` | Plaintext |
   | `DEBUG` | `False` | Plaintext |
   | `ALLOWED_HOSTS` | `*` (cambiar después a tu dominio) | Plaintext |
   | `DATABASE_URL` | `postgresql://postgres:ChatbotProvefut2025!@chatbot-provefut-db.cyfwq6kgermb.us-east-1.rds.amazonaws.com:5432/chatbot_provefut` | **Secret** ⚠️ |
   | `COGNITO_REGION` | `us-east-1` | Plaintext |
   | `COGNITO_USER_POOL_ID` | `us-east-1_hERvQ0wWv` | Plaintext |
   | `CORS_ALLOWED_ORIGINS` | `https://tu-frontend.com,http://localhost:8080` | Plaintext |

   ⚠️ **IMPORTANTE:** Marca `DATABASE_URL` como **Secret** para mayor seguridad.

4. **Port:** `8000` (asegúrate de que coincida con tu app)

5. **Auto scaling:**
   - Min instances: `1`
   - Max instances: `3`
   - Max concurrency: `100`

6. **Health check:**
   - Protocol: `HTTP`
   - Path: `/api/` (o `/admin/`)
   - Interval: `10` segundos
   - Timeout: `5` segundos
   - Unhealthy threshold: `3`

7. Haz clic en **"Next"**

#### 3.5 Revisar y Crear

1. Revisa toda la configuración
2. Haz clic en **"Create & deploy"**
3. **Espera 5-10 minutos** mientras App Runner construye y despliega tu aplicación

#### 3.6 Obtener la URL del Backend

Una vez que el despliegue sea exitoso:

1. En la consola de App Runner, selecciona tu servicio
2. Copia la **Default domain** (algo como: `https://abc123xyz.us-east-1.awsapprunner.com`)
3. **Guarda esta URL** - la necesitarás para configurar el frontend

---

### Opción B: Usando AWS CLI (Avanzado)

#### 3.1 Crear un archivo de configuración JSON

Crea `backend/apprunner-service.json`:

```json
{
  "ServiceName": "chatbot-provefut-backend",
  "SourceConfiguration": {
    "AuthenticationConfiguration": {
      "ConnectionArn": "arn:aws:apprunner:us-east-1:ACCOUNT_ID:connection/GITHUB_CONNECTION_NAME"
    },
    "AutoDeploymentsEnabled": true,
    "CodeRepository": {
      "RepositoryUrl": "https://github.com/tu-usuario/chatbot_provefut",
      "SourceCodeVersion": {
        "Type": "BRANCH",
        "Value": "PoC_NYX_AWS"
      },
      "CodeConfiguration": {
        "ConfigurationSource": "API",
        "CodeConfigurationValues": {
          "Runtime": "PYTHON_3",
          "BuildCommand": "cd backend && pip install -r requirements.txt",
          "StartCommand": "cd backend && sh start.sh",
          "Port": "8000",
          "RuntimeEnvironmentVariables": {
            "DJANGO_SECRET_KEY": "tu-clave-secreta",
            "DEBUG": "False",
            "DATABASE_URL": "postgresql://...",
            "COGNITO_REGION": "us-east-1",
            "COGNITO_USER_POOL_ID": "us-east-1_hERvQ0wWv"
          }
        }
      }
    }
  },
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/api/"
  }
}
```

#### 3.2 Crear el servicio

```bash
aws apprunner create-service --cli-input-json file://backend/apprunner-service.json --region us-east-1
```

---

## Paso 4: Verificar el Despliegue del Backend

### 4.1 Verificar que el servicio esté corriendo

1. En la consola de App Runner, verifica que el estado sea **"Running"**
2. Revisa los **Logs** en la pestaña "Logs" para asegurarte de que no haya errores

### 4.2 Probar el backend

Abre tu navegador o usa `curl`:

```bash
# Verifica que el API responda
curl https://TU-APP-RUNNER-URL.us-east-1.awsapprunner.com/api/

# Deberías ver un error 401 (Unauthorized) porque no tienes token - ¡esto es bueno!
```

### 4.3 Probar el endpoint de autenticación

```bash
# Este endpoint no requiere autenticación (ajustar según tu configuración)
curl https://TU-APP-RUNNER-URL.us-east-1.awsapprunner.com/admin/
```

---

## Paso 5: Configurar el Frontend

Tienes dos opciones para el frontend:

### Opción A: AWS Amplify Hosting (Recomendado)

#### 5.1 Preparar el frontend

1. Actualiza `frontend/static/js/config.js`:

```javascript
window.APP_CONFIG = {
    API_BASE_URL: 'https://TU-APP-RUNNER-URL.us-east-1.awsapprunner.com',

    getApiUrl: function() {
        return this.API_BASE_URL + '/api';
    },

    getSocketUrl: function() {
        // Para WebSockets sobre HTTPS
        return this.API_BASE_URL.replace('https://', 'wss://');
    }
};
```

2. Commit y push:

```bash
git add frontend/static/js/config.js
git commit -m "Update frontend config with App Runner URL"
git push origin PoC_NYX_AWS
```

#### 5.2 Desplegar en Amplify Hosting

1. Ve a **AWS Amplify** en la consola
2. Haz clic en **"New app" → "Host web app"**
3. Selecciona tu repositorio Git
4. Configuración de build:
   - **App build specification:**
     ```yaml
     version: 1
     frontend:
       phases:
         build:
           commands:
             - echo "No build needed - static files only"
       artifacts:
         baseDirectory: /frontend
         files:
           - '**/*'
     ```

5. Haz clic en **"Save and deploy"**
6. Espera 2-3 minutos
7. Copia la **URL de Amplify** (ej: `https://main.d2ar0ncsvlrfzm.amplifyapp.com`)

### Opción B: Amazon S3 + CloudFront

#### 5.1 Crear un bucket de S3

```bash
aws s3 mb s3://chatbot-provefut-frontend --region us-east-1
```

#### 5.2 Configurar el bucket para hosting estático

```bash
aws s3 website s3://chatbot-provefut-frontend --index-document index.html
```

#### 5.3 Subir archivos

```bash
cd frontend
aws s3 sync . s3://chatbot-provefut-frontend --acl public-read
```

#### 5.4 Crear distribución de CloudFront (opcional para HTTPS)

Sigue la guía oficial de AWS para crear una distribución de CloudFront apuntando a tu bucket S3.

---

## Paso 6: Actualizar CORS en el Backend

Una vez que tengas la URL del frontend, actualiza las variables de entorno en App Runner:

1. Ve a **App Runner → Tu servicio → Configuration → Environment variables**
2. Edita `CORS_ALLOWED_ORIGINS`:
   ```
   https://main.d2ar0ncsvlrfzm.amplifyapp.com,http://localhost:8080
   ```
3. Edita `ALLOWED_HOSTS`:
   ```
   TU-APP-RUNNER-URL.us-east-1.awsapprunner.com,localhost
   ```
4. Haz clic en **"Deploy"** para aplicar los cambios

---

## Paso 7: Configurar WebSockets (Opcional - Para Notificaciones en Tiempo Real)

App Runner soporta WebSockets de forma nativa, pero para producción es recomendable usar **Redis** con **Amazon ElastiCache**.

### 7.1 Crear una instancia de Redis en ElastiCache

1. Ve a **ElastiCache** en la consola de AWS
2. Crea un nuevo cluster de Redis:
   - Nombre: `chatbot-provefut-redis`
   - Node type: `cache.t3.micro` (para pruebas)
   - Engine version: 7.x
   - **IMPORTANTE:** Asegúrate de que esté en la **misma VPC** que tu RDS

### 7.2 Configurar Security Groups

Permite que App Runner se conecte a Redis:

1. Security Group de Redis debe aceptar conexiones en puerto `6379` desde el Security Group de App Runner

### 7.3 Actualizar variables de entorno

Agrega a App Runner:

| Name | Value |
|------|-------|
| `REDIS_HOST` | `tu-cluster-redis.cache.amazonaws.com` |
| `REDIS_PORT` | `6379` |

---

## Paso 8: Configurar Dominio Personalizado (Opcional)

### 8.1 En App Runner

1. Ve a **Custom domains** en tu servicio de App Runner
2. Haz clic en **"Link domain"**
3. Ingresa tu dominio: `api.tudominio.com`
4. Sigue las instrucciones para agregar los registros DNS en Route 53 o tu proveedor de DNS

### 8.2 En Amplify (para el frontend)

1. Ve a **Domain management** en Amplify
2. Agrega tu dominio: `tudominio.com`
3. Configura los registros DNS según las instrucciones

---

## Paso 9: Monitoreo y Logs

### 9.1 Ver logs en tiempo real

En la consola de App Runner:

1. Selecciona tu servicio
2. Ve a la pestaña **"Logs"**
3. Selecciona **"Deployment logs"** o **"Application logs"**

### 9.2 Configurar CloudWatch (opcional)

Los logs se envían automáticamente a CloudWatch Logs. Puedes crear alarmas para:

- Errores 500
- Alta latencia
- Uso de CPU/memoria

---

## Paso 10: Pruebas End-to-End

### 10.1 Probar la autenticación

1. Abre tu frontend: `https://main.d2ar0ncsvlrfzm.amplifyapp.com`
2. Deberías ser redirigido a Cognito para login
3. Inicia sesión con tus credenciales
4. Verifica que seas redirigido a `/chat.html` o `/admin.html`

### 10.2 Probar creación de tickets

1. En el chat, crea un nuevo ticket
2. Adjunta un archivo
3. Verifica que aparezca en la base de datos

### 10.3 Probar el panel de administrador

1. Inicia sesión con un usuario admin
2. Verifica que veas todos los tickets
3. Prueba asignar un ticket
4. Verifica que las notificaciones en tiempo real funcionen

---

## Troubleshooting (Solución de Problemas)

### Problema: App Runner no puede conectarse a RDS

**Solución:**

1. Verifica que el Security Group de RDS permita conexiones desde `0.0.0.0/0` (temporalmente)
2. Verifica que la URL de la base de datos en `DATABASE_URL` sea correcta
3. Revisa los logs de App Runner para ver el error específico

### Problema: CORS errors en el frontend

**Solución:**

1. Asegúrate de que `CORS_ALLOWED_ORIGINS` incluya la URL exacta del frontend
2. Verifica que no haya trailing slashes (`/`) al final de las URLs
3. Revisa que el frontend esté usando HTTPS si el backend también lo usa

### Problema: WebSockets no funcionan

**Solución:**

1. App Runner soporta WebSockets, pero verifica que estés usando `wss://` (no `ws://`)
2. Si usas Nginx o un proxy, asegúrate de que esté configurado para WebSockets
3. Considera usar ElastiCache Redis para producción

### Problema: Archivos no se guardan

**Solución:**

App Runner usa almacenamiento efímero. Para producción, debes:

1. Migrar el almacenamiento de archivos a **Amazon S3**
2. Actualizar `settings.py` para usar `django-storages`:
   ```python
   DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
   AWS_STORAGE_BUCKET_NAME = 'chatbot-provefut-uploads'
   ```

---

## Costos Estimados (us-east-1)

| Servicio | Configuración | Costo Mensual Aprox. |
|----------|---------------|----------------------|
| App Runner | 1 vCPU, 2GB RAM | $25-40 |
| RDS PostgreSQL | db.t3.micro | $15-20 |
| Amplify Hosting | 5GB storage + CDN | $0.15/GB |
| Cognito | 50,000 MAU | Gratis (primer año) |
| ElastiCache Redis | cache.t3.micro | $13 |
| **TOTAL** | | **$55-75/mes** |

---

## Próximos Pasos

1. ✅ **Migrar uploads a S3** para persistencia de archivos
2. ✅ **Configurar dominio personalizado** (ej: `api.provefut.com`)
3. ✅ **Configurar CI/CD** para despliegues automáticos
4. ✅ **Implementar Redis/ElastiCache** para WebSockets en producción
5. ✅ **Configurar monitoreo** con CloudWatch Alarms
6. ✅ **Implementar backups automáticos** de RDS
7. ✅ **Configurar SSL/TLS** en App Runner (automático con dominios custom)

---

## Recursos Adicionales

- [Documentación oficial de AWS App Runner](https://docs.aws.amazon.com/apprunner/)
- [Guía de Django en producción](https://docs.djangoproject.com/en/5.0/howto/deployment/)
- [AWS Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [Configurar WebSockets en App Runner](https://aws.amazon.com/blogs/containers/websocket-support-for-aws-app-runner/)

---

## Soporte

Si tienes problemas durante el despliegue:

1. Revisa los logs de App Runner
2. Verifica las variables de entorno
3. Asegúrate de que RDS sea accesible desde App Runner
4. Consulta la documentación oficial de AWS

---

**¡Listo!** Tu aplicación ahora está corriendo en AWS App Runner con arquitectura serverless escalable.
