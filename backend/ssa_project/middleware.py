from django.conf import settings
from django.http import JsonResponse


class GlobalAPIKeyMiddleware:
    """
    SSA Handshake Middleware — FINAL VERSION
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        path = request.path
        method = request.method

        # ✅ Always allow preflight
        if method == "OPTIONS":
            return self.get_response(request)

        # --------------------------------------------------
        # FRONTEND PAGES — ALWAYS ALLOW
        # --------------------------------------------------

        PUBLIC_PREFIXES = (
            "/",
            "/login",
            "/dashboard",
            "/stations",
            "/transactions",
            "/reports",
            "/users",
            "/admins",
            "/profile",
            "/asset",
            "/static/",
            "/media/",
            "/admin/",
            "/swagger",
            "/redoc",
            "/schema",
            "/favicon.ico",
        )

        if path.startswith(PUBLIC_PREFIXES):
            return self.get_response(request)

        # --------------------------------------------------
        # API ROUTES — REQUIRE TZ KEY
        # --------------------------------------------------

        API_PREFIXES = (
            "/api/",
            "/iot/",
            "/auth/",
            "/stations/",
        )

        if not path.startswith(API_PREFIXES):
            return self.get_response(request)

        try:
            tz_key = (
                request.headers.get("TZ-KEY")
                or request.headers.get("Tz-Key")
                or request.headers.get("tz-key")
                or request.META.get("HTTP_TZ_KEY")
            )

            if not tz_key:
                return JsonResponse({"detail": "TZ-KEY missing"}, status=403)

            if str(tz_key).strip() != str(settings.GLOBAL_TZ_KEY).strip():
                return JsonResponse({"detail": "Invalid TZ-KEY"}, status=403)

        except Exception as e:
            return JsonResponse({"detail": f"Middleware Error: {str(e)}"}, status=500)

        return self.get_response(request)
