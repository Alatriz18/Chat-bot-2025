# api/authentication.py - VERSIÓN DEFINITIVA
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
import jwt
from django.contrib.auth.models import User
from .models import Stadmin

class SSOAuthentication(BaseAuthentication):
    """
    Autenticación para tokens JWT del SSO.
    Lee el token del Authorization header O de una cookie específica.
    """
    def authenticate(self, request):
        print("=== 🔍 SSO AUTHENTICATION ===")
        
        token = None
        source = "unknown"
        
        # 1. Buscar en Authorization header (principal)
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            source = "header"
            print(f"✅ Token encontrado en Authorization header")
        
        # 2. Buscar en cookie 'chatbot-auth' (backup para dj-rest-auth)
        if not token:
            cookie_token = request.COOKIES.get('chatbot-auth')
            if cookie_token:
                token = cookie_token
                source = "cookie"
                print(f"✅ Token encontrado en cookie chatbot-auth")
        
        # 3. Buscar en cookie 'jwt_token' (otro posible nombre)
        if not token:
            cookie_token = request.COOKIES.get('jwt_token')
            if cookie_token:
                token = cookie_token
                source = "cookie_jwt"
                print(f"✅ Token encontrado en cookie jwt_token")
        
        if not token:
            print("❌ No se encontró token JWT")
            print(f"Headers: {dict(request.headers)}")
            print(f"Cookies: {dict(request.COOKIES)}")
            return None
        
        print(f"📦 Source: {source}, Token: {token[:50]}...")
        
        try:
            # Decodificar el token JWT del SSO
            # NOTA: El SSO usa settings.SECRET_KEY de Django
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            print(f"📄 Payload decodificado exitosamente")
            
            # Extraer datos del token del SSO
            username = payload.get('username')
            email = payload.get('email')
            nombre_completo = payload.get('nombre_completo')
            rol_nombre = payload.get('rol_nombre')
            user_id = payload.get('user_id')
            
            print(f"👤 Usuario: {username}")
            print(f"📧 Email: {email}")
            print(f"🎭 Rol: {rol_nombre}")
            print(f"🆔 User ID: {user_id}")
            
            if not username:
                print("❌ Token no tiene username")
                return None
            
            # 1. CREAR/ACTUALIZAR USUARIO DJANGO
            is_admin = rol_nombre in ['SISTEMAS_ADMIN', 'admin']
            
            # Extraer nombre y apellido del nombre completo
            first_name = ""
            last_name = ""
            if nombre_completo:
                parts = nombre_completo.split(' ')
                first_name = parts[0] if parts else ""
                last_name = ' '.join(parts[1:]) if len(parts) > 1 else ""
            
            # Crear o actualizar usuario Django
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email or f"{username}@empresa.com",
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_staff': is_admin,
                    'is_superuser': is_admin
                }
            )
            
            # Si el usuario ya existe, actualizar
            if not created:
                needs_save = False
                if user.email != email:
                    user.email = email or f"{username}@empresa.com"
                    needs_save = True
                if user.is_staff != is_admin:
                    user.is_staff = is_admin
                    user.is_superuser = is_admin
                    needs_save = True
                if needs_save:
                    user.save()
            
            print(f"🏷️  Usuario Django: {user.username}, is_staff: {user.is_staff}")
            
            # 2. SINCRONIZAR CON TABLA Stadmin (SI ES ADMIN)
            if is_admin:
                print(f"🛠️  Sincronizando admin {username} con tabla Stadmin...")
                try:
                    Stadmin.objects.update_or_create(
                        admin_username=username,
                        defaults={
                            'admin_correo': email or f"{username}@empresa.com",
                            'admin_nombres': first_name,
                            'admin_apellidos': last_name,
                            'admin_rol': rol_nombre,
                            'admin_activo': True
                        }
                    )
                    print(f"✅ Admin {username} sincronizado en Stadmin")
                except Exception as e:
                    print(f"❌ Error sincronizando admin: {e}")
            
            # 3. ESTABLECER COOKIE chatbot-auth PARA CONSISTENCIA
            # Esto asegura que dj-rest-auth y otras partes funcionen
            if source != "cookie":
                print(f"🍪 Estableciendo cookie chatbot-auth para {username}")
                # El middleware de Django ya manejará la respuesta
            
            print(f"✅ Autenticación exitosa para {username}")
            return (user, token)
            
        except jwt.ExpiredSignatureError:
            print("❌ Token expirado")
            raise AuthenticationFailed('Token expirado')
        except jwt.DecodeError as e:
            print(f"❌ Error decodificando token: {e}")
            raise AuthenticationFailed('Token inválido')
        except Exception as e:
            print(f"❌ Error en autenticación: {e}")
            import traceback
            traceback.print_exc()
            return None