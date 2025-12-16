from rest_framework import serializers
from .models import Stticket, Starchivos, Stlogchat
import boto3
from django.conf import settings

class ArchivoSerializer(serializers.ModelSerializer):
    # Creamos un campo calculado que NO existe en la BD, se genera al vuelo
    archivo_url_firmada = serializers.SerializerMethodField()
    archivo_tam_formateado = serializers.SerializerMethodField()

    class Meta:
        model = Starchivos
        fields = [
            'archivo_cod_archivo',
            'archivo_cod_ticket',
            'archivo_nom_archivo',
            'archivo_tip_archivo',
            'archivo_rut_archivo', # Esta es la ruta cruda (la que ves en la BD)
            'archivo_url_firmada', # <--- ESTE ES EL LINK QUE USARÁ TU FRONTEND
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
        """
        Toma la ruta 'chatbot-uploads/...' de la BD y le pide a AWS
        un link temporal válido por 1 hora.
        """
        if not obj.archivo_rut_archivo:
            return None

        try:
            # 1. Obtenemos la KEY limpia
            key = obj.archivo_rut_archivo
            
            # (Seguro por si acaso alguna vez guardaste la URL entera por error)
            if key.startswith('http'):
                key = key.split('.com/')[-1]

            # 2. Configurar cliente S3
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )

            # 3. Generar la URL firmada (Presigned URL)
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': key
                },
                ExpiresIn=3600 # El enlace dura 1 hora
            )
            return url
            
        except Exception as e:
            print(f"Error generando URL firmada para {obj.archivo_nom_archivo}: {e}")
            return None
# Serializador para Stlogchat (Logs de Interacción)
class LogChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stlogchat
        fields = '__all__'
        read_only_fields = ('log_cod_log', 'log_fec_log')