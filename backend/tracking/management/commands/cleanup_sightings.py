from django.core.management.base import BaseCommand
from tracking.services import cleanup_old_sightings


class Command(BaseCommand):
    help = "Auto-delete edge detection event sightings older than retention period (default 24h) for DPDP compliance."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=24,
            help="Retention duration in hours before purging sightings (default: 24)",
        )

    def handle(self, *args, **options):
        hours = options["hours"]
        count = cleanup_old_sightings(retention_hours=hours)
        self.stdout.write(
            self.style.SUCCESS(f"Successfully purged {count} detection events older than {hours} hours.")
        )

