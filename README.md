# AI Summarize Extension

A Chrome extension that summarizes web content using the Gemini API, in the style of Hitesh Choudhary from ChaiCode.

## Features

- Summarize any webpage with a single click
- Choose between short and detailed summaries
- Content is summarized in Hitesh Choudhary's signature style
- Dark mode support
- Easy-to-use interface

## How It Works

1. The extension uses a persona defined in `persona.txt` that captures Hitesh Choudhary's teaching and communication style
2. When you click "Summarize," the extension:
   - Extracts the main content from the current webpage
   - Sends the content to the Gemini API along with the persona instructions
   - Displays the AI-generated summary in Hitesh's style

## Setup

1. Install the extension
2. Input your Gemini API key in the options page (accessible by clicking the gear icon)
3. Navigate to any webpage you want to summarize
4. Click the extension icon to open the popup
5. Select summary length and click "Summarize"
6. Copy the summary with the copy button

## Files and Structure

- `popup.html/js`: The main UI that appears when clicking the extension icon
- `options.html/js`: Settings page for the API key and theme
- `content.js`: Extracts content from webpages and communicates with the Gemini API
- `background.js`: Handles loading the persona and background tasks
- `persona.txt`: Contains the Hitesh Choudhary persona instructions for the AI
- `manifest.json`: Extension configuration

## Customizing the Persona

The personality and style of the summaries are defined in `persona.txt`. You can edit this file to adjust how the summaries are written while maintaining Hitesh Choudhary's style.

## Created By

Aman Satyawani
