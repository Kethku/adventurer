const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
const characterCount = characters.length;

let previousIds = new Set<string>();

export function newId() {
  let id: string;
  do {
    id = "";
    for (let i = 0; i < 5; i++) {
      id += characters.charAt(Math.floor(Math.random() * characterCount));
    }
  } while (previousIds.has(id));

  return id;
}
