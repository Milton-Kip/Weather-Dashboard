// API key for OpenWeatherMap
const API_KEY = 'YOUR_OPENWEATHER_API_KEY';
const DEFAULT_CITY = 'New York';

// Global variables
let currentUnit = 'metric'; // 'metric' for Celsius, 'imperial' for Fahrenheit
let lastSearchedCity = '';
let weatherData = null;
let forecastData = null;

// DOM elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const locationEl = document.getElementById('location');
const dateEl = document.getElementById('date');
const temperatureEl = document.getElementById('temperature');
const descriptionEl = document.getElementById('description');
const weatherIconEl = document.getElementById('weather-icon');
const windEl = document.getElementById('wind');
const humidityEl = document.getElementById('humidity');
const pressureEl = document.getElementById('pressure');
const forecastContainer = document.getElementById('forecast-container');

// Map initialization
let map;
let marker;
let weatherLayer;

// Initialize the application
function init() {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
        console.error('Leaflet library not loaded. Make sure the script is included correctly.');
        return;
    }

    // Initialize map
    try {
        map = L.map('map').setView([40.7128, -74.0060], 10);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('map').innerHTML = '<p class="error-message">Failed to load map. Please check your internet connection.</p>';
    }
    
    // Add event listeners
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Add unit toggle button to the DOM
    addUnitToggle();
    
    // Add geolocation button
    addGeolocationButton();
    
    // Load last searched city from local storage
    const savedCity = localStorage.getItem('lastCity');
    if (savedCity) {
        getWeather(savedCity);
    } else {
        // Get weather for default city
        getWeather(DEFAULT_CITY);
    }

    // Add window resize event listener for map responsiveness
    window.addEventListener('resize', () => {
        if (map) {
            map.invalidateSize();
        }
    });
}

// Add unit toggle button
function addUnitToggle() {
    const header = document.querySelector('header');
    
    const unitToggle = document.createElement('div');
    unitToggle.className = 'unit-toggle';
    unitToggle.innerHTML = `
        <button id="celsius-btn" class="active">°C</button>
        <button id="fahrenheit-btn">°F</button>
    `;
    
    header.appendChild(unitToggle);
    
    // Add event listeners
    document.getElementById('celsius-btn').addEventListener('click', () => {
        if (currentUnit !== 'metric') {
            currentUnit = 'metric';
            updateUnitButtons();
            if (weatherData && forecastData) {
                displayCurrentWeather(weatherData);
                displayForecast(forecastData);
            }
        }
    });
    
    document.getElementById('fahrenheit-btn').addEventListener('click', () => {
        if (currentUnit !== 'imperial') {
            currentUnit = 'imperial';
            updateUnitButtons();
            if (weatherData && forecastData) {
                displayCurrentWeather(weatherData);
                displayForecast(forecastData);
            }
        }
    });
}

// Update unit toggle buttons
function updateUnitButtons() {
    const celsiusBtn = document.getElementById('celsius-btn');
    const fahrenheitBtn = document.getElementById('fahrenheit-btn');
    
    if (currentUnit === 'metric') {
        celsiusBtn.classList.add('active');
        fahrenheitBtn.classList.remove('active');
    } else {
        celsiusBtn.classList.remove('active');
        fahrenheitBtn.classList.add('active');
    }
}

// Add geolocation button
function addGeolocationButton() {
    const searchContainer = document.querySelector('.search-container');
    
    const geoButton = document.createElement('button');
    geoButton.id = 'geo-btn';
    geoButton.innerHTML = '<i class="fas fa-location-arrow"></i>';
    geoButton.title = 'Use your current location';
    
    searchContainer.appendChild(geoButton);
    
    // Add event listener
    geoButton.addEventListener('click', getUserLocation);
}

// Get user's current location
function getUserLocation() {
    if (navigator.geolocation) {
        // Show loading indicator
        showLoadingIndicator();
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                getWeatherByCoords(latitude, longitude);
                hideLoadingIndicator();
            },
            (error) => {
                hideLoadingIndicator();
                showError(`Geolocation error: ${getGeolocationErrorMessage(error)}`);
            },
            { timeout: 10000 }
        );
    } else {
        showError('Geolocation is not supported by your browser');
    }
}

// Get geolocation error message
function getGeolocationErrorMessage(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            return "User denied the request for geolocation.";
        case error.POSITION_UNAVAILABLE:
            return "Location information is unavailable.";
        case error.TIMEOUT:
            return "The request to get user location timed out.";
        case error.UNKNOWN_ERROR:
            return "An unknown error occurred.";
        default:
            return "An error occurred while getting location.";
    }
}

