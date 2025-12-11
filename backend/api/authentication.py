import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
# YA NO IMPORTAMOS User de Django
from .models import Stadmin

class VirtualUser:
    """
    Usuario que vive solo en memoria RAM para esta petición.
    NO toca la base de datos de Django (auth_user).
    """
    def __init__(self, payload):
        self.username = payload.get('username') or payload.get('sub')
        self.email = payload.get('email', '')
        
        # Mapeo de permisos
        rol = payload.get('rol_nombre', '')
        self.is_staff = rol in ['SISTEMAS_ADMIN', 'admin']
        self.is_superuser = self.is_staff
        self.is_authenticated = True # Importante para permission_classes

    # Métodos dummy para que Django no falle si intenta guardar algo
    def save(self, *args, **kwargs): pass
    def delete(self, *args, **kwargs): pass
    def get_username(self): return self.username
    def is_anonymous(self): return False

class SSOAuthentication(BaseAuthentication):
    def authenticate(self, request):
        # 1. Recuperar token de la cookie HttpOnly
        token = request.COOKIES.get('chatbot-auth')
        
        if not token:
            return None 

        try:
            # 2. Verificar firma
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=["HS256"],
                leeway=300
            )
            
            # 3. Procesar lógica personalizada
            return self.get_or_create_user_custom(payload)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expirado')
        except jwt.InvalidSignatureError:
            raise AuthenticationFailed('Firma inválida')
        except Exception as e:
            print(f"Auth Error: {e}")
            return None

    def get_or_create_user_custom(self, payload):
        username = payload.get('username') or payload.get('sub')
        rol_nombre = payload.get('rol_nombre', '')
        email = payload.get('email', '')
        nombre_completo = payload.get('nombre_completo', '')
        
        is_admin = rol_nombre in ['SISTEMAS_ADMIN', 'admin']
        
        parts = nombre_completo.split(' ')
        first_name = parts[0] if parts else ''
        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

        # --- AQUI ESTA EL CAMBIO: SOLO TOCAMOS STADMIN ---
        
        if is_admin:
            try:
                # Guardamos SOLO en tu tabla personalizada
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
                print(f"✅ Admin {username} sincronizado en STADMIN")
            except Exception as e:
                print(f"⚠️ Error escribiendo en stadmin: {e}")

        # Retornamos el usuario virtual (RAM) para que Django siga trabajando
        return (VirtualUser(payload), None)