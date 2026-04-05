import * as vscode from "vscode";
import { openChatAndPrompt } from "./chat";

type PromptMap = Record<string, string>;

const BUILTIN_IDS = [
  "reword",
  "rephrase",
  "synonym",
  "shorten",
  "expand",
  "itemize",
  "oneSentence",
] as const;

export function activate(context: vscode.ExtensionContext): void {
  const run = (id: (typeof BUILTIN_IDS)[number]) => async () => {
    const prompts = vscode.workspace
      .getConfiguration("prose-prompt")
      .get<PromptMap>("prompts", {});
    const prompt = prompts[id];
    if (!prompt?.trim()) {
      void vscode.window.showWarningMessage(
        `No prompt prose instruction configured for "${id}"`,
      );
      return;
    }
    await sendSelectionWithPrompt(prompt);
  };

  for (const id of BUILTIN_IDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`prose-prompt.${id}`, run(id)),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("prose-prompt.pickProfile", pickProfile),
  );
}

async function pickProfile(): Promise<void> {
  const prompts = vscode.workspace
    .getConfiguration("prose-prompt")
    .get<PromptMap>("prompts", {});

  const items: vscode.QuickPickItem[] = Object.entries(prompts)
    .filter(([, text]) => text.trim().length > 0)
    .map(([key, text]) => ({
      label: titleCase(key),
      description: text.trim().slice(0, 72) + (text.length > 72 ? "…" : ""),
      detail: key,
    }));

  if (items.length === 0) {
    void vscode.window.showInformationMessage(
      "Configure prose-prompt.prompts in settings.",
    );
    return;
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Send text selection to AI chat with a prose prompt",
  });
  if (!picked?.detail) {
    return;
  }
  const prompt = prompts[picked.detail];
  if (prompt) {
    await sendSelectionWithPrompt(prompt);
  }
}

function titleCase(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

async function sendSelectionWithPrompt(prompt: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("No active text editor.");
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection.trim()) {
    void vscode.window.showWarningMessage("Select text to send to AI chat.");
    return;
  }

  const rel = vscode.workspace.asRelativePath(editor.document.uri);
  const body = `${prompt.trim()}

Selected text from "${rel}":
---
${selection}
---`;

  await openChatAndPrompt(body);
}

export function deactivate(): void {}
