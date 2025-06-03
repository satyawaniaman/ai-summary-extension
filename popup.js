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

      const summaryLength = document.getElementById("summary-length").value;

      resultElement.textContent = "Checking API key...";
      const storageResult = await new Promise((resolve) => {
        chrome.storage.sync.get(["geminiApiKey"], resolve);
      });

      if (!storageResult.geminiApiKey) {
        throw new Error(
          "Please set your Gemini API key in the extension options first."
        );
      }

      resultElement.textContent = "Injecting content script...";
      await injectContentScript(tab.id);

      resultElement.textContent = "Initializing...";
      await new Promise((resolve) => setTimeout(resolve, 1500));

      resultElement.textContent = "Testing connection...";
      try {
        await sendMessageWithRetry(tab.id, { action: "ping" }, 3000);
      } catch (pingError) {
        throw new Error(
          "Content script failed to load. Please refresh the page and try again."
        );
      }

      resultElement.textContent = "Generating summary...";
      await sendSummarizeRequest(
        tab.id,
        summaryLength,
        storageResult.geminiApiKey
      );
    } catch (error) {
      resultElement.textContent = "Error: " + error.message;
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
        } catch (fallbackError) {}
        document.body.removeChild(textArea);
      });
  });

  // Options link click handler
  optionsLink.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});
