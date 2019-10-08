import * as path from "path";

import { Directory, pathToItem } from "./files";

export function parseLine(line: string) {
  line = line.trim();
  if (line.length != 0) {
    let splitIndex = line.indexOf(":");
    let id = "new";
    let name = line;

    if (splitIndex != -1) {
      id = line.substring(0, splitIndex).trim();
      name = line.substring(splitIndex + 1).trim();
    }

    return { id, name };
  }
  return null;
}

export function parseDirectoryBuffer(directoryLookup: Map<string, Directory>) {
  let updatedLookup = new Map<string, string[]>();
  function addUpdatedItem(id: string, item: string) {
    if (updatedLookup.has(id)) {
      updatedLookup.get(id).push(item);
    } else {
      updatedLookup.set(id, [item]);
    }
  }

  for (let directory of directoryLookup.values()) {
    for (let line of directory.lines) {
      let parsedLine = parseLine(line);
      if (parsedLine) {
        let { id, name } = parsedLine;
        let fullPath = path.join(directory.fullDirectoryPath, name);
        addUpdatedItem(id, fullPath);
      }
    }
  }

  return updatedLookup;
}
