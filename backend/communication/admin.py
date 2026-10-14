from django.contrib import admin
from communication.models import Announcement, Notification, Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["title", "document_type", "student", "status", "issued_date", "college"]
    list_filter = ["document_type", "status", "college"]
    search_fields = ["title", "student__roll_number"]
