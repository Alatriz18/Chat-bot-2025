# api/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        if self.user.is_anonymous:
            await self.close()
            return

        # Grupo personalizado por usuario
        self.room_group_name = f'notifications_{self.user.username}'
        
        # Unirse al grupo
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"🔌 WebSocket conectado para {self.user.username}")

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        print(f"🔌 WebSocket desconectado para {self.user.username}")

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        
        if message_type == 'ping':
            await self.send(text_data=json.dumps({
                'type': 'pong',
                'message': 'pong'
            }))

    async def send_notification(self, event):
        """Enviar notificación al WebSocket"""
        notification_data = event['data']
        
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': notification_data
        }))

    async def ticket_assigned(self, event):
        """Notificación específica para tickets asignados"""
        ticket_data = event['data']
        
        await self.send(text_data=json.dumps({
            'type': 'ticket_assigned',
            'data': ticket_data
        }))