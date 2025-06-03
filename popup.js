document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const summarizeButton = document.getElementById("summarize");
  const resultElement = document.getElementById("result");
  const copyButton = document.getElementById("copy");
  const optionsLink = document.getElementById("options-link");

  // Check and apply theme
  chrome.storage.sync.get(["darkMode"], (result) => {
    if (result.darkMode) {
      document.body.classList.add("dark-theme");
    }
  });

  // Summarize button click handler
  summarizeButton.addEventListener("click", async () => {
    summarizeButton.disabled = true;
    summarizeButton.textContent = "Processing...";
    resultElement.textContent = "Checking page access...";

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      console.log("Current tab:", tab.url);

      // Check if we can access this tab
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("moz-extension://") ||
        tab.url.startsWith("safari-extension://")
      ) {
        throw new Error(
          "Cannot access browser internal pages. Please try a different website."
        );
      }

      if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
        throw new Error(
          "Can only summarize web pages (http/https). Please navigate to a website first."
        );
      }

      // Get selected summary length
      const summaryLength = document.getElementById("summary-length").value;

      // Check if API key is set
      resultElement.textContent = "Checking API key...";
      const storageResult = await new Promise((resolve) => {
        chrome.storage.sync.get(["geminiApiKey"], resolve);
      });

      if (!storageResult.geminiApiKey) {
        throw new Error(
          "Please set your Gemini API key in the extension options first."
        );
      }

      // Always inject fresh content script to avoid conflicts
      resultElement.textContent = "Injecting content script...";
      console.log("Injecting content script into tab:", tab.id);

      await injectContentScript(tab.id);

      // Wait for content script to initialize
      resultElement.textContent = "Initializing...";
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Test connection
      resultElement.textContent = "Testing connection...";
      console.log("Testing connection to content script");

      try {
        const pingResponse = await sendMessageWithRetry(
          tab.id,
          { action: "ping" },
          3000
        );
        console.log("Ping successful:", pingResponse);
      } catch (pingError) {
        console.error("Ping failed:", pingError);
        throw new Error(
          "Content script failed to load. Please refresh the page and try again."
        );
      }

      // Send summarize request
      resultElement.textContent = "Generating summary...";
      await sendSummarizeRequest(
        tab.id,
        summaryLength,
        storageResult.geminiApiKey
      );
    } catch (error) {
      resultElement.textContent = "Error: " + error.message;
      console.error("Popup error:", error);
    } finally {
      summarizeButton.disabled = false;
      summarizeButton.textContent = "Summarize";
    }
  });

  // Function to inject content script with proper error handling
  async function injectContentScript(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          files: ["content.js"],
        },
        (result) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(
                `Script injection failed: ${chrome.runtime.lastError.message}`
              )
            );
          } else {
            console.log("Content script injected successfully");
            resolve(result);
          }
        }
      );
    });
  }

  // Function to send message with timeout and retry logic
  function sendMessageWithRetry(tabId, message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, timeout);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response) {
          resolve(response);
        } else {
          reject(new Error("No response received"));
        }
      });
    });
  }

  // Function to send summarize request to content script
  async function sendSummarizeRequest(tabId, summaryLength, apiKey) {
    try {
      const response = await sendMessageWithRetry(
        tabId,
        {
          action: "summarize",
          summaryLength: summaryLength,
          apiKey: apiKey,
        },
        30000 // 30 second timeout for summarization
      );

      if (response.summary) {
        resultElement.textContent = response.summary;
      } else if (response.error) {
        throw new Error(response.error);
      } else {
        throw new Error("Failed to generate summary. Please try again.");
      }
    } catch (error) {
      throw new Error(`Summarization failed: ${error.message}`);
    }
  }

  // Copy button click handler
  copyButton.addEventListener("click", () => {
    const summaryText = resultElement.textContent;

    if (
      !summaryText ||
      summaryText === "Select a type and click summarize to get started" ||
      summaryText.startsWith("Error:")
    ) {
      return;
    }

    navigator.clipboard
      .writeText(summaryText)
      .then(() => {
        const originalText = copyButton.textContent;
        copyButton.textContent = "Copied!";
        setTimeout(() => {
          copyButton.textContent = originalText;
        }, 1500);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = summaryText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          const originalText = copyButton.textContent;
          copyButton.textContent = "Copied!";
          setTimeout(() => {
            copyButton.textContent = originalText;
          }, 1500);
        } catch (fallbackError) {
          console.error("Fallback copy failed:", fallbackError);
        }
        document.body.removeChild(textArea);
      });
  });

  // Options link click handler
  optionsLink.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});
