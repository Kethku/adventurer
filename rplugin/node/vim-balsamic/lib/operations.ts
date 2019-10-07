import { Item, itemIsDirectory, nameIsDirectory } from "./files";

export enum FileOperations {
  // Recognizable operations
  New,
  Copy,
  Cut,
  // Optimized operations
  Paste,
  Delete,
  Move
}

export interface IOperation {
  type: FileOperations;
}

export interface INew extends IOperation {
  type: FileOperations.New,
}

export function New() : INew {
  return {
    type: FileOperations.New
  };
}

export interface IExecutableNew {
  type: FileOperations.New;
  fullPath: string;
  isDirectory: boolean;
}

export interface ICopy extends IOperation {
  type: FileOperations.Copy;
  destination: string;
}

export function Copy(destination: string) : ICopy {
  return {
    type: FileOperations.Copy,
    destination
  };
}

export interface IExecutableCopy {
  type: FileOperations.Copy;
  sourceFullPath: string;
  destinationFullPath: string;
}

export interface ICut extends IOperation {
  type: FileOperations.Cut;
}

export function Cut() : ICut {
  return {
    type: FileOperations.Cut
  }
}

export interface IExecutableCut {
  type: FileOperations.Cut;
  fullPath: string;
  id: string;
}

export interface IPaste extends IOperation {
  type: FileOperations.Paste;
}

export function Paste() : IPaste {
  return {
    type: FileOperations.Paste,
  };
}

export interface IExecutablePaste {
  type: FileOperations.Paste;
  fullPath: string;
  id: string;
}

export interface IDelete extends IOperation {
  type: FileOperations.Delete,
}

export function Delete() : IDelete {
  return {
    type: FileOperations.Delete
  };
}

export interface IExecutableDelete {
  type: FileOperations.Delete;
  fullPath: string;
}

export interface IMove extends IOperation {
  type: FileOperations.Move,
  destination: string
}

export function Move(destination: string) : IMove {
  return {
    type: FileOperations.Move,
    destination
  };
}

export interface IExecutableMove {
  type: FileOperations.Move;
  fromFullPath: string;
  destinationFullPath: string;
}

export type FileOperation = INew | ICopy | ICut | IPaste | IDelete | IMove;

function itemToString(item: Item) {
  return item.fullPath + (itemIsDirectory(item) ? "\\" : "");
}

export function operationToString(id: string, item: Item, operation: FileOperation) {
  switch (operation.type) {
    case FileOperations.New:
      return `NEW ${itemToString(item)}`;
    case FileOperations.Copy:
      return `COPY ${itemToString(item)} => ${operation.destination}`;
    case FileOperations.Cut:
      return `CUT ${id}:${itemToString(item)}`;
    case FileOperations.Paste:
      return `PASTE ${id}:${itemToString(item)}`;
    case FileOperations.Delete:
      return `DELETE ${itemToString(item)}`;
    case FileOperations.Move:
      return `MOVE ${itemToString(item)} => ${operation.destination}`;
  }
}

export type ExecutableFileOperation = IExecutableNew | IExecutableCopy | IExecutableCut | IExecutablePaste | IExecutableDelete | IExecutableMove;

export function parseOperationString(line: string) : ExecutableFileOperation {
  line = line.trim();
  if (line.startsWith("NEW")) {
    let rest = line.substr(3).trim();
    return {
      type: FileOperations.New,
      fullPath: rest,
      isDirectory: nameIsDirectory(rest)
    };
  } else if (line.startsWith("COPY")) {
    let [ source, destination ] = line.substr(4).split(" => ").map(part => part.trim());
    return {
      type: FileOperations.Copy,
      sourceFullPath: source,
      destinationFullPath: destination
    };
  } else if (line.startsWith("CUT")) {
    let [ id, ...pathParts ] = line.substr(3).split(":").map(part => part.trim());
    let fullPath = pathParts.join(":");
    return {
      type: FileOperations.Cut,
      id, fullPath
    };
  } else if (line.startsWith("PASTE")) {
    let [ id, ...pathParts ] = line.substr(5).split(":").map(part => part.trim());
    let fullPath = pathParts.join(":");
    return {
      type: FileOperations.Paste,
      id, fullPath
    };
  } else if (line.startsWith("DELETE")) {
    let rest = line.substr(6).trim();
    return {
      type: FileOperations.Delete,
      fullPath: rest.trim(),
    };
  } else if (line.startsWith("MOVE")) {
    let [ from, destination ] = line.substr(4).split(" => ").map(part => part.trim());
    return {
      type: FileOperations.Move,
      fromFullPath: from,
      destinationFullPath: destination
    };
  } else {
    return null;
  }
}
