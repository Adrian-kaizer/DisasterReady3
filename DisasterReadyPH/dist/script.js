
"use strict";

// ==========================================
// DISASTERREADY PH - MAIN JAVASCRIPT
// ==========================================

// Mobile navigation
const menuButton = document.getElementById("menuButton");
const navigation = document.getElementById("navigation");

if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
        const isOpen = navigation.classList.toggle("open");
        menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    navigation.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            navigation.classList.remove("open");
            menuButton.setAttribute("aria-expanded", "false");
        });
    });
}

const logoutButton = document.getElementById("logoutButton");

const profileEmail = document.getElementById("profileEmail");
const profileRole = document.getElementById("profileRole");
const profileInitials = document.getElementById("profileInitials");
const profilePicture = document.getElementById("profilePicture");
const profilePictureInput = document.getElementById("profilePictureInput");
const profilePictureStatus = document.getElementById("profilePictureStatus");

async function loadUserProfile() {
    try {
        const response = await fetch("/api/profile", {
            credentials: "same-origin"
        });
        const profile = await response.json();

        if (!response.ok) {
            throw new Error(profile.error || "Unable to load your account profile.");
        }

        profileEmail.textContent = profile.email;
        profileInitials.textContent = profile.email.charAt(0).toUpperCase();
        profileRole.hidden = profile.role !== "admin";

        if (profile.hasProfilePicture) {
            profilePicture.src = `/api/profile-picture?updated=${Date.now()}`;
            profilePicture.hidden = false;
            profileInitials.hidden = true;
        }
    } catch (error) {
        console.error("Unable to load profile:", error);
        profilePictureStatus.textContent = error.message;
    }
}

if (profilePictureInput) {
    loadUserProfile();

    profilePictureInput.addEventListener("change", async () => {
        const file = profilePictureInput.files[0];
        if (!file) return;

        const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            profilePictureStatus.textContent = "Choose a PNG, JPEG, or WebP image.";
            profilePictureInput.value = "";
            return;
        }
        if (file.size > 512 * 1024) {
            profilePictureStatus.textContent = "The image must be 512 KB or smaller.";
            profilePictureInput.value = "";
            return;
        }

        profilePictureStatus.textContent = "Saving profile picture...";
        profilePictureInput.disabled = true;

        try {
            const image = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.addEventListener("load", () => resolve(reader.result));
                reader.addEventListener("error", () => {
                    reject(new Error("Unable to read the selected image."));
                });
                reader.readAsDataURL(file);
            });

            const response = await fetch("/api/profile-picture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ image })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Unable to save your profile picture.");
            }

            profilePicture.src = `/api/profile-picture?updated=${Date.now()}`;
            profilePicture.hidden = false;
            profileInitials.hidden = true;
            profilePictureStatus.textContent = "Profile picture updated.";
        } catch (error) {
            console.error("Unable to update profile picture:", error);
            profilePictureStatus.textContent = error.message;
        } finally {
            profilePictureInput.disabled = false;
            profilePictureInput.value = "";
        }
    });
}

const deleteAccountForm = document.getElementById("deleteAccountForm");

if (deleteAccountForm) {
    const deleteAccountMessage = document.getElementById("deleteAccountMessage");
    const deleteAccountButton = deleteAccountForm.querySelector("button[type='submit']");

    deleteAccountForm.addEventListener("submit", async event => {
        event.preventDefault();
        deleteAccountMessage.textContent = "";
        deleteAccountButton.disabled = true;
        deleteAccountButton.textContent = "Deleting account...";

        try {
            const response = await fetch("/api/delete-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    password: document.getElementById("deleteAccountPassword").value,
                    confirmation: document.getElementById("deleteAccountConfirmation").value
                })
            });
            const result = await response.json();

            if (!response.ok) {
                deleteAccountMessage.textContent =
                    result.error || "Unable to delete your account.";
                return;
            }

            window.location.assign("/login.html?deleted=1");
        } catch (error) {
            console.error("Unable to delete account:", error);
            deleteAccountMessage.textContent =
                "Unable to reach the server. Check your connection and try again.";
        } finally {
            deleteAccountButton.disabled = false;
            deleteAccountButton.textContent = "Delete my account";
        }
    });
}

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        try {
            const response = await fetch("/api/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Sign out failed. Please try again.");
            }

            window.location.assign("/login.html");
        } catch (error) {
            console.error("Unable to sign out:", error);
            alert(error.message || "Unable to sign out. Please try again.");
            logoutButton.disabled = false;
        }
    });
}

// Page navigation
const pageViews = document.querySelectorAll(".page-view");
let map;

function showPageForHash(hash, updateHistory) {
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    const page = target && target.closest(".page-view");

    if (!page) return;

    pageViews.forEach(view => {
        const isActive = view === page;
        view.classList.toggle("active", isActive);
        view.setAttribute("aria-hidden", String(!isActive));
    });

    if (map && page.contains(map.getContainer())) {
        window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    }

    navigation.querySelectorAll("a[href^='#']").forEach(link => {
        const isCurrent = link.hash === hash;
        if (isCurrent) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });

    if (updateHistory && window.location.hash !== hash) {
        window.history.pushState(null, "", hash);
    }
}

