import json

from django_test_migrations.contrib.unittest_case import MigratorTestCase

from InvenTree import helpers


class TestForwardMigrations(MigratorTestCase):
    """Unit testing class for testing 'bulkcreationtemplate' app migrations"""

    migrate_from = ('bulkaction', helpers.getOldestMigrationFile('bulkaction'))
    migrate_to = ('bulkaction', helpers.getNewestMigrationFile('bulkaction'))

    def prepare(self):
        """Create some simple Template data, and ensure that it migrates OK."""
        BulkCreationTemplate = self.old_state.apps.get_model('bulkaction', 'bulkcreationtemplate')

        simple_valid_generation_template = {
            "version": "0.1.0",
            "input": {},
            "templates": [],
            "output": {
                "generate": {
                    "name": "Test",
                    "description": "Test description"
                },
            }
        }
        BulkCreationTemplate.objects.create(name="Stock template", template_type="STOCK_LOCATION",
                                            template=json.dumps(simple_valid_generation_template))

    def test_migrations(self):
        """Test the database state after applying all migrations"""
        BulkCreationTemplate = self.old_state.apps.get_model('bulkaction', 'bulkcreationtemplate')

        self.assertEqual(1, BulkCreationTemplate.objects.count())
