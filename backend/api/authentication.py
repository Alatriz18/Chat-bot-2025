from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
import jwt
# No importamos User de Django porque no lo vamos a usar
from .models import Stadmin 

class VirtualUser:
    """
    Usuario temporal en memoria RAM para engañar a Django.
    No se guarda en ninguna base de datos auth_user.
    """
    def __init__(self, payload):
        # Mapeo de datos del token a atributos de User
        self.username = payload.get('username') or payload.get('sub')
        self.id = payload.get('user_id') or payload.get('id')
        self.email = payload.get('email', '')
        self.first_name = payload.get('nombre_completo', '').split(' ')[0]
        
        self.is_authenticated = True
        self.is_active = True
        
        # Definimos permisos según el rol del token
        rol = payload.get('rol_nombre', '')
        self.is_staff = rol in ['SISTEMAS_ADMIN', 'admin']
        self.is_superuser = self.is_staff

    # Métodos dummy obligatorios para que Django no falle si intenta guardar algo
    def save(self, *args, **kwargs): pass
    def delete(self, *args, **kwargs): pass
    def get_group_permissions(self, obj=None): return set()
    def get_all_permissions(self, obj=None): return set()
    def has_perm(self, perm, obj=None): return self.is_staff
    def has_module_perms(self, app_label): return self.is_staff

class JITStadminAuthentication(BaseAuthentication):
    """
    Autenticación personalizada que:
    1. Lee el JWT de la Cookie.
    2. Si es Admin -> Guarda/Actualiza en la tabla soporte_ti.stadmin.
    3. Retorna un VirtualUser (en memoria) para que la request continúe.
    """
    def authenticate(self, request):
        # 1. Leer Cookie
        cookie_name = getattr(settings, 'JWT_AUTH_COOKIE', 'chatbot-auth')
        raw_token = request.COOKIES.get(cookie_name)
        
        if not raw_token:
            return None

        try:
            # 2. Verificar Token con la clave secreta
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
            # Esto asegura que tu lista de técnicos siempre esté actualizada
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
                    print(f"Error sincronizando admin {username}: {e}")

            # 4. Retornar Usuario Virtual
            # Django usará este objeto 'user' para el resto de la petición
            return (VirtualUser(payload), None)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expirado')
        except jwt.DecodeError:
            raise AuthenticationFailed('Token inválido')
        except Exception as e:
            # print(f"Auth Error: {e}")
            return None