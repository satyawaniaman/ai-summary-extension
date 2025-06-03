// Store the persona text
let personaText = "";
let personaLoading = false;
let personaLoaded = false;

// Load the persona file when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  loadPersonaFile();
  chrome.storage.sync.get("geminiApiKey", (result) => {
    if (!result.geminiApiKey) {
      chrome.tabs.create({ url: "options.html" });
    }
  });
});

// Also load the persona when the service worker starts (after browser restart)
loadPersonaFile();

// Load persona file with better error handling
async function loadPersonaFile() {
  if (personaLoading || personaLoaded) {
    return; // Prevent multiple simultaneous loads
  }

  personaLoading = true;

  try {
    const url = chrome.runtime.getURL("persona.txt");
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to load persona: ${response.status} ${response.statusText}`
      );
    }

    personaText = await response.text();

    if (!personaText || personaText.trim().length === 0) {
      throw new Error("Persona file is empty");
    }

    personaLoaded = true;
  } catch (error) {
    personaText =
      "You are a helpful AI assistant that provides concise and accurate summaries."; // Fallback
    personaLoaded = true; // Set to true even with fallback to prevent infinite retries
  } finally {
    personaLoading = false;
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPersona") {
    if (!personaLoaded && !personaLoading) {
      loadPersonaFile()
        .then(() => {
          sendResponse({
            persona: personaText,
            loaded: personaLoaded,
            fallback: personaText.includes("helpful AI assistant"),
          });
        })
        .catch((error) => {
          sendResponse({
            persona:
              "You are a helpful AI assistant that provides concise and accurate summaries.",
            loaded: false,
            error: error.message,
          });
        });
      return true; // Keep the channel open for async response
    }

    // If currently loading, wait for it
    if (personaLoading) {
      const checkLoaded = () => {
        if (personaLoaded) {
          sendResponse({
            persona: personaText,
            loaded: personaLoaded,
            fallback: personaText.includes("helpful AI assistant"),
          });
        } else {
          setTimeout(checkLoaded, 100); // Check again in 100ms
        }
      };
      checkLoaded();
      return true;
    }

    // Persona is already loaded
    sendResponse({
      persona: personaText,
      loaded: personaLoaded,
      fallback: personaText.includes("helpful AI assistant"),
    });
  }
  return true;
});
