"""
Archivo: api/authentication.py
ADAPTADO PARA DESARROLLO LOCAL CON TOKEN CUSTOM
"""
import jwt
import logging
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

logger = logging.getLogger(__name__)
User = get_user_model()

class CognitoAuthentication(authentication.BaseAuthentication):
    """
    Autenticación adaptada para leer el token Custom (Local/Dev).
    Ignora la firma para facilitar el desarrollo, pero lee los permisos correctos.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        try:
            # Formato esperado: "Bearer <token>"
            parts = auth_header.split()
            if len(parts) != 2 or parts[0].lower() != 'bearer':
                return None
            
            token = parts[1]

            # -------------------------------------------------------------
            # PASO CRÍTICO: Decodificación sin verificar firma (SOLO DEV)
            # Esto permite leer tu token local sin necesitar la clave secreta ajena
            # -------------------------------------------------------------
            payload = jwt.decode(token, options={"verify_signature": False})
            
            # Extraemos los datos según LA ESTRUCTURA DE TU TOKEN
            username = payload.get('username')
            email = payload.get('email')
            rol_nombre = payload.get('rol_nombre')  # Ej: SISTEMAS_ADMIN
            permisos = payload.get('permisos', [])  # Ej: ['core.chatbot_acceso', ...]
            nombre_completo = payload.get('nombre_completo', '')

            if not username:
                raise exceptions.AuthenticationFailed('El token no contiene username')

            # Buscamos o Creamos el usuario en Django
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': nombre_completo,
                    'is_active': True
                }
            )

            # --- MAPEO DE ROLES Y PERMISOS ---
            # Si el token dice que es SISTEMAS_ADMIN, le damos superpoderes en Django
            es_admin = (rol_nombre == 'SISTEMAS_ADMIN')

            # Actualizamos los permisos si cambiaron
            needs_save = False
            
            if user.is_staff != es_admin:
                user.is_staff = es_admin
                needs_save = True
            
            if user.is_superuser != es_admin:
                user.is_superuser = es_admin
                needs_save = True

            if needs_save:
                user.save()
                logger.info(f"Permisos actualizados para usuario {username}. Es Admin: {es_admin}")

            # Inyectamos los permisos del token en el objeto user temporalmente
            # Esto sirve para verificaciones en vistas si usas request.user.permisos
            user.token_permissions = permisos 
            user.token_role = rol_nombre

            return (user, None)

        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Token expirado')
        except Exception as e:
            logger.error(f"Error decodificando token local: {e}")
            raise exceptions.AuthenticationFailed('Token inválido')

    def authenticate_header(self, request):
        return 'Bearer realm="api"'