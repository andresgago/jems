let promise = null;

export function loadGoogleMaps() {
  if (promise) return promise;
  if (window.google?.maps) return (promise = Promise.resolve());
  promise = new Promise((resolve, reject) => {
    window.__onGoogleMapsLoaded = resolve;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&libraries=places&callback=__onGoogleMapsLoaded`;
    script.async = true;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return promise;
}

export function parsePlaceComponents(place) {
  const get = (type, nameType = 'short_name') =>
    place.address_components?.find((c) => c.types.includes(type))?.[nameType] || '';
  return {
    street: `${get('street_number')} ${get('route')}`.trim(),
    zip: get('postal_code'),
    cityName: get('locality', 'long_name'),
    state: get('administrative_area_level_1'),
  };
}

export function calculateMiles(origin, destination) {
  return new Promise((resolve) => {
    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destination],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
        avoidHighways: false,
        avoidTolls: false,
      },
      (response, status) => {
        if (status !== 'OK') return resolve(null);
        const meters = response.rows[0]?.elements[0]?.distance?.value;
        resolve(meters ? Math.ceil(meters / 1609) : null);
      }
    );
  });
}