document.querySelectorAll("a[href^='#']").forEach(link => {
    link.addEventListener("click", event => {
        const hash = link.getAttribute("href");
        if (!hash || hash === "#") return;

        event.preventDefault();
        showPageForHash(hash, true);
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
});

window.addEventListener("popstate", () => {
    showPageForHash(window.location.hash || "#dashboard", false);
});

showPageForHash(window.location.hash || "#dashboard", false);

// ==========================================
// MAP SEARCH AND PERSONAL PIN
// ==========================================

let mapMarker;
let selectedMapLocation = null;
const mapMessage = document.getElementById("mapMessage");
const locationSearch = document.getElementById("locationSearch");
const searchButton = document.getElementById("searchButton");
const useMapLocationButton = document.getElementById("use-map-location");
const saveMapLocationButton = document.getElementById("save-map-location");
const clearMapLocationButton = document.getElementById("clear-map-location");
const selectedLocationTitle = document.getElementById("selected-location-title");
const selectedLocationCoordinates = document.getElementById("selected-location-coordinates");

function showMapMessage(message) {
    if (mapMessage) mapMessage.textContent = message;
}

function setSelectedMapLocation(latitude, longitude, label, zoom = 15) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        showMapMessage("The selected coordinates are not valid.");
        return;
    }

    selectedMapLocation = {
        latitude,
        longitude,
        label: (label || "Pinned location").trim().slice(0, 160)
    };

    if (map) {
        map.setView([latitude, longitude], zoom);
        if (mapMarker) map.removeLayer(mapMarker);
        mapMarker = L.marker([latitude, longitude], { draggable: true })
            .addTo(map)
            .bindPopup(selectedMapLocation.label)
            .openPopup();
        mapMarker.on("dragend", event => {
            const point = event.target.getLatLng();
            setSelectedMapLocation(point.lat, point.lng, "Pinned location", map.getZoom());
            showMapMessage("Pin moved. Save it if you want to keep these coordinates on your account.");
        });
    }

    if (selectedLocationTitle) selectedLocationTitle.textContent = selectedMapLocation.label;
    if (selectedLocationCoordinates) {
        selectedLocationCoordinates.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
    if (saveMapLocationButton) saveMapLocationButton.disabled = false;
}

function clearSelectedMapLocation() {
    if (map && mapMarker) map.removeLayer(mapMarker);
    mapMarker = null;
    selectedMapLocation = null;
    if (selectedLocationTitle) selectedLocationTitle.textContent = "No location selected";
    if (selectedLocationCoordinates) selectedLocationCoordinates.textContent = "Choose a place or click the map to set a pin.";
    if (saveMapLocationButton) saveMapLocationButton.disabled = true;
    showMapMessage("Pin cleared from the map. Your previously saved account pin is unchanged until you save or delete it.");
}

if (document.getElementById("map") && window.L) {
    map = L.map("map").setView([12.8797, 121.7740], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19
    }).addTo(map);

    map.on("click", event => {
        setSelectedMapLocation(event.latlng.lat, event.latlng.lng, "Pinned map location", map.getZoom());
        showMapMessage("Pin placed. Drag it to adjust the position, then save it to your account if needed.");
    });

    const mapPage = document.getElementById("map").closest(".page-view");
    if (mapPage.classList.contains("active")) {
        window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    }

    // A saved pin is private to the signed-in account and is stored in Neon.
    fetch("/api/saved-location", { credentials: "same-origin" })
        .then(async response => {
            if (response.status === 401 || response.status === 404) return null;
            if (!response.ok) return null;
            return response.json();
        })
        .then(saved => {
            if (saved && Number.isFinite(Number(saved.latitude)) && Number.isFinite(Number(saved.longitude))) {
                setSelectedMapLocation(Number(saved.latitude), Number(saved.longitude), saved.label || "My saved pin", 14);
                showMapMessage("Your saved personal map pin is loaded. Click the map to move it, then save to update it.");
            } else {
                showMapMessage("Search for a place, use GPS, or click the map to place a pin.");
            }
        })
        .catch(() => showMapMessage("Map ready. Search for a place or click to place a pin."));
}

if (searchButton) searchButton.addEventListener("click", searchLocation);
if (locationSearch) {
    locationSearch.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchLocation();
        }
    });
}

