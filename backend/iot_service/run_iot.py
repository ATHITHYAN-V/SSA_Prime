# from aws_iot_connect import start_iot_listener

# if __name__ == "__main__":
#     print("🚀 Starting IoT listener service...")
#     start_iot_listener()


import os
import sys
 
# Get project root
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
 
# Add project root to python path
sys.path.insert(0, PROJECT_ROOT)
 
# Correct Django settings module (IMPORTANT)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ssa_project.settings")
 
import django
django.setup()
 
from iot_service.aws_iot_connect import start_iot_listener
 
 
if __name__ == "__main__":
    print("Starting AWS IoT Listener...")
    start_iot_listener()