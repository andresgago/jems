"""
HTTP client for the ApexHOS (RTL) ELD API.

Authenticates per-carrier using credentials stored on the Carrier model and
caches the bearer token in Django's cache backend (Redis) to avoid re-auth on
every request.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from django.core.cache import cache

logger = logging.getLogger(__name__)

_BASE_URL = "https://backend.apexhos.com/"
_TOKEN_TTL = 3600  # seconds — cache token for 1 hour


class RtlApiError(Exception):
    """Raised when the RTL API returns an error or is unreachable."""


class RtlApiClient:
    def __init__(self, carrier_id: int, eld_user: str, eld_password: str) -> None:
        self._carrier_id = carrier_id
        self._eld_user = eld_user
        self._eld_password = eld_password
        self._cache_key = f"rtl_access_token_{carrier_id}"

    # ── Auth ──────────────────────────────────────────────────────────────────

    def _get_token(self) -> str:
        token: str | None = cache.get(self._cache_key)
        if token:
            return token
        return self._login()

    def _login(self) -> str:
        payload = {
            "strategy": "local",
            "email": self._eld_user,
            "password": self._eld_password,
            "company": None,
            "rCode": "rtl",
        }
        try:
            response = httpx.post(
                f"{_BASE_URL}authentication",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RtlApiError(f"RTL login failed: {exc}") from exc

        data = response.json()
        token = data.get("accessToken")
        if not token:
            raise RtlApiError("RTL login succeeded but no accessToken in response")

        cache.set(self._cache_key, token, _TOKEN_TTL)
        return token

    def _invalidate_token(self) -> None:
        cache.delete(self._cache_key)

    # ── HTTP ──────────────────────────────────────────────────────────────────

    def _get(self, path: str) -> list[dict[str, Any]]:
        """GET a resource, re-authenticating once on 401."""
        token = self._get_token()
        for attempt in range(2):
            try:
                response = httpx.get(
                    f"{_BASE_URL}{path}",
                    headers={
                        "Authorization": token,
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    timeout=60,
                )
            except httpx.HTTPError as exc:
                raise RtlApiError(f"RTL request to {path} failed: {exc}") from exc

            if response.status_code == 401 and attempt == 0:
                self._invalidate_token()
                token = self._login()
                continue

            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise RtlApiError(
                    f"RTL {path} returned {response.status_code}"
                ) from exc

            data = response.json()
            return data.get("data", [])

        raise RtlApiError(f"RTL {path}: exhausted retries")  # pragma: no cover

    # ── Public fetch methods ───────────────────────────────────────────────────

    def get_drivers(self) -> list[dict[str, Any]]:
        return self._get("users")

    def get_trucks(self) -> list[dict[str, Any]]:
        return self._get("vehicles")

    def get_latest_driver_statuses(self) -> list[dict[str, Any]]:
        return self._get("latest_driver_statuses")

    def get_latest_vehicle_statuses(self) -> list[dict[str, Any]]:
        return self._get("latest_vehicle_statuses")
