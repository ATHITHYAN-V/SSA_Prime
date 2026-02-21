from rest_framework.permissions import BasePermission
from .models import SuperAdmin, Admin, User


# class SuperAdminPermission(BasePermission):
#     """Allow only SuperAdmin"""
#     def has_permission(self, request, view):
#         email = request.data.get("email")
#         password = request.data.get("password")
#         return SuperAdmin.objects.filter(email=email, password=password).exists()


# class AdminPermission(BasePermission):
#     """Allow only Admin"""
#     def has_permission(self, request, view):
#         email = request.data.get("email")
#         password = request.data.get("password")
#         return Admin.objects.filter(email=email, password=password).exists()


# class UserPermission(BasePermission):
#     """Allow only User"""
#     def has_permission(self, request, view):
#         email = request.data.get("email")
#         password = request.data.get("password")
#         return User.objects.filter(email=email, password=password).exists()


# class AdminOrSuperAdminPermission(BasePermission):
#     """Allow Admin + SuperAdmin"""
#     def has_permission(self, request, view):
#         # support POST body + GET query params
#         email = request.data.get("email") or request.query_params.get("email")
#         password = request.data.get("password") or request.query_params.get("password")

#         if not email or not password:
#             return False

#         return (
#             SuperAdmin.objects.filter(email=email, password=password).exists() or
#             Admin.objects.filter(email=email, password=password).exists()
#         )
    
    

# class AdminSuperAdminOrUserPermission(BasePermission):
#     """
#     Allow SuperAdmin + Admin + User
#     (email/password can come from body or query params)
#     """
#     def has_permission(self, request, view):
#         email = request.data.get("email") or request.query_params.get("email")
#         password = request.data.get("password") or request.query_params.get("password")

#         if not email or not password:
#             return False

#         return (
#             SuperAdmin.objects.filter(email=email, password=password).exists() or
#             Admin.objects.filter(email=email, password=password).exists() or
#             User.objects.filter(email=email, password=password).exists()
#         )

# class UserReadOnlyPermission(BasePermission):
#     """Users can only GET"""
#     def has_permission(self, request, view):
#         if request.method in ["GET"]:
#             return True

#         # For POST/PUT/DELETE -> only admins or superadmins
#         email = request.data.get("email")
#         password = request.data.get("password")

#         return (
#             SuperAdmin.objects.filter(email=email, password=password).exists() or
#             Admin.objects.filter(email=email, password=password).exists()
#         )


# class IsAnyAuthenticated(BasePermission):
#     def has_permission(self, request, view):
#         return request.role in ["superadmin", "admin", "user"]

from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return getattr(request, "role", None) == "superadmin"


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return getattr(request, "role", None) == "admin"


class IsAdminOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return getattr(request, "role", None) in ["admin", "superadmin"]


class IsUser(BasePermission):
    def has_permission(self, request, view):
        return getattr(request, "role", None) in ["user", "superadmin", "admin" ]


class IsAnyAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return request.actor is not None

