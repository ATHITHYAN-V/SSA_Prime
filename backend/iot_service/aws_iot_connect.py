import re
import json
import time
import requests
import os
import threading
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
from core.models import AssetBarcode,Bowser, Stationary, Tank
from django.utils import timezone
 
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
 
ENDPOINT = "a1ubcv6j7fanf3-ats.iot.ap-south-1.amazonaws.com"
LISTENER_CLIENT_ID = f"ssa_iot_listener_{int(time.time())}"
SUB_TOPIC = "SSA/DISPENSER/TRANSACT"
 
PATH_TO_CERT = os.path.join(BASE_DIR, "certs", "certificate.pem.crt")
PATH_TO_KEY = os.path.join(BASE_DIR, "certs", "private.pem.key")
PATH_TO_ROOT = os.path.join(BASE_DIR, "certs", "AmazonRootCA1.pem")
 
DJANGO_API_URL = "http://127.0.0.1:8000/iot/update/"
HEADERS = {"TZ-KEY": "ssa123"}
 
mqtt_client = None
 
 
# ================= SAFE PUBLISH =================
def safe_publish(topic, payload):
    global mqtt_client
 
    if mqtt_client is None:
        print("❌ MQTT not connected yet")
        return
 
    try:
        mqtt_client.publish(topic, json.dumps(payload), 0) # QoS 0
        print(f"📤 Published → {topic}")
    except Exception as e:
        print("❌ Publish failed:", e)
 
 
# ============================================================
# DEVICE INFO CALLBACK
# ============================================================
def device_info_callback(client, userdata, message):
 
    try:
        payload = json.loads(message.payload.decode())
        print("\n📩 DEVICE INFO REQUEST:", payload)
 
        dev_id = payload.get("devID")
 
        if not dev_id:
            print("❌ devID missing")
            return
 
        station_id = ""
        bowser_id = ""
 
        # 1️⃣ Check Bowser
        bowser = Bowser.objects.filter(mqtt_id=dev_id).first()
        if bowser and bowser.status == "active":
            station_id = bowser.station.station_id
            bowser_id = bowser.bowser_id
 
        else:
            # 2️⃣ Check Stationary
            stationary = Stationary.objects.filter(mqtt_id=dev_id).first()
            if stationary and stationary.status == "active":
                station_id = stationary.station.station_id
                bowser_id = stationary.stationary_id
 
            else:
                # 3️⃣ Check Tank
                tank = Tank.objects.filter(mqtt_id=dev_id).first()
                if tank and tank.status == "active":
                    station_id = tank.station.station_id
                    bowser_id = tank.tank_id
 
        response = {
            # "devID": dev_id,
            "stationid": station_id,
            "bowser": bowser_id
        }
 
        topic = f"SSA/{dev_id}/INFORES"
 
        safe_publish(topic, response)
 
        print("📤 INFO RESPONSE SENT:", response)
 
    except Exception as e:
        print("❌ Device info error:", e)
 
# ============================================================
# PUBLISH CONFIG MESSAGE (SERVER → DEVICE)
# ============================================================
def publish_config_message(dev_id, adm_flag, usr_flag, dev_type):
    global mqtt_client
    try:
        topic = f"SSA/{dev_id}/CONFIG"
        payload = {
            "devID": dev_id,
            "Admflg": adm_flag,
            "usrflg": usr_flag,
            "devtyp": dev_type
        }
 
        print(f"\n📤 PUBLISH CONFIG → {topic}")
        print(payload)
 
        safe_publish(topic, payload)
 
        print("✅ CONFIG Published")
    except Exception as e:
        print("❌ CONFIG publish failed:", e)
 
 
# ============================================================
# SEND RESPONSE BACK TO DEVICE
# ============================================================
def send_device_response(dev_id, status_code):
    global mqtt_client
    try:
        topic = f"SSA/{dev_id}/RESPONSE"
        payload = {
            "devID": dev_id,
            "trnrsp": {"status": status_code}
        }
 
        safe_publish(topic, payload)
 
        print("✅ RESPONSE Published")
    except Exception as e:
        print("❌ Response publish failed:", e)
 
 
# ============================================================
# SEND TO DJANGO IN A SEPARATE THREAD
# ============================================================
def process_message(payload):
    try:
        print("➡️ Sending to Django:", payload)
        res = requests.post(DJANGO_API_URL, json=payload, headers=HEADERS)
 
        dev_id = payload.get("devID")
        status = res.status_code
 
        if status in (200, 201):
            send_device_response(dev_id, 100)
        else:
            send_device_response(dev_id, 99)
            print("❌ Django error:", res.text)
 
    except Exception as e:
        print("❌ Django request failed:", e)
 
 
# ============================================================
# MODEL EXTRACTOR
# ============================================================
# def extract_model(barcode):
 
#     if barcode.startswith("THE"):
#         trimmed = barcode[3:]
#         match = re.match(r"([A-Z]+)", trimmed)
#         if match:
#             return match.group(1)
 
#     if "-" in barcode:
#         return barcode.split("-")[0]
 
#     match = re.match(r"([A-Z]+\d+)", barcode)
#     if match:
#         return match.group(1)
 
#     if barcode.isalpha():
#         return barcode
 
#     return barcode
 
# # ============================================================
# # ASSET BARCODE REQUEST CALLBACK
# # ============================================================
# def asset_request_callback(client, userdata, message):
 
#     try:
#         payload = json.loads(message.payload.decode())
#         print("📩 Asset Request:", payload)
 
