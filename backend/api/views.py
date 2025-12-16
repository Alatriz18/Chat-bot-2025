from rest_framework import viewsets, views, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.http import FileResponse, Http404, HttpResponseRedirect
from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import redirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import traceback
import os
import uuid
import datetime
import boto3
from botocore.exceptions import ClientError

# Importaciones de tu proyecto
from .storage_backends import MediaStorage, NotificationSoundStorage
from .models import Stticket, Starchivos, Stlogchat, Stadmin
from .serializers import TicketSerializer, ArchivoSerializer, LogChatSerializer

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

# --- VISTA DE SINCRONIZACIÓN DE COOKIE (CRÍTICA PARA AUTH) ---
@method_decorator(csrf_exempt, name='dispatch')
class SetAuthCookieView(views.APIView):
    """
    Recibe el token del Frontend (SSO) y lo planta en una Cookie HttpOnly segura.
    """
    permission_classes = [AllowAny] 
    authentication_classes = []
    
    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token no proporcionado'}, status=status.HTTP_400_BAD_REQUEST)

        response = Response({'success': True, 'message': 'Cookie establecida'})
        cookie_name = getattr(settings, 'JWT_AUTH_COOKIE', 'chatbot-auth')
        
        response.set_cookie(
            key=cookie_name,
            value=token,
            httponly=True,
            secure=True,
            samesite='None', 
            max_age=7 * 24 * 60 * 60
        )
        return response

# --- GESTIÓN DE SUBIDAS S3 ---

