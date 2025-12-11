from rest_framework import viewsets, views, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import FileResponse, Http404
from django.conf import settings
from django.contrib.auth.models import User # Importamos el modelo de usuario de Django
import os
import uuid
import mimetypes
import datetime
from .storage_backends import MediaStorage, NotificationSoundStorage
import boto3
from botocore.exceptions import ClientError

from .models import Stticket, Starchivos, Stlogchat, Stadmin
from .serializers import TicketSerializer, ArchivoSerializer, LogChatSerializer

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

# NOTA: VerifyAuthView ha sido ELIMINADA. 
# React usará '/api/auth/user/' (provisto por dj-rest-auth) para obtener los datos del usuario.

# --- ViewSet para Tickets ---



class GeneratePresignedUrlView(views.APIView):
    """Genera URL firmada para subida directa desde frontend a S3"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, ticket_id):
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            
            # Datos del archivo
            filename = request.data.get('filename')
            filetype = request.data.get('filetype')
            filesize = int(request.data.get('filesize', 0))
            
            # Validar tamaño (16MB máximo)
            MAX_SIZE = 16 * 1024 * 1024
            if filesize > MAX_SIZE:
                return Response({'error': f'Archivo demasiado grande. Máximo {MAX_SIZE/1024/1024}MB'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Generar ruta única en S3
            import uuid
            file_extension = filename.split('.')[-1] if '.' in filename else ''
            unique_filename = f"{uuid.uuid4()}.{file_extension}" if file_extension else str(uuid.uuid4())
            s3_key = f"chatbot-uploads/tickets/{ticket_id}/{unique_filename}"
            
            # Generar URL firmada para PUT (subida)
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
                ExpiresIn=3600  # 1 hora para subir
            )
            
            # URL para GET (descarga/view)
            download_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': s3_key,
                },
                ExpiresIn=604800  # 7 días para ver/descargar
            )
            
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
    """Confirma que el archivo fue subido y lo registra en BD"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, ticket_id):
        try:
            s3_key = request.data.get('s3_key')
            filename = request.data.get('filename')
            filetype = request.data.get('filetype')
            filesize = request.data.get('filesize')
            username = request.data.get('username')  # ✅ Agrega este campo
            
            # Verificar que el archivo existe en S3
            s3_client = boto3.client('s3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )
            
            try:
                # Verificar que el archivo existe
                s3_client.head_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=s3_key
                )
                
                # Obtener el ticket
                try:
                    ticket = Stticket.objects.get(pk=ticket_id)
                except Stticket.DoesNotExist:
                    return Response({'error': 'Ticket no encontrado'}, status=status.HTTP_404_NOT_FOUND)
                
                # Guardar en base de datos - USANDO TU MODELO Starchivos
                archivo = Starchivos.objects.create(
                    archivo_cod_ticket=ticket,
                    archivo_nom_archivo=filename,
                    archivo_tip_archivo=filetype.split('/')[-1] if '/' in filetype else filetype,
                    archivo_tam_archivo=filesize,
                    archivo_rut_archivo=s3_key,  # ✅ Guardamos la ruta S3 completa
                    archivo_usua_archivo=username or request.user.username
                )
                
                # Generar URL de descarga temporal
                download_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                        'Key': s3_key,
                    },
                    ExpiresIn=604800  # 7 días
                )
                
                return Response({
                    'success': True,
                    'file_id': archivo.archivo_cod_archivo,
                    'filename': filename,
                    'file_url': download_url,
                    's3_key': s3_key
                })
                
            except s3_client.exceptions.NoSuchKey:
                return Response({'error': 'Archivo no encontrado en S3'}, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Stticket.objects.all().order_by('-ticket_fec_ticket')
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'pk' 

    def get_queryset(self):
        username_param = self.request.query_params.get('username')
        user = self.request.user # Este es ahora un usuario estándar de Django

        # En Django, 'is_staff' indica si es administrador/staff
        if not user.is_staff:
             # Filtramos por el username del usuario logueado
             return Stticket.objects.filter(ticket_tusua_ticket=user.username).order_by('-ticket_fec_ticket')

        # Si es admin, puede filtrar por usuario o ver todos
        if username_param:
            return Stticket.objects.filter(ticket_tusua_ticket=username_param).order_by('-ticket_fec_ticket')
        
        return Stticket.objects.all().order_by('-ticket_fec_ticket')

    def perform_create(self, serializer):
        data = self.request.data
        context_data = data.get('context', {})
        user = self.request.user 
        
        # Usamos los atributos estándar de Django User
        username_from_token = user.username
        # Usamos el ID numérico de Django como código de usuario
        user_code_from_token = str(user.id) 

        preferred_admin = data.get('preferred_admin')
        assigned_to = None

        if preferred_admin and preferred_admin != 'none':
            assigned_to = preferred_admin
            print(f"Ticket asignado por preferencia a: {assigned_to}")
        else:
            print("Asignación automática no implementada. Asignado a None.")

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
                print(f"Notificación enviada al grupo 'notifications_{assigned_to}'")
            except Exception as e:
                print(f"Error enviando notificación: {e}")

    @action(detail=True, methods=['post'], url_path='upload-file')
    def upload_file(self, request, pk=None):
        ticket = self.get_object()
        if 'file' not in request.FILES:
            return Response({"error": "No se encontró el archivo"}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        
        if file.size > settings.MAX_FILE_SIZE:
            return Response({"error": f"Archivo demasiado grande. Máximo: {settings.MAX_FILE_SIZE//1024//1024}MB"}, status=status.HTTP_400_BAD_REQUEST)

        ticket_folder_path = os.path.join(settings.MEDIA_ROOT, ticket.ticket_id_ticket)
        os.makedirs(ticket_folder_path, exist_ok=True)
        
        # Limpiar nombre de archivo y extensión
        file_extension = file.name.split('.')[-1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path_on_disk = os.path.join(ticket_folder_path, unique_filename)
        
        with open(file_path_on_disk, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)
        
        try:
            relative_path = f"{ticket.ticket_id_ticket}/{unique_filename}"
            
            archivo = Starchivos.objects.create(
                archivo_cod_ticket=ticket, 
                archivo_nom_archivo=file.name,
                archivo_tip_archivo=file_extension,
                archivo_tam_archivo=file.size,
                archivo_rut_archivo=relative_path, 
                archivo_usua_archivo=request.user.username # Usuario de Django
            )
            serializer = ArchivoSerializer(archivo)
            return Response({"success": True, "message": "Archivo subido", **serializer.data}, status=status.HTTP_201_CREATED)
        except Exception as e:
            if os.path.exists(file_path_on_disk):
                os.remove(file_path_on_disk)
            print(f"Error al guardar archivo en BD: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def files(self, request, pk=None):
        ticket = self.get_object()
        archivos = Starchivos.objects.filter(archivo_cod_ticket=ticket).order_by('-archivo_fec_archivo')
        serializer = ArchivoSerializer(archivos, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def rate(self, request, pk=None):
        ticket = self.get_object()
        rating = request.data.get('rating')
        ticket.ticket_calificacion = rating
        ticket.save()
        return Response({"success": True, "message": "Calificación guardada"})
    
    @action(detail=True, methods=['post'], url_path='upload-file')
    def upload_file(self, request, pk=None):
        ticket = self.get_object()
        if 'file' not in request.FILES:
            return Response({"error": "No se encontró el archivo"}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        
        if file.size > settings.MAX_FILE_SIZE:
            return Response({"error": f"Archivo demasiado grande. Máximo: {settings.MAX_FILE_SIZE//1024//1024}MB"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Generar nombre único para el archivo
            file_extension = file.name.split('.')[-1].lower()
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            
            # Ruta en S3: media/tickets/{ticket_id}/{filename}
            s3_path = f"tickets/{ticket.ticket_id_ticket}/{unique_filename}"
            
            # Usar el storage backend para S3
            storage = MediaStorage()
            
            # Guardar archivo en S3
            filename = storage.save(s3_path, file)
            
            # Obtener URL del archivo (presigned URL para acceso temporal)
            file_url = storage.url(filename)
            
            # Guardar metadata en la base de datos
            archivo = Starchivos.objects.create(
                archivo_cod_ticket=ticket, 
                archivo_nom_archivo=file.name,
                archivo_tip_archivo=file_extension,
                archivo_tam_archivo=file.size,
                archivo_rut_archivo=filename,  # Guardamos la ruta S3
                archivo_usua_archivo=request.user.username
            )
            
            serializer = ArchivoSerializer(archivo)
            return Response({
                "success": True, 
                "message": "Archivo subido a S3",
                "file_url": file_url,
                **serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"Error al subir archivo a S3: {e}")
            return Response({"error": f"Error al subir archivo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# --- ViewSet para Archivos ---
class ArchivoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Starchivos.objects.all()
    serializer_class = ArchivoSerializer
    lookup_field = 'archivo_cod_archivo'
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['get'])
    def download(self, request, archivo_cod_archivo=None):
        archivo = self.get_object()
        
        try:
            storage = MediaStorage()
            
            # Generar URL firmada (válida por 1 hora)
            file_url = storage.url(archivo.archivo_rut_archivo)
            
            # Redirigir a la URL de S3
            from django.shortcuts import redirect
            return redirect(file_url)
            
        except Exception as e:
            return Response({"error": f"Error al acceder al archivo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def view(self, request, archivo_cod_archivo=None):
        archivo = self.get_object()
        
        try:
            storage = MediaStorage()
            file_url = storage.url(archivo.archivo_rut_archivo)
            return redirect(file_url)
            
        except Exception as e:
            return Response({"error": f"Error al acceder al archivo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# --- ViewSet para Logs del Chat ---
class LogChatViewSet(viewsets.ModelViewSet):
    queryset = Stlogchat.objects.all()
    serializer_class = LogChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(username=self.request.user.username)

# --- Vista para log de tickets resueltos ---
class LogSolvedTicketView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        try:
            data = request.data
            context = data.get('context', {})
            user = request.user # Usuario de Django
            
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
            print(f"Error al registrar ticket resuelto: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- Vista para Listar Administradores ---
class AdminListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            print(f"=== DEBUG AdminListView ===")
            print(f"Usuario: {request.user.username}")
            print(f"is_staff: {request.user.is_staff}")
            print(f"is_authenticated: {request.user.is_authenticated}")
            
            # Si no es staff, igual puede ver los técnicos (pero no asignarse a sí mismo)
            # Esto es más permisivo
            if not request.user.is_staff:
                print("Usuario no es staff, pero puede ver técnicos")
            
            # Consultar tabla Stadmin
            admins_db = Stadmin.objects.filter(admin_activo=True)
            print(f"Encontrados {admins_db.count()} técnicos en Stadmin")
            
            # Formatear respuesta
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
            
            # Fallback si no hay técnicos
            if not admins:
                print("No hay técnicos en Stadmin, usando fallback")
                # Si el usuario actual es admin, incluirse a sí mismo
                if request.user.is_staff:
                    admins = [{
                        'username': request.user.username, 
                        'nombreCompleto': request.user.get_full_name() or request.user.username,
                        'email': request.user.email
                    }]
                else:
                    admins = [{
                        'username': 'Soporte TI', 
                        'nombreCompleto': 'Soporte General',
                        'email': 'soporte@empresa.com'
                    }]
            
            print(f"Retornando {len(admins)} técnicos")
            return Response(admins)

        except Exception as e:
            print(f"Error en AdminListView: {e}")
            import traceback
            traceback.print_exc()
            return Response([], status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class AdminTicketListView(views.APIView):
    """Lista todos los tickets para el panel de administración"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Solo staff (admins) pueden ver todos los tickets
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        tickets = Stticket.objects.all().order_by('-ticket_fec_ticket')
        serializer = TicketSerializer(tickets, many=True)
        return Response(serializer.data)

class AdminTicketDetailView(views.APIView):
    """Detalle de ticket para admin + actualización"""
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

    def put(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ticket = Stticket.objects.get(pk=pk)
            
            # ✅ CORRECCIÓN: Aceptar más campos además del status
            status_val = request.data.get('status')
            ticket_treal = request.data.get('ticket_treal')
            observation = request.data.get('observation')
            
            if status_val in ['PE', 'FN']:
                ticket.ticket_est_ticket = status_val
            
            # ✅ ACTUALIZAR TIEMPO DE SOLUCIÓN
            if ticket_treal is not None:
                ticket.ticket_treal_ticket = ticket_treal
            
            # ✅ ACTUALIZAR OBSERVACIÓN
            if observation is not None:
                ticket.ticket_obs_ticket = observation
            
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
    """Reasignar ticket a otro usuario"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ticket = Stticket.objects.get(pk=pk)
            new_username = request.data.get('username')
            
            if not new_username:
                return Response({"error": "Username requerido"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Verificar que el usuario existe
            from django.contrib.auth.models import User
            try:
                User.objects.get(username=new_username)
            except User.DoesNotExist:
                return Response({"error": "Usuario no encontrado"}, status=status.HTTP_400_BAD_REQUEST)
            
            ticket.ticket_tusua_ticket = new_username
            ticket.save()
            
            return Response({
                "success": True, 
                "message": f"Ticket reasignado a {new_username}",
                "ticket": TicketSerializer(ticket).data
            })
            
        except Stticket.DoesNotExist:
            return Response({"error": "Ticket no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        
class NotificationSoundUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            if 'sound' not in request.FILES:
                return Response({"error": "No se encontró el archivo de sonido"}, status=status.HTTP_400_BAD_REQUEST)

            sound_file = request.FILES['sound']
            username = request.user.username

            # Validaciones
            allowed_types = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4']
            if sound_file.content_type not in allowed_types:
                return Response({"error": "Tipo de archivo no permitido"}, status=status.HTTP_400_BAD_REQUEST)

            if sound_file.size > 2 * 1024 * 1024:  # 2MB
                return Response({"error": "Archivo demasiado grande (máximo 2MB)"}, status=status.HTTP_400_BAD_REQUEST)

            # Generar nombre único
            file_extension = sound_file.name.split('.')[-1].lower()
            unique_filename = f"custom_notification.{file_extension}"
            s3_path = f"notification_sounds/{username}/{unique_filename}"
            
            # Guardar en S3
            storage = NotificationSoundStorage()
            filename = storage.save(s3_path, sound_file)
            file_url = storage.url(filename)

            return Response({
                "success": True,
                "filePath": file_url,
                "s3_key": filename,
                "message": "Sonido personalizado guardado en S3"
            })

        except Exception as e:
            print(f"Error subiendo sonido a S3: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class NotificationSoundDeleteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            username = request.user.username
            
            # Buscar y eliminar archivos del usuario en S3
            storage = NotificationSoundStorage()
            
            # Patrón de búsqueda para los archivos del usuario
            prefix = f"notification_sounds/{username}/"
            
            # Listar y eliminar archivos (esto es simplificado)
            # En producción necesitarías una forma más robusta de trackear los archivos
            try:
                # Eliminar el archivo si sabemos su key exacta
                # Necesitarías guardar la key en la base de datos o sesión
                storage.delete(f"notification_sounds/{username}/custom_notification.mp3")
                storage.delete(f"notification_sounds/{username}/custom_notification.wav")
                storage.delete(f"notification_sounds/{username}/custom_notification.ogg")
                storage.delete(f"notification_sounds/{username}/custom_notification.m4a")
            except:
                pass  # Si no existe, no hay problema

            return Response({
                "success": True,
                "message": "Sonido personalizado eliminado de S3"
            })

        except Exception as e:
            print(f"Error eliminando sonido de S3: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CheckNotificationSoundView(views.APIView):
    """Verificar si existe sonido personalizado"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            username = request.user.username
            user_sounds_dir = os.path.join(settings.NOTIFICATION_SOUNDS_DIR, username)

            sound_files = []
            if os.path.exists(user_sounds_dir):
                for file in os.listdir(user_sounds_dir):
                    if file.startswith('custom_notification.'):
                        sound_files.append(file)

            if sound_files:
                filename = sound_files[0]  # Tomar el primero
                return Response({
                    "success": True,
                    "hasCustomSound": True,
                    "soundPath": f"/media/notification_sounds/{username}/{filename}"
                })
            else:
                return Response({
                    "success": True,
                    "hasCustomSound": False
                })

        except Exception as e:
            print(f"Error verificando sonido: {e}")
            return Response({"error": str(e)}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class AssignAdminView(views.APIView):
    """Asignar un ticket a un administrador técnico"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ticket = Stticket.objects.get(pk=pk)
            admin_username = request.data.get('admin_username')
            
            # Si viene vacío, lo desasignamos
            if not admin_username:
                ticket.ticket_asignado_a = None
                ticket.save()
                return Response({"success": True, "message": "Ticket desasignado"})

            # Verificar que el admin existe
            try:
                User.objects.get(username=admin_username)
            except User.DoesNotExist:
                return Response({"error": "Administrador no encontrado"}, status=status.HTTP_400_BAD_REQUEST)
            
            ticket.ticket_asignado_a = admin_username
            ticket.save()
            
            # (Opcional) Aquí podrías enviar notificación WebSocket al admin asignado
            
            return Response({
                "success": True, 
                "message": f"Ticket asignado a {admin_username}",
                "ticket": TicketSerializer(ticket).data
            })
            
        except Stticket.DoesNotExist:
            return Response({"error": "Ticket no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        
class SetAuthCookieView(views.APIView):
    """
    Endpoint para establecer la cookie 'chatbot-auth' desde el token JWT del SSO.
    Esto sincroniza el SSO con Django.
    """
    permission_classes = []  # Accesible sin autenticación
    
    def post(self, request):
        try:
            token = request.data.get('token')
            if not token:
                return Response({'error': 'Token requerido'}, status=400)
            
            # Decodificar para verificar
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            username = payload.get('username')
            
            if not username:
                return Response({'error': 'Token inválido'}, status=400)
            
            # Crear respuesta con la cookie
            response = Response({
                'success': True,
                'message': f'Cookie establecida para {username}',
                'user': {
                    'username': username,
                    'rol_nombre': payload.get('rol_nombre'),
                    'nombre_completo': payload.get('nombre_completo')
                }
            })
            
            # Establecer cookie que Django pueda leer
            response.set_cookie(
                key='chatbot-auth',
                value=token,
                httponly=False,  # Para que JS pueda leer si es necesario
                secure=True,
                samesite='None',
                max_age=3600 * 24 * 7,  # 7 días
                domain='.us-east-1.awsapprunner.com'  # Ajusta según tu dominio
            )
            
            # También establecer cookie jwt_token para compatibilidad
            response.set_cookie(
                key='jwt_token',
                value=token,
                httponly=False,
                secure=True,
                samesite='None',
                max_age=3600 * 24 * 7,
            )
            
            return response
            
        except jwt.ExpiredSignatureError:
            return Response({'error': 'Token expirado'}, status=401)
        except jwt.DecodeError:
            return Response({'error': 'Token inválido'}, status=401)
        except Exception as e:
            return Response({'error': str(e)}, status=500)