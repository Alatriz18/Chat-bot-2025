"""
Punto de entrada ASGI para Channels.
Maneja tanto HTTP como WebSockets.
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import api.routing  # Importa las rutas de tu app 'api'

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = ProtocolTypeRouter({
    # Peticiones HTTP normales van a la app de Django
    "http": get_asgi_application(),

    # Peticiones WebSocket van a nuestro propio enrutador
    "websocket": AuthMiddlewareStack(
        URLRouter(
            api.routing.websocket_urlpatterns
        )
    ),
})