// Show loading indicator
function showLoadingIndicator() {
    // Create loading indicator if it doesn't exist
    if (!document.getElementById('loading-indicator')) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner"></div><p>Loading...</p>';
        document.body.appendChild(loadingIndicator);
    }
    
    document.getElementById('loading-indicator').style.display = 'flex';
}

// Hide loading indicator
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    // Create error container if it doesn't exist
    if (!document.getElementById('error-container')) {
        const errorContainer = document.createElement('div');
        errorContainer.id = 'error-container';
        document.body.appendChild(errorContainer);
    }
    
    const errorContainer = document.getElementById('error-container');
    errorContainer.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
            <button id="error-close-btn"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    errorContainer.style.display = 'flex';
    
    // Add event listener to close button
    document.getElementById('error-close-btn').addEventListener('click', () => {
        errorContainer.style.display = 'none';
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 5000);
}

// Handle search button click
function handleSearch() {
    const city = searchInput.value.trim();
    if (city) {
        getWeather(city);
        searchInput.value = '';
    } else {
        showError('Please enter a city name');
    }
}

// Get weather by city name
async function getWeather(city) {
    showLoadingIndicator();
    
    try {
        // Get current weather
        const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=${currentUnit}`;
        const currentResponse = await fetch(currentWeatherUrl);
        
        if (!currentResponse.ok) {
            throw new Error(await getErrorMessage(currentResponse));
        }
        
        weatherData = await currentResponse.json();
        
        // Save to local storage
        localStorage.setItem('lastCity', city);
        lastSearchedCity = city;
        
        // Update map
        updateMap(weatherData.coord.lat, weatherData.coord.lon);
        
        // Display current weather
        displayCurrentWeather(weatherData);
        
        // Get forecast
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=${currentUnit}`;
        const forecastResponse = await fetch(forecastUrl);
        
        if (!forecastResponse.ok) {
            throw new Error(await getErrorMessage(forecastResponse));
        }
        
        forecastData = await forecastResponse.json();
        
        // Display forecast
        displayForecast(forecastData);
        
        hideLoadingIndicator();
    } catch (error) {
        hideLoadingIndicator();
        showError(error.message);
    }
}

// Get weather by coordinates
async function getWeatherByCoords(lat, lon) {
    showLoadingIndicator();
    
    try {
        // Get current weather
        const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`;
        const currentResponse = await fetch(currentWeatherUrl);
        
        if (!currentResponse.ok) {
            throw new Error(await getErrorMessage(currentResponse));
        }
        
        weatherData = await currentResponse.json();
        
        // Save to local storage
        localStorage.setItem('lastCity', weatherData.name);
        lastSearchedCity = weatherData.name;
        
        // Update map
        updateMap(lat, lon);
        
        // Display current weather
        displayCurrentWeather(weatherData);
        
        // Get forecast
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`;
        const forecastResponse = await fetch(forecastUrl);
        
        if (!forecastResponse.ok) {
            throw new Error(await getErrorMessage(forecastResponse));
        }
        
        forecastData = await forecastResponse.json();
        
        // Display forecast
        displayForecast(forecastData);
        
        hideLoadingIndicator();
    } catch (error) {
        hideLoadingIndicator();
        showError(error.message);
    }
}

// Get error message from response
async function getErrorMessage(response) {
    try {
        const errorData = await response.json();
        return errorData.message || `Error: ${response.status} ${response.statusText}`;
    } catch (e) {
        return `Error: ${response.status} ${response.statusText}`;
    }
}

// Display current weather data
function displayCurrentWeather(data) {
    const { name, sys, main, weather, wind } = data;
    const date = new Date();
    
    locationEl.textContent = `${name}, ${sys.country}`;
    dateEl.textContent = formatDate(date);
    
    // Temperature with unit
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    temperatureEl.textContent = `${Math.round(main.temp)}${tempUnit}`;
    
    descriptionEl.textContent = weather[0].description;
    weatherIconEl.src = `https://openweathermap.org/img/wn/${weather[0].icon}@2x.png`;
    weatherIconEl.alt = weather[0].description;
    
    // Wind speed with unit
    const windSpeed = currentUnit === 'metric' ? 
        `${Math.round(wind.speed * 3.6)} km/h` : // Convert m/s to km/h
        `${Math.round(wind.speed)} mph`;
    windEl.textContent = windSpeed;
    
    humidityEl.textContent = `${main.humidity}%`;
    pressureEl.textContent = `${main.pressure} hPa`;
    
    // Add feels like temperature
    addFeelsLikeTemperature(main.feels_like);
    
    // Add sunrise and sunset times
    addSunriseSunset(sys.sunrise, sys.sunset);
    
    // Change background based on weather condition
    setWeatherBackground(weather[0].id);
}

