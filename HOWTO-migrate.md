# How to Apply an Existing Django Project into This Docker Template

This guide walks through migrating an existing Django project into this Docker setup.

---

## Overview of what needs to change

| What | Where |
|---|---|
| Your Django source code | Replace contents of `app/` |
| Your dependencies | Update `docker/requirements.txt` |
| Your Django settings | Adapt `settings.py` for environment variables and PostgreSQL |
| Your project package name | Update `manage.py`, `wsgi.py`, and `docker/entrypoint.sh` |
| Your secrets | Update `.env` |

---

## Step 1 — Copy your project into `app/`

Copy your project files into the `app/` directory:

```bash
cp -r /path/to/your/django/project/* app/
```

Your `app/` should look like this after copying:

```
app/
├── manage.py
├── myproject/          ← your project package (contains settings.py, wsgi.py)
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── myapp/              ← your Django apps
│   ├── models.py
│   ├── views.py
│   └── ...
└── ...
```

---

## Step 2 — Update `docker/requirements.txt`

Add all your project's dependencies to `docker/requirements.txt`.
Keep the existing base packages:

```
Django>=5.2,<5.3
gunicorn==22.0.0
psycopg2-binary==2.9.9
python-decouple==3.8

# Add your dependencies below
djangorestframework==3.15.0
Pillow==10.3.0
# ... etc
```

> If your project has a `requirements.txt` already, merge it into `docker/requirements.txt`.

---

## Step 3 — Update project package name references

When Django creates a project with `django-admin startproject myproject`, it hardcodes
the project name in three files. All three must point to **your** project package name.

Your project package name is the directory inside `app/` that contains `settings.py` and `wsgi.py`.

### 3a. `app/manage.py`

```python
# Change django_project to your project package name
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
```

### 3b. `app/myproject/wsgi.py`

```python
# Change django_project to your project package name
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
```

### 3c. `docker/entrypoint.sh`

```sh
# Change django_project to your project package name
exec gunicorn myproject.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 1 \
    --reload \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
```

> After editing `entrypoint.sh` always rebuild with `docker compose up --build`
> so Docker copies the updated file into the image.

---

## Step 4 — Adapt `settings.py`

Your existing `settings.py` needs to read configuration from environment variables
so it works inside Docker. Make the following changes:

### 4a. Install python-decouple

It is already in `docker/requirements.txt`. Import it at the top of your `settings.py`:

```python
from decouple import Csv, config
```

### 4b. Secret key and debug

```python
# Replace hardcoded values with:
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:8000,http://127.0.0.1:8000',
    cast=Csv(),
)
```

### 4c. Database — switch from SQLite to PostgreSQL

```python
# Replace your existing DATABASES block with:
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB'),
        'USER': config('POSTGRES_USER'),
        'PASSWORD': config('POSTGRES_PASSWORD'),
        'HOST': config('POSTGRES_HOST', default='db'),
        'PORT': config('POSTGRES_PORT', default='5432'),
    }
}
```

### 4d. Static and media files

```python
STATIC_URL = '/static/'
STATIC_ROOT = '/staticfiles'   # matches the volume mount in docker-compose.yml

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

---

## Step 5 — Update `.env`

Open your `.env` file and set the correct values:

```env
# Nginx
NGINX_PORT=8000

# Django
SECRET_KEY=your-long-random-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000

# PostgreSQL
POSTGRES_DB=django_db
POSTGRES_USER=django_user
POSTGRES_PASSWORD=your-strong-password
POSTGRES_HOST=db
POSTGRES_PORT=5432

# pgAdmin
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=your-pgadmin-password
```

---

## Step 6 — Build and start

```bash
docker compose up --build
```

On first startup the container will automatically:
1. Wait for PostgreSQL
2. Run `python manage.py migrate`
3. Run `python manage.py collectstatic`
4. Start Gunicorn

---

## Step 7 — Create a superuser (if needed)

```bash
docker compose exec django python manage.py createsuperuser
```

---

## Migrating existing data from SQLite

If your existing project has data in a SQLite database that you want to keep:

**1. Export data from SQLite:**

```bash
# Run this in your original project (outside Docker)
python manage.py dumpdata --natural-foreign --natural-primary \
    --exclude=contenttypes --exclude=auth.permission \
    -o data.json
```

**2. Copy the file into the `app/` directory:**

```bash
cp data.json app/data.json
```

**3. After `docker compose up --build`, import the data:**

```bash
docker compose exec django python manage.py loaddata data.json
```

---

## Troubleshooting

**Static files not showing (unstyled admin page)**

```bash
docker compose exec django python manage.py collectstatic --noinput --clear
```

**Database errors on startup**

Check that your `DATABASES` settings match the `.env` values exactly,
and that `psycopg2-binary` is in `docker/requirements.txt`.

**`ModuleNotFoundError: No module named 'django_project'`**

The project package name is wrong in one of three places. Check all of them:

| File | Line to check |
|---|---|
| `app/manage.py` | `os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')` |
| `app/myproject/wsgi.py` | `os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')` |
| `docker/entrypoint.sh` | `exec gunicorn myproject.wsgi:application \` |

After fixing, always rebuild:

```bash
docker compose down
docker compose up --build
```

**`ModuleNotFoundError: No module named 'somepackage'`**

A dependency is missing from `docker/requirements.txt`. Add it and rebuild:

```bash
docker compose up --build
```

**500 errors with no details**

Set `DEBUG=True` in `.env` to see full tracebacks in the browser.
