import * as fs from "fs";
import * as path from "path";

export interface Item {
  name: string;
  fullPath: string;
  isDir: boolean;
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

export function getFiles(directory: string) {
  function isDirectory(file: string) {
    return fs.lstatSync(file).isDirectory();
  }

  let files = fs.readdirSync(directory).map(name => { 
    let fullPath = path.resolve(path.join(directory, name));
    let isDir = isDirectory(fullPath);
    return { 
      name: name + generateSuffix(isDir), 
      fullPath, isDir 
    };
  });

  return files.filter(file => file.isDir).concat(files.filter(file => !file.isDir));
}
