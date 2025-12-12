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
from botocore.exceptions import ClientError

from .storage_backends import MediaStorage, NotificationSoundStorage
from .models import Stticket, Starchivos, Stlogchat, Stadmin
from .serializers import TicketSerializer, ArchivoSerializer, LogChatSerializer

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

# --- VISTA DE SINCRONIZACIÓN DE COOKIE (CRÍTICA PARA AUTH) ---
@method_decorator(csrf_exempt, name='dispatch')
class SetAuthCookieView(APIView):
    """
    Recibe el token del Frontend (SSO) y lo planta en una Cookie HttpOnly segura.
    Esto permite que el navegador envíe la credencial automáticamente.
    """
    permission_classes = [AllowAny] # ¡Vital! Debe ser público

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token no proporcionado'}, status=status.HTTP_400_BAD_REQUEST)

        response = Response({'success': True, 'message': 'Cookie establecida'})
        
        cookie_name = getattr(settings, 'JWT_AUTH_COOKIE', 'chatbot-auth')
        
        # Configuración robusta de la cookie
        response.set_cookie(
            key=cookie_name,
            value=token,
            httponly=True,
            secure=True,
            samesite='None', 
            max_age=7 * 24 * 60 * 60
        )
        return response

# --- ViewSet para Tickets ---

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

# En backend/api/views.py

class ConfirmUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, ticket_id):
        print(f"\n🔍 INICIO CONFIRMACIÓN - TICKET {ticket_id}")
        try:
            # 1. Recibir datos
            s3_key = request.data.get('s3_key')
            filename = request.data.get('filename')
            filetype = request.data.get('filetype')
            
            # Limpieza de datos
            try:
                filesize = int(request.data.get('filesize', 0))
            except:
                filesize = 0
            
            # Cortar tipo de archivo si es muy largo (Evita error SQL)
            short_filetype = (filetype.split('/')[-1] if '/' in filetype else filetype)[:90]
            
            username = request.data.get('username') or request.user.username

            print(f"📦 Guardando: {filename}")

            # 2. OMITIMOS head_object (Causa del crash)
            # Asumimos que si el frontend llama aquí, es porque S3 respondió 200 OK.
            
            # 3. Buscar el Ticket
            try:
                # Usamos el manager base para evitar conflictos
                ticket = Stticket.objects.get(pk=ticket_id)
            except Stticket.DoesNotExist:
                print(f"❌ Ticket {ticket_id} no existe")
                return Response({'error': 'Ticket no encontrado'}, status=404)
            
            # 4. Guardar DIRECTO en Base de Datos
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
            # Si falla aquí, es puramente base de datos
            print(f"🔥🔥🔥 ERROR BDD AL GUARDAR ARCHIVO: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': f'Error guardando en BDD: {str(e)}'}, status=500)
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
        print("\n=== 🛠️ INICIO DEBUG CREACIÓN TICKET ===")
        try:
            data = self.request.data
            context_data = data.get('context', {})
            user = self.request.user 
            
            print(f"👤 Usuario: {user.username}")

            username_from_token = user.username
            # Convertimos a string por seguridad, aunque el modelo espera Integer
            # Django intentará convertirlo automáticamente
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
            
            # Generamos ID
            import datetime
            ticket_id_str = f"TKT-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"
            
            categoria_key = context_data.get('categoryKey', '')
            tipo_ticket = 'Software' if 'software' in categoria_key.lower() else 'Hardware'

            print(f"📝 Intentando guardar ticket: {ticket_id_str}")
            print(f"🔧 Datos clave: CIE={user_code_from_token}, TIPO={tipo_ticket}")

            # --- INTENTO DE GUARDADO ---
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
                    print(f"⚠️ Error enviando notificación (No crítico): {e}")

        except Exception as e:
            # --- AQUÍ ATRAPAMOS EL ERROR REAL ---
            print("\n" + "="*40)
            print("🔥 ERROR FATAL EN BDD AL CREAR TICKET 🔥")
            print(f"❌ Tipo de error: {type(e)}")
            print(f"❌ Mensaje: {str(e)}")
            print("👇 TRACEBACK COMPLETO (Mira aquí abajo):")
            import traceback
            traceback.print_exc()
            print("="*40 + "\n")
            
            # Lanzamos el error al frontend para que lo veas en la consola del navegador también
            from rest_framework.exceptions import APIException
            raise APIException(f"Error BDD: {str(e)}")

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
            file_url = storage.url(archivo.archivo_rut_archivo)
            return redirect(file_url)
        except Exception as e:
            return Response({"error": f"Error al acceder al archivo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    """Devuelve técnicos desde la tabla STADMIN"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            # Consultamos TU tabla personalizada
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
                # Fallback: Si no hay nadie en la tabla stadmin, al menos mostrar al usuario actual si es staff
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

    def put(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ticket = Stticket.objects.get(pk=pk)
            status_val = request.data.get('status')
            ticket_treal = request.data.get('ticket_treal')
            observation = request.data.get('observation')
            
            if status_val in ['PE', 'FN']:
                ticket.ticket_est_ticket = status_val
            
            if ticket_treal is not None:
                ticket.ticket_treal_ticket = ticket_treal
            
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
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_staff:
            return Response({"error": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            ticket = Stticket.objects.get(pk=pk)
            new_username = request.data.get('username')
            
            if not new_username:
                return Response({"error": "Username requerido"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Solo actualizamos el campo texto, ya no validamos contra auth_user
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

# --- NOTIFICACIONES (CORREGIDO PARA APP RUNNER CON S3) ---

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
            
            # Borrar variantes
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
    """Verificar si existe sonido personalizado EN S3"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            username = request.user.username
            
            # USAMOS BOTO3 PARA PREGUNTAR A S3, NO os.path
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
    """Endpoint para debug de tokens JWT"""
    permission_classes = []  # Accesible sin autenticación
    
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
        
        # Intentar con diferentes secret keys
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
            except jwt.ExpiredSignatureError as e:
                result['verification_attempts'].append({
                    'secret_name': name,
                    'success': False,
                    'error': 'Token expirado',
                    'expired': True
                })
            except jwt.InvalidSignatureError as e:
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
        
        # También intentar decodificar sin verificación
        try:
            parts = token.split('.')
            if len(parts) == 3:
                import base64
                import json
                
                # Decodificar payload sin verificar
                payload_b64 = parts[1]
                # Añadir padding si es necesario
                payload_b64 += '=' * (4 - len(payload_b64) % 4)
                payload_json = base64.b64decode(payload_b64).decode('utf-8')
                payload_data = json.loads(payload_json)
                
                result['unverified_payload'] = payload_data
                result['unverified_headers'] = json.loads(base64.b64decode(parts[0] + '==').decode('utf-8'))
        except Exception as e:
            result['decode_error'] = str(e)
        
        return Response(result)