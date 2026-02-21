from django.shortcuts import render, get_object_or_404
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes,authentication_classes, parser_classes
from rest_framework.permissions import AllowAny
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import random

from rest_framework.decorators import api_view, permission_classes
from .authentication import APIKeyAuthentication,TokenAuthentication
from .permissions import IsSuperAdmin, IsAdmin, IsAdminOrSuperAdmin, IsUser, IsAnyAuthenticated
from django.db.models import Q
from iot_service.aws_iot_connect import publish_config_message


from .models import SuperAdmin, Admin, User, Station, Bowser, Stationary, Tank, Transaction, UserAssignment, AuthToken,AssetBarcode
from .serializers import (
    NewLoginSerializer, StationSerializer, BowserSerializer,
    StationarySerializer, TankSerializer, TransactionSerializer,
    AdminSerializer, UserSerializer, RegisterUserSerializer, SuperAdminSerializer, UserAssignmentSerializer,AssetBarcodeSerializer

)

# # ============================================================
# # RESPONSE FORMATTER
# # ============================================================
# def resp(code, msg, data=None):
#     return Response({"code": code, "status": msg, "data": data}, status=code)

# def generate_portal_id():
#     return "SSA" + "".join(str(random.randint(0, 9)) for _ in range(9))
# # ============================================================
# # LOGIN SERVICE (superadmin / admin / user)
# # ============================================================
# class LoginView(APIView):
#     permission_classes = [AllowAny]

#     @swagger_auto_schema(security=[{'TZKey': []}],
#         request_body=NewLoginSerializer,
#         operation_description="Auto-detect login: superadmin / admin / user"
#     )
#     def post(self, request):

#         email = request.data.get("email")
#         password = request.data.get("password")
#         portal_id = request.data.get("portal_id")

#         if not email or not password:
#             return resp(400, "email and password required")

#         # 1️⃣ SUPERADMIN LOGIN (does NOT need portal_id)
#         sa = SuperAdmin.objects.filter(email=email, password=password).first()
#         if sa:
#             return resp(200, "superadmin_login_success", {
#                 "role": "superadmin",
#                 "id": sa.super_admin_id,
#                 "name": sa.name,
#                 "email": sa.email
#             })

#         # 2️⃣ ADMIN LOGIN (must match email+password+portal)
#         if portal_id:
#             admin = Admin.objects.filter(
#                 email=email,
#                 password=password,
#                 portal_id=portal_id
#             ).first()

#             if admin:
#                 return resp(200, "admin_login_success", {
#                     "role": "admin",
#                     "id": admin.admin_id,
#                     "name": admin.name,
#                     "portal_id": admin.portal_id,
#                     "email": admin.email
#                 })

#         # 3️⃣ USER LOGIN (must match email+password+portal)
#         if portal_id:
#             user = User.objects.filter(
#                 email=email,
#                 password=password,
#                 portal_id=portal_id
#             ).first()

#             if user:
#                 return resp(200, "user_login_success", {
#                     "role": "user",
#                     "id": user.id,
#                     "name": user.name,
#                     "portal_id": user.portal_id,
#                     "email": user.email
#                 })

#         # No match
#         return resp(401, "Invalid credentials")

# # ============================================================
# # REGISTER SERVICE
# # ============================================================
# class RegisterRoleView(APIView):
#     permission_classes = [AllowAny]

#     @swagger_auto_schema(
#         request_body=openapi.Schema(
#             type=openapi.TYPE_OBJECT,
#             required=[
#                 "creator_email", "creator_password",
#                 "role", "name", "email", "password"
#             ],
#             properties={
#                 "creator_email": openapi.Schema(type=openapi.TYPE_STRING),
#                 "creator_password": openapi.Schema(type=openapi.TYPE_STRING),

#                 "role": openapi.Schema(type=openapi.TYPE_STRING),  # admin/user
#                 "name": openapi.Schema(type=openapi.TYPE_STRING),
#                 "email": openapi.Schema(type=openapi.TYPE_STRING),
#                 "password": openapi.Schema(type=openapi.TYPE_STRING),
#                 "portal_id": openapi.Schema(type=openapi.TYPE_STRING),
#             }
#         ),
#         operation_description="SuperAdmin → Admin/User | Admin → User"
#     )
#     def post(self, request):

#         creator_email = request.data.get("creator_email")
#         creator_password = request.data.get("creator_password")

#         role = request.data.get("role")   # admin OR user
#         name = request.data.get("name")
#         email = request.data.get("email")
#         password = request.data.get("password")
#         portal_id = request.data.get("portal_id")

#         # 1️⃣ CHECK IF CREATOR IS SUPERADMIN
#         superadmin = SuperAdmin.objects.filter(
#             email=creator_email, password=creator_password
#         ).first()

#         # 2️⃣ CHECK IF CREATOR IS ADMIN
#         admin_creator = Admin.objects.filter(
#             email=creator_email, password=creator_password
#         ).first()

#         # ============================================================
#         # SUPERADMIN CREATES ADMIN
#         # ============================================================
#         if role == "admin":

#             if not superadmin:
#                 return resp(403, "Only superadmin can create admin")

#             if not portal_id:
#                 return resp(400, "portal_id required for admin")

#             Admin.objects.create(
#                 super_admin=superadmin,
#                 name=name,
#                 email=email,
#                 password=password,
#                 portal_id=portal_id
#             )

#             return resp(201, "Admin created successfully")

#         # ============================================================
#         # CREATE USER (SUPERADMIN or ADMIN)
#         # ============================================================
#         if role == "user":

#             # SUPERADMIN → USER
#             if superadmin:
#                 User.objects.create(
#                     admin=None,
#                     name=name,
#                     email=email,
#                     password=password,
#                     portal_id=portal_id
#                 )
#                 return resp(201, "User created (superadmin)")

#             # ADMIN → USER
#             if admin_creator:
#                 User.objects.create(
#                     admin=admin_creator,
#                     name=name,
#                     email=email,
#                     password=password,
#                     portal_id=admin_creator.portal_id   # inherit admin portal
#                 )
#                 return resp(201, "User created (admin)")

#             return resp(403, "Only superadmin or admin can create user")

#         return resp(400, "role must be admin or user")



# # ============================================================
# # CLEAN CRUD SERVICE (superadmin + admin)
# # ============================================================
# # ========================================================================
# # ACTION ENUM (Allowed CRUD operations)
# # ========================================================================

# SUPERADMIN_ACTIONS = [
#     "create_admin",
#     "update_admin",
#     "delete_admin",
#     "get_admins",

#     "create_user",
#     "update_user",
#     "delete_user",
#     "get_users",
# ]

# ADMIN_ACTIONS = [
#     "create_user",
#     "update_user",
#     "delete_user",
#     "get_users",
# ]

# USER_ACTIONS = [
#     "profile",
# ]

# ALL_ACTIONS = SUPERADMIN_ACTIONS + ADMIN_ACTIONS + USER_ACTIONS
# # ========================================================================


# @swagger_auto_schema(
#     method='post',
#     operation_description="Unified CRUD for SuperAdmin / Admin / User",
#     request_body=openapi.Schema(
#         type=openapi.TYPE_OBJECT,
#         required=["email", "password", "action"],
#         properties={
#             "email": openapi.Schema(type=openapi.TYPE_STRING),
#             "password": openapi.Schema(type=openapi.TYPE_STRING),

#             "action": openapi.Schema(
#                 type=openapi.TYPE_STRING,
#                 enum=ALL_ACTIONS,  # ⭐ Swagger dropdown
#                 description="Choose an action"
#             ),

#             "portal_id": openapi.Schema(type=openapi.TYPE_STRING),
#             "data": openapi.Schema(type=openapi.TYPE_OBJECT),
#         }
#     )
# )
# @api_view(["POST"])
# @authentication_classes([TokenAuthentication])
# @permission_classes([IsAnyAuthenticated])# def manage_users(request):

#     email = request.data.get("email")
#     password = request.data.get("password")
#     action = request.data.get("action")
#     portal_id = request.data.get("portal_id")
#     data = request.data.get("data", {})

#     # -------------------------------
#     # Validate action
#     # -------------------------------
#     if action not in ALL_ACTIONS:
#         return resp(400, f"Invalid action. Allowed: {ALL_ACTIONS}")

#     # -------------------------------
#     # Auto detect role
#     # -------------------------------
#     sa = SuperAdmin.objects.filter(email=email, password=password).first()
#     admin_obj = Admin.objects.filter(email=email, password=password).first()
#     user_obj = User.objects.filter(email=email, password=password).first()

#     if sa:
#         actor_role = "superadmin"
#     elif admin_obj:
#         actor_role = "admin"
#     elif user_obj:
#         actor_role = "user"
#     else:
#         return resp(403, "Invalid credentials")

#     # ===================================================================
#     # SUPERADMIN ACTIONS
#     # ===================================================================
#     if actor_role == "superadmin":

#         # CREATE ADMIN
#         if action == "create_admin":
#             Admin.objects.create(
#                 super_admin=sa,
#                 name=data["name"],
#                 email=data["email"],
#                 password=data["password"],
#                 portal_id=data["portal_id"]
#             )
#             return resp(201, "Admin created")

#         # UPDATE ADMIN
#         if action == "update_admin":
#             admin = Admin.objects.filter(admin_id=data["admin_id"]).first()
#             if not admin:
#                 return resp(404, "Admin not found")

#             for k, v in data.items():
#                 if k != "admin_id":
#                     setattr(admin, k, v)
#             admin.save()
#             return resp(200, "Admin updated")

#         # DELETE ADMIN
#         if action == "delete_admin":
#             Admin.objects.filter(admin_id=data["admin_id"]).delete()
#             return resp(200, "Admin deleted")

#         # GET ADMINS (optional portal filter)
#         if action == "get_admins":
#             if portal_id:
#                 admins = Admin.objects.filter(portal_id=portal_id)
#             else:
#                 admins = Admin.objects.all()
#             return resp(200, "Fetched", AdminSerializer(admins, many=True).data)

#         # ----------------------------------------------------------------------------------
#         # USER CRUD
#         # ----------------------------------------------------------------------------------

#         if action == "create_user":
#             User.objects.create(
#                 admin=None,
#                 name=data["name"],
#                 email=data["email"],
#                 password=data["password"],
#                 portal_id=data["portal_id"],
#             )
#             return resp(201, "User created")

#         if action == "update_user":
#             user = User.objects.filter(id=data["id"]).first()
#             if not user:
#                 return resp(404, "User not found")

#             for k, v in data.items():
#                 if k != "id":
#                     setattr(user, k, v)
#             user.save()
#             return resp(200, "User updated")

#         if action == "delete_user":
#             User.objects.filter(id=data["id"]).delete()
#             return resp(200, "User deleted")

#         if action == "get_users":
#             if portal_id:
#                 users = User.objects.filter(portal_id=portal_id)
#             else:
#                 users = User.objects.all()
#             return resp(200, "Fetched", UserSerializer(users, many=True).data)

#     # ===================================================================
#     # ADMIN ACTIONS  (restricted by portal_id)
#     # ===================================================================
#     if actor_role == "admin":

#         # my_portal = admin_obj.portal_id

#         if action == "create_user":
#             User.objects.create(
#                 admin=admin_obj,
#                 name=data["name"],
#                 email=data["email"],
#                 password=data["password"],
#                 portal_id=data["portal_id"]
#             )
#             return resp(201, "User created")

#         if action == "update_user":
#             user = User.objects.filter(id=data["id"], portal_id=my_portal).first()
#             if not user:
#                 return resp(403, "No permission")

#             for k, v in data.items():
#                 if k != "id":
#                     setattr(user, k, v)
#             user.save()
#             return resp(200, "User updated")

#         if action == "delete_user":
#             user = User.objects.filter(id=data["id"], portal_id=my_portal)
#             if not user.exists():
#                 return resp(403, "No permission")

#             user.delete()
#             return resp(200, "User deleted")

#         if action == "get_users":
#             users = User.objects.filter(portal_id=my_portal)
#             return resp(200, "Fetched", UserSerializer(users, many=True).data)

