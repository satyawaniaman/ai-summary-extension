# AI Summarize Extension Flow Documentation

## Overview

This document explains the flow and interaction between different components of the AI Summarize browser extension. The extension uses the Gemini API to generate summaries of web pages in a conversational Hinglish style inspired by Hitesh Choudhary.

## Component Structure

The extension consists of the following key components:

1. **Popup UI** (popup.js, popup.html)
2. **Content Script** (content.js)
3. **Background Script** (background.js)
4. **Options Page** (options.js, options.html)
5. **Persona Definition** (persona.txt)

## 1. Popup Flow (popup.js, popup.html)

The popup is the user interface that appears when the user clicks on the extension icon:

1. **Initialization**:

   - DOM elements are loaded
   - Dark mode preference is checked and applied
   - Event listeners are set up

2. **User Interaction**:

   - User selects summary length (concise or detailed)
   - User clicks "Summarize" button

3. **Validation Process**:

   - Checks if the current tab is a valid webpage (not browser internal pages)
   - Verifies API key is set in storage
   - Injects content script into the current tab
   - Tests connection with content script via "ping" action

4. **Summarization Request**:

   - Sends summarize request to content script with API key and summary length
   - Displays progress messages during the process
   - Shows the summary result or error message

5. **Additional Features**:
   - Copy button to copy the summary to clipboard
   - Options link to open extension options page

## 2. Content Script Flow (content.js)

The content script is injected into web pages to extract content and handle summarization:

1. **Initialization**:

   - Sets up a global flag to prevent multiple injections
   - Logs diagnostic information

2. **Message Handling**:

   - Listens for messages from popup
   - Responds to "ping" to verify connection
   - Processes "summarize" requests

3. **Content Extraction**:

   - Extracts page title and main content using intelligent selection
   - Tries to find the most relevant content container (article, main, etc.)
   - Falls back to paragraphs or body text if needed
   - Limits content length to prevent API overload

4. **Persona Integration**:

   - Requests persona text from background script
   - Uses fallback persona if retrieval fails

5. **Summarization Process**:
   - Constructs prompt with page content, persona, and summary type
   - Makes API call to Gemini API with proper error handling
   - Implements retry logic with different models:
     - First try: gemini-1.5-pro
     - Second try: gemini-1.5-flash
     - Third try: gemini-pro
   - Returns summary or error to popup

## 3. Background Script Flow (background.js)

The background script runs persistently and manages global state:

1. **Initialization**:

   - Loads persona file when extension is installed or updated
   - Opens options page on first install if API key isn't set

2. **Persona Management**:

   - Loads persona text from persona.txt
   - Provides fallback if loading fails
   - Handles persona requests from content script

3. **Message Handling**:
   - Responds to "getPersona" requests with loaded persona text
   - Implements retry and waiting logic if persona is still loading

## 4. Options Page Flow (options.js, options.html)

The options page allows users to configure the extension:

1. **API Key Management**:

   - Allows user to enter and save their Gemini API key
   - Validates the API key format
   - Stores the API key in chrome.storage.sync

2. **Theme Settings**:
   - Toggle between light and dark mode
   - Saves preference to chrome.storage.sync

## 5. Persona Definition (persona.txt)

Contains the persona definition that guides the AI to generate summaries in the style of Hitesh Choudhary:

1. **Style Guidelines**:

   - Hinglish language style
   - Conversational tone
   - Storytelling approach
   - Common phrases and expressions

2. **Summarization Format**:
   - Warm welcome introduction
   - Key points presentation
   - Personal insight or takeaway
   - Consistent style throughout

## Data Flow Between Components

1. **Popup → Content Script**:

   - Sends "ping" to verify connection
   - Sends "summarize" request with API key and summary type

2. **Content Script → Background Script**:

   - Requests persona text with "getPersona" action

3. **Content Script → Gemini API**:

   - Makes API call with constructed prompt
   - Handles errors and retries

4. **Content Script → Popup**:

   - Returns summary or error message

5. **Options → Chrome Storage**:

   - Saves API key and preferences

6. **Background → Chrome Storage**:
   - Retrieves API key to check if setup is needed

## Error Handling

The extension implements robust error handling:

1. **API Key Validation**:

   - Checks if API key is present
   - Validates format before use

2. **Content Script Injection**:

   - Verifies successful injection
   - Tests connection with ping/pong

3. **API Call Errors**:

   - Handles rate limiting with retries
   - Falls back to alternative models
   - Provides clear error messages

4. **Persona Loading**:
   - Uses fallback persona if loading fails
   - Implements retry mechanism

## Extension Lifecycle

1. **Installation/Update**:

   - Background script loads persona
   - Options page opens on first install

2. **User Interaction**:

   - User clicks extension icon → Popup opens
   - User clicks Summarize → Content extraction and API call
   - User clicks Options → Options page opens

3. **Page Navigation**:
   - Content script is injected when needed
   - State is maintained in background script
