import datetime
import zoneinfo

import pytest

from apps.dispatch.tests.factories import DispatcherWorkFactory

UTC = zoneinfo.ZoneInfo("UTC")


@pytest.mark.django_db
class TestDispatcherWorkDurationHours:
    def test_finished_work_has_correct_duration(self):
        work = DispatcherWorkFactory(
            start=datetime.datetime(2024, 1, 15, 8, 0, tzinfo=UTC),
            end=datetime.datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
            is_finished=True,
        )
        assert work.duration_hours == 2.0

    def test_unfinished_work_returns_zero(self):
        work = DispatcherWorkFactory(
            start=datetime.datetime(2024, 1, 15, 8, 0, tzinfo=UTC),
            end=datetime.datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
            is_finished=False,
        )
        assert work.duration_hours == 0.0

    def test_duration_with_partial_hours(self):
        work = DispatcherWorkFactory(
            start=datetime.datetime(2024, 1, 15, 8, 0, tzinfo=UTC),
            end=datetime.datetime(2024, 1, 15, 9, 30, tzinfo=UTC),
            is_finished=True,
        )
        assert work.duration_hours == 1.5
