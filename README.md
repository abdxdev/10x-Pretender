# 10x Pretender

<!-- ![10x Pretender Demonstration](https://github.com/abdbbdii/10x-Pretender/blob/main/media/other/demo.gif?raw=true) -->

The 10x Pretender is a VS Code extension that makes you look like a coding genius by simulating realistic typing from your clipboard or AI-generated code. Perfect for live coding demos, presentations, or impressing colleagues with your "incredible" typing speed.

## Note

To use the 10x Pretender extension:

1. Obtain a Google Generative AI API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Set the API key in the extension settings to enable Gemini code generation.
3. Toggle the typing mode using the status bar icon or keyboard shortcut.

## Features

- **Realistic Typing Simulation:** Automatically types text from your clipboard at a natural pace.
- **AI-Powered Code Generation:** Integrates with Google's Gemini API to generate code snippets based on your plain English descriptions.
- **Status Bar Integration:** Easily toggle the typing mode on and off with a visible status bar icon.
- **Seamless Pausing:** Automatically pauses typing when you move the cursor to a different position, and resumes when you return.
- **Custom Text Entry:** Manually input text to be typed out if you don't want to use clipboard content.

## Requirements

- A stable internet connection is required to use the Gemini code generation feature.
- You must have a Google Generative AI API key to use the AI code generation feature. You can get one at [Google AI Studio](https://aistudio.google.com/apikey).

## Extension Settings

- `10x-pretender.apiKey`: API key for Google Generative AI.

## Commands

To access the commands, press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac) to open the command palette and type the following commands:

- **10x Pretender: Toggle Typing Mode:** `10x-pretender.toggle`
- **10x Pretender: Set Text to Type:** `10x-pretender.setClipboard`
- **10x Pretender: Generate Code with Gemini:** `10x-pretender.geminiPrompt`

## How to Use

1. **Using Clipboard Content:**
   - Copy any code or text to your clipboard
   - Click the "10x Pretender: Off" button in the status bar to toggle it on
   - Watch as the extension types out your clipboard content

2. **Using AI-Generated Code:**
   - Run the "Generate Code with Gemini" command
   - Enter a description of the code you want to create
   - Choose whether to start typing the generated code immediately

3. **Using Custom Text:**
   - Run the "Set Custom Text" command
   - Enter the text you want to type out
   - Choose whether to start typing immediately

## Use Cases

- **Live Coding Demonstrations:** Prepare your code beforehand and have it typed out as if you're coding in real-time.
- **Presentations:** Showcase code examples without typing mistakes or delays.
- **Teaching:** Focus on explaining concepts while code appears seamlessly.
- **Brainstorming Sessions:** Generate code solutions quickly using the Gemini AI integration.

## Contributing

If you encounter any issues or have suggestions for improvements, please feel free to open an issue or submit a pull request on [GitHub](https://github.com/abdbbdii/10x-pretender).

## Repository

The source code for this extension is available on [GitHub](https://github.com/abdbbdii/10x-pretender).