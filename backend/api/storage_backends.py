# storage_backends.py
from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings

class MediaStorage(S3Boto3Storage):
    location = 'media'
    file_overwrite = False
    default_acl = 'private'
    
    def __init__(self, *args, **kwargs):
        kwargs['custom_domain'] = settings.AWS_S3_CUSTOM_DOMAIN
        super().__init__(*args, **kwargs)
    
    def url(self, name, parameters=None, expire=None):
        # Generar URL firmada para archivos privados
        if expire is None:
            expire = 3600  # 1 hora por defecto
        
        return super().url(name, parameters=parameters, expire=expire)

class NotificationSoundStorage(S3Boto3Storage):
    location = 'notification_sounds'
    file_overwrite = False
    default_acl = 'private'