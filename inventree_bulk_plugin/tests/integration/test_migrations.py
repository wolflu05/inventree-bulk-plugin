import json
import re
from pathlib import Path, PosixPath
from unittest import skip

from django_test_migrations.contrib.unittest_case import MigratorTestCase


def getMigrationFiles(func) -> str:
    files = Path(__file__).parent.joinpath('..', "..", 'migrations').iterdir()
    none_value = -1 if func == max else float("inf")

    def extract_number(path: PosixPath):
        s = re.findall("(\\d+)_.*\\.py", path.name)
        return int(s[0]) if s and len(s) == 1 else none_value

    return func(files, key=extract_number).name.rstrip(".py")


@skip("Migrations tests take to much time for now.")
class TestForwardMigrations(MigratorTestCase):
    """Unit testing class for testing 'bulkcreationtemplate' app migrations."""

    migrate_from = ('inventree_bulk_plugin', getMigrationFiles(min))
    migrate_to = ('inventree_bulk_plugin', getMigrationFiles(max))

    def prepare(self):
        """Create some simple Template data, and ensure that it migrates OK."""
        bulk_creation_template = self.old_state.apps.get_model('inventree_bulk_plugin', 'bulkCreationTemplate')

        simple_valid_generation_template = {
            "version": "1.0.0",
            "input": {},
            "templates": [],
            "output": {
                "generate": {
                    "name": "Test",
                    "description": "Test description"
                },
            }
        }
        bulk_creation_template.objects.create(name="Stock template", template_type="STOCK_LOCATION",
                                              template=json.dumps(simple_valid_generation_template))

    def test_migrations(self):
        """Test the database state after applying all migrations."""
        bulk_creation_template = self.old_state.apps.get_model('inventree_bulk_plugin', 'bulkCreationTemplate')

        self.assertEqual(1, bulk_creation_template.objects.count())
