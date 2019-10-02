import * as fs from "fs";
import * as path from "path";

import { Neovim, Plugin, Command } from "neovim";

import { FileOperation, New, Copy, Delete, operationToString } from "./operations";

/*
 * TODO: Fix directory update checks
 * TODO: Actually update files on commit
 * TODO: Enable copies
 * TODO: Confirm changes
 * TODO: Auto fix duplicate names
 * TODO: Error handling
 */

export interface Item {
  name: string;
  fullPath: string;
  isDir: boolean;
} 

interface Directory {
  fullDirectoryPath: string;
  lines: string[];
}

let currentFileId = 1;
let fileLookup = new Map<number, Item[]>();
let currentState = new Map<number, Item[]>();
let directoryLookup = new Map<string, Directory>();

let operationList: FileOperation[][] = [];

async function tempBuffer(nvim: Neovim, name: string, lines: string[] = []) {
  await nvim.command("enew");
  const buffer = nvim.buffer;
  await buffer.setOption("buftype", "nofile"); // Ensure the buffer won't be written to disk
  await buffer.setOption("bufhidden", "wipe"); // Close the buffer when done
  await buffer.setLines(lines, { start: 0, end: -1, strictIndexing: false });
  await nvim.command(`file ${name}`); // Change buffer name to match the current file
  return buffer;
}

function itemToString(item: Item, id: number, idLength: number = 0) {
  let sufix = item.isDir ? "\\" : "";
  return id.toString().padStart(idLength, "0") + ":" + item.name + sufix;
}

function getFiles(directory: string) {
  function isDirectory(file: string) {
    return fs.lstatSync(file).isDirectory();
  }

  const items = fs.readdirSync(directory).map(name => { 
    let id = currentFileId;
    currentFileId += 1;
    let fullPath = path.resolve(path.join(directory, name));
    let isDir = isDirectory(fullPath);
    let item = { name, fullPath, id, isDir };
    fileLookup.set(id, [item]);
    return item;
  });

  let idLength = (currentFileId - 1).toString().length;

  return items.filter(item => item.isDir)
    .concat(items.filter(item => !item.isDir))
    .map(item => itemToString(item, item.id, idLength));
}

async function createDirectoryBuffer(fullDirectoryPath: string, nvim: Neovim) {
  let lines: string[];
  if (directoryLookup.has(fullDirectoryPath)) {
    lines = directoryLookup.get(fullDirectoryPath).lines;
  } else {
    lines = getFiles(fullDirectoryPath);
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
  let updatedLookup = new Map<number, Item[]>();
  function addUpdatedItem(id: number, item: Item) {
    if (updatedLookup.has(id)) {
      updatedLookup.get(id).push(item);
    } else {
      updatedLookup.set(id, [item]);
    }
  }

  for (let directory of directoryLookup.values()) {
    for (let line of directory.lines) {
      line = line.trim();
      if (line.length != 0) {
        let splitIndex = line.indexOf(":");
        let id = -1;
        let name = line;

        if (splitIndex != -1) {
          id = parseInt(line.substring(0, splitIndex).trim());
          name = line.substring(splitIndex + 1).trim();
        }

        let fullPath = path.join(directory.fullDirectoryPath, name);
        let isDir = false;

        if (name.endsWith("/")) {
          name = name.substring(0, name.length - 1);
          isDir = true;
        }

        addUpdatedItem(id, {
          name, fullPath, isDir
        });
      }
    }
  }

  let newOperations: FileOperation[] = [];

  for (let id of fileLookup.keys()) {
    let currentItems = fileLookup.get(id);
    if (updatedLookup.has(id)) {
      let newItems = updatedLookup.get(id);
      for (let newItem of newItems) {
        let matchingItem = currentItems.find(currentItem => currentItem.fullPath === newItem.fullPath);
        if (!matchingItem) {
          newOperations.push(Copy(currentItems[0], newItem.fullPath));
        }
      }

      for (let currentItem of currentItems) {
        let matchingNewItem = newItems.find(newItem => newItem.fullPath === currentItem.fullPath);
        if (!matchingNewItem) {
          newOperations.push(Delete(currentItem));
        }
      }
    } else {
      for (let currentItem of currentItems) {
        newOperations.push(Delete(currentItem));
      }
    }
  }

  for (let id of updatedLookup.keys()) {
    if (!fileLookup.has(id)) {
      let updatedItems = updatedLookup.get(id);
      for (let updatedItem of updatedItems) {
        newOperations.push(New(updatedItem));
      }
    }
  }

  if (newOperations.length != 0) {
    operationList.push(newOperations);
  }

  fileLookup = updatedLookup;
}

async function commitChanges(nvim: Neovim) {
  let lines = [];
  let groupNumber = 1;
  for (let group of operationList) {
    lines.push("Command Group " + groupNumber);
    groupNumber++;
    for (let operation of group) {
      lines.push("  " + operationToString(operation));
    }
  }
  tempBuffer(nvim, "commands", lines);
  operationList = [];
}

@Plugin({ dev: false })
export default class BalsamicPlugin {
  constructor(public nvim: Neovim) {  }

  @Command("BalsamicCommit")
  async balsamicCommit() {
    commitChanges(this.nvim);
  }

  @Command("Balsamic")
  async balsamic() {
    const fullFilePath = path.resolve(await this.nvim.commandOutput("echo expand('%:p')")) // Query the current file directory path
    const fullDirectoryPath = path.resolve(path.join(fullFilePath, '..'));
    createDirectoryBuffer(fullDirectoryPath, this.nvim);
  }
}
