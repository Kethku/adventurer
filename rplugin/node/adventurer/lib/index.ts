import * as fs from "fs";
import * as path from "path";

import { Neovim, Plugin, Command } from "neovim";

/*
 * TODO: Fix directory update checks
 * TODO: Actually update files on commit
 * TODO: Enable copies
 * TODO: Confirm changes
 * TODO: Auto fix duplicate names
 * TODO: Error handling
 */

interface Item {
  name: string;
  fullPath: string;
  isDir: boolean;
} 

let currentFileId = 1;
let fileLookup = new Map<number, Item>();

interface Adventure {
  fullDirectoryPath: string;
  lines: string[];
}

let adventureLookup = new Map<string, Adventure>();

enum FileUpdates {
  New,
  Rename,
  Copy,
  Move,
  Delete
}

interface IOperation {
  type: FileUpdates;
  item: Item;
}

interface INew {
  type: FileUpdates.New,
  item: Item
}

interface IRename extends IOperation {
  type: FileUpdates.Copy;
  newName: string;
}

interface ICopy extends IOperation {
  type: FileUpdates.Copy;
  destination: string;
}

interface IMove extends IOperation {
  type: FileUpdates.Move;
  destination: string;
}

interface IDelete extends IOperation {
  type: FileUpdates.Delete,
}

type FileOperation = INew | IRename | ICopy | IMove | IDelete;

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
    fileLookup.set(id, item);
    return item;
  });

  let idLength = (currentFileId - 1).toString().length;

  let directories = items
    .filter(item => item.isDir)
    .map(dir => dir.id.toString().padEnd(idLength) + ":" + dir.name + "/");
  let files = items
    .filter(item => !item.isDir)
    .map(file => file.id.toString().padEnd(idLength) + ":" + file.name);
  
  return directories.concat(files);
}

async function createDirectoryBuffer(nvim: Neovim) {
  const fullFilePath = path.resolve(await nvim.commandOutput("echo expand('%:p')")) // Query the current file directory path
  const fullDirectoryPath = path.resolve(path.join(fullFilePath, '..'));

  let lines: string[];
  if (adventureLookup.has(fullDirectoryPath)) {
    lines = adventureLookup.get(fullDirectoryPath).lines;
  } else {
    lines = getFiles(fullDirectoryPath);
    adventureLookup.set(fullDirectoryPath, { fullDirectoryPath, lines });
  }

  await nvim.command("enew");
  const buffer = nvim.buffer;


  await nvim.command(`lcd ${fullDirectoryPath}`); // Set the buffer location
  await buffer.setOption("buftype", "nofile"); // Ensure the buffer won't be written to disk
  await buffer.setOption("bufhidden", "wipe"); // Close the buffer when done
  nvim.command(`file ${fullDirectoryPath}`); // Change buffer name to match the current file and type
  await nvim.buffer.setLines(lines, { start: 0, end: -1, strictIndexing: false });

  buffer.listen("lines", async () => {
    let adventure = adventureLookup.get(fullDirectoryPath);
    adventure.lines = await buffer.lines;
    adventureLookup.set(fullDirectoryPath, adventure);
  });
}

async function commitChanges(nvim: Neovim) {
  let updatedLookup = new Map<number, Item[]>();
  function addUpdatedItem(id: number, item: Item) {
    if (updatedLookup.has(id)) {
      updatedLookup.get(id).push(item);
    } else {
      updatedLookup.set(id, [item]);
    }
  }

  let newItems: Item[] = [];

  for (let adventure of adventureLookup.values()) {
    for (let line of adventure.lines) {
      let splitIndex = line.indexOf(":");
      if (splitIndex != -1) {
        let id = parseInt(line.substring(0, splitIndex).trim());
        let name = line.substring(splitIndex + 1);
        let fullPath = path.join(adventure.fullDirectoryPath, name);
        let isDir = false;

        if (name.endsWith("/")) {
          name = name.substring(0, name.length - 1);
          isDir = true;
        }

        addUpdatedItem(id, {
          name, fullPath, isDir
        });
      } else {
        // TODO: Extract repeated code
        let name = line.trim();
        let fullPath = path.join(adventure.fullDirectoryPath, name);
        let isDir = false;

        if (name.endsWith("/")) {
          name = name.substring(0, name.length - 1);
          isDir = true;
        }

        newItems.push({
          name, fullPath, isDir
        });
      }
    }
  }

  await nvim.command("enew");
  for (let id of fileLookup.keys()) {
    let item = fileLookup.get(id);
    if (updatedLookup.has(id)) {
      let newItems = updatedLookup.get(id);
      for (let newItem of newItems) {
        if (item.fullPath !== newItem.fullPath) {
          await nvim.buffer.append(`${item.fullPath} => ${newItem.fullPath}`);
        }
      }
    } else {
      await nvim.buffer.append(`${item.fullPath} => DELETED`);
    }
  }

  for (let newItem of newItems) {
    await nvim.buffer.append(`${newItem.fullPath} => NEW`);
  }

  currentFileId = 0;
  fileLookup.clear();
  adventureLookup.clear();
}

@Plugin({ dev: false })
export default class AdventurerPlugin {
  constructor(public nvim: Neovim) {  }

  @Command("AdvCommit")
  async advCommit() {
    commitChanges(this.nvim);
  }

  @Command("Adventurer")
  async adventurer() {
    createDirectoryBuffer(this.nvim);
  }
}
