import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';

class TenXPretender {
	private statusBarItem: vscode.StatusBarItem;
	private typingMode = false;
	private clipboardText = '';
	private currentIndex = 0;
	private pausedIndex = 0;
	private context: vscode.ExtensionContext;
	private lastActiveEditor: vscode.TextEditor | undefined;
	private pausePosition: vscode.Position | undefined;
	private typeDisposable: vscode.Disposable | undefined;
	private genAI: any;
	private model: any;
	private keyBuffer: string[] = [];
	private isProcessingKey = false;
	private typingStatus: 'running' | 'paused' | 'stopped' = 'stopped';
	private pauseButton: vscode.StatusBarItem;
	private stopButton: vscode.StatusBarItem;
	private restartButton: vscode.StatusBarItem;
	private isGenerating = false;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		const config = vscode.workspace.getConfiguration();
		const apiKey = config.get<string>('abd-dev.geminiApiKey') || '';
		if (apiKey && apiKey.trim() !== '') {
			this.initializeGemini(apiKey);
		}

		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);
		this.statusBarItem.text = "$(symbol-method) 10x Pretender: Off";
		this.statusBarItem.command = '10x-pretender.toggle';
		this.statusBarItem.show();

		this.pauseButton = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			99
		);
		this.pauseButton.text = "$(debug-pause)";
		this.pauseButton.tooltip = "Pause/Resume typing";
		this.pauseButton.command = '10x-pretender.pause';

		this.stopButton = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			98
		);
		this.stopButton.text = "$(debug-stop)";
		this.stopButton.tooltip = "Stop typing";
		this.stopButton.command = '10x-pretender.stop';

		this.restartButton = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			97
		);
		this.restartButton.text = "$(debug-restart)";
		this.restartButton.tooltip = "Restart typing from beginning";
		this.restartButton.command = '10x-pretender.restart';

		this.registerCommands();
		vscode.window.onDidChangeActiveTextEditor(editor => {
			this.lastActiveEditor = editor;
		});
	}

	private initializeGemini(apiKey: string) {
		if (!apiKey || apiKey.trim() === '') {
			console.error('Empty API key provided');
			vscode.window.showErrorMessage('Empty API key provided for Gemini API.');
			return;
		}

		try {
			const config = vscode.workspace.getConfiguration();
			const modelName = config.get<string>('abd-dev.geminiModel') || 'gemini-2.0-flash-001';
			this.genAI = new GoogleGenerativeAI(apiKey);
			this.model = this.genAI.getGenerativeModel({ model: modelName });
		} catch (error) {
			console.error('Failed to initialize Gemini:', error);
			vscode.window.showErrorMessage('Failed to initialize Gemini API. Check your API key.');
		}
	}

	private registerCommands() {
		let toggleCommand = vscode.commands.registerCommand('10x-pretender.toggle', () => {
			this.typingMode = !this.typingMode;
			if (this.typingMode) {
				vscode.env.clipboard.readText().then(text => {
					if (text) {
						this.clipboardText = this.normalizeLineEndings(text);
						this.currentIndex = this.pausedIndex;
						this.typingStatus = 'running';
						this.updateStatusBar();
						this.registerTypeHandler();
					} else {
						this.typingMode = false;
						this.typingStatus = 'stopped';
						this.updateStatusBar();
						this.unregisterTypeHandler();
						vscode.window.showWarningMessage('No text in clipboard!');
					}
				});
			} else {
				this.typingStatus = 'stopped';
				this.updateStatusBar();
				this.unregisterTypeHandler();
			}
		});
		let setClipboardCommand = vscode.commands.registerCommand('10x-pretender.setClipboard', async () => {
			const text = await vscode.window.showInputBox({
				prompt: 'Enter the text you want to type',
				placeHolder: 'Paste or type your text here'
			});
			if (text) {
				this.clipboardText = this.normalizeLineEndings(text);
				this.currentIndex = 0;
				this.pausedIndex = 0;
				this.typingMode = true;
				this.typingStatus = 'running';
				this.updateStatusBar();
				this.registerTypeHandler();
			}
		});
		let geminiCommand = vscode.commands.registerCommand('10x-pretender.geminiPrompt', async () => {
			const config = vscode.workspace.getConfiguration();
			let apiKey = config.get<string>('abd-dev.geminiApiKey') || '';
			if (!apiKey || !this.genAI) {
				const inputApiKey = await vscode.window.showInputBox({
					prompt: 'Enter your Google Generative AI API key',
					password: true
				});
				if (inputApiKey) {
					apiKey = inputApiKey;
					await config.update('abd-dev.geminiApiKey', apiKey, true);
					this.initializeGemini(apiKey);
				} else {
					return;
				}
			}

			if (!this.model) {
				vscode.window.showErrorMessage('Failed to initialize Gemini API. Please check your API key.');
				return;
			}

			const prompt = await vscode.window.showInputBox({
				prompt: 'Enter your programming task for Gemini',
				placeHolder: 'Describe the code you want Gemini to generate'
			});
			if (!prompt) { return; }

			this.isGenerating = true;
			this.updateStatusBar();

			try {
				const generatedCode = await this.generateCodeWithGemini(prompt);
				if (generatedCode) {
					let extractedCode = generatedCode.replaceAll('\t', '    ').trim();
					extractedCode = extractedCode.split('\n').slice(1, -2).join('\n');
					extractedCode = extractedCode.replaceAll('\n', '\r\n');

					await vscode.env.clipboard.writeText(extractedCode);
					this.clipboardText = extractedCode;
					this.currentIndex = 0;
					this.pausedIndex = 0;

					this.typingMode = true;
					this.typingStatus = 'running';
					this.registerTypeHandler();
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to generate code: ${error}`);
			} finally {
				this.isGenerating = false;
				this.updateStatusBar();
			}
		});

		let pauseCommand = vscode.commands.registerCommand('10x-pretender.pause', () => {
			if (this.typingMode) {
				if (this.typingStatus === 'running') {
					this.typingStatus = 'paused';
					this.pausedIndex = this.currentIndex;
					this.pausePosition = this.lastActiveEditor?.selection.active;
					this.pauseButton.text = "$(debug-continue)";
					this.pauseButton.tooltip = "Resume typing";
					this.unregisterTypeHandler();
				} else if (this.typingStatus === 'paused') {
					this.typingStatus = 'running';
					this.pauseButton.text = "$(debug-pause)";
					this.pauseButton.tooltip = "Pause typing";
					this.registerTypeHandler();
					if (this.lastActiveEditor) {
						this.processNextKey(this.lastActiveEditor);
					}
				}
				this.updateStatusBar();
			}
		});

		let stopCommand = vscode.commands.registerCommand('10x-pretender.stop', () => {
			this.typingMode = false;
			this.typingStatus = 'stopped';
			this.pausedIndex = 0;
			this.currentIndex = 0;
			this.updateStatusBar();
			this.unregisterTypeHandler();
		});

		let restartCommand = vscode.commands.registerCommand('10x-pretender.restart', () => {
			if (this.clipboardText) {
				this.typingMode = true;
				this.typingStatus = 'running';
				this.currentIndex = 0;
				this.pausedIndex = 0;
				this.updateStatusBar();
				this.registerTypeHandler();
				if (this.lastActiveEditor) {
					this.processNextKey(this.lastActiveEditor);
				}
			}
		});

		let cursorChangeDisposable = vscode.window.onDidChangeTextEditorSelection((event) => {
			if (this.typingMode && event.textEditor === this.lastActiveEditor) {
				const currentPosition = event.selections[0].active;
				const currentDocumentOffset = event.textEditor.document.offsetAt(currentPosition);
				const expectedOffset = event.textEditor.document.offsetAt(
					event.textEditor.document.positionAt(this.currentIndex)
				);
				if (currentDocumentOffset !== expectedOffset) {
					this.pausePosition = currentPosition;
					this.pausedIndex = this.currentIndex;
				}
			}
		});
		this.context.subscriptions.push(
			toggleCommand,
			setClipboardCommand,
			geminiCommand,
			pauseCommand,
			stopCommand,
			restartCommand,
			cursorChangeDisposable
		);
	}

	// Handles AI code generation with specific formatting instructions
	private async generateCodeWithGemini(prompt: string): Promise<string> {
		try {
			const systemInstructions = `Generate code for the given programming task.

Provide only the code implementation without comments.
Use properly formatted markdown code blocks with the appropriate language specification.
Ensure the code appears naturally written by a human, avoiding overly structured or robotic patterns.
Modify string outputs (e.g., in print statements) to avoid full English sentences and ignore casing.
Always use 4 spaces for indentation.
Avoid full variable names and use short, concise names instead.
Avoid using any external libraries or imports if not mentioned.
Avoid all sorts of comments and docstrings.
`;
			const result = await this.model.generateContent([
				systemInstructions,
				`Task: ${prompt}`
			]);
			const response = await result.response;
			const generatedText = response.text();

			if (!generatedText) {
				throw new Error('Received empty response from Gemini API.');
			}

			return generatedText;
		} catch (error) {
			console.error('Error generating code with Gemini:', error);
			throw error;
		}
	}

	// Intercepts keystrokes to simulate human typing from clipboard content
	private registerTypeHandler() {
		this.unregisterTypeHandler();
		this.keyBuffer = [];
		this.isProcessingKey = false;

		this.typeDisposable = vscode.commands.registerTextEditorCommand('type', (textEditor, edit, args) => {
			if (!this.typingMode || this.typingStatus === 'paused') {
				return;
			}

			const { text } = args;

			this.keyBuffer.push(text);
			this.processNextKey(textEditor);
		});

		if (this.typeDisposable) {
			this.context.subscriptions.push(this.typeDisposable);
		}
	}

	// Manages complex typing logic including newlines and indentation
	private async processNextKey(textEditor: vscode.TextEditor) {
		if (this.isProcessingKey) {
			return;
		}

		this.isProcessingKey = true;

		while (this.keyBuffer.length > 0 && this.typingMode && this.typingStatus === 'running') {
			const currentKey = this.keyBuffer.shift();

			if (this.pausePosition) {
				const currentPosition = textEditor.selection.active;
				const currentDocumentOffset = textEditor.document.offsetAt(currentPosition);
				const pausedOffset = textEditor.document.offsetAt(this.pausePosition);
				if (currentDocumentOffset === pausedOffset) {
					this.currentIndex = this.pausedIndex;
					this.pausePosition = undefined;
				}
			}

			if (this.typingStatus !== 'running') {
				break;
			}

			if (currentKey === '\b') {
				if (this.currentIndex > 0) {
					await textEditor.edit(editBuilder => {
						const range = new vscode.Range(
							textEditor.document.positionAt(this.currentIndex - 1),
							textEditor.document.positionAt(this.currentIndex)
						);
						editBuilder.delete(range);
					});
					this.currentIndex--;
				}
			} else {
				if (this.currentIndex < this.clipboardText.length) {
					if (this.clipboardText[this.currentIndex] === '\r' &&
						this.currentIndex + 1 < this.clipboardText.length &&
						this.clipboardText[this.currentIndex + 1] === '\n') {
						this.currentIndex++;
						continue;
					}

					const characterToType = this.clipboardText[this.currentIndex];
					const currentPosition = textEditor.document.positionAt(this.currentIndex);

					if (characterToType === '\n') {
						let nextIndex = this.currentIndex + 1;
						let whitespaceCount = 0;

						while (nextIndex < this.clipboardText.length &&
							(this.clipboardText[nextIndex] === ' ' || this.clipboardText[nextIndex] === '\t')) {
							whitespaceCount++;
							nextIndex++;
						}

						if (whitespaceCount > 0) {
							const whitespace = this.clipboardText.substring(this.currentIndex + 1, nextIndex);

							await textEditor.edit(editBuilder => {
								editBuilder.insert(currentPosition, characterToType + whitespace);
							});

							this.currentIndex += whitespaceCount + 1;
						} else {
							await textEditor.edit(editBuilder => {
								editBuilder.insert(currentPosition, characterToType);
							});
							this.currentIndex++;
						}
					} else {
						await textEditor.edit(editBuilder => {
							editBuilder.insert(currentPosition, characterToType);
						});
						this.currentIndex++;
					}

					const newPosition = textEditor.document.positionAt(this.currentIndex);
					textEditor.selection = new vscode.Selection(newPosition, newPosition);

					if (this.currentIndex >= this.clipboardText.length) {
						this.typingMode = false;
						this.typingStatus = 'stopped';
						this.updateStatusBar();
						this.unregisterTypeHandler();
					}
				}
			}

			await new Promise(resolve => setTimeout(resolve, 10));

			if (this.typingStatus !== 'running') {
				break;
			}
		}

		this.isProcessingKey = false;
	}

	private unregisterTypeHandler() {
		if (this.typeDisposable) {
			this.typeDisposable.dispose();
			this.typeDisposable = undefined;
		}
		this.keyBuffer = [];
		this.isProcessingKey = false;
	}

	private updateStatusBar() {
		if (this.isGenerating) {
			this.statusBarItem.text = "$(sync~spin) Generating code...";
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
			this.pauseButton.hide();
			this.stopButton.hide();
			this.restartButton.hide();
		} else if (this.typingStatus === 'running') {
			this.statusBarItem.text = "$(symbol-method) 10x Pretender: Typing";
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
			this.pauseButton.text = "$(debug-pause)";
			this.pauseButton.tooltip = "Pause typing";
			this.pauseButton.show();
			this.stopButton.show();
			this.restartButton.show();
		} else if (this.typingStatus === 'paused') {
			this.statusBarItem.text = "$(debug-pause) 10x Pretender: Paused";
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
			this.pauseButton.text = "$(debug-continue)";
			this.pauseButton.tooltip = "Resume typing";
			this.pauseButton.show();
			this.stopButton.show();
			this.restartButton.show();
		} else {
			this.statusBarItem.text = "$(symbol-method) 10x Pretender: Off";
			this.statusBarItem.backgroundColor = undefined;
			this.pauseButton.hide();
			this.stopButton.hide();
			this.restartButton.hide();
		}
	}

	// Ensures consistent line endings across different platforms
	private normalizeLineEndings(text: string): string {
		return text.replace(/\r\n|\r|\n/g, '\r\n');
	}

	dispose() {
		this.unregisterTypeHandler();
		this.statusBarItem.dispose();
		this.pauseButton.dispose();
		this.stopButton.dispose();
		this.restartButton.dispose();
	}
}

export function activate(context: vscode.ExtensionContext) {
	const tenXPretender = new TenXPretender(context);
	context.subscriptions.push(tenXPretender);
}

export function deactivate() { }