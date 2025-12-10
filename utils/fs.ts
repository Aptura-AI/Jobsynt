import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

const resolvePath = (file: string) => path.join(dataDir, file);

export async function readJSON<T>(file: string): Promise<T> {
  const filePath = resolvePath(file);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data) as T;
}

export async function writeJSON<T>(file: string, data: T): Promise<void> {
  const filePath = resolvePath(file);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, payload, 'utf-8');
}