#         dev_id = payload.get("devID")
#         barreq = payload.get("barreq", {})
 
#         # accept BOTH formats
#         barnum = barreq.get("barnum") or barreq.get("astnum")
 
#         if not barnum:
#             print("❌ Barcode missing in payload")
#             return
 
#         modnum = extract_model(barnum)
 
#         # 🔥 DB lookup using MODEL FIELD (your DB structure)
#         asset = AssetBarcode.objects.filter(model=barnum).first()
#         print("DB Asset Found:", asset)
 
#         valid = 99
#         volume = 0
 
#         if asset:
#             status_ok = str(asset.status).lower() == "active"
#             validity_ok = asset.valitity and asset.valitity >= timezone.now()
 
#             if status_ok and validity_ok:
#                 valid = 100
#                 volume = float(asset.volume)
 
#         response = {
#             "devID": dev_id,
#             "barrsp": {
#                 "barnum": barnum,
#                 "modnum": modnum,
#                 "valid": valid,
#                 "volume": volume
#             }
#         }
 
#         topic = f"SSA/{dev_id}/ASSET"
 
#         safe_publish(topic, response)
#         print("📤 Asset response published →", topic)
 
#     except Exception as e:
#         print("❌ Asset callback error:", e)
def extract_model(barcode):
 
    if not barcode:
        return ""
 
    barcode = barcode.strip().upper()
 
    # THEDHJLO0003972 → DHJLO
    if barcode.startswith("THE"):
        trimmed = barcode[3:]
        match = re.match(r"([A-Z]+)", trimmed)
        if match:
            return match.group(1)
 
    # NX30-00145 → NX30
    if "-" in barcode:
        return barcode.split("-")[0]
   
    if "_" in barcode:
        return barcode.split("_")[0]
 
    # SPO25551 → SPO
    match = re.match(r"([A-Z]+)", barcode)
    if match:
        return match.group(1)
 
    # ADBL / DHJL
    if barcode.isalpha():
        return barcode
 
    return barcode
 
 
# MAIN IOT CALLBACK
def asset_request_callback(client, userdata, message):
 
    try:
        payload = json.loads(message.payload.decode())
        print("📩 Incoming:", payload)
 
        dev_id = payload.get("devID")
        barreq = payload.get("barreq", {})
        barnum = barreq.get("barnum") or barreq.get("astnum")
 
        if not barnum:
            print("❌ No barcode")
            return
 
        # STEP 1 → extract model
        modnum = extract_model(barnum)
        print("Extracted model:", modnum)
 
        # STEP 2 → find DB match using MODEL MASTER
        asset = AssetBarcode.objects.filter(model=modnum).first()
        print("DB match:", asset)
 
        valid = 99
        volume = 0
 
        if asset:
 
            status_ok = str(asset.status).lower() == "active"
 
            if asset.valitity.tzinfo is None:
                asset.valitity = timezone.make_aware(asset.valitity)
 
            validity_ok = asset.valitity >= timezone.now()
 
            if status_ok and validity_ok:
                valid = 100
                volume = float(asset.volume)
 
        # STEP 3 → send response
        response = {
            "devID": dev_id,
            "barrsp": {
                "barnum": barnum,
                "modnum": modnum,
                "valid": valid,
                "volume": volume
            }
        }
 
        topic = f"SSA/{dev_id}/ASSET"
 
        safe_publish(topic, response)
 
        print("📤 Sent:", response)
 
    except Exception as e:
        print("❌ IoT error:", e)
# ============================================================
# MQTT CALLBACK
# ============================================================
def message_callback(client, userdata, message):
    try:
        payload = json.loads(message.payload.decode())
        print("\n📩 RECEIVED:", payload)
 
        threading.Thread(target=process_message, args=(payload,)).start()
 
    except Exception as e:
        print("❌ MQTT callback error:", e)
 
 
# ============================================================
# START AWS IOT LISTENER
# ============================================================
def start_iot_listener():
    global mqtt_client
 
    print("🚀 Starting AWS IoT Listener...")
 
    mqtt_client = AWSIoTMQTTClient(LISTENER_CLIENT_ID)
    mqtt_client.configureEndpoint(ENDPOINT, 8883)
    mqtt_client.configureCredentials(PATH_TO_ROOT, PATH_TO_KEY, PATH_TO_CERT)
 
    mqtt_client.configureAutoReconnectBackoffTime(1, 32, 20)
    mqtt_client.configureOfflinePublishQueueing(-1)
    mqtt_client.configureDrainingFrequency(2)
    mqtt_client.configureConnectDisconnectTimeout(10)
    mqtt_client.configureMQTTOperationTimeout(20)
 
    print("🔌 Connecting to AWS IoT...")
    mqtt_client.connect()
    print("✅ CONNECTED to AWS IoT Core")
    print("===============================")
 
    mqtt_client.subscribe(SUB_TOPIC, 1, message_callback)
    print(f"👂 Subscribed to: {SUB_TOPIC}")
    print("===============================")
 
 
    mqtt_client.subscribe("SSA/REQUEST/ASSET", 1, asset_request_callback)
    print("👂 Subscribed to: SSA/REQUEST/ASSET")
    print("===============================")
 
    mqtt_client.subscribe("SSA/DEVICEINFO/INFOREQ", 1, device_info_callback)
    print("👂 Subscribed to: SSA/DEVICEINFO/INFOREQ")
    print("=========================================")
    while True:
        time.sleep(1)
 
 
if __name__ == "__main__":
    start_iot_listener()
 