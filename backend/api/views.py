from rest_framework import viewsets, views, status, permissions
from rest_framework.views import APIView 
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny 
from django.http import FileResponse, Http404
from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import redirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
import traceback
from rest_framework.exceptions import APIException
import os
import uuid
import datetime
import boto3
import logging  # ← FIX: faltaba este import
from botocore.exceptions import ClientError
from rest_framework.authentication import BasicAuthentication
from .storage_backends import MediaStorage, NotificationSoundStorage
from .models import Stticket, Starchivos, Stlogchat, Stadmin
from .serializers import StticketSerializer, ArchivoSerializer, LogChatSerializer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.utils import timezone
from datetime import datetime
import pytz

# ← FIX: logger definido globalmente para que todas las funciones lo usen
logger = logging.getLogger(__name__)


# ============================================================
# HELPER: ENVIAR NOTIFICACIÓN WEBSOCKET
# ============================================================
def send_ticket_notification(admin_username, ticket):
    """
    Envía una notificación WebSocket al admin asignado.
    Llamar después de crear o actualizar un ticket.
    """
    if not admin_username:
        return
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"notifications_{admin_username}",
            {
                "type": "send_notification",  # Mapea a NotificationConsumer.send_notification()
                "data": {
                    "type": "ticket_assigned",
                    "title": "🎫 Nuevo ticket asignado",
                    "message": f"Se te asignó el ticket #{ticket.ticket_id_ticket}: {ticket.ticket_asu_ticket}",
                    "ticket_id": ticket.ticket_cod_ticket,
                    "ticket_display_id": ticket.ticket_id_ticket,
                }
            }
        )
        logger.info(f"✅ Notificación enviada a {admin_username} para ticket {ticket.ticket_id_ticket}")
    except Exception as e:
        logger.warning(f"⚠️ No se pudo enviar notificación WebSocket: {e}")


# ============================================================
# VISTA DE SINCRONIZACIÓN DE COOKIE (CRÍTICA PARA AUTH)
# ============================================================
@method_decorator(csrf_exempt, name='dispatch')
class SetAuthCookieView(APIView):
    """
    Recibe el token del Frontend (SSO), lo planta en una Cookie HttpOnly
    y crea/actualiza el usuario en Stadmin al momento del login.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token no proporcionado'}, status=status.HTTP_400_BAD_REQUEST)

        # --- CREAR/ACTUALIZAR USUARIO EN LOGIN ---
        try:
            import jwt
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
                leeway=300
            )

            username = payload.get('username') or payload.get('sub')
            rol_nombre = payload.get('rol_nombre', 'USUARIO')
            email = payload.get('email', '')
            nombre_completo = payload.get('nombre_completo', '')

            parts = nombre_completo.split(' ')
            first_name = parts[0] if parts else ''
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

            usuario_db = Stadmin.objects.filter(admin_username=username).first()

            if not usuario_db:
                Stadmin.objects.create(
                    admin_username=username,
                    admin_correo=email,
                    admin_nombres=first_name,
                    admin_apellidos=last_name,
                    admin_rol=rol_nombre,
                    admin_activo=True
                )
                print(f"✅ Usuario creado en login: {username} | ROL: {rol_nombre}")
            else:
                cambios = False
                if usuario_db.admin_rol != rol_nombre:
                    usuario_db.admin_rol = rol_nombre
                    cambios = True
                if usuario_db.admin_correo != email:
                    usuario_db.admin_correo = email
                    cambios = True
                if usuario_db.admin_nombres != first_name:
                    usuario_db.admin_nombres = first_name
                    cambios = True
                if usuario_db.admin_apellidos != last_name:
                    usuario_db.admin_apellidos = last_name
                    cambios = True
                if cambios:
                    usuario_db.save()
                    print(f"🔄 Usuario actualizado en login: {username}")
                else:
                    print(f"ℹ️ Usuario ya existe sin cambios: {username}")

        except Exception as e:
            print(f"🔥 Error creando usuario en login: {str(e)}")
            traceback.print_exc()
            # No bloqueamos el login aunque falle esto

        # --- PLANTAR COOKIE ---
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
class NewTicketsPollingView(views.APIView):
    """
    Polling endpoint: devuelve tickets asignados al admin autenticado
    que fueron creados/modificados después de 'since'.

    GET /api/admin/tickets/new/?since=2026-03-04T17:00:00Z
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            since_param = request.query_params.get('since')
            username = request.user.username

            tickets_qs = Stticket.objects.filter(
                ticket_asignado_a=username
            )

            if since_param:
                try:
                    # Acepta ISO 8601 con o sin timezone
                    since_dt = datetime.fromisoformat(since_param.replace('Z', '+00:00'))
                    tickets_qs = tickets_qs.filter(ticket_fec_ticket__gt=since_dt)
                except (ValueError, TypeError):
                    pass  # Si el formato es inválido, devuelve todos

            tickets = tickets_qs.order_by('-ticket_fec_ticket')[:20]

            data = []
            for t in tickets:
                data.append({
                    'ticket_id':     t.ticket_id_ticket or t.ticket_cod_ticket,
                    'ticket_cod':    t.ticket_cod_ticket,
                    'titulo':        t.ticket_asu_ticket or 'Sin asunto',
                    'descripcion':   (t.ticket_des_ticket or '')[:120],
                    'estado':        t.ticket_est_ticket,
                    'fecha':         t.ticket_fec_ticket.isoformat() if t.ticket_fec_ticket else None,
                    'creado_por':    t.ticket_usu_ticket or '',
                })

            return Response({
                'tickets':      data,
                'count':        len(data),
                'checked_at':   timezone.now().isoformat(),
            })

        except Exception as e:
            logger.error(f"Error en NewTicketsPollingView: {e}")
            return Response({'tickets': [], 'count': 0, 'checked_at': timezone.now().isoformat()})

