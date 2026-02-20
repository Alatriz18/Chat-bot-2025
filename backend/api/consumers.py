import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        # Rechazar si no está autenticado
        if not self.user or not self.user.is_authenticated:
            logger.warning("WebSocket: Intento de conexión sin autenticación")
            await self.close(code=4001)
            return
        
        # Cada admin tiene su propio grupo: "notifications_kevin.santana"
        self.group_name = f"notifications_{self.user.username}"
        
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"✅ WebSocket conectado: {self.user.username}")
        
        # Confirmar conexión al cliente
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': f'Conectado como {self.user.username}'
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            logger.info(f"🔌 WebSocket desconectado: {getattr(self.user, 'username', 'unknown')}")

    async def receive(self, text_data):
        """Recibe mensajes del cliente (ej: ping)"""
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            pass

    # Este método lo llama channel_layer.group_send desde views.py
    async def send_notification(self, event):
        """Envía la notificación al cliente WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))