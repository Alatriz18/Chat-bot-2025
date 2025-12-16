from rest_framework import serializers
from .models import Stticket, Starchivos, Stlogchat
import boto3
from django.conf import settings

# 1. Serializador de Archivos (El nuevo que hicimos, ESTÁ PERFECTO)
class ArchivoSerializer(serializers.ModelSerializer):
    archivo_url_firmada = serializers.SerializerMethodField()
    archivo_tam_formateado = serializers.SerializerMethodField()

    class Meta:
        model = Starchivos
        fields = [
            'archivo_cod_archivo',
            'archivo_cod_ticket',
            'archivo_nom_archivo',
            'archivo_tip_archivo',
            'archivo_rut_archivo', 
            'archivo_url_firmada', 
            'archivo_tam_formateado',
            'archivo_fec_archivo',
            'archivo_usua_archivo'
        ]

    def get_archivo_tam_formateado(self, obj):
        if obj.archivo_tam_archivo:
            tam = obj.archivo_tam_archivo
            for unit in ['B', 'KB', 'MB', 'GB']:
                if tam < 1024:
                    return f"{tam:.2f} {unit}"
                tam /= 1024
        return "0 B"

    def get_archivo_url_firmada(self, obj):
        if not obj.archivo_rut_archivo:
            return None
        try:
            key = obj.archivo_rut_archivo
            if key.startswith('http'):
                key = key.split('.com/')[-1]

            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': key
                },
                ExpiresIn=3600
            )
            return url
        except Exception as e:
            print(f"Error generando URL firmada: {e}")
            return None

# 2. Serializador de Tickets
class StticketSerializer(serializers.ModelSerializer):
    # Incluimos los archivos anidados para verlos al cargar el ticket
    archivos = ArchivoSerializer(many=True, read_only=True, source='starchivos_set') 
    # OJO: verifica si en tu models.py el related_name es 'starchivos_set' o algo diferente.
    # Si no estás seguro, puedes quitar la línea de arriba por ahora.

    class Meta:
        model = Stticket
        fields = '__all__'

# 3. Serializador de Logs (Logs de Interacción)
class LogChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stlogchat
        fields = '__all__'
        read_only_fields = ('log_cod_log', 'log_fec_log')