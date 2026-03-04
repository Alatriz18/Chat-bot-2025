from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TicketViewSet,
    ArchivoViewSet,
    LogChatViewSet,
    SetAuthCookieView,
    LogSolvedTicketView,
    AdminListView,
    ActiveUsersListView,
    AdminTicketListView,
    AdminTicketDetailView,
    ReassignTicketView,
    AssignAdminView,
    GeneratePresignedUrlView,
    ConfirmUploadView,
    DebugTokenView,
    # Notificaciones de sonido
    NotificationSoundUploadView,
    NotificationSoundDeleteView,
    CheckNotificationSoundView,
)

router = DefaultRouter()
router.register(r'tickets', TicketViewSet, basename='ticket')
router.register(r'archivos', ArchivoViewSet, basename='archivo')
router.register(r'logs', LogChatViewSet, basename='log')

urlpatterns = [
    # ── Router (tickets, archivos, logs) ──
    path('', include(router.urls)),

    # ── Auth ──
    path('auth/set-cookie/', SetAuthCookieView.as_view()),
    path('debug/token/', DebugTokenView.as_view()),

    # ── Tickets de usuario ──
    path('tickets/solved/', LogSolvedTicketView.as_view()),
    path('tickets/<int:ticket_id>/generate-presigned-url/', GeneratePresignedUrlView.as_view()),
    path('tickets/<int:ticket_id>/confirm-upload/', ConfirmUploadView.as_view()),

    # ── Admin ──
    path('admins/', AdminListView.as_view()),
    path('users/active', ActiveUsersListView.as_view()),
    path('admin/tickets/', AdminTicketListView.as_view()),
    path('admin/tickets/<int:pk>/', AdminTicketDetailView.as_view()),
    path('admin/tickets/<int:pk>/reassign/', ReassignTicketView.as_view()),
    path('admin/tickets/<int:pk>/assign/', AssignAdminView.as_view()),

    # ── Sonidos de notificación (S3) ── ← NUEVAS
    path('notifications/sounds/upload/', NotificationSoundUploadView.as_view()),
    path('notifications/sounds/delete/', NotificationSoundDeleteView.as_view()),
    path('notifications/sounds/check/',  CheckNotificationSoundView.as_view()),
]