#     # ===================================================================
#     # USER ACTIONS
#     # ===================================================================
#     if actor_role == "user":
#         if action == "profile":
#             return resp(200, "Fetched", UserSerializer(user_obj).data)

#     return resp(400, "Invalid role or action")







#====================================================
#=======================New=========================

# ============================================================
# RESPONSE FORMATTER
# ============================================================
def resp(code, msg, data=None):
    return Response({"code": code, "status": msg, "data": data}, status=code)


# ============================================================
# LOGIN SERVICE
# ============================================================
class LoginView(APIView):
    permission_classes = [AllowAny]   # Public
    authentication_classes = []       # No token required

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["email", "password"],
            properties={
                "email": openapi.Schema(type=openapi.TYPE_STRING),
                "password": openapi.Schema(type=openapi.TYPE_STRING),
                "portal_id": openapi.Schema(type=openapi.TYPE_STRING, description="Required for admin/user")
            },
        ),
        operation_description="Login as superadmin / admin / user"
    )
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        portal_id = request.data.get("portal_id")

        if not email or not password:
            return resp(400, "Email and password required")

        try:
            # ================= SUPERADMIN =================
            sa = SuperAdmin.objects.filter(
                email=email,
                password=password
            ).first()

            if sa:
                try:
                    token = AuthToken.objects.create(
                        role="superadmin",
                        superadmin=sa
                    )
                except Exception as e:
                    # Fallback if token creation fails (e.g. DB mismatch)
                    print(f"Token creation failed: {e}")
                    # Return success without token if critical, or return error. 
                    # Assuming token is needed for future requests, we must fix this.
                    # Returning error for now to debug.
                    return resp(500, f"Token Creation Error: {str(e)}")

                return resp(200, "superadmin_login_success", {
                    "role": "superadmin",
                    "id": sa.super_admin_id,
                    "name": sa.name,
                    "email": sa.email,
                    "token": str(token.token)
                })

            # ================= ADMIN =================
            if not portal_id:
                # If checking Admin/User, portal_id is required. 
                # If user intended SuperAdmin but failed credentials, they might see this if they didn't provide portal_id.
                # However, valid flow is: if no portal_id, only check SA. If SA fails, return Invalid Creds (or 400 portal_id required).
                return resp(400, "portal_id required for admin/user login")

            admin_obj = Admin.objects.filter(
                email=email,
                password=password,
                portal_id=portal_id
            ).first()

            if admin_obj:
                try:
                    token = AuthToken.objects.create(
                        role="admin",
                        admin=admin_obj
                    )
                except Exception as e:
                     return resp(500, f"Token Creation Error: {str(e)}")

                return resp(200, "admin_login_success", {
                    "role": "admin",
                    "id": admin_obj.admin_id,
                    "name": admin_obj.name,
                    "email": admin_obj.email,
                    "portal_id": admin_obj.portal_id,
                    "token": str(token.token)
                })

            # ================= USER =================
            user_obj = User.objects.filter(
                email=email,
                password=password,
                portal_id=portal_id
            ).first()

            if user_obj:
                try:
                    token = AuthToken.objects.create(
                        role="user",
                        user=user_obj
                    )
                except Exception as e:
                     return resp(500, f"Token Creation Error: {str(e)}")

                return resp(200, "user_login_success", {
                    "role": "user",
                    "id": user_obj.id,
                    "name": user_obj.name,
                    "email": user_obj.email,
                    "portal_id": user_obj.portal_id,
                    "token": str(token.token)
                })
            
            return resp(401, "Invalid credentials")

        except Exception as e:
            return resp(500, f"Login Error: {str(e)}")

        return resp(401, "Invalid credentials")

# ============================================================
# REGISTER SERVICE (SuperAdmin -> Admin/User | Admin -> User)
# ============================================================
class RegisterRoleView(APIView):
    permission_classes = [IsAnyAuthenticated]
    authentication_classes = [TokenAuthentication]

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["role", "name", "email", "password", "portal_id"],
            properties={
                "role": openapi.Schema(type=openapi.TYPE_STRING),
                "name": openapi.Schema(type=openapi.TYPE_STRING),
                "email": openapi.Schema(type=openapi.TYPE_STRING),
                "password": openapi.Schema(type=openapi.TYPE_STRING),
                "portal_id": openapi.Schema(type=openapi.TYPE_STRING),
            }
        ),
        operation_description="SuperAdmin → Admin/User | Admin → User"
    )
    def post(self, request):
        actor = request.actor
        role = request.data.get("role")
        name = request.data.get("name")
        email = request.data.get("email")
        password = request.data.get("password")
        portal_id = request.data.get("portal_id")

        if role == "admin":
            if getattr(actor, 'super_admin_id', None) is None:
                return resp(403, "Only superadmin can create admin")
            if not portal_id:
                return resp(400, "portal_id required for admin")
            Admin.objects.create(
                super_admin=actor,
                name=name,
                email=email,
                password=password,
                portal_id=portal_id
            )
            return resp(201, "Admin created successfully")

        if role == "user":
            if getattr(actor, 'super_admin_id', None):  # superadmin
                User.objects.create(
                    admin=None,
                    name=name,
                    email=email,
                    password=password,
                    portal_id=portal_id
                )
                return resp(201, "User created (superadmin)")
            elif getattr(actor, 'admin_id', None):      # admin
                User.objects.create(
                    admin=actor,
                    name=name,
                    email=email,
                    password=password,
                    portal_id=portal_id
                )
                return resp(201, "User created (admin)")
            else:
                return resp(403, "Unauthorized to create user")

        return resp(400, "role must be admin or user")


#============================================================================================
# Access Functions
#============================================================================================
def can_access_station(request, station):
    role = request.role
    actor = request.actor

    if role == "superadmin":
        return True

    if role == "admin":
        # FIX: station has NO portal_id
        if not station.created_by_admin:
            return False
        return station.created_by_admin.portal_id == actor.portal_id

    if role == "user":
        return UserAssignment.objects.filter(
            user=actor,
            station=station
        ).exists()

    return False



# ============================================================
# ACTION ENUMS
# ============================================================
SUPERADMIN_ACTIONS = [
    "create_admin", "update_admin", "delete_admin", "get_admins",
    "create_user", "update_user", "delete_user", "get_users",
    "reset_password"
]

ADMIN_ACTIONS = [
    "create_user", "update_user", "delete_user", "get_users",
    "reset_password","update_profile"
]

USER_ACTIONS = [
    "profile",
    "change_password",
    "update_profile" 
]

ALL_ACTIONS = list(set(SUPERADMIN_ACTIONS + ADMIN_ACTIONS + USER_ACTIONS))


# ============================================================
# RESPONSE HELPER
# ============================================================
def resp(code, status, data=None):
    return Response(
        {"code": code, "status": status, "data": data},
        status=code
    )


# ============================================================
# SWAGGER SCHEMA
# ============================================================
ManageUserRequestSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=["action"],
    properties={
        "action": openapi.Schema(
            type=openapi.TYPE_STRING,
            enum=ALL_ACTIONS,
            description="Action to perform"
        ),
        "data": openapi.Schema(
            type=openapi.TYPE_OBJECT,
            description="Payload depends on action",
            properties={
                "user_id": openapi.Schema(type=openapi.TYPE_INTEGER),
                "name": openapi.Schema(type=openapi.TYPE_STRING),
                "email": openapi.Schema(type=openapi.TYPE_STRING),
                "password": openapi.Schema(type=openapi.TYPE_STRING),
                "portal_id": openapi.Schema(type=openapi.TYPE_STRING),
            },
            example={
                "user_id": 1,
                "name": "John Doe",
                "email": "john@mail.com",
                "password": "1234",
                "portal_id": "SSA001"
            }
        )
    }
)

ManageUserResponseSchema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "code": openapi.Schema(type=openapi.TYPE_INTEGER, example=200),
        "status": openapi.Schema(type=openapi.TYPE_STRING, example="success"),
        "data": openapi.Schema(type=openapi.TYPE_OBJECT, nullable=True),
    }
)


# ============================================================
# MANAGE USERS API
# ============================================================
@swagger_auto_schema(
    method="post",
    operation_description="Unified CRUD for SuperAdmin / Admin / User",
    request_body=ManageUserRequestSchema,
    manual_parameters=[
        openapi.Parameter(
            name="Authorization",
            in_=openapi.IN_HEADER,
            type=openapi.TYPE_STRING,
            required=True,
            description="Bearer <token>"
        ),
        openapi.Parameter(
            name="TZ-KEY",
            in_=openapi.IN_HEADER,
            type=openapi.TYPE_STRING,
            required=True,
            description="Global API Key"
        )
    ],
    responses={
        200: openapi.Response("Success", ManageUserResponseSchema),
        201: openapi.Response("Created", ManageUserResponseSchema),
        400: openapi.Response("Bad Request", ManageUserResponseSchema),
        403: openapi.Response("Forbidden", ManageUserResponseSchema),
        401: openapi.Response("Unauthorized", ManageUserResponseSchema),
    }
)

@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def manage_users(request):

    role = request.role
    actor = request.actor
    action = request.data.get("action")
    data = request.data.get("data", {})

    if not action:
        return resp(400, "Action required")

    if action not in ALL_ACTIONS:
        return resp(400, "Invalid action")

