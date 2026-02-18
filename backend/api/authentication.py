import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
from .models import Stadmin

class VirtualUser:
    """
    Usuario que vive solo en memoria RAM para esta petición.
    """
    def __init__(self, payload):
        self.username = payload.get('username') or payload.get('sub')
        self.email = payload.get('email', '')
        self.id = payload.get('user_id') or payload.get('id') or 0
        
        # Mapeo de permisos 
        rol = payload.get('rol_nombre', '')
        # Solo los que sean admins tendrán is_staff=True
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
        # Datos básicos
        username = payload.get('username') or payload.get('sub')
        rol_nombre = payload.get('rol_nombre', 'USUARIO') # Si no trae rol, ponemos USUARIO
        email = payload.get('email', '')
        nombre_completo = payload.get('nombre_completo', '')
        
        parts = nombre_completo.split(' ')
        first_name = parts[0] if parts else ''
        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

       
        # Eliminamos el "if is_admin". Ahora guardamos A TODOS en la tabla Stadmin.
        # Aunque la tabla se llame 'Stadmin', la usaremos como tabla de usuarios general.
        
        try:
            # 1. Buscamos al usuario (Lectura rápida)
            usuario_db = Stadmin.objects.filter(admin_username=username).first()

            if not usuario_db:
                # 2. CREAR: Si no existe, lo creamos
                Stadmin.objects.create(
                    admin_username=username,
                    admin_correo=email,
                    admin_nombres=first_name,
                    admin_apellidos=last_name,
                    admin_rol=rol_nombre, # Aquí se guardará el rol real (ej. 'CLIENTE')
                    admin_activo=True
                )
                print(f"✅ Nuevo Usuario registrado en DB: {username} ({rol_nombre})")
            
            else:
                # 3. ACTUALIZAR: Si YA existe, actualizamos sus datos si cambiaron
                cambios = False
                
                # Actualizamos correo
                if usuario_db.admin_correo != email:
                    usuario_db.admin_correo = email
                    cambios = True
                
                # Actualizamos nombres
                if usuario_db.admin_nombres != first_name:
                    usuario_db.admin_nombres = first_name
                    cambios = True
                
                # Actualizamos apellidos
                if usuario_db.admin_apellidos != last_name:
                    usuario_db.admin_apellidos = last_name
                    cambios = True

                # IMPORTANTE: Actualizamos el rol si cambió
                if usuario_db.admin_rol != rol_nombre:
                    usuario_db.admin_rol = rol_nombre
                    cambios = True
                
                if cambios:
                    usuario_db.save()
                    print(f"🔄 Datos actualizados para: {username}")
                    
        except Exception as e:
            # Si falla la base de datos, no bloqueamos el login, solo imprimimos el error
            print(f"⚠️ Error sincronizando usuario en Stadmin: {e}")

        # Retornamos el usuario virtual para que Django sepa que está logueado
        return (VirtualUser(payload), None)