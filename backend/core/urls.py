from django.urls import path
from django.views.generic.base import RedirectView
from .views import (
    # ===================== AUTH APIs =====================
    LoginView,
    RegisterRoleView,
    manage_users,
    logout,  # ✅ ADDED THIS: Import the logout function

    # ===================== IOT APIs ======================
    update_service,
    get_transactions,

    # ===================== STATION APIs ==================
    create_station,
    get_stations,
    station_detail,
    station_update,
    station_delete,
    station_transactions,

    # ===================== BOWSER APIs ===================
    add_bowser,
    bulk_add_bowsers,
    list_bowsers,
    list_all_bowsers,
    bowser_detail,

    # ===================== STATIONARY (ASSET) APIs =======
    add_stationary,
    bulk_add_stationaries,
    list_stationaries,
    get_all_stationaries,
    stationary_detail,

    # ===================== TANK APIs =====================
    add_tank,
    bulk_add_tanks,
    list_tanks,
    get_all_tanks,
    tank_detail,

    # ===================== ASSIGNMENT APIs ===============
    assign_station,
    unassign_station,
    get_user_stations,
    unassigned_stations,
    get_all_assignments,

    # ===================== ASSET BARCODE APIs ==============
    asset_barcode_api,
    create_asset_barcode,
    list_asset_barcodes,
    retrieve_asset_barcode,
    update_asset_barcode,
    delete_asset_barcode,
    # ===================== HTML PAGE VIEWS ===============
    LoginPage,
    iot_dashboard_view,
    asset_page,
    stations_page,
    create_station_page,
    station_detail_page,
    transactions_page,
    reports_page,
    manage_users_page,
    manage_admins_page,
    profile_page,
)

urlpatterns = [
    # =====================================================
    # ROOT REDIRECT (Fixes 404 on base URL)
    # =====================================================
    path("", RedirectView.as_view(url="/login/", permanent=False)),

    # =====================================================
    # AUTH APIs
    # =====================================================
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/register/", RegisterRoleView.as_view(), name="register"),
    path("auth/manage/", manage_users, name="manage_users"),
    path("auth/logout/", logout, name="logout_api"), # ✅ ADDED THIS: Register the path

    # =====================================================
    # IOT APIs
    # =====================================================
    path("iot/update/", update_service, name="update_service"),
    path("iot/transactions/", get_transactions, name="get_transactions"),

    # =====================================================
    # STATION APIs
    # =====================================================
    path("stations/create/", create_station, name="create_station_api"),
    path("stations/list/", get_stations, name="get_stations_api"),
    path("stations/<str:station_id>/", station_detail, name="station_detail_api"),
    path("stations/<str:station_id>/update/", station_update, name="station_update_api"),
    path("stations/<str:station_id>/delete/", station_delete, name="station_delete_api"),
    path("stations/<str:station_id>/transactions/", station_transactions, name="station_transactions_api"),

    # =====================================================
    # BOWSER APIs
    # =====================================================
    path("stations/<str:station_id>/bowsers/add/", add_bowser, name="add_bowser"),
    path("stations/<str:station_id>/bowsers/bulk-add/", bulk_add_bowsers, name="bulk_add_bowsers"),
    path("stations/<str:station_id>/bowsers/", list_bowsers, name="list_bowsers"),
    path("bowsers/<int:bowser_id>/", bowser_detail, name="bowser_detail"),
    path("bowsers/list/", list_all_bowsers, name="list_all_bowsers"),

    # =====================================================
    # STATIONARY / ASSET APIs
    # =====================================================
    path("stations/<str:station_id>/stationaries/add/", add_stationary, name="add_stationary"),
    path("stations/<str:station_id>/stationaries/bulk-add/", bulk_add_stationaries, name="bulk_add_stationaries"),
    path("stations/<str:station_id>/stationaries/", list_stationaries, name="list_stationaries"),
    path("stationaries/all/", get_all_stationaries, name="get_all_stationaries"),
    path("stationaries/<int:stationary_id>/", stationary_detail, name="stationary_detail"),

    # =====================================================
    # TANK APIs
    # =====================================================
    path("stations/<str:station_id>/tanks/add/", add_tank, name="add_tank"),
    path("stations/<str:station_id>/tanks/bulk-add/", bulk_add_tanks, name="bulk_add_tanks"),
    path("stations/<str:station_id>/tanks/", list_tanks, name="list_tanks"),
    path("tanks/all/", get_all_tanks, name="get_all_tanks"),
    path("tanks/<int:tank_id>/", tank_detail, name="tank_detail"),

    # =====================================================
    # ASSIGNMENT APIs
    # =====================================================
    path("assignments/assign/", assign_station, name="assign_station"),
    path("assignments/<int:assignment_id>/unassign/", unassign_station, name="unassign_station"),
    path("assignments/user/<int:user_id>/", get_user_stations, name="get_user_stations"),
    path("assignments/unassigned/stations/", unassigned_stations, name="unassigned_stations"),
    path("assignments/all/", get_all_assignments, name="get_all_assignments"),

    #=======================================================
    #    # Barcode
    #==========================================================
    path("asset/validate/", asset_barcode_api),
    path("asset/create/", create_asset_barcode),
    path("asset/list/", list_asset_barcodes),
    path("asset/update/<int:id>/", update_asset_barcode),
    path("asset/delete/<int:id>/", delete_asset_barcode),



    
    # =====================================================
    # FRONTEND HTML PAGES (REFINED ROUTES)
    # =====================================================
    path("login/", LoginPage, name="login_page"),
    path("dashboard/", iot_dashboard_view, name="dashboard"),

    path("asset/", asset_page, name="asset_page"),
    path("stations/", stations_page, name="stations_page"),
    path("stations-create/", create_station_page, name="create_station_page"),
    path("stations-detail/<str:station_id>/", station_detail_page, name="station_detail_page"),

    path("transactions/", transactions_page, name="transactions_page"),
    path("reports/", reports_page, name="reports_page"),

    path("users/", manage_users_page, name="manage_users_page"),
    path("admins/", manage_admins_page, name="manage_admins_page"),
    path("profile/", profile_page, name="profile_page"),
]