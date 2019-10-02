import { Item } from ".";

export enum FileOperations {
  New,
  Copy,
  Delete
}

export interface IOperation {
  type: FileOperations;
  item: Item;
}

export interface INew extends IOperation {
  type: FileOperations.New,
}

export function New(item: Item) : INew {
  return {
    type: FileOperations.New,
    item
  };
}

export interface ICopy extends IOperation {
  type: FileOperations.Copy;
  destination: string;
}

export function Copy(item: Item, destination: string) : ICopy {
  return {
    type: FileOperations.Copy,
    item,
    destination
  };
}

export interface IDelete extends IOperation {
  type: FileOperations.Delete,
}

export function Delete(item: Item) : IDelete {
  return {
    type: FileOperations.Delete,
    item
  };
}

export type FileOperation = INew | ICopy | IDelete;

function itemToString(item: Item) {
  return item.fullPath + (item.isDir ? "\\" : "");
}

export function operationToString(operation: FileOperation) {
  switch (operation.type) {
    case FileOperations.New:
      return `NEW: ${itemToString(operation.item)}`;
    case FileOperations.Delete:
      return `DELETE: ${itemToString(operation.item)}`;
    case FileOperations.Copy:
      return `COPY: ${itemToString(operation.item)} => ${operation.destination}`;
  }
}
