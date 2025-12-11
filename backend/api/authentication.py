import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
from django.contrib.auth.models import User
from .models import Stadmin

class SSOAuthentication(BaseAuthentication):
    def authenticate(self, request):
        # 1. Recuperar token de la cookie HttpOnly
        token = request.COOKIES.get('chatbot-auth')
        if not token:
            return None # No hay sesión

        try:
            # 2. Verificar firma con la clave secreta COMPARTIDA
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=["HS256"],
                leeway=300 # Tolerancia de 5 min para relojes desfasados
            )
            
            # 3. Procesar usuario (Crear/Actualizar)
            return self.get_or_create_user(payload)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expirado')
        except jwt.InvalidSignatureError:
            raise AuthenticationFailed('Firma inválida (SECRET_KEY incorrecta)')
        except Exception:
            return None

    def get_or_create_user(self, payload):
        username = payload.get('username') or payload.get('sub')
        rol_nombre = payload.get('rol_nombre', '')
        email = payload.get('email', '')
        nombre_completo = payload.get('nombre_completo', '')
        
        # Mapeo de Admin
        is_admin = rol_nombre in ['SISTEMAS_ADMIN', 'admin']
        
        # Separar nombres
        parts = nombre_completo.split(' ')
        first_name = parts[0] if parts else ''
        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

        # Lógica de Usuario Django
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={'email': email, 'is_active': True}
        )
        
        # Actualizar permisos siempre
        if user.is_staff != is_admin:
            user.is_staff = is_admin
            user.is_superuser = is_admin
            user.first_name = first_name
            user.last_name = last_name
            user.save()

        # Sincronizar STADMIN si es admin
        if is_admin:
            try:
                Stadmin.objects.update_or_create(
                    admin_username=username,
                    defaults={
                        'admin_correo': email,
                        'admin_nombres': first_name,
                        'admin_apellidos': last_name,
                        'admin_rol': rol_nombre,
                        'admin_activo': True
                    }
                )
            except Exception as e:
                print(f"Error stadmin: {e}")

        return (user, None)