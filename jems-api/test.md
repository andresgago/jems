# JEMS Backend — Test & Dev Commands

All commands run from `jems/jems-api/`.

## Run the dev server

```bash
uv run python manage.py runserver
```

## Tests

### Run all tests
```bash
uv run pytest
```

### Run a specific app
```bash
uv run pytest apps/loads/tests/
uv run pytest apps/users/tests/
```

### Run a specific file
```bash
uv run pytest apps/loads/tests/test_services.py
uv run pytest apps/loads/tests/test_views.py
```

### Run a specific test
```bash
uv run pytest apps/loads/tests/test_services.py::TestLoadService::test_create_load
```

### Run with coverage report
```bash
uv run coverage run -m pytest
uv run coverage report
uv run coverage html   # generates htmlcov/index.html
```

### Run only fast tests (skip slow/integration)
```bash
uv run pytest -m "not slow"
```

## Code quality

### Format (Black)
```bash
uv run black .
```

### Lint (Ruff)
```bash
uv run ruff check .
uv run ruff check . --fix
```

### Type check (mypy)
```bash
uv run mypy .
```

## Database

### Load base catalog data (states, trailer types, truck types, etc.)
```bash
uv run python manage.py seed
```

### Import legacy TMS data from the local SQL dump
```bash
uv run python manage.py seed_from_tms_dump
```

### Apply migrations
```bash
uv run python manage.py migrate
```

### Create a migration after model changes
```bash
uv run python manage.py makemigrations
```

### Open Django shell
```bash
uv run python manage.py shell
```

## End-to-end API smoke test

Crea una base de datos temporal, corre migraciones, levanta el servidor, ejercita todos los endpoints en orden y limpia al final.

```bash
./scripts/run_api_checks.sh
```

Requiere: `uv`, cliente `psql`, PostgreSQL + PostGIS corriendo.
