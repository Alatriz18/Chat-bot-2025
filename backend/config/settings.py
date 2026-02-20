"""
Configuración de Django para Arquitectura Limpia (Django Auth + React)
PRODUCCIÓN - AWS APP RUNNER
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
DEBUG = os.getenv('DEBUG', 'False') == 'True' # Por defecto False en prod

# Permitir tu dominio de App Runner y localhost
ALLOWED_HOSTS = ['*', 'eipaj4pzfp.us-east-1.awsapprunner.com']

# --- APLICACIONES ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Terceros
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'channels',
    
    # Auth & JWT
    'dj_rest_auth',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'dj_rest_auth.registration',
    
    # Tu App
    'api',
]

SITE_ID = 1

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # 1. CORS siempre primero
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', # 2. Archivos estáticos
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
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
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

DATABASES = {
    'default': dj_database_url.config(default=os.getenv('DATABASE_URL'))
}

# --- SEGURIDAD HTTPS Y COOKIES (VITAL PARA APP RUNNER) ---
# Como usas JWT en Cookies, esto es obligatorio para que funcione en Chrome/HTTPS
# Configurar cookies para cross-domain
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'None'
CSRF_COOKIE_SAMESITE = 'None'

# --- CORS & CSRF ---
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://main.dvc5a0uzbx1ld.amplifyapp.com",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

# Headers necesarios para que Axios envíe cookies
from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-csrftoken',
]

CSRF_TRUSTED_ORIGINS = [
    "https://eipaj4pzfp.us-east-1.awsapprunner.com",
    "https://main.dvc5a0uzbx1ld.amplifyapp.com",
]

# --- AUTENTICACIÓN ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'api.authentication.SSOAuthentication', # Tu clase personalizada
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ]
}

REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'chatbot-auth',
    'JWT_AUTH_REFRESH_COOKIE': 'chatbot-refresh',
    'JWT_AUTH_SAMESITE': 'None',
    'JWT_AUTH_SECURE': True,
    'JWT_AUTH_HTTPONLY': True, # Mejor True para seguridad, el backend lee la cookie
}
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# --- CANALES (WebSockets) ---
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

if os.getenv("REDIS_URL"):
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [os.getenv("REDIS_URL")],
            },
        },
    }
else:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# --- CONFIGURACIÓN GENERAL ---
LANGUAGE_CODE = 'es-ec'
TIME_ZONE = 'America/Guayaquil'
USE_I18N = True
USE_TZ = False
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- ARCHIVOS ESTÁTICOS Y MEDIA (AWS S3) ---
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME')
AWS_S3_REGION_NAME = os.getenv('AWS_REGION', 'us-east-1')

# URLs
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Configuración S3 optimizada
if AWS_ACCESS_KEY_ID and AWS_STORAGE_BUCKET_NAME:
    AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = 'private'
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    
    # Usar S3 para Media
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
else:
    # Fallback local
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'uploads')

MAX_FILE_SIZE = 16 * 1024 * 1024
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO', # OJO: Si sigue sin salir, cámbialo a 'DEBUG'
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.request': { # Este captura los errores 500
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'api': {  # Tu aplicación
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True,
        }
    },
}