// Add feels like temperature
function addFeelsLikeTemperature(feelsLike) {
    const detailsContainer = document.querySelector('.details');
    
    // Check if feels like element already exists
    let feelsLikeEl = document.getElementById('feels-like-container');
    
    if (!feelsLikeEl) {
        // Create new element
        feelsLikeEl = document.createElement('div');
        feelsLikeEl.id = 'feels-like-container';
        feelsLikeEl.className = 'detail';
        feelsLikeEl.innerHTML = `
            <i class="fas fa-thermometer-half"></i>
            <span id="feels-like"></span>
        `;
        detailsContainer.appendChild(feelsLikeEl);
    }
    
    // Update feels like temperature
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    document.getElementById('feels-like').textContent = `${Math.round(feelsLike)}${tempUnit}`;
}

// Add sunrise and sunset times
function addSunriseSunset(sunrise, sunset) {
    const currentWeatherSection = document.querySelector('.current-weather');
    
    // Check if sun times element already exists
    let sunTimesEl = document.getElementById('sun-times');
    
    if (!sunTimesEl) {
        // Create new element
        sunTimesEl = document.createElement('div');
        sunTimesEl.id = 'sun-times';
        sunTimesEl.className = 'sun-times';
        sunTimesEl.innerHTML = `
            <div class="sun-time">
                <i class="fas fa-sunrise"></i>
                <span id="sunrise-time"></span>
            </div>
            <div class="sun-time">
                <i class="fas fa-sunset"></i>
                <span id="sunset-time"></span>
            </div>
        `;
        currentWeatherSection.appendChild(sunTimesEl);
    }
    
    // Update sunrise and sunset times
    document.getElementById('sunrise-time').textContent = formatTime(sunrise);
    document.getElementById('sunset-time').textContent = formatTime(sunset);
}

// Format time from Unix timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Set weather background based on condition code
function setWeatherBackground(conditionCode) {
    const body = document.body;
    
    // Remove any existing weather classes
    const weatherClasses = ['clear', 'clouds', 'rain', 'thunderstorm', 'snow', 'mist'];
    weatherClasses.forEach(cls => body.classList.remove(cls));
    
    // Add appropriate class based on condition code
    if (conditionCode >= 200 && conditionCode < 300) {
        body.classList.add('thunderstorm');
    } else if (conditionCode >= 300 && conditionCode < 600) {
        body.classList.add('rain');
    } else if (conditionCode >= 600 && conditionCode < 700) {
        body.classList.add('snow');
    } else if (conditionCode >= 700 && conditionCode < 800) {
        body.classList.add('mist');
    } else if (conditionCode === 800) {
        body.classList.add('clear');
    } else if (conditionCode > 800) {
        body.classList.add('clouds');
    }
}

// Display forecast data
function displayForecast(data) {
    forecastContainer.innerHTML = '';
    
    // Filter forecast data for one entry per day (noon)
    const dailyData = data.list.filter(item => item.dt_txt.includes('12:00:00'));
    
    // Limit to 5 days
    dailyData.slice(0, 5).forEach(day => {
        const { dt, main, weather, wind, pop } = day;
        const date = new Date(dt * 1000);
        
        const forecastItem = document.createElement('div');
        forecastItem.classList.add('forecast-item');
        
        // Temperature with unit
        const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
        
        // Wind speed with unit
        const windSpeed = currentUnit === 'metric' ? 
            `${Math.round(wind.speed * 3.6)} km/h` : // Convert m/s to km/h
            `${Math.round(wind.speed)} mph`;
        
        // Probability of precipitation as percentage
        const precipitation = Math.round(pop * 100);
        
        forecastItem.innerHTML = `
            <h3>${formatDay(date)}</h3>
            <p class="forecast-date">${formatShortDate(date)}</p>
            <img src="https://openweathermap.org/img/wn/${weather[0].icon}.png" alt="${weather[0].description}">
            <p class="temp">${Math.round(main.temp)}${tempUnit}</p>
            <p class="forecast-description">${weather[0].description}</p>
            <div class="forecast-details">
                <div class="forecast-detail">
                    <i class="fas fa-wind"></i>
                    <span>${windSpeed}</span>
                </div>
                <div class="forecast-detail">
                    <i class="fas fa-tint"></i>
                    <span>${precipitation}%</span>
                </div>
            </div>
        `;
        
        forecastContainer.appendChild(forecastItem);
    });
}

