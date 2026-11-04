from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView,
    UserProfileView,
    UserModulesView,
    ChangePasswordView,
    SwitchRoleView,
)

urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserProfileView.as_view(), name='user_profile'),
    path('me/modules/', UserModulesView.as_view(), name='user_modules'),
    path('modules/', UserModulesView.as_view(), name='user_modules_alias'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('switch-role/', SwitchRoleView.as_view(), name='switch_role'),
]
