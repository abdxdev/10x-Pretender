
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

	constructor(context: vscode.ExtensionContext) {
		this.context = context;

		const config = vscode.workspace.getConfiguration('10x-pretender');
		const apiKey = config.get<string>('apiKey') || '';

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
			this.genAI = new GoogleGenerativeAI(apiKey);
			this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
			vscode.window.showInformationMessage('Gemini API initialized successfully!');
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
						this.clipboardText = text;
						this.currentIndex = this.pausedIndex;
						this.updateStatusBar(true);
						this.registerTypeHandler();
						vscode.window.showInformationMessage('10x Pretender: Typing mode activated!');
					} else {
						this.typingMode = false;
						vscode.window.showWarningMessage('No text in clipboard!');
						this.updateStatusBar(false);
						this.unregisterTypeHandler();
					}
				});
			} else {
				this.updateStatusBar(false);
				this.unregisterTypeHandler();
				vscode.window.showInformationMessage('10x Pretender: Typing mode deactivated!');
			}
		});

		let setClipboardCommand = vscode.commands.registerCommand('10x-pretender.setClipboard', async () => {
			const text = await vscode.window.showInputBox({
				prompt: 'Enter the text you want to type',
				placeHolder: 'Paste or type your text here'
			});

			if (text) {
				this.clipboardText = text;
				this.currentIndex = 0;
				this.pausedIndex = 0;

				const activate = await vscode.window.showQuickPick(['Yes', 'No'], {
					placeHolder: 'Activate typing mode now?'
				});

				if (activate === 'Yes') {
					this.typingMode = true;
					this.updateStatusBar(true);
					this.registerTypeHandler();
					vscode.window.showInformationMessage('10x Pretender: Text set and typing mode activated!');
				}
			}
		});

		let geminiCommand = vscode.commands.registerCommand('10x-pretender.geminiPrompt', async () => {
			const config = vscode.workspace.getConfiguration('10x-pretender');
			let apiKey = config.get<string>('apiKey') || '';

			if (!apiKey || !this.genAI) {
				const inputApiKey = await vscode.window.showInputBox({
					prompt: 'Enter your Google Generative AI API key',
					password: true
				});

				if (inputApiKey) {
					apiKey = inputApiKey;
					await config.update('apiKey', apiKey, true);
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

			vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Generating code with Gemini...",
					cancellable: false
				},
				async (progress) => {
					try {
						const generatedCode = await this.generateCodeWithGemini(prompt);

						if (generatedCode) {
							const match = generatedCode.match(/```python(.*?)```/s);
							let extractedCode = match ? match[1] : generatedCode;

							await vscode.env.clipboard.writeText(extractedCode.trim());

							this.clipboardText = extractedCode.trim();
							this.currentIndex = 0;
							this.pausedIndex = 0;

							const activate = await vscode.window.showQuickPick(['Yes', 'No'], {
								placeHolder: 'Code generated and copied to clipboard. Activate typing mode now?'
							});

							if (activate === 'Yes') {
								this.typingMode = true;
								this.updateStatusBar(true);
								this.registerTypeHandler();
								vscode.window.showInformationMessage('10x Pretender: Gemini code ready for typing!');
							}
						}
					} catch (error) {
						vscode.window.showErrorMessage(`Failed to generate code: ${error}`);
					}
				}
			);
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
			cursorChangeDisposable
		);
	}

	private async generateCodeWithGemini(prompt: string): Promise<string> {
		try {
			const systemInstructions = `Generate code for the given programming task.

Provide only the code implementation without comments.
Use properly formatted markdown code blocks with the appropriate language specification.
Ensure the code appears naturally written by a human, avoiding overly structured or robotic patterns.
Modify string outputs (e.g., in print statements) to avoid full English sentences and ignore casing.
`;

			const result = await this.model.generateContent([
				systemInstructions,
				`Task: ${prompt}`
			]);

			const response = await result.response;
			return response.text();
		} catch (error) {
			console.error('Error generating code with Gemini:', error);
			throw error;
		}
	}

	private registerTypeHandler() {
		this.unregisterTypeHandler();

		this.typeDisposable = vscode.commands.registerTextEditorCommand('type', (textEditor, edit, args) => {
			if (!this.typingMode) { return; }

			const { text } = args;

			if (this.pausePosition) {
				const currentPosition = textEditor.selection.active;
				const currentDocumentOffset = textEditor.document.offsetAt(currentPosition);
				const pausedOffset = textEditor.document.offsetAt(this.pausePosition);

				if (currentDocumentOffset === pausedOffset) {
					this.currentIndex = this.pausedIndex;
					this.pausePosition = undefined;
				}
			}

			if (text === '\b') {
				if (this.currentIndex > 0) {
					const range = new vscode.Range(
						textEditor.document.positionAt(this.currentIndex - 1),
						textEditor.document.positionAt(this.currentIndex)
					);
					edit.delete(range);
					this.currentIndex--;
				}
			} else {
				if (this.currentIndex < this.clipboardText.length) {
					const characterToType = this.clipboardText[this.currentIndex];

					if (characterToType === '\n') {
						edit.insert(
							textEditor.document.positionAt(this.currentIndex),
							'\n'
						);
					} else {
						edit.insert(
							textEditor.document.positionAt(this.currentIndex),
							characterToType
						);
					}

					this.currentIndex++;

					if (this.currentIndex >= this.clipboardText.length) {
						this.typingMode = false;
						this.updateStatusBar(false);
						this.unregisterTypeHandler();
						vscode.window.showInformationMessage('10x Pretender: Typing complete!');
					}
				}
			}
		});

		if (this.typeDisposable) {
			this.context.subscriptions.push(this.typeDisposable);
		}
	}

	private unregisterTypeHandler() {
		if (this.typeDisposable) {
			this.typeDisposable.dispose();
			this.typeDisposable = undefined;
		}
	}

	private updateStatusBar(active: boolean) {
		if (active) {
			this.statusBarItem.text = "$(symbol-method) 10x Pretender: On";
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
		} else {
			this.statusBarItem.text = "$(symbol-method) 10x Pretender: Off";
			this.statusBarItem.backgroundColor = undefined;
		}
	}

	dispose() {
		this.unregisterTypeHandler();
		this.statusBarItem.dispose();
	}
}

export function activate(context: vscode.ExtensionContext) {
	const tenXPretender = new TenXPretender(context);
	context.subscriptions.push(tenXPretender);
}

export function deactivate() { }
