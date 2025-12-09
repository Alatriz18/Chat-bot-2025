# ✅ Checklist Pre-Despliegue - AWS App Runner

Antes de desplegar, asegúrate de completar todos estos pasos:

---

## 🔐 Seguridad

- [ ] Generar una `DJANGO_SECRET_KEY` nueva y segura
  ```bash
  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```

- [ ] Verificar que `.env` NO esté en el repositorio Git
  ```bash
  git status
  # .env NO debe aparecer en la lista
  ```

- [ ] Cambiar contraseña de la base de datos RDS si está usando la por defecto

- [ ] Verificar que `DEBUG=False` en producción

- [ ] Configurar `ALLOWED_HOSTS` con el dominio correcto de App Runner

---

## 🗄️ Base de Datos

- [ ] RDS PostgreSQL está corriendo y accesible
  ```bash
  psql "postgresql://postgres:ChatbotProvefut2025!@chatbot-provefut-db.cyfwq6kgermb.us-east-1.rds.amazonaws.com:5432/chatbot_provefut" -c "\l"
  ```

- [ ] Security Group de RDS permite conexiones:
  - Desde `0.0.0.0/0` (temporal) o
  - Desde el Security Group de App Runner (mejor)

- [ ] Backups automáticos están habilitados en RDS

- [ ] Verificar que la tabla `stticket`, `starchivos`, `stlogchat` existan

---

## 🔧 Configuración

- [ ] Todas las variables de entorno están en `.env.example` como referencia

- [ ] `backend/apprunner.yaml` existe y está configurado

- [ ] `backend/start.sh` tiene permisos de ejecución
  ```bash
  chmod +x backend/start.sh
  ```

- [ ] `backend/Dockerfile` está actualizado

- [ ] Archivos necesarios para App Runner están en Git:
  ```bash
  git ls-files | grep -E "(apprunner.yaml|start.sh|Dockerfile|requirements.txt)"
  ```

---

## 🔑 AWS Cognito

- [ ] User Pool existe: `us-east-1_hERvQ0wWv`

- [ ] Usuarios de prueba creados en Cognito

- [ ] Grupos configurados:
  - `admin` o `Administradores` (para admins)

- [ ] URL de callback de Cognito incluye la URL de tu frontend

---

## 📦 Dependencias

- [ ] `backend/requirements.txt` está actualizado
  ```bash
  cd backend
  pip freeze | grep -E "(django|gunicorn|psycopg2)"
  ```

- [ ] Todas las dependencias están especificadas con versiones

- [ ] No hay dependencias innecesarias

---

## 🌐 Frontend

- [ ] `frontend/static/js/config.js` tiene la URL correcta de App Runner
  - O está configurado para usar `window.location.origin` (si usas proxy)

- [ ] Archivos estáticos están en `frontend/`

- [ ] `frontend/nginx.conf` está configurado (si usas Nginx)

- [ ] Decidido dónde hostear el frontend:
  - [ ] AWS Amplify Hosting
  - [ ] S3 + CloudFront
  - [ ] App Runner (segunda instancia)

---

## 🔌 Integraciones

- [ ] Cognito login URL está configurado:
  ```
  https://main.d2ar0ncsvlrfzm.amplifyapp.com/
  ```

- [ ] CORS configurado correctamente para el frontend

- [ ] WebSockets funciona localmente
  ```bash
  # Probar en local primero
  docker-compose up
  # Abrir chat y verificar notificaciones
  ```

---

## 📝 Migraciones

- [ ] Todas las migraciones de Django están creadas
  ```bash
  python backend/manage.py makemigrations --check
  ```

- [ ] Migraciones se aplican correctamente
  ```bash
  python backend/manage.py migrate --plan
  ```

- [ ] `start.sh` ejecuta `migrate` automáticamente

---

## 🧪 Testing Local

- [ ] App corre localmente con Docker Compose
  ```bash
  docker-compose up --build
  ```

- [ ] Backend responde en `http://localhost:8080/api/`

- [ ] Frontend carga en `http://localhost:8080`

- [ ] Puedes crear un ticket de prueba

- [ ] Puedes subir un archivo

- [ ] WebSockets funcionan (notificaciones en admin)

- [ ] Autenticación con Cognito funciona

---

## 📊 Monitoreo (Post-Despliegue)

- [ ] Configurar alarma de CloudWatch para errores 5xx

- [ ] Configurar alarma de CloudWatch para alta latencia

- [ ] Configurar alarma de CloudWatch para CPU/Memoria

- [ ] Dashboard de CloudWatch para métricas clave

---

## 💰 Costos

- [ ] Estimado de costos mensuales: ~$50-75

- [ ] Budget de AWS configurado para alertas

- [ ] Revisado plan de escalamiento (min/max instances)

---

## 🚀 Despliegue

- [ ] Código subido a Git
  ```bash
  git add .
  git commit -m "Configure app for AWS App Runner"
  git push origin PoC_NYX_AWS
  ```

- [ ] Branch `PoC_NYX_AWS` está en GitHub/GitLab

- [ ] README o documentación actualizada

---

## 🔍 Post-Despliegue

Después de desplegar, verifica:

- [ ] App Runner service está en estado "Running"

- [ ] Logs de App Runner no muestran errores críticos

- [ ] Backend responde en la URL de App Runner
  ```bash
  curl https://TU-APP-RUNNER-URL.us-east-1.awsapprunner.com/api/
  # Debe devolver 401 (correcto - necesita auth)
  ```

- [ ] Frontend carga correctamente

- [ ] Autenticación funciona end-to-end

- [ ] Puedes crear un ticket de prueba

- [ ] Puedes subir archivos

- [ ] Admin puede ver y asignar tickets

- [ ] Notificaciones en tiempo real funcionan

---

## 🐛 Rollback Plan

Si algo sale mal:

- [ ] Saber cómo hacer rollback en App Runner:
  ```bash
  aws apprunner list-operations --service-arn <ARN>
  # Identificar el último deployment exitoso
  ```

- [ ] Tener backup de la base de datos RDS

- [ ] Tener versión anterior del código en Git

---

## 📞 Contactos de Emergencia

- AWS Support: https://console.aws.amazon.com/support/
- Documentación de App Runner: https://docs.aws.amazon.com/apprunner/
- Status de AWS: https://status.aws.amazon.com/

---

## 📚 Documentación

- [ ] [QUICK_START.md](QUICK_START.md) - Pasos rápidos de despliegue
- [ ] [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Guía completa paso a paso
- [ ] [backend/.env.example](backend/.env.example) - Variables de entorno necesarias

---

**¡Cuando todos los checkboxes estén marcados, estás listo para desplegar!** 🚀

---

## Comando Final

```bash
# 1. Verificar todo
git status

# 2. Subir al repositorio
git add .
git commit -m "Ready for AWS App Runner deployment"
git push origin PoC_NYX_AWS

# 3. Ir a AWS Console → App Runner → Create service
# 4. Seguir los pasos en QUICK_START.md
```

---

**Tiempo estimado de despliegue:** 15-20 minutos
**Dificultad:** Media
**Conocimientos necesarios:** AWS básico, Git, Docker conceptos

¡Éxito! 🎉
