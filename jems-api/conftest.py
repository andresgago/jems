import pytest
from django.test import override_settings


@pytest.fixture(scope="session", autouse=True)
def temp_media_root(tmp_path_factory):
    """Redirect all file uploads to a temp dir so media/ stays clean after tests."""
    tmp = tmp_path_factory.mktemp("media")
    with override_settings(MEDIA_ROOT=str(tmp)):
        yield tmp
