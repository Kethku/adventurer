import { FileOperation, FileOperations, ICopy, IDelete, Move, IMove } from "./operations";
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
        let deleteOperation: IDelete = null;

        for (let operation of operations) {
          if (operation.type === FileOperations.Copy) {
            copyOperation = operation;
          } else if (operation.type === FileOperations.Delete) {
            deleteOperation = operation;
          }
        }

        if (copyOperation && deleteOperation) {
          operations = operations.filter(operation => operation !== copyOperation && operation !== deleteOperation);
          operations.push(Move(copyOperation.destination));
        }

        operationsByItem.set(item, operations);
      }
    }
  }
}

/**
 * Loop over every operation group and merge consecutive moves.
 */
function mergeMoves(operations: Map<string, Map<Item, FileOperation[]>>[]) {
  let resultingOperations: Map<string, Map<Item, FileOperation[]>>[] = [];

  function getSingleMove(group: Map<string, Map<Item, FileOperation[]>>) {
    if (group.size == 1) {
      let operationsByItem = group.get(group.keys().next().value);
      if (operationsByItem.size == 1) {
        let item = operationsByItem.keys().next().value as Item;
        let operations = operationsByItem.get(item);
        if (operations.length == 1 && operations[0].type === FileOperations.Move) {
          let operation = operations[0] as IMove;
          return { item, operation };
        }
      }
    }
    return null;
  }

  do {
    let nextGroup = operations.shift();
    resultingOperations.push(nextGroup);

    let move = getSingleMove(nextGroup);
    if (move) {
      do {
        let nextNextGroup = operations.shift();
        let nextMove = getSingleMove(nextNextGroup);
        if (nextMove && move.operation.destination === nextMove.item.fullPath) {
          move.operation.destination = nextMove.operation.destination;
        } else {
          resultingOperations.push(nextNextGroup);
          break;
        }
      } while (operations.length > 0);
    }
  } while (operations.length > 1);

  if (operations.length != 0) {
    resultingOperations.push(operations.shift());
  }

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
