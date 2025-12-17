from rest_framework import serializers
from .models import Stticket, Starchivos, Stlogchat
import boto3
from django.conf import settings

# --- 1. ARCHIVOS ---
class ArchivoSerializer(serializers.ModelSerializer):
    archivo_url_firmada = serializers.SerializerMethodField()
    archivo_tam_formateado = serializers.SerializerMethodField()

    class Meta:
        model = Starchivos
        fields = [
            'archivo_cod_archivo', 'archivo_cod_ticket', 'archivo_nom_archivo',
            'archivo_tip_archivo', 'archivo_rut_archivo', 'archivo_url_firmada', 
            'archivo_tam_formateado', 'archivo_fec_archivo', 'archivo_usua_archivo'
        ]

    def get_archivo_tam_formateado(self, obj):
        if obj.archivo_tam_archivo:
            tam = obj.archivo_tam_archivo
            for unit in ['B', 'KB', 'MB', 'GB']:
                if tam < 1024: return f"{tam:.2f} {unit}"
                tam /= 1024
        return "0 B"

    def get_archivo_url_firmada(self, obj):
        if not obj.archivo_rut_archivo: return None
        try:
            key = obj.archivo_rut_archivo
            if key.startswith('http'): key = key.split('.com/')[-1]
            
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            return s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
                ExpiresIn=3600
            )
        except: return None

# --- 2. TICKETS ---
class StticketSerializer(serializers.ModelSerializer):
    archivos = serializers.SerializerMethodField()

    class Meta:
        model = Stticket
        fields = '__all__'

    def get_archivos(self, obj):
        """
        obj: Es el objeto Ticket actual (ej. el ticket con ticket_cod_ticket=8)
        """
        try:
            # 1. Obtenemos el ID exacto del ticket actual (el 8, el 17, etc.)
            id_del_ticket = obj.ticket_cod_ticket
            
            # DEBUG: Imprimir para ver qué está buscando (míralo en los logs de App Runner)
            # print(f"🔎 Buscando archivos para ticket_cod_ticket: {el_id_del_ticket}")

            # 2. Filtramos la tabla de archivos buscando EXACTAMENTE ese número
            # Usamos 'archivo_cod_ticket' que es tu columna ForeignKey
            qs = Starchivos.objects.filter(archivo_cod_ticket=id_del_ticket).order_by('-archivo_fec_archivo')
            
            return ArchivoSerializer(qs, many=True).data
        except Exception as e:
            print(f"Error buscando archivos: {e}")
            return []

# --- 3. LOGS ---
class LogChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stlogchat
        fields = '__all__'
        read_only_fields = ('log_cod_log', 'log_fec_log')