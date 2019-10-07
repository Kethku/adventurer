import * as fs from "fs";
import * as path from "path";

export interface Item {
  name: string;
  fullPath: string;
} 

export interface Directory {
  fullDirectoryPath: string;
  lines: string[];
}

export function generateSuffix(isDir: boolean) {
  return isDir ? "\\" : "";
}

export function itemToString(item: Item, id: string) {
  return id + ":" + item.name;
}

export function itemIsDirectory(item: Item) {
  return nameIsDirectory(item.name);
}

export function nameIsDirectory(name: string) {
  return name.endsWith("\\") || name.endsWith("/");
}

export function getFiles(directory: string) {
  function isDirectory(file: string) {
    return fs.lstatSync(file).isDirectory();
  }

  if (fs.existsSync(directory)) {
    let files = fs.readdirSync(directory).map(name => { 
      try {
        let fullPath = path.resolve(path.join(directory, name));
        let isDir = isDirectory(fullPath);
        return { 
          name: name + generateSuffix(isDir), 
          fullPath 
        };
      } catch {
        return null;
      }
    }).filter(file => file);

    return files.filter(file => itemIsDirectory(file)).concat(files.filter(file => !itemIsDirectory(file)));
  } else {
    return [];
  }
}
