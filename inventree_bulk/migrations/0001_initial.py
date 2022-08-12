
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='BulkCreationTemplate',
            fields=[
                ('id', models.IntegerField(primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=250)),
                ('template', models.TextField()),
                ('updated_at', models.DateField(auto_now=True)),
                ('created_at', models.DateField(auto_created=True)),
            ],
        ),
    ]
