import process from 'node:process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

interface MakeDirectoryOptions {
  mode?: number;
  fs?: typeof fs;
}

const checkPath = (pth: string): void => {
  if (process.platform === 'win32') {
    const pathHasInvalidWinCharacters = /[<>:"|?*]/.test(
      pth.replace(path.parse(pth).root, ''),
    );

    if (pathHasInvalidWinCharacters) {
      const error = new Error(
        `Path contains invalid characters: ${pth}`,
      ) as NodeJS.ErrnoException;
      error.code = 'EINVAL';
      throw error;
    }
  }
};

const processOptions = (
  options?: MakeDirectoryOptions,
): Required<MakeDirectoryOptions> => {
  return {
    mode: 0o777,
    fs,
    ...options,
  };
};

const permissionError = (pth: string): NodeJS.ErrnoException => {
  const error = new Error(
    `operation not permitted, mkdir '${pth}'`,
  ) as NodeJS.ErrnoException;
  error.code = 'EPERM';
  error.errno = -4048;
  error.path = pth;
  error.syscall = 'mkdir';
  return error;
};

export async function makeDirectory(
  input: string,
  options?: MakeDirectoryOptions,
): Promise<string> {
  checkPath(input);
  options = processOptions(options);

  if (options?.fs?.mkdir === fs.mkdir) {
    const pth = path.resolve(input);

    await fsPromises.mkdir(pth, {
      mode: options.mode,
      recursive: true,
    });

    return pth;
  }

  const make = async (pth: string): Promise<string> => {
    try {
      await fsPromises.mkdir(pth, options.mode);

      return pth;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EPERM') {
        throw err;
      }

      if (err.code === 'ENOENT') {
        if (path.dirname(pth) === pth) {
          throw permissionError(pth);
        }

        if (err.message.includes('null bytes')) {
          throw err;
        }

        await make(path.dirname(pth));

        return make(pth);
      }

      try {
        const stats = await fsPromises.stat(pth);
        if (!stats.isDirectory()) {
          throw new Error('The path is not a directory');
        }
      } catch {
        throw err;
      }

      return pth;
    }
  };

  return make(path.resolve(input));
}

export function makeDirectorySync(
  input: string,
  options?: MakeDirectoryOptions,
): string {
  checkPath(input);
  options = processOptions(options);

  if (options?.fs?.mkdirSync === fs.mkdirSync) {
    const pth = path.resolve(input);

    fs.mkdirSync(pth, {
      mode: options.mode,
      recursive: true,
    });

    return pth;
  }

  const make = (pth: string): string => {
    try {
      options?.fs?.mkdirSync(pth, options.mode);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EPERM') {
        throw err;
      }

      if (err.code === 'ENOENT') {
        if (path.dirname(pth) === pth) {
          throw permissionError(pth);
        }

        if (err.message.includes('null bytes')) {
          throw err;
        }

        make(path.dirname(pth));
        return make(pth);
      }

      try {
        if (!options?.fs?.statSync(pth).isDirectory()) {
          throw new Error('The path is not a directory');
        }
      } catch {
        throw err;
      }
    }

    return pth;
  };

  return make(path.resolve(input));
}
