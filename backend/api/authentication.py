from dj_rest_auth.jwt_auth import JWTCookieAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.contrib.auth import get_user_model
from django.conf import settings
import jwt
from .models import Stadmin

User = get_user_model()

class AutoCreateUserJWTCookieAuthentication(JWTCookieAuthentication):
    """
    1. Busca el token en la COOKIE 'chatbot-auth'.
    2. Verifica la FIRMA usando DJANGO_SECRET_KEY.
    3. Si el usuario no existe en la BD local, lo CREA (JIT Provisioning).
    """
    
    def authenticate(self, request):
        # 1. Intentar autenticación estándar (busca cookie y usuario existente)
        try:
            return super().authenticate(request)
        except InvalidToken:
            # Si el token es inválido/expirado, rechazamos
            return None
        except AuthenticationFailed:
            # Si el token es válido pero el usuario NO existe en BD local...
            # ¡Aquí entra nuestra magia!
            pass

        # 2. Recuperar el token crudo de la cookie
        cookie_name = getattr(settings, 'JWT_AUTH_COOKIE', 'chatbot-auth')
        raw_token = request.COOKIES.get(cookie_name)
        
        if not raw_token:
            return None

        try:
            # 3. Decodificar y VERIFICAR FIRMA (Seguridad)
            # Usamos la SECRET_KEY definida en settings.py
            payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=["HS256"])
            
            return self.get_or_create_user(payload)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expirado')
        except jwt.DecodeError:
            raise AuthenticationFailed('Token inválido')
        except Exception as e:
            # Si falla por otra razón, retornamos None para no romper nada
            return None

    def get_or_create_user(self, payload):
        """Lógica para crear el usuario espejo en la BD local"""
        
        # Datos del Token (Ajustados a tu estructura)
        username = payload.get('username') or payload.get('sub')
        user_id = payload.get('user_id') or payload.get('id')
        email = payload.get('email', '')
        nombre_completo = payload.get('nombre_completo', '')
        rol_nombre = payload.get('rol_nombre', '')

        if not username:
            raise AuthenticationFailed('Token sin username')

        # Determinar si es Admin
        es_admin = rol_nombre in ['SISTEMAS_ADMIN', 'admin']

        try:
            # Intentamos buscar por ID primero (más preciso)
            if user_id:
                user = User.objects.get(id=user_id)
            else:
                user = User.objects.get(username=username)
            
            # Si existe, actualizamos permisos por si cambiaron
            if user.is_staff != es_admin:
                user.is_staff = es_admin
                user.save()
                
        except User.DoesNotExist:
            # ¡CREAMOS EL USUARIO!
            print(f"👤 Creando usuario JIT: {username}")
            
            # Separar nombre y apellido (opcional, para que quede bonito)
            parts = nombre_completo.split(' ')
            first_name = parts[0] if parts else ''
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

            user = User.objects.create_user(
                id=user_id, # Forzamos el mismo ID para mantener coherencia
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                is_staff=es_admin,     # Permiso Admin
                is_superuser=es_admin, # Permiso Superuser
                is_active=True
            )
            user.set_unusable_password() # No tendrá password local (usa SSO)
            user.save()

        return (user, None)
    
class VirtualUser:
    """Usuario temporal en memoria RAM para engañar a Django"""
    def __init__(self, payload):
        self.username = payload.get('username') or payload.get('sub')
        self.id = payload.get('user_id') or payload.get('id')
        self.is_authenticated = True
        # Definimos permisos según el rol del token
        rol = payload.get('rol_nombre', '')
        self.is_staff = rol in ['SISTEMAS_ADMIN', 'admin']
        self.is_superuser = self.is_staff

    # Métodos dummy para que Django no falle si intenta guardar algo
    def save(self, *args, **kwargs): pass
    def delete(self, *args, **kwargs): pass

class JITStadminAuthentication(BaseAuthentication):
    def authenticate(self, request):
        # 1. Leer Cookie
        cookie_name = getattr(settings, 'JWT_AUTH_COOKIE', 'chatbot-auth')
        raw_token = request.COOKIES.get(cookie_name)
        
        if not raw_token:
            return None

        try:
            # 2. Verificar Token
            payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=["HS256"])
            
            # Datos
            username = payload.get('username') or payload.get('sub')
            email = payload.get('email', '')
            nombre_completo = payload.get('nombre_completo', '')
            rol_nombre = payload.get('rol_nombre', '')
            
            parts = nombre_completo.split(' ')
            first_name = parts[0] if parts else ''
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

            # 3. SI ES ADMIN -> Guardar en soporte_ti.stadmin
            if rol_nombre in ['SISTEMAS_ADMIN', 'admin']:
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
                    print(f"Error guardando admin en esquema soporte_ti: {e}")

            # 4. Retornar Usuario Virtual
            return (VirtualUser(payload), None)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expirado')
        except jwt.DecodeError:
            raise AuthenticationFailed('Token inválido')
        except Exception as e:
            # print(f"Auth Error: {e}")
            return None