# api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tickets', views.TicketViewSet, basename='ticket') 
router.register(r'files', views.ArchivoViewSet, basename='archivo')
router.register(r'logs', views.LogChatViewSet, basename='logchat')

urlpatterns = [
    # Rutas existentes...
    path('tickets/log-solved/', views.LogSolvedTicketView.as_view(), name='log-solved-ticket'),
    path('admins/', views.AdminListView.as_view(), name='admin-list'),
    
    # Rutas para Admin Panel
    path('admin/tickets/', views.AdminTicketListView.as_view(), name='admin-tickets'),
    path('users/active/', views.AdminListView.as_view(), name='active-users'),
    path('admin/tickets/<int:pk>/reassign/', views.ReassignTicketView.as_view(), name='reassign-ticket'),
    path('admin/tickets/<int:pk>/assign/', views.AssignAdminView.as_view(), name='assign-admin'),
    path('admin/tickets/<int:pk>/', views.AdminTicketDetailView.as_view(), name='admin-ticket-detail'),
    
    # NUEVAS RUTAS PARA NOTIFICACIONES
    path('upload-notification-sound/', views.NotificationSoundUploadView.as_view(), name='upload-notification-sound'),
    path('delete-notification-sound/', views.NotificationSoundDeleteView.as_view(), name='delete-notification-sound'),
    path('get-notification-sound/', views.CheckNotificationSoundView.as_view(), name='get-notification-sound'),
      # NUEVAS URLs para S3
    path('tickets/<int:ticket_id>/generate-presigned-url/', views.GeneratePresignedUrlView.as_view(), name='generate-presigned-url'),
    path('tickets/<int:ticket_id>/confirm-upload/', views.ConfirmUploadView.as_view(), name='confirm-upload'),
    path('set-auth-cookie/', views.SetAuthCookieView.as_view(), name='set-auth-cookie'),
    path('debug-token/', views.DebugTokenView.as_view(), name='debug-token'),
    # Rutas del Router
    path('', include(router.urls)),
]