# ============================================================
# PRESIGNED URL PARA S3
# ============================================================
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
            
            MAX_SIZE = 16 * 1024 * 1024
            if filesize > MAX_SIZE:
                return Response({'error': f'Archivo demasiado grande. Máximo {MAX_SIZE/1024/1024}MB'}, status=status.HTTP_400_BAD_REQUEST)
            
            file_extension = filename.split('.')[-1] if '.' in filename else ''
            unique_filename = f"{uuid.uuid4()}.{file_extension}" if file_extension else str(uuid.uuid4())
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


# ============================================================
# CONFIRMAR UPLOAD A S3
# ============================================================
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

            print(f"📦 Guardando: {filename}")

            try:
                ticket = Stticket.objects.get(pk=ticket_id)
            except Stticket.DoesNotExist:
                print(f"❌ Ticket {ticket_id} no existe")
                return Response({'error': 'Ticket no encontrado'}, status=404)
            
            archivo = Starchivos.objects.create(
                archivo_cod_ticket=ticket,
                archivo_nom_archivo=filename,
                archivo_tip_archivo=short_filetype,
                archivo_tam_archivo=filesize,
                archivo_rut_archivo=s3_key,
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


# ============================================================
# VIEWSET DE TICKETS
# ============================================================
class TicketViewSet(viewsets.ModelViewSet):
    queryset = Stticket.objects.all().order_by('-ticket_fec_ticket')
    serializer_class = StticketSerializer
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
        print("\n=== 🛠️ INICIO DEBUG CREACIÓN TICKET ===")
        try:
            data = self.request.data
            context_data = data.get('context', {})
            user = self.request.user 
            
            print(f"👤 Usuario: {user.username}")

            username_from_token = user.username
            user_code_from_token = user.id 

            preferred_admin = data.get('preferred_admin')
            assigned_to = None

            if preferred_admin and preferred_admin != 'none':
                assigned_to = preferred_admin

            problem_description = context_data.get('problemDescription', 'N/A')
            final_options_tried = context_data.get('finalOptionsTried', [])
            
            options_text = ""
            if final_options_tried:
                options_text += "\n\n--- Opciones Finales Intentadas sin Éxito ---\n" 
                for option in final_options_tried:
                    options_text += f"- {option}\n"

            final_description = f"{problem_description}{options_text}"
            
            from zoneinfo import ZoneInfo
            now_ecuador = datetime.datetime.now(ZoneInfo('America/Guayaquil'))
            ticket_id_str = f"TKT-{now_ecuador.strftime('%Y%m%d-%H%M%S')}"
            
            categoria_key = context_data.get('categoryKey', '')
            tipo_ticket = 'Software' if 'software' in categoria_key.lower() else 'Hardware'

            print(f"📝 Intentando guardar ticket: {ticket_id_str}")
            print(f"🔧 Datos clave: CIE={user_code_from_token}, TIPO={tipo_ticket}")

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
            print("✅ ¡TICKET GUARDADO EXITOSAMENTE EN BDD!")

            # ← FIX: usar el helper send_ticket_notification en lugar del inline con type incorrecto
            if assigned_to:
                send_ticket_notification(assigned_to, instance)

        except Exception as e:
            print("\n" + "="*40)
            print("🔥 ERROR FATAL EN BDD AL CREAR TICKET 🔥")
            print(f"❌ Tipo de error: {type(e)}")
            print(f"❌ Mensaje: {str(e)}")
            print("👇 TRACEBACK COMPLETO:")
            traceback.print_exc()
            print("="*40 + "\n")
            raise APIException(f"Error BDD: {str(e)}")

    @action(detail=True, methods=['get'])
    def files(self, request, pk=None):
        ticket = self.get_object()
        archivos = Starchivos.objects.filter(archivo_cod_ticket=ticket).order_by('-archivo_fec_archivo')
        serializer = ArchivoSerializer(archivos, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def rate(self, request, pk=None):
        # ← FIX: eliminado el código muerto después del return
        ticket = self.get_object()
        rating = request.data.get('rating')
        ticket.ticket_calificacion = rating
        ticket.save()
        return Response({"success": True, "message": "Calificación guardada"})


# ============================================================
# VIEWSET DE ARCHIVOS
# ============================================================
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
            file_url = storage.url(archivo.archivo_rut_archivo)
            return redirect(file_url)
        except Exception as e:
            return Response({"error": f"Error al acceder al archivo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def view(self, request, archivo_cod_archivo=None):
        return self.download(request, archivo_cod_archivo)


# ============================================================
# VIEWSET DE LOGS DEL CHAT
# ============================================================
class LogChatViewSet(viewsets.ModelViewSet):
    queryset = Stlogchat.objects.all()
    serializer_class = LogChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(username=self.request.user.username)


# ============================================================
# LOG DE TICKETS RESUELTOS
# ============================================================
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


# ============================================================
# LISTA DE ADMINS Y USUARIOS
# ============================================================
class AdminListView(views.APIView):
    """Devuelve SOLO técnicos/admins"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            admins_db = Stadmin.objects.filter(
                admin_activo=True,
                admin_rol__in=['SISTEMAS_ADMIN', 'admin']
            )
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
            return Response(admins)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ActiveUsersListView(views.APIView):
    """Devuelve usuarios regulares (todos los que NO son admin)"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            users_db = Stadmin.objects.filter(
                admin_activo=True
            ).exclude(
                admin_rol__in=['SISTEMAS_ADMIN', 'admin']
            )
            users = []
            for u in users_db:
                nombre_completo = u.admin_username
                if u.admin_nombres or u.admin_apellidos:
                    nombre_completo = f"{u.admin_nombres or ''} {u.admin_apellidos or ''}".strip()
                users.append({
                    'username': u.admin_username,
                    'email': u.admin_correo,
                    'nombreCompleto': nombre_completo,
                    'rol': u.admin_rol
                })
            return Response(users)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# ADMIN TICKET VIEWS
# ============================================================
class AdminTicketListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        tickets = Stticket.objects.all().order_by('-ticket_fec_ticket')
        serializer = StticketSerializer(tickets, many=True)
        return Response(serializer.data)


class AdminTicketDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        try:
            ticket = Stticket.objects.get(pk=pk)
            serializer = StticketSerializer(ticket)
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
            
            print(f"🔧 ACTUALIZANDO TICKET {pk}: {data}")

            # ← FIX: guardar admin_anterior ANTES de modificar el ticket
            admin_anterior = ticket.ticket_asignado_a

            # 1. Estado
            status_val = data.get('status') or data.get('ticket_est_ticket')
            if status_val:
                ticket.ticket_est_ticket = status_val

            # 2. Usuario Asignado
            usuario = data.get('ticket_tusua_ticket')
            if usuario:
                ticket.ticket_tusua_ticket = usuario

            # 3. Técnico Asignado
            if 'ticket_asignado_a' in data:
                ticket.ticket_asignado_a = data['ticket_asignado_a']

            # 4. Observaciones
            obs = data.get('observation') or data.get('ticket_obs_ticket')
            if obs:
                ticket.ticket_obs_ticket = obs

            # 5. Tiempo real de resolución
            treal = data.get('ticket_treal_ticket')
            if treal is not None:
                ticket.ticket_treal_ticket = int(treal)

            # 6. Calificación
            calificacion = data.get('ticket_calificacion')
            if calificacion is not None:
                ticket.ticket_calificacion = calificacion

            ticket.save(update_fields=[
                'ticket_est_ticket',
                'ticket_tusua_ticket',
                'ticket_asignado_a',
                'ticket_obs_ticket',
                'ticket_treal_ticket',
                'ticket_calificacion'
            ])

            # ← FIX: notificación ANTES del return, solo si cambió el técnico
            nuevo_admin = ticket.ticket_asignado_a
            if nuevo_admin and nuevo_admin != admin_anterior:
                send_ticket_notification(nuevo_admin, ticket)
            
            return Response({
                "success": True,
                "message": "Ticket actualizado",
                "ticket": StticketSerializer(ticket).data
            })

        except Stticket.DoesNotExist:
            return Response({"error": "Ticket no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"❌ Error update: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# REASIGNAR Y ASIGNAR ADMIN
# ============================================================
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
                "ticket": StticketSerializer(ticket).data
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
                "ticket": StticketSerializer(ticket).data
            })            
        except Stticket.DoesNotExist:
            return Response({"error": "Ticket no encontrado"}, status=status.HTTP_404_NOT_FOUND)


# ============================================================
# NOTIFICACIONES - SONIDO PERSONALIZADO
# ============================================================
class NotificationSoundUploadView(views.APIView):
    """
    PASO 1: Genera presigned URL para subir el sonido.
    El frontend sube directo a S3, igual que los adjuntos del chat.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            filename = request.data.get('filename')
            filetype = request.data.get('filetype')

            if not filename or not filetype:
                return Response({"error": "filename y filetype son requeridos"}, status=400)

            username = request.user.username
            file_extension = filename.split('.')[-1].lower() if '.' in filename else 'mp3'
            s3_key = f"notification_sounds/{username}/custom_notification.{file_extension}"

            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )

            # Generar presigned URL para PUT — igual que generate-presigned-url del chat
            presigned_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': s3_key,
                    'ContentType': filetype,
                },
                ExpiresIn=3600
            )

            download_url = f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{s3_key}"

            return Response({
                'upload_url': presigned_url,
                'download_url': download_url,
                's3_key': s3_key,
            })

        except Exception as e:
            logger.error(f"Error generando presigned URL para sonido: {e}")
            return Response({"error": str(e)}, status=500)

class NotificationSoundDeleteView(views.APIView):
    """
    Elimina el sonido personalizado de S3.
    delete_object es instantáneo — no hay timeout.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            username = request.user.username
            s3_key = request.data.get('s3_key')

            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME
            )

            if s3_key:
                # Eliminar key específico recibido del frontend
                s3_client.delete_object(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=s3_key
                )
            else:
                # Eliminar todos los formatos posibles
                for ext in ['mp3', 'wav', 'ogg', 'm4a']:
                    try:
                        s3_client.delete_object(
                            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                            Key=f"notification_sounds/{username}/custom_notification.{ext}"
                        )
                    except Exception:
                        pass

            return Response({"success": True})

        except Exception as e:
            logger.error(f"Error eliminando sonido: {e}")
            return Response({"error": str(e)}, status=500)

class CheckNotificationSoundView(views.APIView):
    """
    NO llama a S3 — eso causaba el WORKER TIMEOUT.
    Solo devuelve las URLs posibles; el frontend verifica si cargan.
    La fuente de verdad es localStorage del frontend.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            username = request.user.username
            base_url = f"https://{settings.AWS_S3_CUSTOM_DOMAIN}"

            # Devolver URLs para todos los formatos — el frontend prueba cuál carga
            possible_urls = {
                ext: f"{base_url}/notification_sounds/{username}/custom_notification.{ext}"
                for ext in ['mp3', 'wav', 'ogg', 'm4a']
            }

            return Response({
                "success": True,
                "username": username,
                "possibleUrls": possible_urls,
                # El frontend sabe si hay sonido porque lo guardó en localStorage al subir
            })

        except Exception as e:
            logger.error(f"Error en check sound: {e}")
            return Response({"error": str(e)}, status=500)

# ============================================================
# DEBUG TOKEN
# ============================================================
class DebugTokenView(views.APIView):
    """Endpoint para debug de tokens JWT"""
    permission_classes = []

    def get(self, request):
        return Response({"status": "online", "message": "Debug endpoint ready"}, status=200)

    def post(self, request):
        import jwt
        from django.conf import settings
        
        token = request.data.get('token')
        
        if not token:
            return Response({'error': 'Token requerido'}, status=400)
        
        result = {
            'token_received': True,
            'token_length': len(token),
            'secret_key_used': settings.SECRET_KEY[:10] + '...' if settings.SECRET_KEY else 'No configurada',
            'verification_attempts': []
        }
        
        test_secrets = [
            ('current', settings.SECRET_KEY),
            ('default', 'django-insecure-'),
            ('local', 'tu-clave-secreta-local'),
        ]
        
        for name, secret in test_secrets:
            try:
                if secret:
                    payload = jwt.decode(token, secret, algorithms=["HS256"])
                    result['verification_attempts'].append({
                        'secret_name': name,
                        'success': True,
                        'payload': payload
                    })
                else:
                    result['verification_attempts'].append({
                        'secret_name': name,
                        'success': False,
                        'error': 'Secret key vacía'
                    })
            except jwt.ExpiredSignatureError:
                result['verification_attempts'].append({
                    'secret_name': name,
                    'success': False,
                    'error': 'Token expirado',
                    'expired': True
                })
            except jwt.InvalidSignatureError:
                result['verification_attempts'].append({
                    'secret_name': name,
                    'success': False,
                    'error': 'Firma inválida'
                })
            except Exception as e:
                result['verification_attempts'].append({
                    'secret_name': name,
                    'success': False,
                    'error': str(e)
                })
        
        try:
            parts = token.split('.')
            if len(parts) == 3:
                import base64
                import json
                
                payload_b64 = parts[1]
                payload_b64 += '=' * (4 - len(payload_b64) % 4)
                payload_json = base64.b64decode(payload_b64).decode('utf-8')
                payload_data = json.loads(payload_json)
                
                result['unverified_payload'] = payload_data
                result['unverified_headers'] = json.loads(base64.b64decode(parts[0] + '==').decode('utf-8'))
        except Exception as e:
            result['decode_error'] = str(e)
        
        return Response(result)