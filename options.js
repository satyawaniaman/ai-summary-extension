document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const darkModeToggle = document.getElementById("dark-mode");
  const saveButton = document.getElementById("save-button");
  const statusElement = document.getElementById("status");

  // Load saved settings
  chrome.storage.sync.get(["geminiApiKey", "darkMode"], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }

    if (result.darkMode) {
      darkModeToggle.checked = result.darkMode;
      applyTheme(result.darkMode);
    }
  });

  // Save settings
  saveButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const isDarkMode = darkModeToggle.checked;

    if (!apiKey) {
      showStatus("Please enter a valid API key", "error");
      return;
    }

    chrome.storage.sync.set(
      {
        geminiApiKey: apiKey,
        darkMode: isDarkMode,
      },
      () => {
        showStatus("Settings saved successfully!", "success");
      }
    );
  });

  // Toggle dark mode
  darkModeToggle.addEventListener("change", () => {
    const isDarkMode = darkModeToggle.checked;
    applyTheme(isDarkMode);
  });

  // Apply theme based on toggle state
  function applyTheme(isDarkMode) {
    if (isDarkMode) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  }

  // Show status message
  function showStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = "status";
    statusElement.classList.add(type);

    setTimeout(() => {
      statusElement.textContent = "";
      statusElement.className = "status";
    }, 3000);
  }
});
