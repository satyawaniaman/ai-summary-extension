/**
 * Debug script for testing the AI Summarize Extension
 *
 * This script can be used from the developer console to test the summarization functionality.
 * Copy and paste it into the console on a webpage to test summarization.
 */

// Test summarization with direct Gemini API call
async function testSummarize(apiKey) {
  if (!apiKey) {
    console.error("No API key provided. Usage: testSummarize('YOUR_API_KEY')");
    return;
  }

  const pageTitle = document.title;
  const pageContent = document.body.innerText.substring(0, 10000);

  console.log("Page title:", pageTitle);
  console.log("Content length:", pageContent.length);

  const prompt = `
Please summarize the following content in a concise manner.

Title: ${pageTitle}

Content:
${pageContent}

Please provide a brief summary of the key points.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API response not OK:", response.status, errorText);
      return;
    }

    const data = await response.json();

    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      const summary = data.candidates[0].content.parts[0].text;
      console.log("Summary generated successfully:");
      console.log("-----------------------------------");
      console.log(summary);
      console.log("-----------------------------------");
      return summary;
    } else {
      console.error("Unexpected API response format:", data);
    }
  } catch (error) {
    console.error("Error generating summary:", error);
  }
}

// Usage instructions
console.log("AI Summarize Debug Tool loaded");
console.log("To test summarization, run: testSummarize('YOUR_API_KEY')");
console.log(
  "Example: testSummarize('AIzaSyB7--IrFMO0pnyYmFls4z5c6gKHRDRwdm8')"
);