// Update map with new coordinates
function updateMap(lat, lon) {
    if (!map) return;
    
    map.setView([lat, lon], 10);
    
    if (marker) {
        map.removeLayer(marker);
    }
    
    marker = L.marker([lat, lon]).addTo(map);
    
    // Add weather layer
    addWeatherLayer(lat, lon);
}

// Add weather overlay to map
function addWeatherLayer(lat, lon) {
    if (!map) return;
    
    // Weather layer URL
    const weatherLayerUrl = `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${API_KEY}`;
    
    // Clear any existing weather layers
    if (weatherLayer) {
        map.removeLayer(weatherLayer);
    }
    
    // Add the weather layer
    try {
        weatherLayer = L.tileLayer(weatherLayerUrl, {
            opacity: 0.5
        }).addTo(map);
    } catch (error) {
        console.error('Error adding weather layer:', error);
    }
}

// Format date to display
function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Format short date
function formatShortDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Format day name
function formatDay(date) {
    const options = { weekday: 'short' };
    return date.toLocaleDateString(undefined, options);
}

// Add CSS for new elements
function addAdditionalStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Loading indicator */
        #loading-indicator {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: none;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            z-index: 1000;
        }
        
        .spinner {
            border: 5px solid #f3f3f3;
            border-top: 5px solid var(--primary-color);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin-bottom: 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Error container */
        #error-container {
            position: fixed;
            top: 20px;
            right: 20px;
            display: none;
            z-index: 1000;
        }
        
        .error-message {
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: var(--border-radius);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            max-width: 350px;
        }
        
        .error-message i {
            font-size: 24px;
            margin-right: 10px;
        }
        
        .error-message p {
            flex: 1;
        }
        
        #error-close-btn {
            background: none;
            border: none;
            color: #721c24;
            cursor: pointer;
            font-size: 16px;
        }
        
        /* Unit toggle */
        .unit-toggle {
            display: flex;
            margin-top: 15px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            overflow: hidden;
        }
        
        .unit-toggle button {
            background: none;
            border: none;
            color: white;
            padding: 5px 15px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .unit-toggle button.active {
            background-color: rgba(255, 255, 255, 0.3);
            font-weight: bold;
        }
        
        /* Geolocation button */
        #geo-btn {
            background-color: var(--secondary-color);
            color: white;
            border: none;
            border-radius: var(--border-radius);
            padding: 12px;
            margin-left: 10px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        #geo-btn:hover {
            background-color: #1a5b83;
        }
        
        /* Sun times */
        .sun-times {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 15px;
        }
        
        .sun-time {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .sun-time i {
            color: var(--primary-color);
        }
        
        /* Forecast details */
        .forecast-details {
            display: flex;
            justify-content: space-around;
            margin-top: 10px;
        }
        
        .forecast-detail {
            display: flex;
            flex-direction: column;
            align-items: center;
            font-size: 0.8rem;
        }
        
        .forecast-date {
            font-size: 0.8rem;
            color: #777;
            margin-bottom: 5px;
        }
        
        .forecast-description {
            font-size: 0.9rem;
            margin: 5px 0;
        }
        
        /* Weather backgrounds */
        body.clear {
            background: linear-gradient(to bottom, #4ca1af, #c4e0e5);
        }
        
        body.clouds {
            background: linear-gradient(to bottom, #757f9a, #d7dde8);
        }
        
        body.rain {
            background: linear-gradient(to bottom, #616161, #9bc5c3);
        }
        
        body.thunderstorm {
            background: linear-gradient(to bottom, #232526, #414345);
        }
        
        body.snow {
            background: linear-gradient(to bottom, #e6dada, #274046);
        }
        
        body.mist {
            background: linear-gradient(to bottom, #b993d6, #8ca6db);
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
            .unit-toggle {
                margin-top: 10px;
            }
            
            .search-container {
                flex-wrap: wrap;
            }
            
            #geo-btn {
                margin-top: 10px;
                margin-left: 0;
                width: 100%;
            }
        }
    `;
    
    document.head.appendChild(styleElement);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if Leaflet is already defined
    if (typeof L === 'undefined') {
        // Dynamically load Leaflet CSS
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
        leafletCSS.crossOrigin = '';
        document.head.appendChild(leafletCSS);

        // Dynamically load Leaflet JavaScript
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        leafletScript.crossOrigin = '';
        leafletScript.onload = () => {
            init();
            addAdditionalStyles();
        };
        document.body.appendChild(leafletScript);
    } else {
        init();
        addAdditionalStyles();
    }
});