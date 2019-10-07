import { FileOperation, FileOperations, ICopy, ICut, Move, IMove } from "./operations";
import { Item } from './files';

/**
 * Merge copy deletes into move operations.
 */
function createMoves(operationGroups: Map<string, Map<Item, FileOperation[]>>[]) {
  for (let group of operationGroups) {
    for (let id of group.keys()) {
      let operationsByItem = group.get(id);

      for (let item of operationsByItem.keys()) {
        let operations = operationsByItem.get(item);

        let copyOperation: ICopy = null;
        let cutOperation: ICut = null;

        for (let operation of operations) {
          if (operation.type === FileOperations.Copy) {
            copyOperation = operation;
          } else if (operation.type === FileOperations.Cut) {
            cutOperation = operation;
          }
        }

        if (copyOperation && cutOperation) {
          operations = operations.filter(operation => operation !== copyOperation && operation !== cutOperation);
          operations.push(Move(copyOperation.destination));
        }

        operationsByItem.set(item, operations);
      }
    }
  }
}

function mergeConsecutiveMoves(firstGroup: Map<string, Map<Item, FileOperation[]>>, secondGroup: Map<string, Map<Item, FileOperation[]>>) {
  let idsToDelete: string[] = [];
  for (let id of firstGroup.keys()) {
    let firstOperationsByItem = firstGroup.get(id);
    let itemsToDelete: Item[] = [];
    if (secondGroup.has(id)) {
      let secondOperationsByItem = secondGroup.get(id);

      if (firstOperationsByItem.size != 1 || secondOperationsByItem.size != 1) continue;
      let firstItem = firstOperationsByItem.keys().next().value as Item;
      let firstOperations = firstOperationsByItem.get(firstItem);
      let secondItem = secondOperationsByItem.keys().next().value as Item;
      let secondOperations = secondOperationsByItem.get(secondItem);

      if (firstOperations.length != 1 || secondOperations.length != 1) continue;
      let firstOperation = firstOperations[0];
      let secondOperation = secondOperations[0];

      if (secondOperation.type === FileOperations.Move) {
        if (firstOperation.type === FileOperations.New && firstItem.fullPath === secondItem.fullPath) {
          itemsToDelete.push(firstItem);
          secondItem.fullPath = secondOperation.destination;
          secondOperations[0] = { type: FileOperations.New }; // Change second operation to a new
        }

         
        if (firstOperation.type === FileOperations.Move && firstOperation.destination === secondItem.fullPath) {
          itemsToDelete.push(firstItem);
          secondItem.fullPath = firstItem.fullPath;
        }
      }
    }

    for (let itemToDelete of itemsToDelete) {
      firstOperationsByItem.delete(itemToDelete);
    }

    if (firstOperationsByItem.size === 0) {
      idsToDelete.push(id);
    }
  }

  for (let idToDelete of idsToDelete) {
    firstGroup.delete(idToDelete);
  }
}

/**
 * Loop over every operation group and merge consecutive moves.
 */
function mergeMoves(operations: Map<string, Map<Item, FileOperation[]>>[]) {
  if (operations.length < 2) return operations;

  let resultingOperations: Map<string, Map<Item, FileOperation[]>>[] = [];

  let first: Map<string, Map<Item, FileOperation[]>> = null;
  let second = operations.shift();
  do {
    if (first) resultingOperations.push(first);
    first = second;
    second = operations.shift();

    mergeConsecutiveMoves(first, second);
    if (first.size == 0) first = null;
  } while (operations.length != 0);
  resultingOperations.push(second);

  return resultingOperations;
}

/**
 * Turn new operations into pastes if id was previously cut.
 */
export function convertNewsToPastes(operationsById: Map<string, Map<Item, FileOperation[]>>[]) {
  // For each id which contains a new operation, if there was a cut before it with the same id, 
  // convert the new to a paste.

  let wasCutLookup = new Set<string>();

  for (let group of operationsById) {
    for (let id of group.keys()) {
      let operations = [].concat(...group.get(id).values());
      for (let operation of operations) {
        if (operation.type === FileOperations.Cut) {
          wasCutLookup.add(id);
        }

        if (operation.type === FileOperations.New &&
            wasCutLookup.has(id)) {
          operation.type = FileOperations.Paste;
        }
      }
    }
  }
}

/**
 * Turn unused cuts into deletes.
 */
export function convertCutsToDeletes(operationsById: Map<string, Map<Item, FileOperation[]>>[]) {
  // For each id which contains a cut operation, if after the cut there exist no new operation for 
  // that id, convert the cut to a delete.

  let wasPastedLookup = new Set<string>();

  for (let group of [...operationsById].reverse()) {
    for (let id of group.keys()) {
      let operations = [].concat(...group.get(id).values());
      for (let operation of operations) {
        if (operation.type === FileOperations.Paste) {
          wasPastedLookup.add(id);
        }

        if (operation.type === FileOperations.Cut &&
            !wasPastedLookup.has(id)) {
          operation.type = FileOperations.Delete;
        }
      }
    }
  }
}

export function optimize(operations: Map<string, Map<Item, FileOperation[]>>[]) {
  createMoves(operations);
  convertNewsToPastes(operations);
  convertCutsToDeletes(operations);

  return mergeMoves(operations);
}
