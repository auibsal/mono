const START = /^\s*(?:\/\/|#|\{\/\*)\s*<module:([a-z0-9-]+)>\s*(?:\*\/\})?\s*$/;
const END = /^\s*(?:\/\/|#|\{\/\*)\s*<\/module:([a-z0-9-]+)>\s*(?:\*\/\})?\s*$/;

export class MarkerError extends Error {}

/**
 * Removes the blocks of every module in `remove` (markers included) and the
 * marker lines of every kept module, leaving plain code behind.
 */
export const stripModuleBlocks = (
  content: string,
  remove: ReadonlySet<string>,
  file = "<input>"
) => {
  const lines = content.split("\n");
  const output: string[] = [];
  const open: { id: string; line: number }[] = [];
  const modules = new Set<string>();

  for (const [index, line] of lines.entries()) {
    const start = START.exec(line);
    const end = END.exec(line);

    if (start?.[1]) {
      open.push({ id: start[1], line: index + 1 });
      modules.add(start[1]);
      continue;
    }

    if (end?.[1]) {
      const last = open.pop();
      if (last?.id !== end[1]) {
        throw new MarkerError(
          `${file}:${index + 1}: </module:${end[1]}> does not close ${
            last ? `<module:${last.id}> from line ${last.line}` : "any block"
          }`
        );
      }
      continue;
    }

    if (!open.some((block) => remove.has(block.id))) {
      output.push(line);
    }
  }

  const unclosed = open.at(-1);
  if (unclosed) {
    throw new MarkerError(
      `${file}:${unclosed.line}: <module:${unclosed.id}> is never closed`
    );
  }

  return {
    changed: output.length !== lines.length,
    content: output.join("\n"),
    modules,
  };
};
