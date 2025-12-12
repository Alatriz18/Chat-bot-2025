from rest_framework import serializers
from .models import Stticket, Starchivos, Stlogchat # Importa desde tus models.py

# Serializador para el modelo Stticket (Tickets)
class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stticket
        # 'pk' es un alias para la llave primaria (ticket_cod_ticket)
        fields = ['ticket_cod_ticket', 'ticket_id_ticket', 'ticket_des_ticket', 'ticket_tip_ticket', 
                  'ticket_est_ticket', 'ticket_asu_ticket', 'ticket_fec_ticket', 
                  'ticket_tusua_ticket', 'ticket_cie_ticket', 'ticket_asignado_a', 
                  'ticket_preferencia_usuario', 'ticket_calificacion','ticket_treal_ticket',
            'ticket_obs_ticket']
        read_only_fields = ('ticket_cod_ticket', 'ticket_fec_ticket')


# Serializador para el modelo Starchivos (Archivos Adjuntos)
class ArchivoSerializer(serializers.ModelSerializer):
    archivo_tam_formateado = serializers.SerializerMethodField()
    archivo_fec_formateada = serializers.DateTimeField(source='archivo_fec_archivo', format='%Y-%m-%d %H:%M:%S', read_only=True)

    class Meta:
        model = Starchivos
        fields = [
            'archivo_cod_archivo', 
            'archivo_nom_archivo', 
            'archivo_tip_archivo', 
            'archivo_tam_archivo', 
            'archivo_usua_archivo', 
            'archivo_fec_archivo',
            'archivo_tam_formateado', # Campo personalizado
            'archivo_fec_formateada'  # Campo personalizado
        ]
        read_only_fields = ('archivo_cod_archivo', 'archivo_fec_archivo')

    def get_archivo_tam_formateado(self, obj):
        size_bytes = obj.archivo_tam_archivo
        if size_bytes == 0:
            return "0 B"
        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names)-1:
            size_bytes /= 1024.0
            i += 1
        return f"{size_bytes:.1f} {size_names[i]}"

# Serializador para Stlogchat (Logs de Interacción)
class LogChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stlogchat
        fields = '__all__'
        read_only_fields = ('log_cod_log', 'log_fec_log')