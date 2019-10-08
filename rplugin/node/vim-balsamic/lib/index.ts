import * as path from "path";

import { Neovim, Plugin, Command } from "neovim";

import { Directory, itemToLine, getFiles, itemIsDirectory } from "./files";
import { FileOperation, New, Copy, Cut, operationToString, parseOperationString, FileOperations } from "./operations";
import { newId } from "./ids";
import { parseDirectoryBuffer, parseLine } from './parser';
import { appendOrAdd } from './utils';
import { optimize } from './optimizations';
import { executeFileOperation } from './execute';

/*
 * TODO: Fix directory update checks
 * TODO: Actually update files on commit
 * TODO: Enable copies
 * TODO: Confirm changes
 * TODO: Auto fix duplicate names
 * TODO: Error handling
 */

let namespaceId = 0;
let initialState = new Map<string, string>();
let currentState = new Map<string, string[]>();
let directoryLookup = new Map<string, Directory>();

let operationList: Map<string, Map<string, FileOperation[]>>[] = [];

function reset() {
  initialState = new Map<string, string>();
  currentState = new Map<string, string[]>();
  directoryLookup = new Map<string, Directory>();

  operationList = [];
}

async function tempBuffer(nvim: Neovim, name: string, lines: string[] = [], fileType = "balsamic") {
  nvim.callAtomic([
    await nvim.command("enew"),
    await nvim.buffer.setOption("buftype", "nofile"), // Ensure the buffer won't be written to disk
    await nvim.buffer.setOption("bufhidden", "wipe"), // Close the buffer when done
    await nvim.buffer.setOption("ft", fileType), // Set file type to balsamic or filetype
    await nvim.command("setlocal noswapfile"),
    await nvim.command("0f"),
    await nvim.command(`file ${name.replace(/\\/g, "/")}`), // Change buffer name to match the current file
    await nvim.buffer.setLines(lines, { start: 0, end: -1, strictIndexing: false })
  ]);
  return nvim.buffer;
}

async function createDirectoryBuffer(nvim: Neovim, fullDirectoryPath: string) {
  let lines: string[];
  if (directoryLookup.has(fullDirectoryPath)) {
    lines = directoryLookup.get(fullDirectoryPath).lines;
  } else {
    let files = getFiles(fullDirectoryPath);
    lines = [];

    for (let file of files) {
      let id = newId();
      initialState.set(id, file);
      currentState.set(id, [file]);
      lines.push(itemToLine(file, id));
    }

    directoryLookup.set(fullDirectoryPath, { fullDirectoryPath, lines });
  }

  let buffer = await tempBuffer(nvim, fullDirectoryPath, lines)
  await nvim.command(`lcd ${fullDirectoryPath}`); // Set the buffer location

  buffer.listen("lines", async () => {
    let directory = directoryLookup.get(fullDirectoryPath);
    directory.lines = await buffer.lines;
    directoryLookup.set(fullDirectoryPath, directory);
    recordChanges();
  });
}

function recordChanges() {
  let updatedLookup = parseDirectoryBuffer(directoryLookup);
  let newOperationsById = new Map<string, Map<string, FileOperation[]>>();

  for (let id of currentState.keys()) {
    let newOperations = new Map<string, FileOperation[]>();
    let currentItems = currentState.get(id);
    if (updatedLookup.has(id)) {
      let newItems = updatedLookup.get(id);
      for (let newItem of newItems) {
        let matchingItem = currentItems.find(currentItem => currentItem === newItem);
        if (!matchingItem) {
          appendOrAdd(newOperations, currentItems[0], Copy(newItem));
        }
      }

      for (let currentItem of currentItems) {
        let matchingNewItem = newItems.find(newItem => newItem === currentItem);
        if (!matchingNewItem) {
          appendOrAdd(newOperations, currentItem, Cut());
        }
      }
    } else {
      for (let currentItem of currentItems) {
        appendOrAdd(newOperations, currentItem, Cut());
      }
    }

    if (newOperations.size != 0) {
      newOperationsById.set(id, newOperations);
    }
  }

  for (let id of updatedLookup.keys()) {
    if (!currentState.has(id)) {
      let operationsByItem = new Map<string, FileOperation[]>();
      if (newOperationsById.has(id)) {
        operationsByItem = newOperationsById.get(id);
      }

      let updatedItems = updatedLookup.get(id);
      for (let updatedItem of updatedItems) {
        appendOrAdd(operationsByItem, updatedItem, New());
      }

      if (operationsByItem.size != 0) {
        newOperationsById.set(id, operationsByItem);
      }
    }
  }

  if (newOperationsById.size != 0) {
    operationList.push(newOperationsById);
  }

  currentState = updatedLookup;
}

async function commitChanges(nvim: Neovim) {
  let lines = [];
  let groupNumber = 1;

  operationList = optimize(operationList);

  for (let group of operationList) {
    lines.push("Command Group " + groupNumber);
    groupNumber++;
    for (let id of group.keys()) {
      let operationsByItem = group.get(id);
      for (let item of operationsByItem.keys()) {
        let operations = operationsByItem.get(item);
        for (let operation of operations) {
          lines.push("  " + operationToString(id, item, operation));
        }
      }
    }
  }
  tempBuffer(nvim, "commands", lines, "balsamic-commit");

  reset();
}

async function executeOperations(nvim: Neovim) {
  let lines = await nvim.buffer.lines;
  let executables = Array.from(lines
    .map(parseOperationString));

  let newFiles = [];

  for (let i = 0; i < executables.length; i++) {
    let executable = executables[i];
    if (!executable) continue;
    try {
      executeFileOperation(executable);
      if (executable.type === FileOperations.New) {
        newFiles.push(executable.fullPath);
      }
      namespaceId = await nvim.buffer.setVirtualText(namespaceId, i, [["DONE", "Comment"]]);
    } catch (err) {
      namespaceId = await nvim.buffer.setVirtualText(namespaceId, i, [["Something went wrong: " + JSON.stringify(err), "WarningMsg"]]);
      return;
    }
  }

  for (let newFile of newFiles) {
    if (!itemIsDirectory(newFile)) {
      await nvim.command("vs " + newFile);
    }
  }
}

@Plugin({ dev: false })
export default class BalsamicPlugin {
  constructor(public nvim: Neovim) {  }

  @Command("Balsamic")
  async openParent() {
    const fullFilePath = await this.nvim.commandOutput("echo expand('%:p')") // Query the current file directory path
    const fullDirectoryPath = path.resolve(path.join(fullFilePath, '..'));
    createDirectoryBuffer(this.nvim, fullDirectoryPath);
  }

  @Command("BalsamicOpen")
  async openCurrentLine() {
    let line = await this.nvim.getLine();
    let parsedLine = parseLine(line);
    if (parsedLine) {
      let { name } = parsedLine;
      let fullDirectoryPath = await this.nvim.commandOutput("pwd");

      if (name.endsWith("\\")) {
        createDirectoryBuffer(this.nvim, path.join(fullDirectoryPath, name));
      } else {
        this.nvim.command(`e ${name}`);
      }
    }
  }

  @Command("BalsamicCommit")
  balsamicCommit() {
    commitChanges(this.nvim);
  }

  @Command("BalsamicExecute")
  balsamicExecute() {
    executeOperations(this.nvim)
  }
}
