import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
from .models import Stadmin

class VirtualUser:
    def __init__(self, payload):
        self.username = payload.get('username') or payload.get('sub')
        self.email = payload.get('email', '')
        self.id = payload.get('user_id') or payload.get('id') or 0
        
        rol = payload.get('rol_nombre', '')
        self.is_staff = rol in ['SISTEMAS_ADMIN', 'admin']
        self.is_superuser = self.is_staff
        self.is_authenticated = True 

    def save(self, *args, **kwargs): pass
    def delete(self, *args, **kwargs): pass
    def get_username(self): return self.username
    def is_anonymous(self): return False

class SSOAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = request.COOKIES.get('chatbot-auth')
        
        if not token:
            return None 

        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=["HS256"],
                leeway=300
            )
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
        rol_nombre = payload.get('rol_nombre', 'USUARIO')
        email = payload.get('email', '')
        nombre_completo = payload.get('nombre_completo', '')
        
        print(f"🔍 AUTENTICANDO: {username} | ROL: {rol_nombre}")
        
        parts = nombre_completo.split(' ')
        first_name = parts[0] if parts else ''
        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

        try:
            usuario_db = Stadmin.objects.filter(admin_username=username).first()

            if not usuario_db:
                print(f"👤 Usuario nuevo, intentando crear: {username}")
                Stadmin.objects.create(
                    admin_username=username,
                    admin_correo=email,
                    admin_nombres=first_name,
                    admin_apellidos=last_name,
                    admin_rol=rol_nombre,
                    admin_activo=True
                )
                print(f"✅ USUARIO CREADO: {username} | ROL: {rol_nombre}")
            else:
                cambios = False
                if usuario_db.admin_correo != email:
                    usuario_db.admin_correo = email
                    cambios = True
                if usuario_db.admin_nombres != first_name:
                    usuario_db.admin_nombres = first_name
                    cambios = True
                if usuario_db.admin_apellidos != last_name:
                    usuario_db.admin_apellidos = last_name
                    cambios = True
                if usuario_db.admin_rol != rol_nombre:
                    usuario_db.admin_rol = rol_nombre
                    cambios = True
                if cambios:
                    usuario_db.save()
                    print(f"🔄 Datos actualizados para: {username}")
                else:
                    print(f"ℹ️ Usuario ya existe sin cambios: {username} | ROL: {usuario_db.admin_rol}")

        except Exception as e:
            import traceback
            print(f"🔥 ERROR CREANDO USUARIO EN STADMIN:")
            print(f"   Username: {username}")
            print(f"   Rol: {rol_nombre}")
            print(f"   Error: {str(e)}")
            traceback.print_exc()

        return (VirtualUser(payload), None)