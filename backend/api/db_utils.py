import psycopg2
import psycopg2.extras
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def get_postgres_connection():
    """Obtener conexión a PostgreSQL usando la configuración de Django"""
    try:
        # Obtener la URL de conexión directamente
        database_url = settings.DATABASES['default']['URL'] if 'URL' in settings.DATABASES['default'] else None
        
        if database_url:
            # Usar la URL directamente
            return psycopg2.connect(database_url)
        else:
            # Fallback: construir desde campos individuales
            return psycopg2.connect(
                dbname=settings.DATABASES['default']['NAME'],
                user=settings.DATABASES['default']['USER'],
                password=settings.DATABASES['default']['PASSWORD'],
                host=settings.DATABASES['default']['HOST'],
                port=settings.DATABASES['default']['PORT']
            )
    except Exception as e:
        logger.error(f"Error de conexión a PostgreSQL: {e}")
        return None

def format_file_size(size_bytes):
    """Convertir bytes a formato legible"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names)-1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f} {size_names[i]}"