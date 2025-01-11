// a list of helper functions for the api's 
import fetch from 'node-fetch'; // You can use any fetch/HTTP request library like Axios

// Function to validate Zipcode format
export const isValidZipcode = (zipcode) => {
  const isValidZip = /(^\d{5}$)|(^\d{5}-\d{4}$)/;
  return isValidZip.test(zipcode);
};

export const generateReferralCode = (length = 8) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let referralCode = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    referralCode += characters[randomIndex];
  }
  
  return referralCode.toUpperCase(); // Optional: Convert to uppercase for consistency
}

// Function to get geocode (latitude and longitude) from Google Maps API
export const getGeocodeAddress = async (zipcode, city) => {
  try {
    // Use either zipcode or city, whichever is valid
    const address = isValidZipcode(zipcode) && city ? `${city} ${zipcode}` : city;
    if (!address) return null;
    const geocode_key = process.env.GOOGLE_GEOCODE_KEY
    // Build Google Maps Geocoding API URL
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${geocode_key}`;

    // Fetch the geocode data
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      // return [lng, lat]; // Return coordinates in [lng, lat] format (for MongoDB Point)
      return {
        lng: lng,
        lat:lat
      } 
    } else {
      console.error(`Geocode error: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching geocode address:', error);
    return null;
  }
};