# =====================================================
# SUPERADMIN
# =====================================================

    if role == "superadmin":

        # ---------- CREATE ADMIN ----------
        if action == "create_admin":

            required = ["name", "email", "password", "portal_id"]
            for field in required:
                if not data.get(field):
                    return resp(400, f"{field} required")

            if Admin.objects.filter(portal_id=data["portal_id"]).exists():
                return resp(400, "Portal ID already exists")

            admin = Admin.objects.create(
                super_admin=actor,
                name=data["name"],
                email=data["email"],
                password=data["password"],
                portal_id=data["portal_id"],
                status=data.get("status", "inactive").lower()
            )

            return resp(201, "Admin created", {
                "admin_id": admin.admin_id,
                "status": admin.status
            })


        # ---------- GET ADMINS ----------
        if action == "get_admins":

            admins = Admin.objects.all().values(
                "admin_id",
                "name",
                "email",
                "portal_id",
                "status",
                "created_on"
            )

            return resp(200, "Admins fetched", list(admins))


        # ---------- UPDATE ADMIN ----------
        if action == "update_admin":

            admin_id = data.get("admin_id") or data.get("id")
            if not admin_id:
                return resp(400, "admin_id required")

            admin = Admin.objects.filter(admin_id=admin_id).first()
            if not admin:
                return resp(404, "Admin not found")

            # Partial safe updates
            if "name" in data:
                admin.name = data["name"]

            if "email" in data:
                admin.email = data["email"]

            if "password" in data and data["password"]:
                admin.password = data["password"]

            if "portal_id" in data:
                admin.portal_id = data["portal_id"]

            if "status" in data:
                admin.status = data["status"].lower()

            admin.save()

            return resp(200, "Admin updated", {
                "admin_id": admin.admin_id,
                "status": admin.status
            })


            # ---------- DELETE ADMIN ----------
        if action == "delete_admin":

            admin_id = data.get("admin_id") or data.get("id")
            if not admin_id:
                return resp(400, "admin_id required")

            admin = Admin.objects.filter(admin_id=admin_id).first()
            if not admin:
                return resp(404, "Admin not found")

            admin.delete()
            return resp(200, "Admin deleted")


    # =====================================================
    # USER CRUD — SUPERADMIN + ADMIN
    # =====================================================

    if action == "create_user":

        required = ["name", "email", "password", "user_specific_id"]
        for field in required:
            if not data.get(field):
                return resp(400, f"{field} required")

        user_portal_id = data["user_specific_id"]

        # prevent duplicate portal id
        if User.objects.filter(portal_id=user_portal_id).exists():
            return resp(400, "User portal ID already exists")

        admin_obj = None

        # ==========================
        # ADMIN → auto assign to self
        # ==========================
        if role == "admin":
            admin_obj = actor

        # ==========================
        # SUPERADMIN → optional assign
        # ==========================
        elif role == "superadmin":
            admin_portal_id = data.get("admin_portal_id")

            if admin_portal_id:
                admin_obj = Admin.objects.filter(
                    portal_id=admin_portal_id
                ).first()

                if not admin_obj:
                    return resp(404, "Admin portal not found")

        user = User.objects.create(
            admin=admin_obj,
            name=data["name"],
            email=data["email"],
            password=data["password"],
            portal_id=user_portal_id,
            status=data.get("status", "Inactive")
        )

        return resp(201, "User created", {
            "user_id": user.id,
            "admin_portal": admin_obj.portal_id if admin_obj else None
        })

    # ---------- UPDATE USER ----------
    if action == "update_user":

        user_id = data.get("user_id") or data.get("id")
        if not user_id:
            return resp(400, "user_id required")

        user = User.objects.filter(id=user_id).first()
        if not user:
            return resp(404, "User not found")

        # 🔥 admin cannot edit another admin's user
        if role == "admin" and user.admin_id != actor.admin_id:
            return resp(403, "No permission")

        user.name = data.get("name", user.name)
        user.email = data.get("email", user.email)
        user.status = data.get("status", user.status)

        if data.get("password"):
            user.password = data["password"]

        user.save()

        return resp(200, "User updated", {
            "id": user.id,
            "created_on": user.created_on
        })


    # ---------- GET USERS ----------
    if action == "get_users":

        if role == "superadmin":
            users = User.objects.all()

        elif role == "admin":
            users = User.objects.filter(admin=actor)

        else:
            return resp(403, "Unauthorized")

        return resp(
            200,
            "Users fetched",
            list(users.values(
                "id",
                "name",
                "email",
                "portal_id",
                "status",
                "created_on",
                "admin_id"
            ))
        )


    # ---------- DELETE USER ----------
    if action == "delete_user":

        user_id = data.get("user_id")
        if not user_id:
            return resp(400, "user_id required")

        user = User.objects.filter(id=user_id).first()
        if not user:
            return resp(404, "User not found")

        if role == "admin" and user.admin_id != actor.admin_id:
            return resp(403, "No permission")

        user.delete()
        return resp(200, "User deleted")


    # ---------- RESET PASSWORD ----------
    if action == "reset_password":

        user_id = data.get("user_id")
        new_pass = data.get("new_password")

        if not user_id or not new_pass:
            return resp(400, "user_id and new_password required")

        user = User.objects.filter(id=user_id).first()
        if not user:
            return resp(404, "User not found")

        if role == "admin" and user.admin_id != actor.admin_id:
            return resp(403, "No permission")

        user.password = new_pass
        user.save()

        return resp(200, "Password reset")


    # =====================================================
    # ADMIN
    # =====================================================

    elif role == "admin":

        if action not in ADMIN_ACTIONS:
            return resp(403, "Admin not allowed")


    
        # =====================================================
        # USER CRUD — SUPERADMIN + ADMIN
        # =====================================================

        if action == "create_user":

            required = ["name", "email", "password", "user_specific_id"]
            for field in required:
                if not data.get(field):
                    return resp(400, f"{field} required")

            user_portal_id = data["user_specific_id"]

            # prevent duplicate portal id
            if User.objects.filter(portal_id=user_portal_id).exists():
                return resp(400, "User portal ID already exists")

            admin_obj = None

            # ==========================
            # ADMIN → auto assign to self
            # ==========================
            if role == "admin":
                admin_obj = actor

            # ==========================
            # SUPERADMIN → optional assign
            # ==========================
            elif role == "superadmin":
                admin_portal_id = data.get("admin_portal_id")

                if admin_portal_id:
                    admin_obj = Admin.objects.filter(
                        portal_id=admin_portal_id
                    ).first()

                    if not admin_obj:
                        return resp(404, "Admin portal not found")

            user = User.objects.create(
                admin=admin_obj,
                name=data["name"],
                email=data["email"],
                password=data["password"],
                portal_id=user_portal_id,
                status=data.get("status", "Inactive")
            )

            return resp(201, "User created", {
                "user_id": user.id,
                "admin_portal": admin_obj.portal_id if admin_obj else None
            })


        # UPDATE USER
        if action == "update_user":

            user_id = data.get("user_id") or data.get("id")
            if not user_id:
                return resp(400, "user_id required")

            user = User.objects.filter(id=user_id, admin=actor).first()
            if not user:
                return resp(404, "User not found")

            user.name = data.get("name", user.name)
            user.email = data.get("email", user.email)
            user.status = data.get("status", user.status)

            if data.get("password"):
                user.password = data["password"]

            user.save()

            return resp(200, "User updated", {"id": user.id})


        # GET USERS
        if action == "get_users":

            return resp(
                200,
                "Users fetched",
                list(
                    User.objects.filter(admin=actor)
                    .values("id", "name", "email", "portal_id", "status","created_on")
                )
            )


        # DELETE USER
        if action == "delete_user":

            User.objects.filter(id=data.get("user_id"), admin=actor).delete()
            return resp(200, "User deleted")
    # =====================================================
    # UPDATE PROFILE (ADMIN + USER ONLY)
    # =====================================================
    if action == "update_profile":

        user_id = data.get("user_id")
        if not user_id:
            return resp(400, "user_id required")

        # 🔒 SuperAdmin explicitly blocked
        if role == "superadmin":
            return resp(403, "SuperAdmin profile cannot be changed")

        # -------- ADMIN --------
        if role == "admin":
            target = Admin.objects.filter(admin_id=user_id).first()
            if not target:
                return resp(404, "Admin not found")

        # -------- USER --------
        elif role == "user":
            target = User.objects.filter(id=user_id).first()
            if not target:
                return resp(404, "User not found")

        else:
            return resp(403, "Unauthorized")

        # Update name
        if data.get("name"):
            target.name = data["name"]

        # Password change
        if data.get("new_password"):
            if not data.get("current_password"):
                return resp(400, "current_password required")

            if target.password != data["current_password"]:
                return resp(403, "Current password incorrect")

            target.password = data["new_password"]

        target.save()

        return resp(200, "Profile updated successfully")


    # =====================================================
    # USER
    # =====================================================

    elif role == "user":

        # ---------- PROFILE VIEW ----------
        if action == "profile":
            return resp(200, "Profile", {
                "id": actor.id,
                "name": actor.name,
                "email": actor.email,
                "portal_id": actor.portal_id
            })

        # ---------- UPDATE PROFILE ----------
        elif action == "update_profile":

            name = data.get("name")
            current_password = data.get("current_password")
            new_password = data.get("new_password")

            if name:
                actor.name = name

            if new_password:
                if actor.password != current_password:
                    return resp(400, "Current password incorrect")

                actor.password = new_password

            actor.save()

            return resp(200, "Profile updated successfully")

        # ---------- CHANGE PASSWORD ----------
        elif action == "change_password":

            new_password = data.get("new_password")
            if not new_password:
                return resp(400, "new_password required")

            actor.password = new_password
            actor.save()

            return resp(200, "Password changed")

        # ❗ SAFETY FALLBACK
        return resp(400, "Invalid user action")



# ============================================================
# LOGOUT SERVICE
# ============================================================
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def logout(request):
    # request.auth holds the specific Token instance for this session
    if request.auth:
        request.auth.delete() # 🔥 This physically deletes the row from the DB
        return resp(200, "logout_success")
    return resp(400, "no_token_found")

# ============================================================
# STATION CRUD
# ============================================================
@swagger_auto_schema(method="post", request_body=StationSerializer)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminOrSuperAdmin])
def create_station(request):
    role = request.role
    actor = request.actor

    ser = StationSerializer(data=request.data)
    if not ser.is_valid():
        return resp(400, "Validation failed", ser.errors)

    defaults = ser.validated_data

    # Assign admin if role is admin
    if role == "admin":
        defaults["created_by_admin"] = actor

    station, created = Station.objects.update_or_create(
        station_id=ser.validated_data["station_id"],
        defaults=defaults
    )

    return resp(201, "Station created" if created else "Station updated", StationSerializer(station).data)


#----------------------------update----------------

