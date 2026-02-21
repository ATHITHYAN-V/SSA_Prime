from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
from .models import CustomUser,AuthToken


class APIKeyAuthentication(BaseAuthentication):

    def authenticate(self, request):

        # ✅ Allow swagger, redoc, schema without auth
        swagger_paths = [
            '/swagger',
            '/swagger/',
            '/swagger.json',
            '/swagger.yaml',
            '/redoc/',
        ]
        if any(request.path.startswith(p) for p in swagger_paths):
            return None

        # Read TZ_KEY safely
        api_key = request.headers.get('TZ_KEY') or request.META.get('HTTP_TZ_KEY')

        if not api_key:
            raise AuthenticationFailed("TZ_KEY header missing")

        # Global API key
        if api_key == settings.GLOBAL_TZ_KEY:
            return None

        # User API key
        try:
            user = CustomUser.objects.get(api_key=api_key)
        except CustomUser.DoesNotExist:
            raise AuthenticationFailed("Invalid TZ_KEY")

        return (user, None)


class TokenAuthentication(BaseAuthentication):

    def authenticate(self, request):
        auth = request.headers.get("Authorization")

        if not auth or not auth.startswith("Bearer "):
            return None

        token_value = auth.split(" ")[1]
        token = AuthToken.objects.filter(token=token_value).first()

        if not token:
            raise AuthenticationFailed("Invalid token")

        # ✅ SET VALUES HERE
        request.role = token.role

        if token.role == "superadmin":
            request.actor = token.superadmin
        elif token.role == "admin":
            request.actor = token.admin
        elif token.role == "user":
            request.actor = token.user

        return (request.actor, token)