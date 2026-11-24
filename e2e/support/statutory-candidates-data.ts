// Helpers for the flows through the positions and candidatures of an Agora.
import zlib from 'node:zlib';

// The files of a zip, by name.
function unzip(file: Buffer): Map<string, Buffer> {
    // The end of the zip's central directory, which lists its files.
    const end = file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) {
        throw new Error('unzip: not a zip file.');
    }

    const files = new Map<string, Buffer>();
    const count = file.readUInt16LE(end + 10);
    let entry = file.readUInt32LE(end + 16);
    for (let index = 0; index < count; index++) {
        const method = file.readUInt16LE(entry + 10);
        const size = file.readUInt32LE(entry + 20);
        const nameLength = file.readUInt16LE(entry + 28);
        const local = file.readUInt32LE(entry + 42);
        const name = file.toString('utf8', entry + 46, entry + 46 + nameLength);
        entry += 46 + nameLength + file.readUInt16LE(entry + 30) + file.readUInt16LE(entry + 32);

        const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28);
        const data = file.subarray(start, start + size);
        files.set(name, method === 8 ? zlib.inflateRawSync(data) : data);
    }

    return files;
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: '\'', amp: '&' };
const unescapeXml = (text: string): string => text.replace(/&(lt|gt|quot|apos|amp);/g, (_entity, name: string) => ENTITIES[name]);

// The rows of the first sheet of a spreadsheet (an .xlsx file), each cell as text. Enough to
// check the columns and rows of an export without a spreadsheet library.
export function spreadsheetRows(file: Buffer): string[][] {
    const files = unzip(file);
    const sheet = files.get('xl/worksheets/sheet1.xml');
    if (!sheet) {
        throw new Error(`spreadsheetRows: no first sheet among ${[...files.keys()].join(', ')}.`);
    }

    const shared = [...(files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
        .map(([, item]) => unescapeXml([...item.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(([, text]) => text).join('')));

    return [...sheet.toString('utf8').matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(([, row]) => (
        [...row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attributes, content = '']) => {
            const value = /<v>([^<]*)<\/v>/.exec(content)?.[1] ?? /<t(?:\s[^>]*)?>([^<]*)<\/t>/.exec(content)?.[1] ?? '';
            return /\bt="s"/.test(attributes) ? shared[Number(value)] : unescapeXml(value);
        })
    ));
}
