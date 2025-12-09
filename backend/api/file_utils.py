import os
import uuid
from django.conf import settings

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in settings.ALLOWED_EXTENSIONS

def allowed_audio_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in settings.ALLOWED_AUDIO_EXTENSIONS

def secure_filename(filename):
    """Función similar a werkzeug.secure_filename"""
    import re
    filename = re.sub(r'[^\w\.-]', '_', filename)
    return filename