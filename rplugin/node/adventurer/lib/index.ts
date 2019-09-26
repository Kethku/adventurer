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
  id: number;
  isDir: boolean;
} 

let currentFileId = 1;
let fileLookup = new Map<number, Item>();

interface Adventure {
  fullDirectoryPath: string;
  lines: string[];
}

let adventureLookup = new Map<string, Adventure>();

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
  let newLookup = new Map<number, Item>();
  let newIds = new Set<number>();

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

        newLookup.set(id, {
          id, name, fullPath, isDir
        });

        if (!fileLookup.has(id)) {
          newIds.add(id);
        }
      }
    }
  }

  await nvim.command("enew");
  for (let item of fileLookup.values()) {
    if (newLookup.has(item.id)) {
      let newItem = newLookup.get(item.id);
      if (item.fullPath !== newItem.fullPath) {
        await nvim.buffer.append(`${item.fullPath} => ${newItem.fullPath}`);
      }
    } else {
      await nvim.outWriteLine(`${item.fullPath} => DELETED`);
    }
  }

  for (let newId of newIds) {
    let newItem = newLookup.get(newId);
    await nvim.outWriteLine(`${newItem.fullPath} => NEW`);
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
