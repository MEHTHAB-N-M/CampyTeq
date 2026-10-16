from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # OpenAPI 3.0 Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # API v1 Modules
    path('api/v1/auth/', include('accounts.urls_auth')),
    path('api/v1/accounts/', include('accounts.urls_auth')),
    path('api/v1/users/', include('accounts.urls_users')),
    path('api/v1/colleges/', include('colleges.urls')),
    path('api/v1/departments/', include('departments.urls')),
    path('api/v1/academics/', include('academics.urls')),
    path('api/v1/faculty/', include('faculty.urls')),
    path('api/v1/students/', include('students.urls')),
    path('api/v1/exams/', include('exams.urls')),
    path('api/v1/assignments/', include('assignments.urls')),
    path('api/v1/attendance/', include('attendance.urls')),
    path('api/v1/fees/', include('fees.urls')),
    path('api/v1/communication/', include('communication.urls')),
    path('api/v1/leave/', include('leave.urls')),
    path('api/v1/printshop/', include('printshop.urls')),
    path('api/v1/library/', include('library.urls')),
    path('api/v1/cameras/', include('cameras.urls')),
    path('api/v1/tracking/', include('tracking.urls')),
    path('api/v1/analytics/', include('analytics.urls')),
    path('api/v1/facilities/', include('facilities.urls')),
    path('api/v1/hod/', include('attendance.urls_hod')),
    path('api/v1/student/', include('attendance.urls_student')),
    path('api/v1/parent/', include('students.urls_parent')),
    path('api/v1/mentor/', include('students.urls_mentor')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
