import * as fs from "fs";
import * as path from "path";

export interface Directory {
  fullDirectoryPath: string;
  lines: string[];
}

export function generateSuffix(isDir: boolean) {
  return isDir ? "\\" : "";
}

export function itemIsDirectory(item: string) {
  return item.endsWith("\\") || item.endsWith("/");
}

export function getName(item: string) {
  return path.parse(item).base + generateSuffix(itemIsDirectory(item));
}

export function itemToLine(item: string, id: string) {
  return id + ":" + getName(item);
}

export function pathToItem(fullPath: string) {
  function isDirectory(file: string) {
    return fs.lstatSync(file).isDirectory();
  }

  try {
    let isDir = isDirectory(fullPath);
    return fullPath + generateSuffix(isDir);
  } catch {
    return null;
  }
}

export function getFiles(directory: string) {

  if (fs.existsSync(directory)) {
    let files = fs.readdirSync(directory).map(name => { 
      let fullPath = path.resolve(path.join(directory, name));
      return pathToItem(fullPath);
    }).filter(file => file);

    return files.filter(file => itemIsDirectory(file)).concat(files.filter(file => !itemIsDirectory(file)));
  } else {
    return [];
  }
}
