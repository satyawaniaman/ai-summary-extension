document.addEventListener("DOMContentLoaded", function () {
  const summarizeButton = document.getElementById("summarize");
  const copyButton = document.getElementById("copy");
  const summaryElement = document.getElementById("summary");
  const summaryLengthSelect = document.getElementById("summary-length");

  summarizeButton.addEventListener("click", async function () {
    const summaryLength = summaryLengthSelect.value;

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      chrome.tabs.sendMessage(
        tab.id,
        { action: "summarize", summaryLength: summaryLength },
        function (response) {
          if (response && response.summary) {
            summaryElement.textContent = response.summary;
          } else {
            summaryElement.textContent =
              "Failed to generate summary. Please try again.";
          }
        }
      );
    } catch (error) {
      summaryElement.textContent = "Error: " + error.message;
    }
  });

  copyButton.addEventListener("click", function () {
    const summaryText = summaryElement.textContent;
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
      });
  });
});
