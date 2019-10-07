import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import {ExecutableFileOperation, FileOperations} from './operations';

let tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), "balsamic-"));
process.on('exit', function () {
  fs.removeSync(tempDirPath);
});

export function executeFileOperation(operation: ExecutableFileOperation) {
  switch (operation.type) {
    case FileOperations.New:
      if (operation.isDirectory) {
        fs.mkdir(operation.fullPath);
      } else {
        fs.closeSync(fs.openSync(operation.fullPath, 'w'));
      }
      break;
    case FileOperations.Copy:
      fs.copySync(operation.sourceFullPath, operation.destinationFullPath);
      break;
    case FileOperations.Cut:
      fs.moveSync(operation.fullPath, path.join(tempDirPath, operation.id));
      break;
    case FileOperations.Paste:
      fs.moveSync(path.join(tempDirPath, operation.id), operation.fullPath);
      break;
    case FileOperations.Delete:
      fs.removeSync(operation.fullPath);
      break;
    case FileOperations.Move:
      fs.moveSync(operation.fromFullPath, operation.destinationFullPath);
      break;
  }
}
