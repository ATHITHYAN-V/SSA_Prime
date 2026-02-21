from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
 
 
# ============================================================
# 1. CUSTOM USER (Only for Register/Login Panel)
# ============================================================
class CustomUser(AbstractUser):
    portalId = models.CharField(max_length=100, blank=True, null=True)
    api_key = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
 
    def set_password(self, raw_password):
        # Store plain text based on your requirement
        self.password = raw_password
 
    def check_password(self, raw_password):
        return self.password == raw_password
 
    def __str__(self):
        return self.username
 
 
from django.db import models


# ============================================================
# TRANSACTION MODEL (IoT Data)
# ============================================================
class Transaction(models.Model):
    id = models.AutoField(primary_key=True)

    # Device Info
    devID = models.CharField(max_length=50)
    stnID = models.CharField(max_length=50, null=True, blank=True)

    # Date & Time
    todate = models.CharField(max_length=20, null=True, blank=True)
    totime = models.CharField(max_length=20, null=True, blank=True)

    # Transaction Details
    trnsid = models.CharField(max_length=150, null=True, blank=True)
    trnvol = models.FloatField(null=True, blank=True)
    trnamt = models.FloatField(null=True, blank=True)
    utpriz = models.FloatField(null=True, blank=True)

    # Totalizer Data
    totvol = models.FloatField(null=True, blank=True)
    totamt = models.FloatField(null=True, blank=True)

    # Pump Status
    pmpsts = models.CharField(max_length=50, null=True, blank=True)

    # =====================================================
    # Bowser Fields (Mobile Fuel Bowser)
    # =====================================================
    bwsrid = models.CharField(max_length=50, null=True, blank=True)
    pumpid = models.CharField(max_length=50, null=True, blank=True)

    vehnum = models.CharField(max_length=50, null=True, blank=True)

    # NEW Fields from JSON
    mobnum = models.CharField(max_length=20, null=True, blank=True)
    barnum = models.CharField(max_length=50, null=True, blank=True)

    # =====================================================
    # Stationary Pump Fields (Optional)
    # =====================================================
    stanid = models.CharField(max_length=50, null=True, blank=True)
    pmpid = models.CharField(max_length=50, null=True, blank=True)
    attnid = models.CharField(max_length=50, null=True, blank=True)

    # =====================================================
    # Tank Fields (Optional)
    # =====================================================
    tankid = models.CharField(max_length=50, null=True, blank=True)

    # Transaction Type
    type = models.CharField(max_length=20, null=True, blank=True)

    # Environmental Data
    tmprtr = models.FloatField(null=True, blank=True)
    hmidty = models.FloatField(null=True, blank=True)

    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)

    # =====================================================
    # Meta Settings
    # =====================================================
    class Meta:
        db_table = "transactions"
        managed = True   # ✅ Change to True if you want migrations

    def __str__(self):
        return f"{self.devID} - {self.trnsid}"

 
 
# ============================================================
# 3. SUPER ADMIN TABLE
# ============================================================
class SuperAdmin(models.Model):
    super_admin_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, null=True)
    email = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    status = models.CharField(max_length=20, null=True)
    created_on = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = "super_admin"
        managed = False
 
    def __str__(self):
        return self.email
 
 
# ============================================================
# 4. ADMIN TABLE
# ============================================================
class Admin(models.Model):
    admin_id = models.AutoField(primary_key=True)
 
    super_admin = models.ForeignKey(
        SuperAdmin,
        on_delete=models.CASCADE,
        null=True
    )
 
    name = models.CharField(max_length=45, null=True)
    email = models.CharField(max_length=45, unique=True)
    password = models.CharField(max_length=45)
    portal_id = models.CharField(max_length=45)
    status = models.CharField(max_length=20, null=True)
    created_on = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = "admin"
        managed = False
 
    def __str__(self):
        return self.email
 
 
# ============================================================
# 5. USER TABLE (Corrected to match RDS exactly)
# ============================================================
class User(models.Model):
    id = models.AutoField(primary_key=True)
 
    admin = models.ForeignKey(
        Admin,
        on_delete=models.CASCADE,
        null=True,
        db_column="admin_id"
    )
 
    name = models.CharField(max_length=100, null=True)
    email = models.CharField(max_length=100, null=True)
    status = models.CharField(max_length=20, null=True)
    created_on = models.DateTimeField(auto_now_add=True)
 
    password = models.CharField(max_length=45)
    portal_id = models.CharField(max_length=45)
 
    class Meta:
        db_table = "user"
        managed = False
 
    def __str__(self):
        return self.email
 
 
