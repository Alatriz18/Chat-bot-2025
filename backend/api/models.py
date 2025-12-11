"""
Archivo: api/models.py
Este archivo es la representación en Python de tus tablas
en la base de datos PostgreSQL.
"""
from django.db import models


class Stadmin(models.Model):
    admin_id = models.AutoField(primary_key=True)
    admin_username = models.CharField(max_length=150, unique=True)
    admin_correo = models.CharField(max_length=254, null=True, blank=True)
    admin_nombres = models.CharField(max_length=150, null=True, blank=True)
    admin_apellidos = models.CharField(max_length=150, null=True, blank=True)
    admin_rol = models.CharField(max_length=50, null=True, blank=True)
    admin_activo = models.BooleanField(default=True)
    admin_fec_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False 
        # OJO AQUÍ: Sintaxis específica para esquemas en Postgres/Django
        # Usamos comillas para asegurar que interprete el punto correctamente
        db_table = 'soporte_ti"."stadmin' 

    def __str__(self):
        return self.admin_username

class Stticket(models.Model):
    ticket_cod_ticket = models.AutoField(primary_key=True) 
    ticket_id_ticket = models.CharField(max_length=50, unique=True, blank=True, null=True) 
    ticket_des_ticket = models.TextField(blank=True, null=True)
    ticket_tip_ticket = models.CharField(max_length=50, blank=True, null=True)
    ticket_est_ticket = models.CharField(max_length=2, blank=True, null=True) 
    ticket_asu_ticket = models.CharField(max_length=255, blank=True, null=True)
    ticket_fec_ticket = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    ticket_tusua_ticket = models.CharField(max_length=100, blank=True, null=True) 
    ticket_cie_ticket = models.CharField(max_length=100, blank=True, null=True) 
    ticket_asignado_a = models.CharField(max_length=100, blank=True, null=True)
    ticket_preferencia_usuario = models.CharField(max_length=100, blank=True, null=True)
    ticket_calificacion = models.IntegerField(blank=True, null=True)
    # Campos que agregaste después (verificar si existen en SQL, el script dice que sí)
    ticket_treal_ticket = models.IntegerField(blank=True, null=True)
    ticket_obs_ticket = models.TextField(blank=True, null=True)
    ticket_calificacion = models.IntegerField(blank=True, null=True)
    class Meta:
        managed = False 
        db_table = '"soporte_ti"."stticket"' 
        ordering = ['-ticket_fec_ticket']

    def __str__(self):
        return self.ticket_id_ticket or f"Ticket {self.ticket_cod_ticket}"

class Starchivos(models.Model):
    archivo_cod_archivo = models.AutoField(primary_key=True)
    archivo_cod_ticket = models.ForeignKey(Stticket, models.DO_NOTHING, db_column='archivo_cod_ticket', blank=True, null=True)
    archivo_nom_archivo = models.CharField(max_length=255, blank=True, null=True)
    archivo_tip_archivo = models.CharField(max_length=50, blank=True, null=True)
    archivo_tam_archivo = models.BigIntegerField(blank=True, null=True)
    archivo_rut_archivo = models.CharField(max_length=500, blank=True, null=True) 
    archivo_usua_archivo = models.CharField(max_length=100, blank=True, null=True)
    archivo_fec_archivo = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    class Meta:
        managed = False
        db_table = '"soporte_ti"."starchivos"'
        ordering = ['-archivo_fec_archivo']

    def __str__(self):
        return self.archivo_nom_archivo

class Stlogchat(models.Model):
    log_cod_log = models.AutoField(primary_key=True)
    session_id = models.CharField(max_length=255, blank=True, null=True)
    username = models.CharField(max_length=100, blank=True, null=True)
    action_type = models.CharField(max_length=100, blank=True, null=True)
    action_value = models.TextField(blank=True, null=True)
    bot_response = models.TextField(blank=True, null=True)
    log_fec_log = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    class Meta:
        managed = False
        db_table = '"soporte_ti"."stlogchat"'
        ordering = ['-log_fec_log']

    def __str__(self):
        return f"{self.username} - {self.action_type}"