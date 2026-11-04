from datetime import timedelta
from django.utils import timezone
from .models import DetectionEvent


def cleanup_old_sightings(retention_hours=24):
    """
    Deletes edge CV detection sightings older than the retention period.
    Statutory DPDP compliance: Default retention period is 24 hours.
    """
    cutoff = timezone.now() - timedelta(hours=retention_hours)
    deleted_count, _ = DetectionEvent.objects.filter(detected_at__lt=cutoff).delete()
    return deleted_count

