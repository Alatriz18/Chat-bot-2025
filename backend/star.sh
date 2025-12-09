#!/bin/bash
python3 -m pip install gunicorn
python3 -m gunicorn --bind 0.0.0.0:8000 --workers 3 backend.config.wsgi:application