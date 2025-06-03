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
    console.log("AI Summarize Extension: Received message:", request.action);

    // Simple ping to check if content script is accessible
    if (request.action === "ping") {
      console.log("AI Summarize Extension: Responding to ping request");
      sendResponse({ status: "ok", timestamp: Date.now() });
      return true;
    }

    if (request.action === "summarize") {
      console.log("AI Summarize Extension: Processing summarize request");

      // Prevent multiple simultaneous requests
      if (isProcessing) {
        console.log("AI Summarize Extension: Already processing a request");
        sendResponse({ error: "Already processing a request. Please wait." });
        return true;
      }

      isProcessing = true;

      try {
        // Extract page content with validation
        const pageContent = extractPageContent();

        if (!pageContent.content || pageContent.content.trim().length < 50) {
          console.log("AI Summarize Extension: Insufficient content");
          isProcessing = false;
          sendResponse({
            error:
              "Not enough content to summarize on this page. Try a page with more text content.",
          });
          return true;
        }

        console.log("AI Summarize Extension: Extracted page content", {
          title: pageContent.title,
          contentLength: pageContent.content.length,
        });

        // Validate API key first
        const apiKey = request.apiKey;
        if (!apiKey || apiKey.trim().length < 10) {
          isProcessing = false;
          sendResponse({
            error: "Invalid API key. Please check your settings.",
          });
          return true;
        }

        // Get the persona from background.js with retry logic
        getPersonaWithRetry()
          .then((persona) => {
            console.log("AI Summarize Extension: Successfully got persona");

            const summaryType = request.summaryLength;

            // Create the summary with better error handling
            createSummaryWithPersona(pageContent, persona, summaryType, apiKey)
              .then((summary) => {
                console.log(
                  "AI Summarize Extension: Summary generated successfully"
                );
                isProcessing = false;
                sendResponse({ summary: summary });
              })
              .catch((error) => {
                console.error(
                  "AI Summarize Extension: Error generating summary:",
                  error
                );
                isProcessing = false;
                sendResponse({
                  error: `Failed to generate summary: ${error.message}`,
                });
              });
          })
          .catch((error) => {
            console.error(
              "AI Summarize Extension: Failed to get persona:",
              error
            );
            isProcessing = false;

            // Fallback: use default persona if background script fails
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
                console.log(
                  "AI Summarize Extension: Summary generated with fallback persona"
                );
                isProcessing = false;
                sendResponse({ summary: summary });
              })
              .catch((error) => {
                console.error(
                  "AI Summarize Extension: Error with fallback:",
                  error
                );
                isProcessing = false;
                sendResponse({
                  error: `Failed to generate summary: ${error.message}`,
                });
              });
          });
      } catch (error) {
        console.error("AI Summarize Extension: Unexpected error:", error);
        isProcessing = false;
        sendResponse({ error: `Unexpected error: ${error.message}` });
      }

      return true; // Keep the messaging channel open for the async response
    }

    return true;
  });

  console.log("AI Summarize Extension: Message listener registered");
}