@swagger_auto_schema(method="put", request_body=StationSerializer)
@api_view(["PUT"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def station_update(request, station_id):
    role = request.role
    actor = request.actor

    station = Station.objects.filter(station_id=station_id).first()
    if not station:
        return resp(404, "Station not found")

    # SuperAdmin: Allow all
    if role == "superadmin":
        pass

    # Admin: Allow only own stations
    elif role == "admin":
        if station.created_by_admin != actor:
            return resp(403, "Admin cannot update stations created by another admin")

    # User: Allow only assigned station
    elif role == "user":
        assigned = UserAssignment.objects.filter(user=actor, station=station).exists()
        if not assigned:
            return resp(403, "User cannot update unassigned station")
        
        # Prevent users from changing restricted fields if necessary
        # For now, we trust the frontend sends only allowed fields, 
        # but the serializer might allow all. 
        # Ideally we'd use a restricted serializer, but for now this enables the feature.
    
    else:
        return resp(403, "Unauthorized")

    ser = StationSerializer(station, data=request.data, partial=True)
    if ser.is_valid():
        ser.save()
        return resp(200, "Station updated", ser.data)

    return resp(400, "Validation failed", ser.errors)

#---------Delete------------#

@swagger_auto_schema(method="delete")
@api_view(["DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminOrSuperAdmin])
def station_delete(request, station_id):
    role = request.role
    actor = request.actor

    station = Station.objects.filter(station_id=station_id).first()
    if not station:
        return resp(404, "Station not found")

    # Admin can delete only their own stations
    if role == "admin" and station.created_by_admin != actor:
        return resp(403, "Admin cannot delete stations created by another admin")

    station.delete()
    return resp(200, "Station deleted")


#----------------------------------------------------GET--------------------------------------------


# @swagger_auto_schema(
#     method="get",
#     manual_parameters=[
#         openapi.Parameter('email', openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Login email"),
#         openapi.Parameter('password', openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Login password"),
#         openapi.Parameter('portal_id', openapi.IN_QUERY, type=openapi.TYPE_STRING, description="Portal ID (only for admin/user)")
#     ]
# )
# @api_view(["GET"])
# @authentication_classes([TokenAuthentication])
#@permission_classes([IsAnyAuthenticated])# def get_stations(request):

#     email = request.query_params.get("email")
#     password = request.query_params.get("password")
#     portal_id = request.query_params.get("portal_id")

#     sa = SuperAdmin.objects.filter(email=email, password=password).first()
#     admin = Admin.objects.filter(email=email, password=password).first()
#     user = User.objects.filter(email=email, password=password).first()

#     # SUPERADMIN → ALL
#     if sa:
#         stations = Station.objects.all().order_by("-created_on")
#         return resp(200, "All stations (superadmin)", StationSerializer(stations, many=True).data)

#     # ADMIN → ONLY PORTAL STATIONS
#     if admin:
#         stations = Station.objects.filter(portal_id=admin.portal_id).order_by("-created_on")
#         return resp(200, "Stations (admin portal)", StationSerializer(stations, many=True).data)

#     # USER → ONLY ASSIGNED STATIONS
#     if user:
#         assigned_ids = UserAssignment.objects.filter(user_id=user.id).values_list("station_id", flat=True)
#         stations = Station.objects.filter(station_id__in=assigned_ids)
#         return resp(200, "Assigned stations (user)", StationSerializer(stations, many=True).data)

#     return resp(403, "Invalid credentials")



#-----------------------------NEw CHANGES ----------------------------------------------------------------------------------------------------------------
@swagger_auto_schema(method="get",)
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def get_stations(request):
    role = request.role
    actor = request.actor

    if role == "superadmin":
        stations = Station.objects.all().order_by("-created_on")
    elif role == "admin":
        stations = Station.objects.filter(created_by_admin=actor).order_by("-created_on")
    elif role == "user":
        station_ids = UserAssignment.objects.filter(user=actor).values_list("station_id", flat=True)
        stations = Station.objects.filter(station_id__in=station_ids).order_by("-created_on")
    else:
        return resp(403, "Unauthorized")

    serializer = StationSerializer(stations, many=True)
    return resp(200, "Stations fetched successfully", serializer.data)


#-----------------------------------------------------------Old STATION details ------------------------------------------------------------------------
# @swagger_auto_schema(
#     method="get",
#     manual_parameters=[
#         openapi.Parameter('email', openapi.IN_QUERY, type=openapi.TYPE_STRING),
#         openapi.Parameter('password', openapi.IN_QUERY, type=openapi.TYPE_STRING),
#         openapi.Parameter('portal_id', openapi.IN_QUERY, type=openapi.TYPE_STRING)
#     ]
# )
# @api_view(["GET"])
# @authentication_classes([TokenAuthentication])
#@permission_classes([IsAnyAuthenticated])# def station_detail(request, station_id):

#     email = request.query_params.get("email")
#     password = request.query_params.get("password")
#     portal_id = request.query_params.get("portal_id")

#     sa = SuperAdmin.objects.filter(email=email, password=password).first()
#     admin = Admin.objects.filter(email=email, password=password).first()
#     user = User.objects.filter(email=email, password=password).first()

#     station = Station.objects.filter(station_id=station_id).first()
#     if not station:
#         return resp(404, "Station not found")

#     # SUPERADMIN → VIEW ANY
#     if sa:
#         return resp(200, "Fetched (superadmin)", StationSerializer(station).data)

#     # ADMIN → VIEW ONLY PORTAL STATIONS
#     if admin:
#         if station.portal_id != admin.portal_id:
#             return resp(403, "Admin cannot access this station")
#         return resp(200, "Fetched (admin)", StationSerializer(station).data)

#     # USER → VIEW ONLY ASSIGNED
#     if user:
#         assigned_ids = UserAssignment.objects.filter(user_id=user.id).values_list("station_id", flat=True)
#         if station_id not in assigned_ids:
#             return resp(403, "User cannot access this station")
#         return resp(200, "Fetched (user)", StationSerializer(station).data)

#     return resp(403, "Invalid credentials")




#-----------------------------------NEW STATIONS DETAILS ------------------------------------------------------------------------------------------------------------------------------------
@swagger_auto_schema(
    method="get",
    manual_parameters=[
        openapi.Parameter('email', openapi.IN_QUERY, type=openapi.TYPE_STRING),
        openapi.Parameter('password', openapi.IN_QUERY, type=openapi.TYPE_STRING),
        openapi.Parameter('portal_id', openapi.IN_QUERY, type=openapi.TYPE_STRING)
    ]
)
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def station_detail(request, station_id):
    role = request.role
    actor = request.actor

    station = Station.objects.filter(station_id=station_id).first()
    if not station:
        return resp(404, "Station not found")

    if role == "superadmin":
        return resp(200, "Fetched (superadmin)", StationSerializer(station).data)
    elif role == "admin":
        if station.created_by_admin != actor:
            return resp(403, "Admin cannot view stations created by another admin")
        return resp(200, "Fetched (admin)", StationSerializer(station).data)
    elif role == "user":
        assigned = UserAssignment.objects.filter(user=actor, station_id=station_id).exists()
        if not assigned:
            return resp(403, "User not assigned to this station")
        return resp(200, "Fetched (user)", StationSerializer(station).data)

    return resp(403, "Unauthorized")

#===================================================================================
# COMMIN FLAG WRITING
#=======================================================================
def get_admin_user_flags(station):
    admin_active = UserAssignment.objects.filter(
        station=station,
        admin__status__iexact="active"
    ).exists()

    user_active = UserAssignment.objects.filter(
        station=station,
        user__status__iexact="active"
    ).exists()

    return (
        100 if admin_active else 99,
        100 if user_active else 99
    )


# ============================================================
# BOWSER CRUD
# ============================================================
@swagger_auto_schema(method="post", request_body=BowserSerializer)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def add_bowser(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)

    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    data = request.data.copy()  # DO NOT add "station" here

    ser = BowserSerializer(data=data)
    if ser.is_valid():
        ser.save(station=station)  # <-- REAL FIX
        return resp(201, "Bowser created", ser.data)

    return resp(400, "Validation failed", ser.errors)

#-----------------------array model type create Bowserd ----------------------#
@swagger_auto_schema(method="post", request_body=BowserSerializer)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def bulk_add_bowsers(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)
    
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    bowsers_data = request.data.get("bowsers",[])


    if not isinstance(bowsers_data, list):
        return resp(400, "bowsers must be a list")

    if len(bowsers_data) > 25:
        return resp(400, "Maximum 25 bowsers allowed at once")

    created_items = []
    errors = []

    for index, item in enumerate(bowsers_data):

        data = item.copy()
        # data["station"] = station.station_id  # FK FIX

        ser = BowserSerializer(data=data)

        if ser.is_valid():
            ser.save(station=station)
            created_items.append(ser.data)
        else:
            errors.append({
                "index": index,
                "data": item,
                "errors": ser.errors
            })

    if errors:
        return resp(207, "Some records failed", {
            "created": created_items,
            "errors": errors
        })

    return resp(201, "All bowsers created successfully", created_items)



#--------------------------------all list Bowsers --------------------
@swagger_auto_schema(method="get")
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def list_all_bowsers(request):
    role = request.role
    actor = request.actor

    if role == "superadmin":
        bowsers = Bowser.objects.all()

    elif role == "admin":
        station_ids = UserAssignment.objects.filter(
            admin=actor
        ).values_list("station_id", flat=True)

        bowsers = Bowser.objects.filter(station_id__in=station_ids)

    else:  # user
        station_ids = UserAssignment.objects.filter(
            user=actor
        ).values_list("station_id", flat=True)

        bowsers = Bowser.objects.filter(station_id__in=station_ids)

    return resp(200, "Fetched", BowserSerializer(bowsers, many=True).data)

#--------------Station ID Based ------------------#
@swagger_auto_schema(method="get")
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def list_bowsers(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    bowsers = Bowser.objects.filter(station=station_id).order_by("-created_on")
    return resp(200, "Successfuly Geted", BowserSerializer(bowsers, many=True).data)

#----------------old without mqtt connection-----------------------------------
# @swagger_auto_schema(method="get")
# @swagger_auto_schema(method="put", request_body=BowserSerializer)
# @swagger_auto_schema(method="delete")
# @api_view(["GET", "PUT", "DELETE"])
# @authentication_classes([TokenAuthentication])
#@permission_classes([IsAnyAuthenticated])
# # def bowser_detail(request, bowser_id):

#     obj = Bowser.objects.filter(id=bowser_id).first()
#     if not obj:
#         return resp(404, "Not found")

#     if request.method == "GET":
#         return resp(200, "Successfully Fetched", BowserSerializer(obj).data)

#     if request.method == "PUT":
#         ser = BowserSerializer(obj, data=request.data, partial=True)
#         if ser.is_valid():
#             ser.save()
#             return resp(200, "Successfully Updated", ser.data)
#         return resp(400, "Validation failed", ser.errors)

#     obj.delete()
#     return resp(200, "Deleted")




#----------------------------------------------------------------------
# New bowser Datails with mqtt connections
#--------------------------------------------------------------------
@swagger_auto_schema(method="get")
@swagger_auto_schema(method="put", request_body=BowserSerializer)
@swagger_auto_schema(method="delete")
@api_view(["GET", "PUT", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])

# def bowser_detail(request, bowser_id):

#     obj = Bowser.objects.filter(id=bowser_id).first()
#     if not obj:
#         return resp(404, "Not found")

#     if request.method == "GET":
#         return resp(200, "Successfully Fetched", BowserSerializer(obj).data)


#     if request.method == "PUT":
#         # 1. Read email & password (optional for SuperAdmin)
#         email = request.data.get("email") or request.query_params.get("email")
#         password = request.data.get("password") or request.query_params.get("password")

#         # 2. Check credentials only if email/password provided
#         sa = admin = user = None
#         if email and password:
#             sa = SuperAdmin.objects.filter(email=email, password=password).first()
#             admin = Admin.objects.filter(email=email, password=password).first()
#             user = User.objects.filter(email=email, password=password).first()

#             if not (sa or admin or user):
#                 return Response({"code": 401, "status": "Invalid credentials", "data": None}, status=401)
#         else:
#             # Allow update if SuperAdmin session (internal trusted call)
#             sa = SuperAdmin.objects.first()  # replace with proper session in production
#             if not sa:
#                 return Response({"code": 401, "status": "Authentication required", "data": None}, status=401)

#         # 3. Save bowser update
#         old_status = obj.status
#         ser = BowserSerializer(obj, data=request.data, partial=True)
#         if not ser.is_valid():
#             return Response({"code": 400, "status": "Validation failed", "data": ser.errors}, status=400)
#         updated = ser.save()

#         # 4. Publish MQTT only if status changed
#         if "status" in request.data and updated.status != old_status:
#             # Compute flags based on Admin/User linked to the station
#             station_id = updated.station.station_id
#             admin_active = Admin.objects.filter(
#                 # portal_id=updated.station.portal_id,
#                 status__iexact="Active"
#             ).exists()

#             user_active = User.objects.filter(
#                 # portal_id=updated.station.portal_id,
#                 status__iexact="Active"
#             ).exists()

#             adm_flag = 100 if admin_active else 99
#             usr_flag = 100 if user_active else 99

#             publish_config_message(
#                 dev_id=updated.mqtt_id,
#                 adm_flag=adm_flag,
#                 usr_flag=usr_flag,
#                 dev_type="BU"
#             )

#         return Response({"code": 200, "status": "Successfully Updated", "data": BowserSerializer(updated).data})

#     # ---------------- DELETE ----------------
#     elif request.method == "DELETE":
#         obj.delete()
#         return Response({"code": 200, "status": "Deleted", "data": None})




# def bowser_detail(request,  bowser_id):
#     """
#     Get, update, or delete a Bowser
#     """
#     # station = get_object_or_404(Station, station_id=station.station_id)
    
#     # if not can_access_station(request, station):
#     #     return resp(403, "Access denied for this station")

#     obj = get_object_or_404(Bowser, id=bowser_id)
#     station = obj.station   # ✅ this is safe

#     old_status = obj.status

#     # ---------------- GET ----------------
#     if request.method == "GET":
#         return Response({
#             "code": 200,
#             "status": "Successfully Fetched",
#             "data": BowserSerializer(obj).data
#         })

#     # ---------------- PUT ----------------
#     elif request.method == "PUT":
#         # Partial update
#         ser = BowserSerializer(obj, data=request.data, partial=True)
#         if not ser.is_valid():
#             return Response({
#                 "code": 400,
#                 "status": "Validation failed",
#                 "data": ser.errors
#             }, status=400)
#         updated = ser.save()

#         # Publish MQTT if status changed
#         if "status" in request.data and updated.status != old_status:
#             station = updated.station

#             # ✅ Get Admin assigned to this Station
#             assignment = UserAssignment.objects.filter(station=station).first()
#             if assignment:
#                 admin = assignment.admin
#             else:
#                 admin = None

#             # ✅ Admin flag
#             adm_flag = 100 if admin and admin.status.lower() == "active" else 99

#             # ✅ User flag (any assigned user active)
#             usr_flag = 99
#             if assignment:
#                 user_active = UserAssignment.objects.filter(
#                     station=station,
#                     user__status="active"
#                 ).exists()
#                 if user_active:
#                     usr_flag = 100

#             # ✅ Publish MQTT
#             publish_config_message(
#                 dev_id=updated.mqtt_id,
#                 adm_flag=adm_flag,
#                 usr_flag=usr_flag,
#                 dev_type="BU"
#             )

#         return Response({
#             "code": 200,
#             "status": "Successfully Updated",
#             "data": BowserSerializer(updated).data
#         })

#     # ---------------- DELETE ----------------
#     elif request.method == "DELETE":
#         obj.delete()
#         return Response({
#             "code": 200,
#             "status": "Deleted",
#             "data": None
#         })
def bowser_detail(request, bowser_id):
    """
    Get, update, or delete a Bowser
    """

    # ✅ Get Bowser first (FIXES UnboundLocalError)
    obj = get_object_or_404(Bowser, id=bowser_id)
    station = obj.station
    old_status = obj.status

    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    # ---------------- GET ----------------
    if request.method == "GET":
        return Response({
            "code": 200,
            "status": "Successfully Fetched",
            "data": BowserSerializer(obj).data
        })

    # ---------------- PUT ----------------
    elif request.method == "PUT":
        ser = BowserSerializer(obj, data=request.data, partial=True)
        if not ser.is_valid():
            return Response({
                "code": 400,
                "status": "Validation failed",
                "data": ser.errors
            }, status=400)

        updated = ser.save()

        # ✅ Publish MQTT ONLY if status changed
        if "status" in request.data and updated.status != old_status:
            station = updated.station

            # ✅ ADMIN FLAG (station-based, case-insensitive)
            admin_active = UserAssignment.objects.filter(
                station=station,
                admin__status__iexact="active"
            ).exists()
            adm_flag = 100 if admin_active else 99

            # ✅ USER FLAG (station-based, case-insensitive)
            user_active = UserAssignment.objects.filter(
                station=station,
                user__status__iexact="active"
            ).exists()
            usr_flag = 100 if user_active else 99

            # ✅ MQTT Publish (guaranteed execution)
            publish_config_message(
                dev_id=updated.mqtt_id,
                adm_flag=adm_flag,
                usr_flag=usr_flag,
                dev_type="BU"
            )

        return Response({
            "code": 200,
            "status": "Successfully Updated",
            "data": BowserSerializer(updated).data
        })

    # ---------------- DELETE ----------------
    elif request.method == "DELETE":
        obj.delete()
        return Response({
            "code": 200,
            "status": "Deleted",
            "data": None
        })


# ============================================================
# STATIONARY CRUD
# ============================================================
@swagger_auto_schema(method="post", request_body=StationarySerializer)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def add_stationary(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)
    
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    data = request.data.copy()
    # data["station"] = station.station_id

    ser = StationarySerializer(data=data)
    if ser.is_valid():
        ser.save(station=station)
        return resp(201, "Stationary created", ser.data)

    return resp(400, "Validation failed", ser.errors)




#-----------------------array type model create stationary ----------- #
@swagger_auto_schema(method="post", request_body=StationarySerializer)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def bulk_add_stationaries(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)
    
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    stationaries_data = request.data.get("stationaries")

    if not isinstance(stationaries_data, list):
        return resp(400, "stationaries must be a list")

    if len(stationaries_data) > 25:
        return resp(400, "Maximum 25 stationaries allowed at once")

    created_items = []
    errors = []

    for index, item in enumerate(stationaries_data):

        data = item.copy()
        data["station"] = station.station_id   # Auto-assign FK

        ser = StationarySerializer(data=data)

        if ser.is_valid():
            ser.save()
            created_items.append(ser.data)
        else:
            errors.append({
                "index": index,
                "data": item,
                "errors": ser.errors
            })

    if errors:
        return resp(207, "Some records failed", {
            "created": created_items,
            "errors": errors
        })

    return resp(201, "All stationaries created successfully", created_items)



#-------------------------all list statinaries ----------------#
@swagger_auto_schema(method="get")
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def get_all_stationaries(request):
    items = Stationary.objects.all().order_by("-created_on")
    return resp(200, "All stationaries fetched", StationarySerializer(items, many=True).data)


#--------------------------station id based Stationary ----------------------#

@swagger_auto_schema(method="get")
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def list_stationaries(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    items = Stationary.objects.filter(station_id=station_id).order_by("-created_on")
    return resp(200, "Fetched", StationarySerializer(items, many=True).data)





#-----------------------------------------------
# old stationaries detils wthout mqtt
#------------------------------------------------
# @swagger_auto_schema(method="get")
# @swagger_auto_schema(method="put", request_body=StationarySerializer)
# @swagger_auto_schema(method="delete")
# @api_view(["GET", "PUT", "DELETE"])
# @authentication_classes([TokenAuthentication])
#@permission_classes([IsAnyAuthenticated])# def stationary_detail(request, stationary_id):

#     obj = Stationary.objects.filter(id=stationary_id).first()
#     if not obj:
#         return resp(404, "Not found")

#     if request.method == "GET":
#         return resp(200, "Fetched", StationarySerializer(obj).data)

#     if request.method == "PUT":
#         ser = StationarySerializer(obj, data=request.data, partial=True)
#         if ser.is_valid():
#             ser.save()
#             return resp(200, "Updated", ser.data)
#         return resp(400, "Validation failed", ser.errors)

#     obj.delete()
#     return resp(200, "Deleted")








#-------------------------------------------------------------------------------------------------------
#old Station with mqtt 
#------------------------------------------------------------------------------------------
# @swagger_auto_schema(method="get")
# @swagger_auto_schema(method="put", request_body=StationarySerializer)
# @swagger_auto_schema(method="delete")
# @api_view(["GET", "PUT", "DELETE"])
# @authentication_classes([TokenAuthentication])
#permission_classes([IsAnyAuthenticated])# def stationary_detail(request, stationary_id):

#     obj = Stationary.objects.filter(id=stationary_id).first()
#     if not obj:
#         return resp(404, "Not found")

#     if request.method == "GET":
#         return resp(200, "Fetched", StationarySerializer(obj).data)

#     if request.method == "PUT":
#         old_status = obj.status

#         ser = StationarySerializer(obj, data=request.data, partial=True)
#         if ser.is_valid():
#             updated = ser.save()

#             if "status" in request.data and updated.status != old_status:
#                 email = request.data.get("email") or request.query_params.get("email")
#                 password = request.data.get("password") or request.query_params.get("password")

#                 sa = SuperAdmin.objects.filter(email=email, password=password).first()
#                 admin = Admin.objects.filter(email=email, password=password).first()
#                 user = User.objects.filter(email=email, password=password).first()

#                 adm_flag = 0
#                 usr_flag = 0
#                 dev_type = "SU"
#                 dev_id = updated.mqtt_id

#                 if updated.status == "active":
#                     if sa or admin:
#                         adm_flag = 100
#                     elif user:
#                         usr_flag = 100
#                 elif updated.status == "inactive":
#                     if sa or admin:
#                         adm_flag = 99
#                     elif user:
#                         usr_flag = 99

#                 if (adm_flag != 0) or (usr_flag != 0):
#                     publish_config_message(dev_id, adm_flag, usr_flag, dev_type)

#             return resp(200, "Updated", ser.data)

#         return resp(400, "Validation failed", ser.errors)

#     obj.delete()
#     return resp(200, "Deleted")







#-------------------------------------------------------------------------------------------------------
#new Stationary with mqtt active
#------------------------------------------------------------------------------------------
@swagger_auto_schema(method="get")
@swagger_auto_schema(method="put", request_body=StationarySerializer)
@swagger_auto_schema(method="delete")
@api_view(["GET", "PUT", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
# def stationary_detail(request, stationary_id):

#     obj = Stationary.objects.filter(id=stationary_id).first()
#     if not obj:
#         return resp(404, "Not found")

#     if request.method == "GET":
#         return resp(200, "Successfully Fetched", StationarySerializer(obj).data)

    
#     if request.method == "PUT":
#         # 1. Read email & password (optional for SuperAdmin)
#         email = request.data.get("email") or request.query_params.get("email")
#         password = request.data.get("password") or request.query_params.get("password")

#         # 2. Check credentials only if email/password provided
#         sa = admin = user = None
#         if email and password:
#             sa = SuperAdmin.objects.filter(email=email, password=password).first()
#             admin = Admin.objects.filter(email=email, password=password).first()
#             user = User.objects.filter(email=email, password=password).first()

#             if not (sa or admin or user):
#                 return resp(401, "Invalid credentials")
#         else:
#             # Allow update if SuperAdmin session (internal trusted call)
#             sa = SuperAdmin.objects.first()  # replace with proper session in production
#             if not sa:
#                 return resp(401, "Authentication required")

#         # 3. Save stationary update
#         old_status = obj.status
#         ser = StationarySerializer(obj, data=request.data, partial=True)
#         if not ser.is_valid():
#             return resp(400, "Validation failed", ser.errors)
#         updated = ser.save()

#         # 4. Publish MQTT only if status changed
#         if "status" in request.data and updated.status != old_status:
#             station_id = updated.station.station_id  # station-based flags

#             admin_active = Admin.objects.filter(
#                 # station__station_id=station_id,
#                 status__iexact="Active"
#             ).exists()

#             user_active = User.objects.filter(
#                 # station__station_id=station_id,
#                 status__iexact="Active"
#             ).exists()

#             adm_flag = 100 if admin_active else 99
#             usr_flag = 100 if user_active else 99

#             publish_config_message(
#                 dev_id=updated.mqtt_id,
#                 adm_flag=adm_flag,
#                 usr_flag=usr_flag,
#                 dev_type="SU"
#             )

#         return resp(200, "Successfully Updated", StationarySerializer(updated).data)

#     elif request.method == "DELETE":
#         obj.delete()
#         return resp(200, "Deleted")


def stationary_detail(request, stationary_id):

    obj = get_object_or_404(Stationary, id=stationary_id)
    station = obj.station
    old_status = obj.status

    # 🔐 Access check
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    # ---------------- GET ----------------
    if request.method == "GET":
        return resp(200, "Successfully Fetched", StationarySerializer(obj).data)

    # ---------------- PUT ----------------
    elif request.method == "PUT":

        ser = StationarySerializer(obj, data=request.data, partial=True)
        if not ser.is_valid():
            return resp(400, "Validation failed", ser.errors)

        updated = ser.save()

        # MQTT publish if status changed
        if "status" in request.data and updated.status != old_status:

            assignment = UserAssignment.objects.filter(
                station=station
            ).select_related("admin", "user")

            admin_active = assignment.filter(
                admin__status__iexact="active"
            ).exists()

            user_active = assignment.filter(
                user__status__iexact="active"
            ).exists()

            adm_flag = 100 if admin_active else 99
            usr_flag = 100 if user_active else 99

            publish_config_message(
                dev_id=updated.mqtt_id,
                adm_flag=adm_flag,
                usr_flag=usr_flag,
                dev_type="SU"
            )

        return resp(200, "Successfully Updated", StationarySerializer(updated).data)

    # ---------------- DELETE ----------------
    elif request.method == "DELETE":
        obj.delete()
        return resp(200, "Deleted")


# ============================================================
# TANK CRUD
# ============================================================
@swagger_auto_schema(method="post", request_body=TankSerializer)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def add_tank(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)
    
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    data = request.data.copy()
    # data["station"] = station.station_id

    ser = TankSerializer(data=data)
    if ser.is_valid():
        ser.save(station=station)
        return resp(201, "Tank created", ser.data)

    return resp(400, "Validation failed", ser.errors)



#-------------------array type model create tank ---------------------#
@swagger_auto_schema(method="post", request_body=TankSerializer)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def bulk_add_tanks(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    tanks_data = request.data.get("tanks")

    if not isinstance(tanks_data, list):
        return resp(400, "tanks must be a list")

    if len(tanks_data) > 25:
        return resp(400, "Maximum 25 tanks allowed at once")

    created_items = []
    errors = []

    for index, item in enumerate(tanks_data):

        data = item.copy()
        data["station"] = station.station_id   # Auto-assign FK

        ser = TankSerializer(data=data)

        if ser.is_valid():
            ser.save()
            created_items.append(ser.data)
        else:
            errors.append({
                "index": index,
                "data": item,
                "errors": ser.errors
            })

    if errors:
        return resp(207, "Some records failed", {
            "created": created_items,
            "errors": errors
        })

    return resp(201, "All tanks created successfully", created_items)


#-------------------------All tankes geted -------------------------------
@swagger_auto_schema(method="get")
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def get_all_tanks(request):
    tanks = Tank.objects.all().order_by("-created_on")
    return resp(200, "All tanks fetched", TankSerializer(tanks, many=True).data)


#-----------------------------sttaion id based Tank -------------------#
@swagger_auto_schema(method="get")
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def list_tanks(request, station_id):

    station = get_object_or_404(Station, station_id=station_id)
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    tanks = Tank.objects.filter(station_id=station_id).order_by("-created_on")
    return resp(200, "Fetched", TankSerializer(tanks, many=True).data)


# ============================================================
# TANK old without mqtt 
#=========================================================
# @swagger_auto_schema(method="get")
# @swagger_auto_schema(method="put", request_body=TankSerializer)
# @swagger_auto_schema(method="delete")
# @api_view(["GET", "PUT", "DELETE"])
# @authentication_classes([TokenAuthentication])
#@permission_classes([IsAnyAuthenticated])# def tank_detail(request, tank_id):

#     obj = Tank.objects.filter(id=tank_id).first()
#     if not obj:
#         return resp(404, "Not found")

#     if request.method == "GET":
#         return resp(200, "Fetched", TankSerializer(obj).data)

#     if request.method == "PUT":
#         ser = TankSerializer(obj, data=request.data, partial=True)
#         if ser.is_valid():
#             ser.save()
#             return resp(200, "Updated", ser.data)
#         return resp(400, "Validation failed", ser.errors)

#     obj.delete()
#     return resp(200, "Deleted")



# ============================================================
# TANK new with mqtt 
#=========================================================

# @swagger_auto_schema(method="get")
# @swagger_auto_schema(method="put", request_body=TankSerializer)
# @swagger_auto_schema(method="delete")
# @api_view(["GET", "PUT", "DELETE"])
# @authentication_classes([TokenAuthentication])
#@permission_classes([IsAnyAuthenticated])# def tank_detail(request, tank_id):
#     obj = Tank.objects.filter(id=tank_id).first()
#     if not obj:
#         return resp(404, "Not found")

#     if request.method == "GET":
#         return resp(200, "Fetched", TankSerializer(obj).data)

#     if request.method == "PUT":
#         old_status = obj.status

#         ser = TankSerializer(obj, data=request.data, partial=True)
#         if ser.is_valid():
#             updated = ser.save()

#             if "status" in request.data and updated.status != old_status:
#                 email = request.data.get("email") or request.query_params.get("email")
#                 password = request.data.get("password") or request.query_params.get("password")

#                 sa = SuperAdmin.objects.filter(email=email, password=password).first()
#                 admin = Admin.objects.filter(email=email, password=password).first()
#                 user = User.objects.filter(email=email, password=password).first()

#                 adm_flag = 0
#                 usr_flag = 0
#                 dev_type = "SUT"
#                 dev_id = updated.mqtt_id

#                 if updated.status == "active":
#                     if sa or admin:
#                         adm_flag = 100
#                     elif user:
#                         usr_flag = 100
#                 elif updated.status == "inactive":
#                     if sa or admin:
#                         adm_flag = 99
#                     elif user:
#                         usr_flag = 99

#                 if (adm_flag != 0) or (usr_flag != 0):
#                     publish_config_message(dev_id, adm_flag, usr_flag, dev_type)

#             return resp(200, "Updated", ser.data)

#         return resp(400, "Validation failed", ser.errors)

#     obj.delete()
#     return resp(200, "Deleted")


# ============================================================
# TANK new with mqtt include active inactive 
#=========================================================

@swagger_auto_schema(method="get")
@swagger_auto_schema(method="put", request_body=TankSerializer)
@swagger_auto_schema(method="delete")
@api_view(["GET", "PUT", "DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
# def tank_detail(request, tank_id):

#     obj = Tank.objects.filter(id=tank_id).first()
#     if not obj:
#         return resp(404, "Not found")

#     if request.method == "GET":
#         return resp(200, "Successfully Fetched", TankSerializer(obj).data)

#     if request.method == "PUT":
#     # 1. Read email & password (optional for SuperAdmin)
#         email = request.data.get("email") or request.query_params.get("email")
#         password = request.data.get("password") or request.query_params.get("password")

#         # 2. Check credentials only if email/password provided
#         sa = admin = user = None
#         if email and password:
#             sa = SuperAdmin.objects.filter(email=email, password=password).first()
#             admin = Admin.objects.filter(email=email, password=password).first()
#             user = User.objects.filter(email=email, password=password).first()

#             if not (sa or admin or user):
#                 return resp(401, "Invalid credentials")
#         else:
#             # Allow update if SuperAdmin session (internal trusted call)
#             sa = SuperAdmin.objects.first()  # replace with proper session in production
#             if not sa:
#                 return resp(401, "Authentication required")

#         # 3. Save tank update
#         old_status = obj.status
#         ser = TankSerializer(obj, data=request.data, partial=True)
#         if not ser.is_valid():
#             return resp(400, "Validation failed", ser.errors)
#         updated = ser.save()

#         # 4. Publish MQTT only if status changed
#         if "status" in request.data and updated.status != old_status:
#             station_id = updated.station.station_id  # station-based flags

#             admin_active = Admin.objects.filter(
#                 # station__station_id=station_id,
#                 status__iexact="Active"
#             ).exists()

#             user_active = User.objects.filter(
#                 # station__station_id=station_id,
#                 status__iexact="Active"
#             ).exists()

#             # If user is controlling, admin must be active
#             if user and not admin_active:
#                 return resp(403, "Admin inactive. User cannot control device.")

#             adm_flag = 100 if admin_active else 99
#             usr_flag = 100 if user_active else 99

#             publish_config_message(
#                 dev_id=updated.mqtt_id,
#                 adm_flag=adm_flag,
#                 usr_flag=usr_flag,
#                 dev_type="SUT"
#             )

#         return resp(200, "Successfully Updated", TankSerializer(updated).data)

#     elif request.method == "DELETE":
#         obj.delete()
#         return resp(200, "Deleted")

def tank_detail(request, tank_id):

    obj = get_object_or_404(Tank, id=tank_id)
    station = obj.station
    old_status = obj.status

    # 🔐 Access check
    if not can_access_station(request, station):
        return resp(403, "Access denied for this station")

    # ---------------- GET ----------------
    if request.method == "GET":
        return resp(200, "Successfully Fetched", TankSerializer(obj).data)

    # ---------------- PUT ----------------
    elif request.method == "PUT":

        ser = TankSerializer(obj, data=request.data, partial=True)
        if not ser.is_valid():
            return resp(400, "Validation failed", ser.errors)

        updated = ser.save()

        # MQTT publish only if status changed
        if "status" in request.data and updated.status != old_status:

            assignment = UserAssignment.objects.filter(
                station=station
            ).select_related("admin", "user")

            admin_active = assignment.filter(
                admin__status__iexact="active"
            ).exists()

            user_active = assignment.filter(
                user__status__iexact="active"
            ).exists()

            adm_flag = 100 if admin_active else 99
            usr_flag = 100 if user_active else 99

            publish_config_message(
                dev_id=updated.mqtt_id,
                adm_flag=adm_flag,
                usr_flag=usr_flag,
                dev_type="SUT"  # Stationary Tank
            )

        return resp(200, "Successfully Updated", TankSerializer(updated).data)

    # ---------------- DELETE ----------------
    elif request.method == "DELETE":
        obj.delete()
        return resp(200, "Deleted")
# ============================================================
# IOT UPDATE SERVICE
# ============================================================
# ============================================================
# IOT UPDATE SERVICE (UPDATED FIXED VERSION)
# Supports Bowser / Stationary / Tank
# ============================================================
# ============================================================
# Helpers (ONLY FIX FOR IOT STRING DATA)
# ============================================================
@swagger_auto_schema(
    method="post",
    operation_description="IoT update service (Bowser / Stationary / Tank)",
    request_body=openapi.Schema(type=openapi.TYPE_OBJECT)
)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def update_service(request):

    data = request.data or {}

    try:
        # -------------------------------
        # Base Common Fields
        # -------------------------------
        base = {
            "devID": data.get("devID"),
            "todate": data.get("todate"),
            "totime": data.get("totime"),
            "tmprtr": data.get("tmprtr"),
            "hmidty": data.get("hmidty"),
        }

        tx = None

        # -------------------------------
        # Bowser Transaction
        # -------------------------------
        if "bowser" in data:
            tx = data["bowser"]

            base.update({
                "type": "bowser",
                "bwsrid": tx.get("bwsrid"),
                "pumpid": tx.get("pumpid"),
                "vehnum": tx.get("vehnum"),
                "mobnum": tx.get("mobnum"),
            })

        # -------------------------------
        # Stationary Transaction
        # -------------------------------
        elif "stan" in data:
            tx = data["stan"]

            base.update({
                "type": "stationary",
                "stanid": tx.get("stanid"),
                "pmpid": tx.get("pmpid"),
                "attnid": tx.get("attnid"),
                "vehnum": tx.get("vehnum"),
            })

        # -------------------------------
        # Tank Transaction
        # -------------------------------
        elif "tank" in data:
            tx = data["tank"]

            base.update({
                "type": "tank",
                "tankid": tx.get("tankid"),
            })

        else:
            return resp(400, "Invalid JSON → must include bowser / stan / tank")

        # -------------------------------
        # Transaction Fields
        # -------------------------------
        base.update({
            "trnsid": tx.get("trnsid"),
            "trnvol": tx.get("trnvol"),
            "trnamt": tx.get("trnamt"),
            "utpriz": tx.get("utpriz"),
            "totvol": tx.get("totvol"),
            "totamt": tx.get("totamt"),
            "pmpsts": tx.get("pmpsts"),
            "barnum": tx.get("barnum"),
            "mobnum": tx.get("mobnum"),
        })

        # Remove null values
        base = {k: v for k, v in base.items() if v is not None}

        print("FINAL PAYLOAD:", base)

        # -------------------------------
        # Update if Exists
        # -------------------------------
        existing = Transaction.objects.filter(trnsid=base.get("trnsid")).first()

        if existing:
            serializer = TransactionSerializer(existing, data=base, partial=True)

            if serializer.is_valid():
                serializer.save()
                return resp(200, "Transaction updated successfully")

            print("VALIDATION ERRORS:", serializer.errors)
            return resp(400, "Validation failed", serializer.errors)

        # -------------------------------
        # Create New Transaction
        # -------------------------------
        serializer = TransactionSerializer(data=base)

        if serializer.is_valid():
            serializer.save()
            return resp(201, "Transaction created successfully")

        print("VALIDATION ERRORS:", serializer.errors)
        return resp(400, "Validation failed", serializer.errors)

    except Exception as e:
        print("SERVER ERROR:", str(e))
        return resp(500, "Server crashed", str(e))
# @swagger_auto_schema(
#     method="post",
#     operation_description="IoT update service (Bowser / Stationary / Tank)",
#     request_body=openapi.Schema(type=openapi.TYPE_OBJECT)
# )
# @api_view(["POST"])
# @authentication_classes([TokenAuthentication])
# @permission_classes([IsAnyAuthenticated])
# def update_service(request):
#     data = request.data or {}

#     # 1) Determine device type and get station
#     if "bowser" in data:
#         tx = data["bowser"]
#         bowser = Bowser.objects.filter(bowser_id=tx.get("bwsrid")).first()
#         if not bowser:
#             return resp(404, "Bowser not found")
#         station = bowser.station
#         tx_type = "bowser"

#     elif "stan" in data:
#         tx = data["stan"]
#         stationary = Stationary.objects.filter(stationary_id=tx.get("stanid")).first()
#         if not stationary:
#             return resp(404, "Stationary not found")
#         station = stationary.station
#         tx_type = "stationary"

#     elif "tank" in data:
#         tx = data["tank"]
#         tank = Tank.objects.filter(tank_id=tx.get("tankid")).first()
#         if not tank:
#             return resp(404, "Tank not found")
#         station = tank.station
#         tx_type = "tank"

#     else:
#         return resp(400, "Invalid JSON → must include bowser / stan / tank")

#     # 2) Access control
#     if not can_access_station(request, station):
#         return resp(403, "Access denied for this station")

#     # 3) Build transaction payload
#     base = {
#         "type": tx_type,
#         "devID": data.get("devID"),
#         "todate": data.get("todate"),
#         "totime": data.get("totime"),
#         "tmprtr": data.get("tmprtr"),
#         "hmidty": data.get("hmidty"),
#         "trnsid": tx.get("trnsid"),
#         "trnvol": tx.get("trnvol"),
#         "trnamt": tx.get("trnamt"),
#         "utpriz": tx.get("utpriz"),
#         "totvol": tx.get("totvol"),
#         "totamt": tx.get("totamt"),
#         "pmpsts": tx.get("pmpsts"),
#     }

#     # 4) Add device-specific fields including extras
#     if tx_type == "bowser":
#         base.update({
#             "bwsrid": tx.get("bwsrid"),
#             "pumpid": tx.get("pumpid"),
#             "vehnum": tx.get("vehnum"),
#             "mobnum": tx.get("mobnum"),
#         })
#     elif tx_type == "stationary":
#         base.update({
#             "stanid": tx.get("stanid"),
#             "pmpid": tx.get("pmpid"),
#             "attnid": tx.get("attnid"),
#             "vehnum": tx.get("vehnum"),
#             "mobnum": tx.get("mobnum"),
#         })
#     elif tx_type == "tank":
#         base.update({
#             "tankid": tx.get("tankid"),
#             "vehnum": tx.get("vehnum"),
#             "mobnum": tx.get("mobnum"),
#         })

#     # Remove None values
#     base = {k: v for k, v in base.items() if v is not None}

#     # 5) Prevent duplicates
#     existing = Transaction.objects.filter(trnsid=base.get("trnsid")).first()
#     if existing:
#         return resp(400, "Transaction with this ID already exists")

#     # 6) Create new transaction
#     serializer = TransactionSerializer(data=base)
#     if serializer.is_valid():
#         serializer.save()
#         return resp(201, "Transaction created")
    
#     return resp(400, "Validation failed", serializer.errors)
# @api_view(["POST"])
# @authentication_classes([TokenAuthentication])
# @permission_classes([IsAnyAuthenticated])
# @parser_classes([JSONParser])
# def update_service(request):

#     data = request.data or {}

#     base = {
#         "devID": data.get("devID"),
#         "todate": data.get("todate"),
#         "totime": data.get("totime"),
#         "tmprtr": data.get("tmprtr"),
#         "hmidty": data.get("hmidty")
#     }

#     tx = None

#     if "bowser" in data:
#         tx = data["bowser"]
#         base.update({
#             "type": "bowser",
#             "bwsrid": tx.get("bwsrid"),
#             "pumpid": tx.get("pumpid")
#         })

#     elif "stan" in data:
#         tx = data["stan"]
#         base.update({
#             "type": "stationary",
#             "stanid": tx.get("stanid"),
#             "pmpid": tx.get("pmpid"),
#             "attnid": tx.get("attnid"),
#             "vehnum": tx.get("vehnum")
#         })

#     elif "tank" in data:
#         tx = data["tank"]
#         base.update({
#             "type": "tank",
#             "tankid": tx.get("takid")
#         })

#     else:
#         return resp(400, "Invalid JSON → must include bowser / stan / tank")

#     base.update({
#         "trnsid": tx.get("trnsid"),
#         "trnvol": tx.get("trnvol"),
#         "trnamt": tx.get("trnamt"),
#         "utpriz": tx.get("utpriz"),
#         "totvol": tx.get("totvol"),
#         "totamt": tx.get("totamt"),
#         "pmpsts": tx.get("pmpsts")
#     })

#     base = {k: v for k, v in base.items() if v is not None}

#     existing = Transaction.objects.filter(trnsid=base.get("trnsid")).first()

#     if existing:
#         ser = TransactionSerializer(existing, data=base, partial=True)
#         if ser.is_valid():
#             ser.save()
#             return resp(200, "Transaction updated")
#         return resp(400, "Validation failed", ser.errors)

#     ser = TransactionSerializer(data=base)
#     if ser.is_valid():
#         ser.save()
#         return resp(201, "Transaction created")

#     return resp(400, "Validation failed", ser.errors)


# ============================================================
# GET ALL TRANSACTIONS
# ============================================================
# @swagger_auto_schema(method="get")
# @api_view(["GET"])
# @authentication_classes([TokenAuthentication])
# @permission_classes([IsAnyAuthenticated])
# def get_transactions(request):
#     txs = Transaction.objects.all().order_by("-created_at")
 
#     return resp(200, "Fetched", TransactionSerializer(txs, many=True).data)


@swagger_auto_schema(method="get")
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def get_transactions(request):

    role = request.role
    actor = request.actor   # Logged-in Admin/User object

    # ===============================
    # SUPER ADMIN → ALL TRANSACTIONS
    # ===============================
    if role == "superadmin":

        txs = Transaction.objects.all()

    # ============================================
    # ADMIN → ONLY TRANSACTIONS FROM HIS STATIONS
    # ============================================
    elif role == "admin":

        # Step 1: Find stations created by this admin
        station_ids = Station.objects.filter(
            created_by_admin=actor
        ).values_list("station_id", flat=True)

        # Step 2: Transactions are stored with devID (station_id)
        txs = Transaction.objects.filter(
            devID__in=station_ids
        )

    # ============================================
    # USER → ONLY TRANSACTIONS FROM ASSIGNED STATIONS
    # ============================================
    elif role == "user":

        # Step 1: Find stations assigned to this user
        assigned_station_ids = UserAssignment.objects.filter(
            user=actor
        ).values_list("station_id", flat=True)

        # Step 2: Filter transactions by those station IDs
        txs = Transaction.objects.filter(
            devID__in=assigned_station_ids
        )

    # ===============================
    # INVALID ROLE
    # ===============================
    else:
        return resp(403, "Unauthorized role")

    # ===============================
    # OPTIONAL DATE FILTER
    # ===============================
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    if start_date and end_date:
        # Assumes todate is yyyy-mm-dd or similar standard format
        txs = txs.filter(todate__range=[start_date, end_date])

    # ===============================
    # RESPONSE
    # ===============================
    return resp(
        200,
        "Transactions fetched successfully",
        TransactionSerializer(
            txs.order_by("-created_at"),
            many=True
        ).data
    )


# ============================================================
# ✅ GET TRANSACTIONS FOR A SINGLE STATION (Role-Aware)
# ============================================================
@swagger_auto_schema(
    method="get",
    operation_summary="Station Transactions",
    operation_description="""
    Fetch all transactions for a given station_id.

    ✅ Role Based Access:
    - SuperAdmin → Can view all station transactions
    - Admin → Can view only transactions of stations created by him
    - User → Can view only transactions of stations assigned to him
    """,
    manual_parameters=[
        openapi.Parameter(
            name="station_id",
            in_=openapi.IN_PATH,
            type=openapi.TYPE_STRING,
            description="Station ID (Device ID)",
            required=True
        )
    ],
    responses={
        200: "Transactions fetched successfully",
        403: "Access denied",
        404: "Station not found"
    }
)
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def station_transactions(request, station_id):

    role = request.role
    actor = request.actor

    # ===============================
    # 1) Check station exists
    # ===============================
    station = Station.objects.filter(station_id=station_id).first()

    if not station:
        return resp(404, "Station not found")

    # ===============================
    # 2) Permission Logic (Role-Aware)
    # ===============================
    if role == "superadmin":
        # Superadmin can access everything
        pass

    elif role == "admin":
        # Admin can access ONLY stations created by him
        if station.created_by_admin != actor:
            return resp(403, "Access denied")

    elif role == "user":
        # User can access ONLY assigned stations
        allowed = UserAssignment.objects.filter(
            user=actor,
            station_id=station_id
        ).exists()

        if not allowed:
            return resp(403, "Access denied")

    else:
        return resp(403, "Unauthorized role")

    # ===============================
    # 3) Fetch Transactions for Station
    # ===============================
    # ✅ Transaction.devID stores station_id directly
    txs = Transaction.objects.filter(
        devID=station_id
    ).order_by("-created_at")

    # ===============================
    # OPTIONAL DATE FILTER
    # ===============================
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    if start_date and end_date:
        txs = txs.filter(todate__range=[start_date, end_date])

    # ===============================
    # 4) Response
    # ===============================
    return resp(
        200,
        "Transactions fetched successfully",
        TransactionSerializer(txs, many=True).data
    )
#===================================================================
#ASSIGN STATION — FULL SWAGGER Old 
#=======================================================================
# @swagger_auto_schema(
#     method="post",
#     operation_description="Assign a station to a user (Admin or SuperAdmin only)",
#     request_body=openapi.Schema(
#         type=openapi.TYPE_OBJECT,
#         required=["user_id", "admin_id", "station_id"],
#         properties={
#             "user_id": openapi.Schema(
#                 type=openapi.TYPE_INTEGER,
#                 description="User ID to whom the station is assigned"
#             ),
#             "admin_id": openapi.Schema(
#                 type=openapi.TYPE_INTEGER,
#                 description="Admin ID who performs the assignment"
#             ),
#             "admin_name": openapi.Schema(
#                 type=openapi.TYPE_STRING,
#                 description="Admin name (for history record)"
#             ),
#             "station_id": openapi.Schema(
#                 type=openapi.TYPE_STRING,
#                 description="Station ID being assigned"
#             ),
#         }
#     )
# )
# @api_view(["POST"])
# @authentication_classes([TokenAuthentication])
#@permission_classes([IsAnyAuthenticated])# def assign_station(request):

#     data = request.data
#     assignment = UserAssignment.objects.create(
#         user_id=data["user_id"],
#         admin_id=data["admin_id"],
#         admin_name=data.get("admin_name"),
#         station_id=data["station_id"]
#     )

#     return resp(201, "Station assigned", UserAssignmentSerializer(assignment).data)

# #===================================================================
# #ASSIGN STATION — FULL SWAGGER NEW 
# #=======================================================================
# @swagger_auto_schema(
#     method="post",
#     operation_description="Assign a station to a user (Admin or SuperAdmin only)",
#     request_body=openapi.Schema(
#         type=openapi.TYPE_OBJECT,
#         required=["email", "password", "user_id", "admin_id", "station_id"],
#         properties={
#             "email": openapi.Schema(type=openapi.TYPE_STRING, description="Admin/SuperAdmin email"),
#             "password": openapi.Schema(type=openapi.TYPE_STRING, description="Admin/SuperAdmin password"),
#             "user_id": openapi.Schema(type=openapi.TYPE_INTEGER, description="User ID"),
#             "admin_id": openapi.Schema(type=openapi.TYPE_INTEGER, description="Admin ID"),
#             "admin_name": openapi.Schema(type=openapi.TYPE_STRING, description="Admin name"),
#             "station_id": openapi.Schema(type=openapi.TYPE_STRING, description="Station ID"),
#         }
#     )
# )
# @api_view(["POST"])
# @authentication_classes([TokenAuthentication])
# @permission_classes([IsAdminOrSuperAdmin])
# def assign_station(request):
#     station = get_object_or_404(Station, station_id=data["station_id"])

#     if request.role not in ["admin", "superadmin"]:
#         return resp(403, "Only admin or superadmin can assign stations")
    
#     actor = request.actor  # admin or superadmin
#     data = request.data

#     assignment = UserAssignment.objects.create(
#         user_id=data["user_id"],
#         admin_id=actor.id,
#         admin_name=getattr(actor, "name", None),
#         station_id=data["station_id"]
#     )

#     return resp(
#         201,
#         "Station assigned successfully",
#         UserAssignmentSerializer(assignment).data
#     )



# #============================================================
# #2️⃣ UNASSIGN STATION — FULL SWAGGER
# #==========================================================
# @swagger_auto_schema(
#     method="delete",
#     operation_description="Unassign station from a user"
# )
# @api_view(["DELETE"])
# @authentication_classes([TokenAuthentication])
# @permission_classes([IsAdminOrSuperAdmin])
# def unassign_station(request, assignment_id):
    
#     row = UserAssignment.objects.filter(id=assignment_id).first()

#     if not row:
#         return resp(404, "Assignment not found")

#     row.delete()
#     return resp(200, "Station unassigned")


#=================================================================================================
# New assign
#============================================================================================
#============================================================
# 1️⃣ ASSIGN STATION — FULL SWAGGER + PORTAL CHECK + DUPLICATE PREVENTION
#============================================================
@swagger_auto_schema(
    method="post",
    operation_description="Assign a station to a user (Admin or SuperAdmin only). The admin performing the action is automatically recorded.",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=["user_id", "station_id"],
        properties={
            "user_id": openapi.Schema(type=openapi.TYPE_INTEGER, description="User ID"),
            "station_id": openapi.Schema(type=openapi.TYPE_STRING, description="Station ID"),
        }
    )
)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminOrSuperAdmin])
def assign_station(request):
    actor = request.actor
    role = request.role
    data = request.data

    station = get_object_or_404(Station, station_id=data["station_id"])
    user = get_object_or_404(User, id=data["user_id"])

    # Admin restriction
    if role == "admin":
        if user.admin_id != actor.admin_id:
            return resp(403, "You cannot assign stations to another admin's user")
        
        if station.created_by_admin != actor:
            return resp(403, "You cannot assign a station you did not create")

    # ✅ NEW: remove existing assignment (reassign logic)
    UserAssignment.objects.filter(station=station).delete()

    # Create fresh assignment
    assignment = UserAssignment.objects.create(
        user=user,
        admin=actor if role == "admin" else user.admin,
        admin_name=getattr(actor, "name", None),
        station=station
    )

    return resp(
        201,
        "Station reassigned successfully",
        UserAssignmentSerializer(assignment).data
    )
#============================================================
# 2️⃣ UNASSIGN STATION — FULL SWAGGER + PORTAL CHECK
#============================================================
@swagger_auto_schema(
    method="delete",
    operation_description="Unassign a station from a user. The admin performing the action is recorded automatically."
)
@api_view(["DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminOrSuperAdmin])
def unassign_station(request, assignment_id):
    actor = request.actor
    role = request.role

    assignment = get_object_or_404(UserAssignment, id=assignment_id)

    if role == "admin":
        # Check if the station belongs to the admin
        if assignment.station.created_by_admin != actor:
             return resp(403, "You cannot unassign a station you did not create")

    assignment.delete()
    return resp(200, "Station unassigned successfully")

@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def assignments_map(request):
    rows = UserAssignment.objects.select_related("user", "station")

    data = {}

    for row in rows:
        uid = row.user_id
        sid = row.station.station_id

        if uid not in data:
            data[uid] = []

        data[uid].append(sid)

    return resp(200, "Assignments map", data)

@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminOrSuperAdmin])
def get_all_assignments(request):

    rows = UserAssignment.objects.select_related(
        "user", "admin", "station"
    )

    data = list(rows.values(
        "id",
        "user_id",
        "admin_id",
        "admin_name",
        "station_id"
    ))

    return resp(200, "All assignments", data)

#=========================================================
#GET USER ASSIGNED STATIONS — FULL SWAGGER
#==========================================================

@swagger_auto_schema(
    method="get",
    operation_description="Get all assigned stations for a user",
)
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAnyAuthenticated])
def get_user_stations(request, user_id):
    rows = UserAssignment.objects.filter(user_id=user_id)
    return resp(200, "Assigned stations", UserAssignmentSerializer(rows, many=True).data)

#===============================================================
#GET ALL UNASSIGNED STATIONS — FULL SWAGGER
#==============================================================
@swagger_auto_schema(
    method="get",
    operation_description="List stations that are not assigned to any user"
)
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminOrSuperAdmin])
def unassigned_stations(request):
    assigned_ids = UserAssignment.objects.values_list("station_id", flat=True)
    stations = Station.objects.exclude(station_id__in=assigned_ids)
    return resp(200, "Unassigned stations", StationSerializer(stations, many=True).data)


# ============================================================
# MODEL EXTRACTION FUNCTION
# ============================================================
 
def extract_model(barcode):
 
    if not barcode:
        return ""
 
    barcode = barcode.strip().upper()
 
    # Example: THEDHJLO0003972 → DHJLO
    if barcode.startswith("THE"):
        trimmed = barcode[3:]
        match = re.match(r"([A-Z]+)", trimmed)
        if match:
            return match.group(1)
 
    # Example: NX30-00145 → NX30
    if "-" in barcode:
        return barcode.split("-")[0]
    
    if "_" in barcode:
        return barcode.split("_")[0]
 
    # Example: SPO25551 → SPO2
    match = re.match(r"([A-Z]+\d+)", barcode)
    if match:
        return match.group(1)
 
    # Example: DHJL / ADBL
    if barcode.isalpha():
        return barcode
 
    return barcode
 
# ============================================================
# DEVICE BARCODE VALIDATION API
# ============================================================
@swagger_auto_schema(
    method="post",
    operation_description="Validate asset barcode and return model number, validity status and volume.",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=["devID", "barreq"],
        properties={
            "devID": openapi.Schema(type=openapi.TYPE_STRING),
            "barreq": openapi.Schema(
                type=openapi.TYPE_OBJECT,
                required=["barnum"],
                properties={
                    "barnum": openapi.Schema(type=openapi.TYPE_STRING)
                }
            )
        }
    ),
    responses={
        200: openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "devID": openapi.Schema(type=openapi.TYPE_STRING),
                "barrsp": openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "barnum": openapi.Schema(type=openapi.TYPE_STRING),
                        "modnum": openapi.Schema(type=openapi.TYPE_STRING),
                        "valid": openapi.Schema(type=openapi.TYPE_INTEGER),
                        "volume": openapi.Schema(type=openapi.TYPE_NUMBER),
                    }
                )
            }
        ),
        400: "Invalid request"
    }
)
@api_view(['POST'])
def asset_barcode_api(request):
    dev_id = request.data.get("devID")
    barnum = request.data.get("barreq", {}).get("barnum")
 
    if not dev_id or not barnum:
        return Response({"error": "Invalid request"}, status=400)
 
    # Extract model using new universal logic
    modnum = extract_model(barnum)
 
    # Check full barcode in DB
    asset = AssetBarcode.objects.filter(model=barnum).first()
 
    valid = 99
    volume = 0
 
    if asset:
        # Make sure valitity is aware before comparing
        if asset.valitity.tzinfo is None:
            asset.valitity = timezone.make_aware(asset.valitity, timezone.get_current_timezone())
 
        # Use timezone-aware datetime for comparison
        if asset.status == "active" and asset.valitity >= timezone.now():
            valid = 100
            volume = float(asset.volume)
 
    response_payload = {
        "devID": dev_id,
        "barrsp": {
            "barnum": barnum,
            "modnum": modnum,
            "valid":  valid,
            "volume": volume
        }
    }
 
    return Response(response_payload)
 
 
