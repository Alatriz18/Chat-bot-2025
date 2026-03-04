# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tickets', views.TicketViewSet, basename='ticket') 
router.register(r'files', views.ArchivoViewSet, basename='archivo')
router.register(r'logs', views.LogChatViewSet, basename='logchat')

urlpatterns = [
    # ── Tickets de usuario ──
    path('tickets/log-solved/', views.LogSolvedTicketView.as_view(), name='log-solved-ticket'),
    path('tickets/<int:ticket_id>/generate-presigned-url/', views.GeneratePresignedUrlView.as_view(), name='generate-presigned-url'),
    path('tickets/<int:ticket_id>/confirm-upload/', views.ConfirmUploadView.as_view(), name='confirm-upload'),

    # ── Admins y usuarios ──
    path('admins/', views.AdminListView.as_view(), name='admin-list'),
    path('users/active/', views.ActiveUsersListView.as_view(), name='active-users'),

    # ── Admin Panel ──
    path('admin/tickets/', views.AdminTicketListView.as_view(), name='admin-tickets'),
    path('admin/tickets/<int:pk>/', views.AdminTicketDetailView.as_view(), name='admin-ticket-detail'),
    path('admin/tickets/<int:pk>/reassign/', views.ReassignTicketView.as_view(), name='reassign-ticket'),
    path('admin/tickets/<int:pk>/assign/', views.AssignAdminView.as_view(), name='assign-admin'),
    path('admin/tickets/new/', views.NewTicketsPollingView.as_view(), name='new-tickets-polling'),
    # ── Auth ──
    path('set-auth-cookie/', views.SetAuthCookieView.as_view(), name='set-auth-cookie'),
    path('debug-token/', views.DebugTokenView.as_view(), name='debug-token'),

    # ── Sonidos de notificación (S3) ──
    # Rutas originales (mantener para compatibilidad)
    path('upload-notification-sound/', views.NotificationSoundUploadView.as_view(), name='upload-notification-sound'),
    path('delete-notification-sound/', views.NotificationSoundDeleteView.as_view(), name='delete-notification-sound'),
    path('get-notification-sound/', views.CheckNotificationSoundView.as_view(), name='get-notification-sound'),
    # Rutas nuevas (las que usa NotificationSettings.jsx)
    path('notifications/sounds/upload/', views.NotificationSoundUploadView.as_view(), name='notifications-sound-upload'),
    path('notifications/sounds/delete/', views.NotificationSoundDeleteView.as_view(), name='notifications-sound-delete'),
    path('notifications/sounds/check/',  views.CheckNotificationSoundView.as_view(), name='notifications-sound-check'),

    # ── Router (al final siempre) ──
    path('', include(router.urls)),
]