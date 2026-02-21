from django.contrib import admin
from django.urls import path, include
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions
from django.conf import settings
from django.conf.urls.static import static

# --- Swagger Docs ---
schema_view = get_schema_view(
   openapi.Info(
      title="SSA Project API",
      default_version='v1',
      description="API documentation for the SSA Project (TZ_KEY secured)",
   ),
   public=True,
    permission_classes=(permissions.AllowAny,),
    # authentication_classes=[],
)



urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Core App Routes
    path('', include('core.urls')),

    # Swagger Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('swagger.json', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger.yaml', schema_view.without_ui(cache_timeout=0), name='schema-yaml'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

# Serve static files in DEBUG mode
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)