# ============================================================
# CREATE ASSET BARCODE
# ============================================================
@swagger_auto_schema(
    method="post",
    operation_description="Create a new Asset Barcode (Admin only).",
    request_body=AssetBarcodeSerializer,
    responses={201: AssetBarcodeSerializer}
)
@api_view(["POST"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsUser])
def create_asset_barcode(request):

    serializer = AssetBarcodeSerializer(data=request.data)

    if serializer.is_valid():
        role = request.role
        actor = request.actor

        if role == 'user':
            serializer.save(created_by_user=actor)
        elif role == 'admin':
            serializer.save(created_by_admin=actor)
        else:
            serializer.save()

        return Response(serializer.data, status=201)

    return Response(serializer.errors, status=400)
 
 
# ============================================================
# LIST ALL ASSET BARCODES
# ============================================================
@swagger_auto_schema(
    method="get",
    operation_description="List all Asset Barcodes (Admin only).",
    responses={200: AssetBarcodeSerializer(many=True)}
)
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsUser])
def list_asset_barcodes(request):

    role = request.role
    actor = request.actor

    if role == 'user':
        assets = AssetBarcode.objects.filter(created_by_user=actor)
    elif role == 'admin':
        assets = AssetBarcode.objects.filter(created_by_admin=actor)
    else:
        # SuperAdmin sees all
        assets = AssetBarcode.objects.all()

    serializer = AssetBarcodeSerializer(assets, many=True)

    return Response(serializer.data)
 
 
