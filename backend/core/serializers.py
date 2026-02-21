from rest_framework import serializers
from .models import (
    Transaction, SuperAdmin, Admin, User,
    Station, Bowser, Stationary, Tank, UserAssignment, AssetBarcode
)

# ====================================================================
# 1. REGISTER USER SERIALIZER (simple and correct)
# ====================================================================
class RegisterUserSerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)
    portal_id = serializers.CharField(required=True)


# ====================================================================
# 2. LOGIN SERIALIZER (NO ROLE — auto detect)
# ====================================================================
class NewLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)
    portal_id = serializers.CharField(required=False, allow_blank=True)


# ====================================================================
# 3. SUPERADMIN SERIALIZER
# ====================================================================
class SuperAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuperAdmin
        fields = [
            "super_admin_id",
            "name",
            "email",
            "password",
            "status",
            "created_on"
        ]


# ====================================================================
# 4. ADMIN SERIALIZER
# ====================================================================
class AdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Admin
        fields = [
            "admin_id",
            "super_admin",
            "name",
            "email",
            "password",
            "portal_id",
            "status",
            "created_on"
        ]


# ====================================================================
# 5. USER SERIALIZER
# ====================================================================
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "admin",
            "name",
            "email",
            "password",
            "portal_id",
            "created_on"
        ]
        extra_kwargs = {
            "password": {"write_only": True}
        }


# ====================================================================
# 6. TRANSACTION SERIALIZER
# ====================================================================
class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = "__all__"


# ====================================================================
# 7. STATION SERIALIZER
# ====================================================================
class StationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Station
        fields = "__all__"


# ====================================================================
# COMMON MQTT VALIDATION
# ====================================================================
def validate_mqtt(value):
    if not (isinstance(value, str) and len(value) == 10 and value.isalnum()):
         raise ValueError("MQTT ID must be exactly 10 alphanumeric characters.")
    return value


# ====================================================================
# 8. BOWSER SERIALIZER
# ====================================================================
class BowserSerializer(serializers.ModelSerializer):
    mqtt_id = serializers.CharField(validators=[validate_mqtt])
    # station = serializers.CharField()


    class Meta:
        model = Bowser
        fields = "__all__"
        extra_kwargs = {
            "station": {"read_only": True}
        }

    def validate(self, data):
        mqtt = data.get("mqtt_id", getattr(self.instance, "mqtt_id", None))
        qs = Bowser.objects.filter(mqtt_id=mqtt)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError({"mqtt_id": "MQTT already in use"})
        return data


# ====================================================================
# 9. STATIONARY SERIALIZER
# ====================================================================
class StationarySerializer(serializers.ModelSerializer):
    mqtt_id = serializers.CharField(validators=[validate_mqtt])
    # station = serializers.CharField(read_only=True)


    class Meta:
        model = Stationary
        fields = "__all__"
        extra_kwargs = {
            "station": {"read_only": True}
        }


    def validate(self, data):
        mqtt = data.get("mqtt_id", getattr(self.instance, "mqtt_id", None))
        qs = Stationary.objects.filter(mqtt_id=mqtt)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError({"mqtt_id": "MQTT already in use"})
        return data


# ====================================================================
# 10. TANK SERIALIZER
# ====================================================================
class TankSerializer(serializers.ModelSerializer):
    mqtt_id = serializers.CharField(validators=[validate_mqtt])
    # station = serializers.CharField(read_only=True)

    class Meta:
        model = Tank
        fields = "__all__"
        extra_kwargs = {
            "station": {"read_only": True}
        }

    def validate(self, data):
        mqtt = data.get("mqtt_id", getattr(self.instance, "mqtt_id", None))
        qs = Tank.objects.filter(mqtt_id=mqtt)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError({"mqtt_id": "MQTT already in use"})
        return data


class UserAssignmentSerializer(serializers.ModelSerializer):
    station = StationSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    admin = AdminSerializer(read_only=True)

    class Meta:
        model = UserAssignment
        fields = "__all__"



 
class AssetBarcodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetBarcode
        fields = "__all__"