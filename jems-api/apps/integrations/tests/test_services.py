from unittest.mock import MagicMock, patch

import pytest

from apps.integrations.rtl_client import RtlApiError
from apps.integrations.services import fetch_and_sync_all_carriers


@pytest.mark.django_db
class TestFetchAndSyncAllCarriers:
    def _make_carrier(self, eld_user="user@test.com", eld_password="secret"):
        from apps.carriers.tests.factories import CarrierFactory

        return CarrierFactory(active=True, eld_user=eld_user, eld_password=eld_password)

    def test_happy_path_upserts_all_entities(self):
        self._make_carrier()
        driver_payload = [{"_id": "drv-1", "firstName": "John", "active": True}]
        truck_payload = [{"_id": "trk-1", "name": "T-001", "active": True}]
        status_payload = [{"_id": "ds-1", "userId": "drv-1"}]
        vehicle_payload = [{"_id": "ts-1", "v": "trk-1"}]

        mock_client = MagicMock()
        mock_client.get_drivers.return_value = driver_payload
        mock_client.get_trucks.return_value = truck_payload
        mock_client.get_latest_driver_statuses.return_value = status_payload
        mock_client.get_latest_vehicle_statuses.return_value = vehicle_payload

        with patch("apps.integrations.services.RtlApiClient", return_value=mock_client):
            totals = fetch_and_sync_all_carriers()

        assert totals["drivers"] == 1
        assert totals["trucks"] == 1
        assert totals["driver_statuses"] == 1
        assert totals["truck_statuses"] == 1

        mock_client.get_drivers.assert_called_once()
        mock_client.get_trucks.assert_called_once()
        mock_client.get_latest_driver_statuses.assert_called_once()
        mock_client.get_latest_vehicle_statuses.assert_called_once()

    def test_no_carriers_returns_zero_counts(self):
        totals = fetch_and_sync_all_carriers()
        assert totals == {
            "drivers": 0,
            "trucks": 0,
            "driver_statuses": 0,
            "truck_statuses": 0,
        }

    def test_carrier_without_eld_credentials_is_skipped(self):
        self._make_carrier(eld_user="", eld_password="")
        mock_client = MagicMock()
        with patch("apps.integrations.services.RtlApiClient", return_value=mock_client):
            totals = fetch_and_sync_all_carriers()
        mock_client.get_drivers.assert_not_called()
        assert totals["drivers"] == 0

    def test_rtl_api_error_propagates(self):
        self._make_carrier()
        mock_client = MagicMock()
        mock_client.get_drivers.side_effect = RtlApiError("connection refused")
        with patch("apps.integrations.services.RtlApiClient", return_value=mock_client):
            with pytest.raises(RtlApiError, match="connection refused"):
                fetch_and_sync_all_carriers()

    def test_multiple_carriers_are_each_synced(self):
        self._make_carrier(eld_user="a@a.com", eld_password="pa")
        self._make_carrier(eld_user="b@b.com", eld_password="pb")

        mock_client = MagicMock()
        mock_client.get_drivers.return_value = [{"_id": "drv-x", "active": True}]
        mock_client.get_trucks.return_value = []
        mock_client.get_latest_driver_statuses.return_value = []
        mock_client.get_latest_vehicle_statuses.return_value = []

        with patch("apps.integrations.services.RtlApiClient", return_value=mock_client):
            totals = fetch_and_sync_all_carriers()

        assert mock_client.get_drivers.call_count == 2
        assert totals["drivers"] == 2
