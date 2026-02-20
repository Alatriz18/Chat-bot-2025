from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
import logging

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_token(token):
    """Valida el JWT y retorna el usuario correspondiente"""
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError
        
        access_token = AccessToken(token)
        user_id = access_token.get('user_id')
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        return User.objects.get(id=user_id)
        
    except Exception as e:
        # Si falla JWT estándar, intentar con tu modelo Stadmin
        try:
            from api.authentication import SSOAuthentication
            # Tu SSOAuthentication usa la cookie 'chatbot-auth'
            # Para WS usamos el token del query param
            from rest_framework_simplejwt.tokens import AccessToken
            decoded = AccessToken(token)
            username = decoded.get('username') or decoded.get('user_id')
            
            from api.models import Stadmin
            return Stadmin.objects.get(username=username)
        except Exception as e2:
            logger.warning(f"Token WebSocket inválido: {e2}")
            return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware que autentica WebSocket usando el token JWT
    del query parameter: ws://...?token=<jwt>
    """
    
    async def __call__(self, scope, receive, send):
        # Extraer token del query string
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_list = params.get('token', [None])
        token = token_list[0] if token_list else None
        
        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)