# ============================================================
# RETRIEVE SINGLE ASSET BARCODE
# ============================================================
@swagger_auto_schema(
    method="get",
    operation_description="Retrieve single Asset Barcode by ID (Admin only).",
    manual_parameters=[
        openapi.Parameter(
            'id',
            openapi.IN_PATH,
            description="AssetBarcode ID",
            type=openapi.TYPE_INTEGER
        )
    ],
    responses={200: AssetBarcodeSerializer}
)
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsUser])
def retrieve_asset_barcode(request, id):
 
    asset = get_object_or_404(AssetBarcode, id=id)
    serializer = AssetBarcodeSerializer(asset)
 
    return Response(serializer.data)
 
 
# ============================================================
# UPDATE ASSET BARCODE
# ============================================================
@swagger_auto_schema(
    method="put",
    operation_description="Update Asset Barcode (Admin only).",
    request_body=AssetBarcodeSerializer,
    responses={200: AssetBarcodeSerializer}
)
@api_view(["PUT"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsUser])
def update_asset_barcode(request, id):

    asset = get_object_or_404(AssetBarcode, id=id)
    role = request.role
    actor = request.actor

    if role == 'user' and asset.created_by_user != actor:
        return Response({"error": "You do not have permission to update this asset"}, status=403)
    if role == 'admin' and asset.created_by_admin != actor:
        return Response({"error": "You do not have permission to update this asset"}, status=403)

    serializer = AssetBarcodeSerializer(asset, data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
 
    return Response(serializer.errors, status=400)
 
 
# ============================================================
# DELETE ASSET BARCODE
# ============================================================
@swagger_auto_schema(
    method="delete",
    operation_description="Delete Asset Barcode (Admin only).",
    manual_parameters=[
        openapi.Parameter(
            'id',
            openapi.IN_PATH,
            description="AssetBarcode ID",
            type=openapi.TYPE_INTEGER
        )
    ],
    responses={204: "Deleted successfully"}
)
@api_view(["DELETE"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsUser])
def delete_asset_barcode(request, id):

    asset = get_object_or_404(AssetBarcode, id=id)
    role = request.role
    actor = request.actor

    if role == 'user' and asset.created_by_user != actor:
        return Response({"error": "You do not have permission to delete this asset"}, status=403)
    if role == 'admin' and asset.created_by_admin != actor:
        return Response({"error": "You do not have permission to delete this asset"}, status=403)

    asset.delete()
 
    return Response({"message": "Deleted successfully"}, status=204)



from django.shortcuts import render

# ============================================================
# AUTH / PUBLIC
# ============================================================

def LoginPage(request):
    return render(request, "core/login.html")


# ============================================================
# DASHBOARD
# ============================================================

def iot_dashboard_view(request):
    return render(request, "core/dashboard.html")


# ============================================================
# ASSET / STATIONARY
# ============================================================

def asset_page(request):
    return render(request, "core/asset.html")


# ============================================================
# STATIONS
# ============================================================

def stations_page(request):
    return render(request, "core/stations.html")


def create_station_page(request):
    return render(request, "core/create-station.html")



def station_detail_page(request, station_id):
    return render(request, "core/station-detail.html")


# ============================================================
# TRANSACTIONS & REPORTS
# ============================================================

def transactions_page(request):
    return render(request, "core/transactions.html")


def reports_page(request):
    return render(request, "core/reports.html")


# ============================================================
# USER / ADMIN MANAGEMENT
# ============================================================

def manage_users_page(request):
    return render(request, "core/manage-users.html")


def manage_admins_page(request):
    return render(request, "core/manage-admins.html")


def profile_page(request):
    return render(request, "core/profile.html")