// Helper function to get persona with retry logic
async function getPersonaWithRetry(maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `AI Summarize Extension: Attempting to get persona (${attempt}/${maxRetries})`
      );

      const persona = await new Promise((resolve, reject) => {
        // Set a timeout for the message
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for persona response"));
        }, 5000);

        chrome.runtime.sendMessage({ action: "getPersona" }, (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            console.error(
              "AI Summarize Extension: Runtime error getting persona:",
              chrome.runtime.lastError
            );
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
      console.error(
        `AI Summarize Extension: Attempt ${attempt} failed:`,
        error
      );

      if (attempt === maxRetries) {
        throw new Error(
          `Failed to get persona after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Extract the main content from the webpage
function extractPageContent() {
  console.log("AI Summarize Extension: Extracting page content");

  // Get page title
  const pageTitle = document.title;

  // Try to get the main content
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

  // Use the first non-null element found
  const contentElement = possibleContentElements.find(
    (element) => element !== null && element.textContent.trim().length > 100
  );

  if (contentElement) {
    content = contentElement.textContent;
    console.log("AI Summarize Extension: Found content in structured element");
  } else {
    // Fallback: get all paragraph text
    const paragraphs = document.querySelectorAll("p");
    content = Array.from(paragraphs)
      .map((p) => p.textContent)
      .join("\n\n");
    console.log("AI Summarize Extension: Extracted content from paragraphs");
  }

  // If content is still empty, get the body text
  if (!content.trim()) {
    content = document.body.textContent;
    console.log("AI Summarize Extension: Fallback to body text");
  }

  // Clean up the content (remove extra whitespace)
  content = content.replace(/\s+/g, " ").trim();

  // Limit content length if needed
  const maxLength = 10000;
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + "...";
    console.log(
      "AI Summarize Extension: Content truncated to",
      maxLength,
      "characters"
    );
  }

  console.log(
    "AI Summarize Extension: Final extracted content length:",
    content.length
  );

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
    console.log("AI Summarize Extension: Creating summary with Gemini API");

    if (!apiKey) {
      throw new Error("API key is missing");
    }

    if (!pageData || !pageData.content) {
      throw new Error("No content to summarize");
    }

    // Trim content if it's too long for the API
    const maxContentLength = 30000;
    const trimmedContent =
      pageData.content.length > maxContentLength
        ? pageData.content.substring(0, maxContentLength) + "..."
        : pageData.content;

    // Select model based on retries (fallback to lighter models if rate limited)
    let model = "gemini-1.5-pro";
    if (retryCount === 1) {
      model = "gemini-1.5-flash"; // First fallback
      console.log(
        "AI Summarize Extension: Using fallback model gemini-1.5-flash"
      );
    } else if (retryCount >= 2) {
      model = "gemini-pro"; // Second fallback
      console.log("AI Summarize Extension: Using fallback model gemini-pro");
    }

    // Improved prompt with clearer structure to enforce persona style
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

    console.log(
      `AI Summarize Extension: Calling Gemini API with model ${model}...`
    );

    // Add exponential backoff delay if retrying
    if (retryCount > 0) {
      const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
      console.log(
        `AI Summarize Extension: Adding delay of ${delayMs}ms before retry`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Call Gemini API with the correct endpoint format and improved parameters
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
          // Add generation parameters to enhance persona adherence
          generationConfig: {
            temperature: model === "gemini-pro" ? 0.7 : 0.9, // Adjust temperature based on model
            topP: 0.8,
            topK: 40,
            maxOutputTokens: model === "gemini-1.5-flash" ? 1024 : 2048, // Shorter output for flash model
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
      console.error(
        "AI Summarize Extension: API response not OK:",
        response.status,
        errorText
      );

      if (response.status === 403) {
        throw new Error(
          "Invalid API key or API key doesn't have permission to use Gemini API"
        );
      } else if (response.status === 429) {
        // Rate limit exceeded, try with fallback model if we haven't tried too many times
        if (retryCount < 3) {
          console.log(
            `AI Summarize Extension: Rate limit exceeded, retrying with fallback model (attempt ${retryCount + 1}/3)`
          );
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
    console.log("AI Summarize Extension: Received API response");

    // Check for errors in the API response
    if (data.error) {
      console.error("AI Summarize Extension: API returned error:", data.error);

      // If we hit a quota limit, try fallback model
      if (
        data.error.code === 429 ||
        (data.error.message && data.error.message.includes("quota"))
      ) {
        if (retryCount < 3) {
          console.log(
            `AI Summarize Extension: Quota error, retrying with fallback model (attempt ${retryCount + 1}/3)`
          );
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

    // Extract the summary text from the response
    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      const summary = data.candidates[0].content.parts[0].text;
      console.log(
        "AI Summarize Extension: Summary generated successfully, length:",
        summary.length,
        `using model ${model}`
      );
      return summary;
    } else {
      console.error(
        "AI Summarize Extension: Unexpected API response format:",
        data
      );
      throw new Error("Unexpected API response format");
    }
  } catch (error) {
    console.error("AI Summarize Extension: Gemini API Error:", error);
    throw error;
  }
}
