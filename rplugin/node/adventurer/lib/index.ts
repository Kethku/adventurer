import { Neovim, NvimPlugin } from "neovim";

let plugin: NvimPlugin;
let nvim: Neovim;

async function newAdventurerBuffer() {
  await nvim.command("vnew");
  nvim.outWriteLine("adventure is waiting");
}

export = function (injectedPlugin: NvimPlugin) {
  plugin = injectedPlugin;
  nvim = plugin.nvim;

  plugin.registerCommand('Adventurer', newAdventurerBuffer);

  const options = {
    dev: true,
    alwaysInit: true
  }
  plugin.setOptions(options);
}