class GeneratePresignedUrlView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, ticket_id):
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            
            filename = request.data.get('filename')
            filetype = request.data.get('filetype')
            filesize = int(request.data.get('filesize', 0))
            
            MAX_SIZE = 16 * 1024 * 1024 # 16MB
            if filesize > MAX_SIZE:
                return Response({'error': f'Archivo demasiado grande. Máximo {MAX_SIZE/1024/1024}MB'}, status=status.HTTP_400_BAD_REQUEST)
            
            file_extension = filename.split('.')[-1] if '.' in filename else ''
            unique_filename = f"{uuid.uuid4()}.{file_extension}" if file_extension else str(uuid.uuid4())
            # Guardamos dentro de la carpeta del ticket
            s3_key = f"chatbot-uploads/tickets/{ticket_id}/{unique_filename}"
            
            presigned_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': s3_key,
                    'ContentType': filetype,
                    'Metadata': {
                        'uploaded-by': request.user.username,
                        'original-filename': filename,
                        'ticket-id': str(ticket_id)
                    }
                },
                ExpiresIn=3600
            )
            
            # Nota: Esta URL de descarga directa probablemente sea privada, 
            # el frontend debe usar la URL firmada que viene en el Serializer.
            download_url = f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{s3_key}"
            
            return Response({
                'upload_url': presigned_url,
                'download_url': download_url,
                's3_key': s3_key,
                'filename': filename,
                'expires_in': 3600
            })
            
        except ClientError as e:
            return Response({'error': f'Error de S3: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ConfirmUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, ticket_id):
        print(f"\n🔍 INICIO CONFIRMACIÓN - TICKET {ticket_id}")
        try:
            s3_key = request.data.get('s3_key')
            filename = request.data.get('filename')
            filetype = request.data.get('filetype')
            
            try:
                filesize = int(request.data.get('filesize', 0))
            except:
                filesize = 0
            
            short_filetype = (filetype.split('/')[-1] if '/' in filetype else filetype)[:90]
            username = request.data.get('username') or request.user.username

            try:
                # Buscamos por PK (ID numérico) o por ID de ticket (TKT-...)
                if str(ticket_id).isdigit():
                    ticket = Stticket.objects.get(pk=ticket_id)
                else:
                    ticket = Stticket.objects.get(ticket_id_ticket=ticket_id)
            except Stticket.DoesNotExist:
                return Response({'error': 'Ticket no encontrado'}, status=404)
            
            # Guardar DIRECTO en Base de Datos
            archivo = Starchivos.objects.create(
                archivo_cod_ticket=ticket,
                archivo_nom_archivo=filename,
                archivo_tip_archivo=short_filetype,
                archivo_tam_archivo=filesize,
                archivo_rut_archivo=s3_key, # Guardamos la KEY de S3
                archivo_usua_archivo=username
            )
            
            print(f"✅ ¡ARCHIVO GUARDADO EN BDD! ID: {archivo.archivo_cod_archivo}")
            
            return Response({
                'success': True,
                'file_id': archivo.archivo_cod_archivo,
                'filename': filename,
                'file_url': f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{s3_key}",
            })
            
        except Exception as e:
            print(f"🔥🔥🔥 ERROR BDD AL GUARDAR ARCHIVO: {str(e)}")
            traceback.print_exc()
            return Response({'error': f'Error guardando en BDD: {str(e)}'}, status=500)

# --- ViewSet para Tickets ---

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Stticket.objects.all().order_by('-ticket_fec_ticket')
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'pk' 

    def get_queryset(self):
        username_param = self.request.query_params.get('username')
        user = self.request.user

        if not user.is_staff:
             return Stticket.objects.filter(ticket_tusua_ticket=user.username).order_by('-ticket_fec_ticket')

        if username_param:
            return Stticket.objects.filter(ticket_tusua_ticket=username_param).order_by('-ticket_fec_ticket')
        
        return Stticket.objects.all().order_by('-ticket_fec_ticket')

    def perform_create(self, serializer):
        try:
            data = self.request.data
            context_data = data.get('context', {})
            user = self.request.user 
            
            username_from_token = user.username
            user_code_from_token = user.id 

            preferred_admin = data.get('preferred_admin')
            assigned_to = preferred_admin if (preferred_admin and preferred_admin != 'none') else None

            problem_description = context_data.get('problemDescription', 'N/A')
            final_options_tried = context_data.get('finalOptionsTried', [])
            
            options_text = ""
            if final_options_tried:
                options_text += "\n\n--- Opciones Finales Intentadas sin Éxito ---\n"
                for option in final_options_tried:
                    options_text += f"- {option}\n"

            final_description = f"{problem_description}{options_text}"
            
            ticket_id_str = f"TKT-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"
            
            categoria_key = context_data.get('categoryKey', '')
            tipo_ticket = 'Software' if 'software' in categoria_key.lower() else 'Hardware'

            instance = serializer.save(
                ticket_des_ticket=final_description,
                ticket_id_ticket=ticket_id_str,
                ticket_tip_ticket=tipo_ticket,
                ticket_est_ticket='PE',
                ticket_asu_ticket=context_data.get('subcategoryKey', 'Sin asunto'),
                ticket_tusua_ticket=username_from_token,
                ticket_cie_ticket=user_code_from_token,
                ticket_asignado_a=assigned_to,
                ticket_preferencia_usuario=preferred_admin
            )
            
            # Notificaciones Websocket
            if assigned_to:
                try:
                    notification_data = {
                        'type': 'new_ticket', 
                        'title': '🎫 Nuevo Ticket Asignado',
                        'message': f'Se te ha asignado el ticket: {ticket_id_str}',
                        'ticket_id': ticket_id_str, 
                        'assigned_to': assigned_to,
                        'user': username_from_token,
                        'subject': context_data.get('subcategoryKey', 'Sin asunto'),
                        'timestamp': datetime.datetime.now().isoformat(),
                        'category': tipo_ticket
                    }
                    channel_layer = get_channel_layer()
                    async_to_sync(channel_layer.group_send)(
                        f'notifications_{assigned_to}', 
                        {'type': 'send.notification', 'data': notification_data}
                    )
                except Exception as e:
                    print(f"⚠️ Error enviando notificación: {e}")

        except Exception as e:
            traceback.print_exc()
            from rest_framework.exceptions import APIException
            raise APIException(f"Error BDD: {str(e)}")

    @action(detail=True, methods=['get'])
    def files(self, request, pk=None):
        """ Devuelve los archivos de UN ticket específico """
        ticket = self.get_object()
        archivos = Starchivos.objects.filter(archivo_cod_ticket=ticket).order_by('-archivo_fec_archivo')
        serializer = ArchivoSerializer(archivos, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def rate(self, request, pk=None):
        ticket = self.get_object()
        ticket.ticket_calificacion = request.data.get('rating')
        ticket.save()
        return Response({"success": True, "message": "Calificación guardada"})

# --- ViewSet para Archivos (CORREGIDO) ---

class ArchivoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para manejar archivos.
    CORRECCIÓN: Incluye filtrado por ?ticket= y generación de URLs firmadas.
    """
    queryset = Starchivos.objects.all()
    serializer_class = ArchivoSerializer
    lookup_field = 'archivo_cod_archivo'
    permission_classes = [permissions.IsAuthenticated]

    # 🔥 CORRECCIÓN 1: Filtrar por ticket para evitar que salgan todos los archivos
    def get_queryset(self):
        queryset = super().get_queryset()
        ticket_param = self.request.query_params.get('ticket')
        
        if ticket_param:
            # Filtramos por el ID visual (TKT-...) o el ID numérico si aplica
            return queryset.filter(archivo_cod_ticket__ticket_id_ticket=ticket_param)
        
        return queryset

    # 🔥 CORRECCIÓN 2: Generar URL firmada para descargas directas
    @action(detail=True, methods=['get'])
    def download(self, request, archivo_cod_archivo=None):
        archivo = self.get_object()
        try:
            # Generamos una URL firmada al vuelo (válida por 1 hora)
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            
            key = archivo.archivo_rut_archivo
            if key.startswith('http'):
                key = key.split('.com/')[-1] # Limpiar si guardaste URL completa

            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': key
                },
                ExpiresIn=3600
            )
            
            # Redireccionamos al usuario a la URL firmada de AWS
            return HttpResponseRedirect(url)
            
        except Exception as e:
            return Response({"error": f"Error al generar enlace de descarga: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def view(self, request, archivo_cod_archivo=None):
        return self.download(request, archivo_cod_archivo)

# --- ViewSet para Logs del Chat ---

class LogChatViewSet(viewsets.ModelViewSet):
    queryset = Stlogchat.objects.all()
    serializer_class = LogChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(username=self.request.user.username)

# --- Vistas para Admin y Otros ---

class LogSolvedTicketView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        try:
            data = request.data
            context = data.get('context', {})
            user = request.user 
            
            ticket_id_str = f"TKT-SOL-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"
            categoria_key = context.get('categoryKey', '')
            tipo_ticket = 'Software' if 'software' in categoria_key.lower() else 'Hardware'
            
            Stticket.objects.create(
                ticket_des_ticket="Resuelto por el usuario a través del Asistente Virtual.",
                ticket_id_ticket=ticket_id_str,
                ticket_tip_ticket=tipo_ticket,
                ticket_est_ticket='FN', 
                ticket_asu_ticket=context.get('subcategoryKey', 'Sin asunto'),
                ticket_tusua_ticket=user.username,
                ticket_cie_ticket=str(user.id)
            )
            return Response({"success": True, "ticket_id": ticket_id_str}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AdminListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            admins_db = Stadmin.objects.filter(admin_activo=True)
            admins = []
            for admin in admins_db:
                nombre_completo = admin.admin_username
                if admin.admin_nombres or admin.admin_apellidos:
                    nombre_completo = f"{admin.admin_nombres or ''} {admin.admin_apellidos or ''}".strip()

                admins.append({
                    'username': admin.admin_username, 
                    'email': admin.admin_correo,
                    'nombreCompleto': nombre_completo,
                    'rol': admin.admin_rol
                })
            
            if not admins:
                if request.user.is_staff:
                    admins = [{'username': request.user.username, 'nombreCompleto': 'Tú mismo'}]
                else:
                    admins = [{'username': 'Soporte TI', 'nombreCompleto': 'Soporte General'}]
                
            return Response(admins)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class AdminTicketListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        tickets = Stticket.objects.all().order_by('-ticket_fec_ticket')
        serializer = TicketSerializer(tickets, many=True)
        return Response(serializer.data)

class AdminTicketDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        try:
            ticket = Stticket.objects.get(pk=pk)
            serializer = TicketSerializer(ticket)
            return Response(serializer.data)
        except Stticket.DoesNotExist:
            return Response({"error": "Ticket no encontrado"}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        return self.put(request, pk)

    def put(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ticket = Stticket.objects.get(pk=pk)
            data = request.data
            
            status_val = data.get('status') or data.get('ticket_est_ticket')
            if status_val:
                ticket.ticket_est_ticket = status_val
            
            usuario = data.get('ticket_tusua_ticket')
            if usuario:
                ticket.ticket_tusua_ticket = usuario

            if 'ticket_asignado_a' in data:
                ticket.ticket_asignado_a = data['ticket_asignado_a']
            
            obs = data.get('observation') or data.get('ticket_obs_ticket')
            if obs:
                ticket.ticket_obs_ticket = obs

            ticket.save()
            
            return Response({
                "success": True, 
                "message": "Ticket actualizado",
                "ticket": TicketSerializer(ticket).data
            })

        except Stticket.DoesNotExist:
            return Response({"error": "Ticket no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ReassignTicketView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ticket = Stticket.objects.get(pk=pk)
            new_username = request.data.get('username')
            
            if not new_username:
                return Response({"error": "Username requerido"}, status=status.HTTP_400_BAD_REQUEST)
            
            ticket.ticket_tusua_ticket = new_username
            ticket.save()
            
            return Response({
                "success": True, 
                "message": f"Ticket reasignado a {new_username}",
                "ticket": TicketSerializer(ticket).data
            })
            
        except Stticket.DoesNotExist:
            return Response({"error": "Ticket no encontrado"}, status=status.HTTP_404_NOT_FOUND)

class AssignAdminView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ticket = Stticket.objects.get(pk=pk)
            admin_username = request.data.get('admin_username')
            
            ticket.ticket_asignado_a = admin_username or None
            ticket.save()
            
            return Response({
                "success": True, 
                "message": f"Ticket asignado a {admin_username}",
                "ticket": TicketSerializer(ticket).data
            })            
        except Stticket.DoesNotExist:
            return Response({"error": "Ticket no encontrado"}, status=status.HTTP_404_NOT_FOUND)  

# --- NOTIFICACIONES ---

class NotificationSoundUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            if 'sound' not in request.FILES:
                return Response({"error": "No se encontró el archivo"}, status=400)

            sound_file = request.FILES['sound']
            username = request.user.username

            file_extension = sound_file.name.split('.')[-1].lower()
            unique_filename = f"custom_notification.{file_extension}"
            s3_path = f"notification_sounds/{username}/{unique_filename}"
            
            storage = NotificationSoundStorage()
            filename = storage.save(s3_path, sound_file)
            file_url = storage.url(filename)

            return Response({
                "success": True,
                "filePath": file_url,
                "s3_key": filename
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class NotificationSoundDeleteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            username = request.user.username
            storage = NotificationSoundStorage()
            
            extensions = ['mp3', 'wav', 'ogg', 'm4a']
            for ext in extensions:
                try:
                    path = f"notification_sounds/{username}/custom_notification.{ext}"
                    storage.delete(path)
                except: pass

            return Response({"success": True})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class CheckNotificationSoundView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            username = request.user.username
            s3 = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            
            prefix = f"notification_sounds/{username}/custom_notification."
            
            response = s3.list_objects_v2(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Prefix=prefix,
                MaxKeys=1
            )
            
            if 'Contents' in response:
                file_key = response['Contents'][0]['Key']
                file_url = f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{file_key}"
                return Response({
                    "success": True,
                    "hasCustomSound": True,
                    "soundPath": file_url
                })
            else:
                return Response({"success": True, "hasCustomSound": False})

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class DebugTokenView(views.APIView):
    permission_classes = []
    def get(self, request):
        return Response({"status": "online", "message": "Debug endpoint ready"}, status=200)
    
    def post(self, request):
        # ... tu código de debug (lo he omitido por brevedad pero puedes dejarlo si lo usas) ...
        return Response({"status": "ok"})