# Generated by Django 3.2.16 on 2022-12-16 13:27

from django.db import migrations, models
from ..models import validate_template


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='BulkCreationTemplate',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=250)),
                ('template_type', models.CharField(max_length=100)),
                ('template', models.TextField(validators=[validate_template])),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
