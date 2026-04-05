import * as vscode from "vscode";

const DEFAULT_OPEN_COMMANDS = [
  "workbench.action.chat.open",
  "workbench.action.chat.focusInput",
];

const FALLBACK_OPEN_FIRST = [
  "workbench.action.chat.open",
  "workbench.action.quickchat.toggle",
  "aichat.newchataction",
];

export async function openChatAndPrompt(text: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("prose-prompt");
  const commands = config.get<string[]>(
    "openChatCommands",
    DEFAULT_OPEN_COMMANDS,
  );
  const delayMs = config.get<number>("promptDelayMs", 450);

  const original = await vscode.env.clipboard.readText();

  let opened = await runOpenSequence(commands);

  if (!opened) {
    for (const first of FALLBACK_OPEN_FIRST) {
      opened = await runOpenSequence([
        first,
        "workbench.action.chat.focusInput",
      ]);
      if (opened) {
        break;
      }
    }
  }

  if (!opened) {
    await vscode.env.clipboard.writeText(text);
    void vscode.window.showErrorMessage(
      "Prose Prompt could not open AI chat. The full prompt is on the clipboard; paste it into chat.",
    );
    return;
  }

  await sleep(delayMs);
  await vscode.env.clipboard.writeText(text);
  try {
    await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
  } catch {
    void vscode.window.showWarningMessage(
      "Chat opened but the prompt could not be inserted. The full prompt is on the clipboard.",
    );
    return;
  }
  await vscode.env.clipboard.writeText(original);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** First entry must succeed; further entries are optional. */
async function runOpenSequence(commands: string[]): Promise<boolean> {
  const list = commands.map((c) => c.trim()).filter(Boolean);
  if (list.length === 0) {
    return false;
  }
  for (let i = 0; i < list.length; i++) {
    try {
      await vscode.commands.executeCommand(list[i]);
    } catch {
      if (i === 0) {
        return false;
      }
    }
  }
  return true;
}
