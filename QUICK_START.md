# Quick Start - Despliegue en AWS App Runner

## Resumen de Archivos Creados

He preparado tu aplicación para despliegue en AWS App Runner. Estos son los archivos nuevos/modificados:

```
✅ backend/apprunner.yaml          - Configuración de App Runner
✅ backend/start.sh                - Script de inicio con migraciones
✅ backend/Dockerfile              - Optimizado para App Runner
✅ backend/.env.example            - Variables de entorno necesarias
✅ backend/config/settings.py      - Actualizado para producción
✅ frontend/static/js/config.js    - Configuración dinámica de URLs
✅ DEPLOYMENT_GUIDE.md             - Guía completa paso a paso
```

---

## Pasos Rápidos (5 minutos)

### 1. Subir cambios a Git

```bash
cd c:\Users\samue\OneDrive\Documentos\GitHub\chatbot_provefut

git add .
git commit -m "Configure app for AWS App Runner deployment"
git push origin PoC_NYX_AWS
```

### 2. Configurar RDS Security Group

1. Ve a **AWS Console → RDS → chatbot-provefut-db**
2. Anota el **Security Group ID**
3. Ve a **EC2 → Security Groups → [Tu Security Group]**
4. **Editar Inbound Rules**:
   - Type: PostgreSQL (TCP 5432)
   - Source: `0.0.0.0/0` (temporal, restringir después)

### 3. Crear Servicio en App Runner

1. Ve a **AWS App Runner → Create service**

2. **Source:**
   - Repository: GitHub → Conecta tu cuenta
   - Selecciona: `chatbot_provefut`
   - Branch: `PoC_NYX_AWS`
   - Deployment: **Automatic**

3. **Build:**
   - Configuration: **Configure all settings here**
   - Runtime: Python 3
   - Build command:
     ```bash
     cd backend && pip install -r requirements.txt
     ```
   - Start command:
     ```bash
     cd backend && sh start.sh
     ```
   - Port: `8000`

4. **Service settings:**
   - Name: `chatbot-provefut-backend`
   - CPU: 1 vCPU
   - Memory: 2 GB

5. **Environment variables** (¡IMPORTANTE!):

   ```
   DJANGO_SECRET_KEY = <genera-una-clave-aleatoria-larga>
   DEBUG = False
   ALLOWED_HOSTS = *
   DATABASE_URL = postgresql://postgres:ChatbotProvefut2025!@chatbot-provefut-db.cyfwq6kgermb.us-east-1.rds.amazonaws.com:5432/chatbot_provefut
   COGNITO_REGION = us-east-1
   COGNITO_USER_POOL_ID = us-east-1_hERvQ0wWv
   CORS_ALLOWED_ORIGINS = https://main.d2ar0ncsvlrfzm.amplifyapp.com,http://localhost:8080
   ```

   ⚠️ Marca `DATABASE_URL` como **Secret**

6. Click **Create & deploy**

7. **Espera 5-10 minutos**

8. Copia tu **Default domain**: `https://abc123xyz.us-east-1.awsapprunner.com`

---

### 4. Actualizar Frontend

#### Opción A: Ya tienes Amplify configurado

1. Edita [config.js](frontend/static/js/config.js):
   ```javascript
   PROD_CONFIG: {
       API_BASE_URL: 'https://TU-APP-RUNNER-URL.us-east-1.awsapprunner.com'
   }
   ```

2. Commit y push:
   ```bash
   git add frontend/static/js/config.js
   git commit -m "Update API URL for App Runner"
   git push origin PoC_NYX_AWS
   ```

3. Amplify desplegará automáticamente

#### Opción B: Desplegar frontend en Amplify

1. Ve a **AWS Amplify → New app → Host web app**
2. Conecta tu repositorio GitHub
3. Branch: `PoC_NYX_AWS`
4. Build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       build:
         commands:
           - echo "Static files only"
     artifacts:
       baseDirectory: /frontend
       files:
         - '**/*'
   ```
5. Deploy

---

### 5. Actualizar CORS

Vuelve a **App Runner → Configuration → Environment variables**:

Edita:
```
ALLOWED_HOSTS = TU-APP-RUNNER-URL.us-east-1.awsapprunner.com,localhost
CORS_ALLOWED_ORIGINS = https://TU-AMPLIFY-URL.amplifyapp.com,http://localhost:8080
```

Click **Deploy**

---

## Probar la Aplicación

### Verificar Backend

```bash
curl https://TU-APP-RUNNER-URL.us-east-1.awsapprunner.com/api/
# Debería devolver 401 Unauthorized (correcto - necesitas auth)
```

### Verificar Frontend

1. Abre tu URL de Amplify
2. Deberías ser redirigido a Cognito
3. Inicia sesión
4. Deberías ver el chat o admin panel

---

## Troubleshooting

### ❌ Error: "Could not connect to database"

**Solución:**
- Verifica que el Security Group de RDS permita conexiones
- Verifica que `DATABASE_URL` sea correcta
- Revisa los logs de App Runner

### ❌ Error: "CORS error"

**Solución:**
- Asegúrate de que `CORS_ALLOWED_ORIGINS` incluya la URL exacta del frontend (sin `/` al final)
- Redeploy el servicio de App Runner

### ❌ Error: "502 Bad Gateway"

**Solución:**
- App Runner está iniciando (espera 2-3 minutos)
- Revisa los logs de App Runner para ver el error
- Verifica que el puerto sea `8000`

---

## Comandos Útiles

### Ver logs en tiempo real
```bash
aws logs tail /aws/apprunner/chatbot-provefut-backend/application --follow
```

### Forzar nuevo despliegue
```bash
aws apprunner start-deployment --service-arn <ARN>
```

### Ver estado del servicio
```bash
aws apprunner describe-service --service-arn <ARN>
```

---

## Costos Estimados

| Servicio | Costo/mes |
|----------|-----------|
| App Runner (1 vCPU, 2GB) | ~$30 |
| RDS db.t3.micro | ~$15 |
| Amplify Hosting | ~$1 |
| **TOTAL** | **~$46/mes** |

---

## Próximos Pasos (Opcional)

1. ☐ Migrar uploads a S3 (ver [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md))
2. ☐ Configurar dominio personalizado
3. ☐ Implementar Redis/ElastiCache para WebSockets
4. ☐ Configurar alarmas de CloudWatch
5. ☐ Configurar backups automáticos de RDS

---

## Ayuda

- 📖 Guía completa: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- 🔧 Documentación de App Runner: https://docs.aws.amazon.com/apprunner/

**¡Listo! Tu app estará en producción en menos de 15 minutos.**