async function searchLocation() {
    const query = locationSearch?.value.trim();
    if (!query) return showMapMessage("Please enter a city, barangay, or landmark.");
    if (!map) return showMapMessage("The map library did not load. Check your internet connection and try again.");

    showMapMessage("Searching for location...");
    if (searchButton) searchButton.disabled = true;
    try {
        const response = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`, { credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Location search failed.");
        if (!Array.isArray(result) || !result.length) {
            showMapMessage("Location not found. Try adding the municipality or province name.");
            return;
        }
        const place = result[0];
        setSelectedMapLocation(Number(place.latitude), Number(place.longitude), place.displayName || query, 15);
        showMapMessage("Location found. The pin marks the searched place, not a verified evacuation center.");
    } catch (error) {
        console.error("Unable to search map location:", error);
        showMapMessage(error.message || "Unable to search right now. Check your connection and try again.");
    } finally {
        if (searchButton) searchButton.disabled = false;
    }
}

if (useMapLocationButton) {
    useMapLocationButton.addEventListener("click", () => {
        if (!navigator.geolocation) {
            showMapMessage("This browser does not support GPS location. Search for your barangay instead.");
            return;
        }
        useMapLocationButton.disabled = true;
        showMapMessage("Requesting your device location. Your browser may ask for permission...");
        navigator.geolocation.getCurrentPosition(position => {
            setSelectedMapLocation(position.coords.latitude, position.coords.longitude, "My current location", 16);
            showMapMessage("GPS location pinned. GPS accuracy may vary; drag the marker to adjust it before saving.");
            useMapLocationButton.disabled = false;
        }, error => {
            const messages = {
                1: "Location permission was denied. You can search for a place or pin it manually.",
                2: "Your device location is unavailable. Try again or pin the location manually.",
                3: "GPS request timed out. Try again or search for a place."
            };
            showMapMessage(messages[error.code] || "Unable to get your location. Search or place a pin manually.");
            useMapLocationButton.disabled = false;
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
}

if (saveMapLocationButton) {
    saveMapLocationButton.addEventListener("click", async () => {
        if (!selectedMapLocation) return;
        const label = window.prompt("Give this pin a name (for example, Home or Family meeting point):", selectedMapLocation.label);
        if (label === null) return;
        if (!label.trim() || label.trim().length > 160) {
            showMapMessage("Enter a pin name between 1 and 160 characters.");
            return;
        }
        saveMapLocationButton.disabled = true;
        try {
            const response = await fetch("/api/saved-location", {
                method: "PUT",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...selectedMapLocation, label: label.trim() })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Unable to save this pin.");
            setSelectedMapLocation(Number(result.latitude), Number(result.longitude), result.label, map.getZoom());
            showMapMessage("Your personal map pin was saved to your account. It is not a verified evacuation center.");
        } catch (error) {
            showMapMessage(error.message || "Unable to save the pin. Check your connection and sign-in status.");
        } finally {
            saveMapLocationButton.disabled = !selectedMapLocation;
        }
    });
}

if (clearMapLocationButton) {
    clearMapLocationButton.addEventListener("click", async () => {
        clearSelectedMapLocation();
        if (!window.confirm("Also delete the saved personal pin from your account?")) return;
        try {
            const response = await fetch("/api/saved-location", { method: "DELETE", credentials: "same-origin" });
            const result = response.status === 204 ? {} : await response.json();
            if (!response.ok) throw new Error(result.error || "Unable to delete the saved pin.");
            showMapMessage("The saved personal pin was deleted from your account.");
        } catch (error) {
            showMapMessage(error.message || "The pin was cleared from this view, but could not be deleted from your account.");
        }
    });
}


/* ==========================================
   EMERGENCY CHECKLIST
========================================== */

const checklistItems = document.querySelectorAll(
    '#checklistItems input[type="checkbox"]'
);

const progressText = document.getElementById("progress");
const progressBar = document.getElementById("progressBar");
const saveChecklistButton = document.getElementById("saveChecklist");
const resetChecklistButton = document.getElementById("resetChecklist");
const checklistStatus = document.getElementById("checklistStatus");

let checklistSaveTimer;
let checklistLoaded = false;

function checklistSnapshot() {
    const items = {};

    checklistItems.forEach(item => {
        items[item.dataset.item] = item.checked;
    });

    return items;
}

// Update the progress display only
function updateChecklistDisplay() {
    const completed = [...checklistItems]
        .filter(item => item.checked).length;

    const total = checklistItems.length;

    if (progressText) {
        progressText.textContent = `${completed} of ${total} completed`;
    }

    if (progressBar) {
        progressBar.style.width = total
            ? `${(completed / total) * 100}%`
            : "0%";
    }
}

// Save the checklist to the logged-in user's account
async function persistChecklist() {
    if (!checklistLoaded) return;

    if (checklistStatus) {
        checklistStatus.textContent = "Saving checklist...";
    }

    if (saveChecklistButton) {
        saveChecklistButton.disabled = true;
    }

    try {
        const response = await fetch("/api/checklist", {
            method: "PUT",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                items: checklistSnapshot()
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.error ||
                (response.status === 401
                    ? "Please sign in to save your checklist."
                    : "Unable to save your checklist.")
            );
        }

        if (checklistStatus) {
            checklistStatus.textContent =
                "✓ Checklist saved successfully to your account.";
        }

    } catch (error) {
        console.error("Checklist save failed:", error);

        if (checklistStatus) {
            checklistStatus.textContent = error.message;
        }
    } finally {
        if (saveChecklistButton) {
            saveChecklistButton.disabled = false;
        }
    }
}

// Automatically save when a checkbox changes
function scheduleChecklistSave() {
    updateChecklistDisplay();

    if (!checklistLoaded) return;

    if (checklistStatus) {
        checklistStatus.textContent = "Changes pending...";
    }

    clearTimeout(checklistSaveTimer);

    checklistSaveTimer = setTimeout(() => {
        persistChecklist();
    }, 500);
}

// Load saved checklist data from the server
async function loadChecklist() {
    try {
        const response = await fetch("/api/checklist", {
            credentials: "same-origin"
        });

        if (response.status === 401) {
            checklistLoaded = false;

            if (checklistStatus) {
                checklistStatus.textContent =
                    "Sign in to save and load your checklist across sessions.";
            }

            updateChecklistDisplay();
            return;
        }

        if (!response.ok) {
            throw new Error("Could not load your saved checklist.");
        }

        const result = await response.json();
        const saved = result.items || {};

        checklistItems.forEach(item => {
            item.checked = Boolean(saved[item.dataset.item]);
        });

        checklistLoaded = true;

        if (checklistStatus) {
            checklistStatus.textContent =
                "Your saved checklist has been loaded.";
        }

    } catch (error) {
        console.error("Checklist load failed:", error);

        if (checklistStatus) {
            checklistStatus.textContent =
                "Could not load your checklist. Please refresh and try again.";
        }
    }

    updateChecklistDisplay();
}

// Checkbox changes
checklistItems.forEach(item => {
    item.addEventListener("change", scheduleChecklistSave);
});

// Manual Save button
if (saveChecklistButton) {
    saveChecklistButton.addEventListener("click", () => {
        clearTimeout(checklistSaveTimer);
        persistChecklist();
    });
}

// Reset and save the empty checklist
if (resetChecklistButton) {
    resetChecklistButton.addEventListener("click", async () => {
        const confirmed = confirm(
            "Are you sure you want to reset all checklist items?"
        );

        if (!confirmed) return;

        clearTimeout(checklistSaveTimer);

        checklistItems.forEach(item => {
            item.checked = false;
        });

        updateChecklistDisplay();
        await persistChecklist();
    });
}

// Initialize
loadChecklist();


// ==========================================
// HAZARD REPORTS
// ==========================================

const hazardForm = document.getElementById("hazardForm");
const reportMessage = document.getElementById("reportMessage");
const reportsList = document.getElementById("reportsList");

let hazardReports = [];
function renderHazardReports() {
    if (!reportsList) return;
    reportsList.replaceChildren();
    if (!hazardReports.length) { reportsList.textContent = "No hazard reports submitted by this account yet."; return; }
    hazardReports.forEach(report => {
        const article = document.createElement("article"); article.className = "report-entry";
        const title = document.createElement("h4"); title.textContent = `${report.type} — ${report.location}`;
        const description = document.createElement("p"); description.textContent = report.description;
        const date = document.createElement("p"); date.textContent = "Reported: " + new Date(report.date).toLocaleString();
        const status = document.createElement("span"); status.className = "report-status";
        status.textContent = (report.status || "unverified").replace(/^./, c => c.toUpperCase()) + " report";
        article.append(title, description, date, status); reportsList.appendChild(article);
    });
}
async function loadHazardReports() {
    try {
        const response = await fetch("/api/hazard-reports", { credentials: "same-origin" });
        if (!response.ok) throw new Error((await response.json()).error || "Unable to load reports.");
        hazardReports = await response.json(); renderHazardReports();
    } catch (error) {
        if (reportsList) reportsList.textContent = "Sign in to view your saved hazard reports. " + (error.message || "");
    }
}
if (hazardForm) hazardForm.addEventListener("submit", async event => {
    event.preventDefault();
    const location = document.getElementById("reporterLocation").value.trim();
    const type = document.getElementById("hazardType").value;
    const description = document.getElementById("hazardDescription").value.trim();
    if (!location || !type || !description) { reportMessage.textContent = "Please complete all fields."; return; }
    const submitButton = hazardForm.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        const response = await fetch("/api/hazard-reports", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location, type, description }) });
        const responseText = await response.text();
let result = {};

try {
    result = responseText ? JSON.parse(responseText) : {};
} catch {
    throw new Error(
        `Server returned an invalid response (HTTP ${response.status}). ` +
        `Check the Netlify Function logs.`
    );
}

if (!response.ok) {
    throw new Error(
        result.error || `Request failed with HTTP ${response.status}.`
    );
}
        if (!response.ok) throw new Error(result.error || "Unable to submit report.");
        hazardReports.unshift(result); hazardForm.reset();
        reportMessage.textContent = "Hazard report saved to your account. It has not been sent directly to emergency responders.";
        renderHazardReports();
    } catch (error) { reportMessage.textContent = error.message || "Unable to save the report. Sign in and try again."; }
    finally { if (submitButton) submitButton.disabled = false; }
});
loadHazardReports();

// ==========================================
// FLOOD MONITORING ASSISTANT
// ==========================================

const stationForm = document.getElementById("stationForm");
const stationList = document.getElementById("stationList");
const assistantMessage = document.getElementById("assistantMessage");

const stationCount = document.getElementById("stationCount");
const warningCount = document.getElementById("warningCount");
const criticalCount = document.getElementById("criticalCount");

const waterChart = document.getElementById("waterChart");
const chartContext = waterChart ? waterChart.getContext("2d") : null;

let stationCache = [];
let currentUserRole = "user";
fetch("/api/session", { credentials: "same-origin", cache: "no-store" }).then(r => r.ok ? r.json() : null).then(session => {
    currentUserRole = session?.role === "admin" ? "admin" : "user";
    if (stationForm) stationForm.style.display = currentUserRole === "admin" ? "" : "none";
    renderStations();
}).catch(() => { if (stationForm) stationForm.style.display = "none"; });
function getStations() { return stationCache; }
function saveStations(stations) { stationCache = stations; }
async function loadStations() {
    try {
        const response = await fetch("/api/flood-stations", { credentials: "same-origin" });
        if (!response.ok) throw new Error((await response.json()).error || "Unable to load stations.");
        stationCache = await response.json(); renderStations();
    } catch (error) {
        if (stationList) stationList.textContent = "Sign in to view shared flood monitoring data. " + (error.message || "");
        if (assistantMessage) assistantMessage.textContent = "Flood monitoring data is unavailable until the account and database connection are verified.";
    }
}

function getStationStatus(station) {
    if (station.waterLevel >= station.criticalLevel) {
        return {
            name: "CRITICAL",
            className: "status-critical"
        };
    }

    if (station.waterLevel >= station.warningLevel) {
        return {
            name: "WARNING",
            className: "status-warning"
        };
    }

    return {
        name: "NORMAL",
        className: "status-normal"
    };
}

function renderStations() {
    const stations = getStations();

    stationList.replaceChildren();

    let warnings = 0;
    let criticals = 0;

    stations.forEach(station => {
        const status = getStationStatus(station);

        if (status.name === "WARNING") warnings++;
        if (status.name === "CRITICAL") criticals++;

        const article = document.createElement("article");
        article.className = "report-entry";

        const title = document.createElement("h4");
        title.textContent = station.name;

        const location = document.createElement("p");
        location.textContent = "Location: " + station.location;

        const level = document.createElement("p");
        level.textContent =
            "Water height: " + station.waterLevel.toFixed(2) + " meters";

        const thresholds = document.createElement("p");
        thresholds.textContent =
            `Warning: ${station.warningLevel.toFixed(2)} m | `
            + `Critical: ${station.criticalLevel.toFixed(2)} m`;

        const badge = document.createElement("span");
        badge.className = "station-status " + status.className;
        badge.textContent = status.name;

        const updated = document.createElement("p");
        updated.textContent = "Last reading: " + station.updatedAt;

        const actions = document.createElement("div");
        actions.className = "station-actions";

        const updateButton = document.createElement("button");
        updateButton.type = "button";
        updateButton.textContent = "Update Reading";
        updateButton.style.display = currentUserRole === "admin" ? "" : "none";
        updateButton.addEventListener("click", () => {
            document.getElementById("stationName").value = station.name;
            document.getElementById("stationLocation").value = station.location;
            document.getElementById("waterLevel").value = station.waterLevel;
            document.getElementById("warningLevel").value = station.warningLevel;
            document.getElementById("criticalLevel").value = station.criticalLevel;

            document.getElementById("flood-monitor").scrollIntoView({
                behavior: "smooth"
            });
            document.getElementById("waterLevel").focus();
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete Station";
        deleteButton.style.display = currentUserRole === "admin" ? "" : "none";
        deleteButton.addEventListener("click", async () => {
            if (!window.confirm(`Delete monitoring station "${station.name}" and its readings?`)) return;
            try {
                const response = await fetch("/api/flood-stations", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: station.id }) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Unable to delete station.");
                stationCache = stationCache.filter(item => String(item.id) !== String(station.id)); renderStations();
            } catch (error) { assistantMessage.textContent = error.message || "Unable to delete station."; }
        });

        if (currentUserRole === "admin") actions.append(updateButton, deleteButton);
        article.append(title, location, level, thresholds, badge, updated);
        if (currentUserRole === "admin") article.append(actions);
        stationList.appendChild(article);
    });

    if (stations.length === 0) {
        stationList.textContent = "No stations added yet.";
    }

    stationCount.textContent = String(stations.length);
    warningCount.textContent = String(warnings);
    criticalCount.textContent = String(criticals);

    updateAssistant(stations);
    drawWaterChart(stations);
}

if (stationForm) stationForm.addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("stationName").value.trim();
    const location = document.getElementById("stationLocation").value.trim();
    const waterLevel = Number(document.getElementById("waterLevel").value);
    const warningLevel = Number(document.getElementById("warningLevel").value);
    const criticalLevel = Number(document.getElementById("criticalLevel").value);
    if (!name || !location || !Number.isFinite(waterLevel) || waterLevel < 0 || !Number.isFinite(warningLevel) || warningLevel <= 0 || !Number.isFinite(criticalLevel) || criticalLevel <= warningLevel) {
        assistantMessage.textContent = "Check the form. Water height must be non-negative, and the critical threshold must be greater than the warning threshold."; return;
    }
    const submitButton = stationForm.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
        const response = await fetch("/api/flood-stations", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, location, waterLevel, warningLevel, criticalLevel }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to save the station.");
        stationForm.reset();
        document.getElementById("warningLevel").value = "1.50";
        document.getElementById("criticalLevel").value = "2.00";
        await loadStations();
        assistantMessage.textContent = "Water-level reading saved to the shared database. Confirm measurements and follow official local advisories.";
    } catch (error) { assistantMessage.textContent = error.message || "Unable to save station. Administrator access may be required."; }
    finally { if (submitButton) submitButton.disabled = false; }
});
loadStations();

function updateAssistant(stations) {
    if (!stations.length) {
        assistantMessage.textContent =
            "No monitoring data yet. Add a station and enter a water-level reading.";
        return;
    }

    const criticalStations = stations.filter(
        station => getStationStatus(station).name === "CRITICAL"
    );

    const warningStations = stations.filter(
        station => getStationStatus(station).name === "WARNING"
    );

    if (criticalStations.length) {
        assistantMessage.textContent =
            "CRITICAL STATUS: " +
            criticalStations.map(station =>
                `${station.name} (${station.location})`
            ).join(", ") +
            " has reached or exceeded its configured critical threshold. "
            + "Verify the reading and follow official local emergency instructions.";
        return;
    }

    if (warningStations.length) {
        assistantMessage.textContent =
            "WARNING STATUS: " +
            warningStations.map(station =>
                `${station.name} (${station.location})`
            ).join(", ") +
            " has reached its configured warning threshold. "
            + "Check conditions and confirm information with local authorities.";
        return;
    }

    assistantMessage.textContent =
        "All recorded stations are below their configured warning thresholds. "
        + "This does not guarantee safety; continue checking official weather and flood advisories.";
}

function drawWaterChart(stations) {
    if (!chartContext || !waterChart) return;

    const width = waterChart.clientWidth || 600;
    const height = 220;
    const pixelRatio = window.devicePixelRatio || 1;

    waterChart.width = width * pixelRatio;
    waterChart.height = height * pixelRatio;
    chartContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    chartContext.clearRect(0, 0, width, height);

    const padding = { left: 48, right: 15, top: 20, bottom: 38 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    chartContext.font = "12px Arial";
    chartContext.fillStyle = "#68788b";
    chartContext.strokeStyle = "#dce5ef";
    chartContext.lineWidth = 1;

    const readings = stations.flatMap(station =>
        (station.readings || []).map(reading => ({
            station: station.name,
            level: reading.level
        }))
    ).slice(-20);

    if (!readings.length) {
        chartContext.fillText("Water-level readings will appear here.", 15, 35);
        return;
    }

    const maxLevel = Math.max(1, ...readings.map(item => item.level)) * 1.15;

    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (plotHeight * i / 4);
        const value = maxLevel * (1 - i / 4);

        chartContext.beginPath();
        chartContext.moveTo(padding.left, y);
        chartContext.lineTo(width - padding.right, y);
        chartContext.stroke();

        chartContext.fillText(value.toFixed(1) + " m", 4, y + 4);
    }

    chartContext.strokeStyle = "#2475c6";
    chartContext.lineWidth = 2;
    chartContext.beginPath();

    readings.forEach((reading, index) => {
        const x = readings.length === 1
            ? padding.left + plotWidth / 2
            : padding.left + plotWidth * index / (readings.length - 1);

        const y = padding.top + plotHeight * (1 - reading.level / maxLevel);

        if (index === 0) chartContext.moveTo(x, y);
        else chartContext.lineTo(x, y);
    });

    chartContext.stroke();

    readings.forEach((reading, index) => {
        const x = readings.length === 1
            ? padding.left + plotWidth / 2
            : padding.left + plotWidth * index / (readings.length - 1);

        const y = padding.top + plotHeight * (1 - reading.level / maxLevel);

        chartContext.fillStyle = "#2475c6";
        chartContext.beginPath();
        chartContext.arc(x, y, 4, 0, Math.PI * 2);
        chartContext.fill();
    });

    chartContext.fillStyle = "#68788b";
    chartContext.fillText("Latest recorded readings (up to 20)", padding.left, height - 10);
}

window.addEventListener("resize", () => drawWaterChart(getStations()));

// =====================================
// DISASTER READY PH - LIVE WEATHER
// =====================================

let weatherLatitude = 14.5995;
let weatherLongitude = 120.9842;
let weatherPlace = "Manila";
let weatherRefreshTimer;
let suggestionTimer;
let suggestionRequest;
let activeSuggestion = -1;

const weatherInput = document.getElementById("weather-location");
const weatherSearchForm = document.getElementById("weather-search-form");
const locationSuggestions = document.getElementById("location-suggestions");

function closeLocationSuggestions() {
    locationSuggestions.replaceChildren();
    locationSuggestions.hidden = true;
    weatherInput.setAttribute("aria-expanded", "false");
    weatherInput.removeAttribute("aria-activedescendant");
    activeSuggestion = -1;
}

function formatPlace(place) {
    return [place.name, place.admin1, place.country]
        .filter((part, index, parts) => part && parts.indexOf(part) === index)
        .join(", ");
}

function selectWeatherPlace(place) {
    weatherLatitude = place.latitude;
    weatherLongitude = place.longitude;
    weatherPlace = formatPlace(place);
    weatherInput.value = weatherPlace;
    closeLocationSuggestions();
    loadWeather();
}

function renderLocationSuggestions(places) {
    locationSuggestions.replaceChildren();
    activeSuggestion = -1;

    places.forEach((place, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.id = `location-option-${index}`;
        option.className = "location-suggestion";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.textContent = formatPlace(place);
        option.addEventListener("click", () => selectWeatherPlace(place));
        locationSuggestions.appendChild(option);
    });

    locationSuggestions.hidden = places.length === 0;
    weatherInput.setAttribute("aria-expanded", String(places.length > 0));
}

async function suggestWeatherLocations(query) {
    if (suggestionRequest) suggestionRequest.abort();
    suggestionRequest = new AbortController();

    try {
        const url =
            "https://geocoding-api.open-meteo.com/v1/search" +
            "?name=" + encodeURIComponent(query) +
            "&count=10&language=en&format=json";
        const response = await fetch(url, { signal: suggestionRequest.signal });

        if (!response.ok) throw new Error("Location suggestions are unavailable.");

        const data = await response.json();
        const places = (data.results || []).slice().sort((first, second) => {
            return Number(second.country_code === "PH")
                - Number(first.country_code === "PH");
        }).slice(0, 6);

        if (places.length) renderLocationSuggestions(places);
        else closeLocationSuggestions();
    } catch (error) {
        if (error.name !== "AbortError") {
            closeLocationSuggestions();
            document.getElementById("weather-alert").textContent =
                "Location suggestions couldn't be loaded. You can still search for a location.";
        }
    }
}

// Search for a city or municipality
async function searchWeatherLocation() {
    const location = weatherInput.value.trim();

    if (!location) {
        document.getElementById("weather-status").textContent =
            "Enter a location";
        return;
    }

    if (activeSuggestion >= 0) {
        locationSuggestions.children[activeSuggestion].click();
        return;
    }

    const status = document.getElementById("weather-status");
    status.textContent = "Searching...";

    try {
        const url =
            "https://geocoding-api.open-meteo.com/v1/search" +
            "?name=" + encodeURIComponent(location) +
            "&count=10&language=en&format=json";

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Location search failed.");
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            throw new Error("Location not found. Try another name.");
        }

        const place = data.results.find(item => item.country_code === "PH")
            || data.results[0];
        selectWeatherPlace(place);

    } catch (error) {
        status.textContent = "Search failed";
        document.getElementById("weather-alert").textContent =
            error.message || "Unable to search for this location.";
    }
}

// Retrieve current weather and precipitation forecast
async function loadWeather() {
    const status = document.getElementById("weather-status");
    const alertBox = document.getElementById("weather-alert");

    status.textContent = "Updating...";

    try {
        const url =
            "https://api.open-meteo.com/v1/forecast" +
            "?latitude=" + weatherLatitude +
            "&longitude=" + weatherLongitude +
            "&current=temperature_2m,relative_humidity_2m," +
            "precipitation,rain,showers,weather_code,wind_speed_10m" +
            "&hourly=precipitation_probability" +
            "&forecast_hours=1" +
            "&timezone=auto";

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Weather service is unavailable.");
        }

        const data = await response.json();
        const current = data.current;

        if (!current) {
            throw new Error("Current weather data is unavailable.");
        }

        const temperature = current.temperature_2m;
        const rainfall = current.precipitation;
        const wind = current.wind_speed_10m;

        const probability =
            data.hourly &&
            data.hourly.precipitation_probability &&
            data.hourly.precipitation_probability.length
                ? data.hourly.precipitation_probability[0]
                : null;

        document.getElementById("location-name").textContent =
            "Weather in " + weatherPlace;

        document.getElementById("temperature").textContent =
            temperature ?? "--";

        document.getElementById("rainfall").textContent =
            rainfall ?? "--";

        document.getElementById("rain-probability").textContent =
            probability ?? "--";

        document.getElementById("wind-speed").textContent =
            wind ?? "--";

        document.getElementById("weather-updated").textContent =
            "Weather observation time: " +
            current.time.replace("T", " ") +
            " (local time)";

        status.textContent = "Weather updated";

        // These are weather-based advisories, not official flood warnings.
        alertBox.className = "weather-alert";

        const code = current.weather_code;
        const rain = Number(current.rain ?? current.precipitation ?? 0);
        const rainProbability = Number(probability ?? 0);
        const windSpeed = Number(wind ?? 0);

        if (
            windSpeed >= 60 ||
            rain >= 15 ||
            rainProbability >= 80
        ) {
            alertBox.classList.add("danger");
            alertBox.textContent =
                "HIGH WEATHER ALERT: Current weather data indicates " +
                "strong wind or potentially significant rainfall. " +
                "Monitor PAGASA and local disaster office advisories. " +
                "This is not an official warning.";
        } else if (
            code >= 51 ||
            rain > 0 ||
            rainProbability >= 50 ||
            windSpeed >= 30
        ) {
            alertBox.classList.add("warning");
            alertBox.textContent =
                "WEATHER ADVISORY: Rain or stronger wind may affect " +
                "your area. Monitor weather updates and avoid rivers " +
                "or flood-prone locations if conditions worsen.";
        } else {
            alertBox.textContent =
                "No significant weather trigger was detected by this " +
                "basic rule. Continue monitoring official forecasts. " +
                "This does not guarantee that your area is safe from flooding.";
        }

    } catch (error) {
        status.textContent = "Update failed";
        alertBox.className = "weather-alert warning";
        alertBox.textContent =
            "Unable to retrieve live weather. Check your internet " +
            "connection and try again. " + error.message;
    }
}

// Use the browser's location permission
function useMyLocation(silentFallback = false) {
    if (!navigator.geolocation) {
        statusUnavailable("Your browser does not support location detection.", silentFallback);
        return;
    }

    document.getElementById("weather-status").textContent = "Finding location...";

    navigator.geolocation.getCurrentPosition(
        async function(position) {
            weatherLatitude = position.coords.latitude;
            weatherLongitude = position.coords.longitude;
            weatherPlace = "Near your current location";
            weatherInput.value = weatherPlace;
            closeLocationSuggestions();
            await loadWeather();
        },
        function() {
            statusUnavailable(
                "Location access was not granted. Enter a city or municipality instead.",
                silentFallback
            );
        }
    );
}

function statusUnavailable(message, silentFallback) {
    document.getElementById("weather-status").textContent =
        silentFallback ? "Showing Manila" : "Location unavailable";

    if (silentFallback) {
        loadWeather();
    } else {
        document.getElementById("weather-alert").textContent = message;
    }
}

// Connect the buttons after the page loads
document.addEventListener("DOMContentLoaded", function() {
    weatherSearchForm.addEventListener("submit", event => {
        event.preventDefault();
        searchWeatherLocation();
    });

    weatherInput.addEventListener("input", () => {
        if (suggestionRequest) suggestionRequest.abort();
        window.clearTimeout(suggestionTimer);
        closeLocationSuggestions();

        const query = weatherInput.value.trim();
        if (query.length < 2) return;

        suggestionTimer = window.setTimeout(
            () => suggestWeatherLocations(query),
            300
        );
    });

    weatherInput.addEventListener("keydown", event => {
        const options = [...locationSuggestions.children];

        if (event.key === "ArrowDown" && options.length) {
            event.preventDefault();
            activeSuggestion = (activeSuggestion + 1) % options.length;
        } else if (event.key === "ArrowUp" && options.length) {
            event.preventDefault();
            activeSuggestion = activeSuggestion <= 0
                ? options.length - 1
                : activeSuggestion - 1;
        } else if (event.key === "Escape") {
            closeLocationSuggestions();
            return;
        } else {
            return;
        }

        options.forEach((option, index) => {
            const selected = index === activeSuggestion;
            option.setAttribute("aria-selected", String(selected));
            if (selected) {
                weatherInput.setAttribute("aria-activedescendant", option.id);
                option.scrollIntoView({ block: "nearest" });
            }
        });
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".location-input-wrap")) {
            closeLocationSuggestions();
        }
    });

    document.getElementById("use-location")
        .addEventListener("click", () => useMyLocation());

    // Refresh weather data every five minutes.
    weatherRefreshTimer = setInterval(loadWeather, 5 * 60 * 1000);

    useMyLocation(true);
});
