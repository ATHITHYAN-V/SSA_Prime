from django.apps import AppConfig
import threading
import os
 
class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
 
    def ready(self):
        # 🔥 RUN ONLY IN MAIN DJANGO PROCESS
        if os.environ.get('RUN_MAIN') != 'true':
            return
 
        from iot_service.aws_iot_connect import start_iot_listener
        threading.Thread(target=start_iot_listener, daemon=True).start()