# ============================================================
# 6. STATION TABLE
# ============================================================
class Station(models.Model):
    id = models.AutoField(primary_key=True)
    
    station_name = models.CharField(max_length=100)
    
    # Validated by frontend to be STSSAXXXXX (Caps)
    station_id = models.CharField(max_length=10, unique=True)
    
    # Location and Description mandatory for industrial use
    location = models.CharField(max_length=200, null=False, blank=False)
    description = models.TextField(null=False, blank=False)
    
    # Free text category name (no choices)
    category = models.CharField(max_length=50, null=False, blank=False)

    created_by_admin = models.ForeignKey(
        'Admin',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column="created_by_admin_id"
    )

    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive")
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="inactive")

    created_on = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "stations"
        managed = False

    def __str__(self):
        return f"{self.station_name} ({self.station_id})"
# ============================================================
# 7. BOWSER TABLE
# ============================================================
class Bowser(models.Model):
    id = models.AutoField(primary_key=True)
 
    # Correct Django FK (maps to DB column station_id)
    station = models.ForeignKey(
        Station,
        to_field="station_id",
        db_column="station_id",
        on_delete=models.CASCADE
    )
 
    bowser_id = models.CharField(max_length=100)
    bowser_name = models.CharField(max_length=150)
    bowser_description = models.TextField(null=True, blank=True)
    mqtt_id = models.CharField(max_length=10, unique=True)
 
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive")
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="inactive")
 
    created_on = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = "bowsers"
        managed = False
 
    def __str__(self):
        return self.bowser_name
 
 
# ============================================================
# 8. STATIONARY TABLE
# ============================================================
class Stationary(models.Model):
    id = models.AutoField(primary_key=True)
 
    station = models.ForeignKey(
        Station,
        to_field="station_id",
        db_column="station_id",
        on_delete=models.CASCADE
    )
 
    stationary_id = models.CharField(max_length=100)
    stationary_name = models.CharField(max_length=150)
    stationary_description = models.TextField(null=True, blank=True)
    mqtt_id = models.CharField(max_length=10, unique=True)
 
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive")
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="inactive")
 
    created_on = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = "stationaries"
        managed = False
 
    def __str__(self):
        return self.stationary_name
 
 
# ============================================================
# 9. TANK TABLE
# ============================================================
class Tank(models.Model):
    id = models.AutoField(primary_key=True)
 
    station = models.ForeignKey(
        Station,
        to_field="station_id",
        db_column="station_id",
        on_delete=models.CASCADE
    )
 
    tank_id = models.CharField(max_length=100)
    tank_name = models.CharField(max_length=150)
    tank_description = models.TextField(null=True, blank=True)
    mqtt_id = models.CharField(max_length=10, unique=True)
    pump_count = models.IntegerField()  # 1 to 4
 
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive")
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="inactive")
 
    created_on = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = "tanks"
        managed = False
 
    def __str__(self):
        return self.tank_name
 


 
class UserAssignment(models.Model):
    id = models.AutoField(primary_key=True)
 
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    admin = models.ForeignKey(Admin, on_delete=models.CASCADE, db_column="admin_id")
   
    admin_name = models.CharField(max_length=100, null=True)
 
    station = models.ForeignKey(
        Station,
        to_field="station_id",
        db_column="station_id",
        on_delete=models.CASCADE
    )
 
    assigned_on = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = "user_assignments"
        managed = False
 
 
 
 
class AuthToken(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    role = models.CharField(max_length=20)
 
    superadmin = models.ForeignKey(
        "SuperAdmin",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        db_column="super_admin_id"   # ✅ IMPORTANT FIX
    )
 
    admin = models.ForeignKey(
        "Admin",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        db_column="admin_id"
    )
 
    user = models.ForeignKey(
        "User",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        db_column="user_id"
    )
 
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        managed = False
        db_table = "auth_token"


# ============================================================
# 10. AssetBarcode
# ============================================================


class AssetBarcode(models.Model):
    id = models.AutoField(primary_key=True)
    model = models.CharField(max_length=100, unique=True, blank=False)
    volume = models.DecimalField(max_digits=10, decimal_places=2, blank=False)
    descriptions = models.CharField(max_length=45, null=True, blank=True)
    valitity = models.DateTimeField()
    status = models.CharField(max_length=10)  # active / inactive

    created_by_user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column="created_by_user_id"
    )
    
    created_by_admin = models.ForeignKey(
        Admin,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column="created_by_admin_id"
    )

    class Meta:
        db_table = "Asset_barcode"
        managed = False
 
    def __str__(self):
        return self.model
