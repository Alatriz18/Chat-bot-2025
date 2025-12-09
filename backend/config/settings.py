"""
Configuración de Django para Arquitectura Limpia (Django Auth + React)
"""
import os
import dj_database_url
from datetime import timedelta
from dotenv import load_dotenv
from pathlib import Path
import redis
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'tu-clave-secreta-local')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['*']

# --- APLICACIONES ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth', # <--- Sistema de usuarios de Django (Vital)
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Terceros
    'rest_framework',
    'rest_framework.authtoken', # Necesario para dj-rest-auth
    'corsheaders',
    'channels',
    
    # Auth & JWT (NUEVOS - Reemplazan a Cognito)
    'dj_rest_auth',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'dj_rest_auth.registration',
    
    # Tu App
    'api',
]

SITE_ID = 1 # Requerido por allauth

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # ¡CORS va primero!
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware', # Autenticación
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware', # Requerido por allauth
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request', # Requerido por allauth
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

DATABASES = {
    'default': dj_database_url.config(default=os.getenv('DATABASE_URL'))
}

# --- AUTENTICACIÓN Y JWT (NUEVO) ---
# Aquí estaba tu error. Quitamos 'api.authentication.CognitoAuthentication'
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication', # Auth vía JWT
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated', # Todo protegido por defecto
    )
}

# Configuración de JWT para dj-rest-auth
REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'chatbot-auth',
    'JWT_AUTH_REFRESH_COOKIE': 'chatbot-refresh',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# --- CORS (Conexión con React) ---
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173", # Puerto estándar de Vite (React)
    "http://localhost:3000", # Puerto estándar de CRA
    "http://172.20.8.70:3000", # TU IP LOCAL
    "http://frontend:80", # Nombre del servicio en Docker
]

# O para desarrollo, permitir todos (NO en producción)
CORS_ALLOW_ALL_ORIGINS = True  # AÑADE ESTA LÍNEA TEMPORALMENTE
CORS_ALLOW_CREDENTIALS = True

# Canales y Archivos
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

LANGUAGE_CODE = 'es-ec'
TIME_ZONE = 'America/Guayaquil'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'uploads')
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Configuración para Channels con Redis
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(os.getenv('REDIS_URL', 'redis://localhost:6379'))],
        },
    },
}

# Configuración para archivos estáticos en contenedores
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_S3_BUCKET')
AWS_S3_REGION_NAME = os.getenv('AWS_REGION', 'us-east-1')
AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}

# Usar S3 para media files en producción
if not DEBUG:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'

# Tamaño máximo de archivos (16MB)
MAX_FILE_SIZE = 16 * 1024 * 1024

# Configuración para notification sounds
NOTIFICATION_SOUNDS_DIR = os.path.join(MEDIA_ROOT, 'notification_sounds')
os.makedirs(NOTIFICATION_SOUNDS_DIR, exist_ok=True)


# Configuración AWS S3
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME', 'provefut-chatbot-files-2025')
AWS_S3_REGION_NAME = os.getenv('AWS_REGION', 'us-east-1')
AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com'

AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = 'private'
AWS_QUERYSTRING_AUTH = True  # IMPORTANTE: URLs firmadas
AWS_S3_SIGNATURE_VERSION = 's3v4'

# Usar S3 para archivos
#DEFAULT_FILE_STORAGE = 'api.storage_backends.MediaStorage'

# Usar S3 para media files en producción
if os.getenv('USE_S3', 'False').lower() == 'true':
    DEFAULT_FILE_STORAGE = 'api.storage_backends.MediaStorage'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
else:
    # Usar sistema de archivos local en desarrollo
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'uploads')

# Tamaño máximo de archivos (16MB)
MAX_FILE_SIZE = 16 * 1024 * 1024

# Configuración para notification sounds
NOTIFICATION_SOUNDS_DIR = 'notification_sounds'