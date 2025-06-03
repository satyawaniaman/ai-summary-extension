// Debug message to confirm content script is loaded
console.log(
  "AI Summarize Extension: Content script loaded at",
  new Date().toISOString()
);
console.log("AI Summarize Extension: Page URL:", window.location.href);
console.log(
  "AI Summarize Extension: Document ready state:",
  document.readyState
);

// Global flag to prevent multiple script injections
if (window.aiSummarizerContentScriptLoaded) {
  console.log(
    "AI Summarize Extension: Content script already loaded, skipping"
  );
} else {
  window.aiSummarizerContentScriptLoaded = true;

  // Global state
  let isProcessing = false;

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ status: "ok", timestamp: Date.now() });
      return true;
    }

    if (request.action === "summarize") {
      if (isProcessing) {
        sendResponse({ error: "Already processing a request. Please wait." });
        return true;
      }

      isProcessing = true;

      try {
        const pageContent = extractPageContent();

        if (!pageContent.content || pageContent.content.trim().length < 50) {
          isProcessing = false;
          sendResponse({
            error:
              "Not enough content to summarize on this page. Try a page with more text content.",
          });
          return true;
        }

        const apiKey = request.apiKey;
        if (!apiKey || apiKey.trim().length < 10) {
          isProcessing = false;
          sendResponse({
            error: "Invalid API key. Please check your settings.",
          });
          return true;
        }

        getPersonaWithRetry()
          .then((persona) => {
            const summaryType = request.summaryLength;

            createSummaryWithPersona(pageContent, persona, summaryType, apiKey)
              .then((summary) => {
                isProcessing = false;
                sendResponse({ summary: summary });
              })
              .catch((error) => {
                isProcessing = false;
                sendResponse({
                  error: `Failed to generate summary: ${error.message}`,
                });
              });
          })
          .catch((error) => {
            isProcessing = false;

            const fallbackPersona =
              "You are a helpful AI assistant that provides concise and accurate summaries.";
            const summaryType = request.summaryLength;

            createSummaryWithPersona(
              pageContent,
              fallbackPersona,
              summaryType,
              apiKey
            )
              .then((summary) => {
                isProcessing = false;
                sendResponse({ summary: summary });
              })
              .catch((error) => {
                isProcessing = false;
                sendResponse({
                  error: `Failed to generate summary: ${error.message}`,
                });
              });
          });
      } catch (error) {
        isProcessing = false;
        sendResponse({ error: `Unexpected error: ${error.message}` });
      }

      return true;
    }

    return true;
  });

  console.log("AI Summarize Extension: Message listener registered");
}

// Helper function to get persona with retry logic
async function getPersonaWithRetry(maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const persona = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for persona response"));
        }, 5000);

        chrome.runtime.sendMessage({ action: "getPersona" }, (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (response && response.persona) {
            resolve(response.persona);
          } else {
            reject(new Error(response?.error || "No persona received"));
          }
        });
      });

      return persona;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to get persona after ${maxRetries} attempts: ${error.message}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Extract the main content from the webpage
function extractPageContent() {
  const pageTitle = document.title;
  let content = "";
  const possibleContentElements = [
    document.querySelector("article"),
    document.querySelector("main"),
    document.querySelector(".content"),
    document.querySelector("#content"),
    document.querySelector(".article"),
    document.querySelector(".post"),
    document.querySelector(".entry"),
    document.querySelector("[role='main']"),
  ];

  const contentElement = possibleContentElements.find(
    (element) => element !== null && element.textContent.trim().length > 100
  );

  if (contentElement) {
    content = contentElement.textContent;
  } else {
    const paragraphs = document.querySelectorAll("p");
    content = Array.from(paragraphs)
      .map((p) => p.textContent)
      .join("\n\n");
  }

  if (!content.trim()) {
    content = document.body.textContent;
  }

  content = content.replace(/\s+/g, " ").trim();

  const maxLength = 10000;
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + "...";
  }

  return {
    title: pageTitle,
    content: content,
  };
}

// Create summary using Gemini API with the persona
async function createSummaryWithPersona(
  pageData,
  persona,
  summaryType,
  apiKey,
  retryCount = 0
) {
  try {
    if (!apiKey) {
      throw new Error("API key is missing");
    }

    if (!pageData || !pageData.content) {
      throw new Error("No content to summarize");
    }

    const maxContentLength = 30000;
    const trimmedContent =
      pageData.content.length > maxContentLength
        ? pageData.content.substring(0, maxContentLength) + "..."
        : pageData.content;

    let model = "gemini-1.5-pro";
    if (retryCount === 1) {
      model = "gemini-1.5-flash";
    } else if (retryCount >= 2) {
      model = "gemini-pro";
    }

    const prompt = `
${persona}

You are summarizing content in the style of Hitesh Choudhary. Follow these guidelines:

1. Use a conversational Hinglish style with occasional Hindi expressions
2. Start with a warm welcome like "Haan bhai" or "Dekho"
3. Present key points in a casual, storytelling manner
4. End with a personal insight or reflection related to the content
5. Maintain Hitesh's teaching style throughout

Now, I need you to summarize the following content:

Title: ${pageData.title}

Content:
${trimmedContent}

${
  summaryType === "detailed"
    ? "Provide a detailed summary covering all major points."
    : "Provide a concise, short summary focusing on the most important points."
}

Remember to maintain Hitesh Choudhary's style and personality throughout the summary. Use phrases like "samajh mein aaya?", "chai-point", and other signature expressions.
`;

    if (retryCount > 0) {
      const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: model === "gemini-pro" ? 0.7 : 0.9,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: model === "gemini-1.5-flash" ? 1024 : 2048,
            stopSequences: [],
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 403) {
        throw new Error(
          "Invalid API key or API key doesn't have permission to use Gemini API"
        );
      } else if (response.status === 429) {
        if (retryCount < 3) {
          return createSummaryWithPersona(
            pageData,
            persona,
            summaryType,
            apiKey,
            retryCount + 1
          );
        } else {
          throw new Error(
            "Rate limit exceeded. Please try again in a few minutes."
          );
        }
      } else {
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();

    if (data.error) {
      if (
        data.error.code === 429 ||
        (data.error.message && data.error.message.includes("quota"))
      ) {
        if (retryCount < 3) {
          return createSummaryWithPersona(
            pageData,
            persona,
            summaryType,
            apiKey,
            retryCount + 1
          );
        }
      }

      throw new Error(data.error.message || "Failed to generate summary");
    }

    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      const summary = data.candidates[0].content.parts[0].text;
      return summary;
    } else {
      throw new Error("Unexpected API response format");
    }
  } catch (error) {
    throw error;
  }
}
