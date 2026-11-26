"""Produce install icons and deterministic distribution archives."""
import gzip
import io
from pathlib import Path
import struct
import sys
import tarfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import zlib


def png_chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))


def icon(size):
    pixels = bytearray()
    for row in range(size):
        pixels.append(0)
        y = row / size
        for column in range(size):
            x = abs(column / size - 0.5)
            width = 0.25 if y < 0.55 else max(0, 0.25 * (0.82 - y) / 0.27)
            shield = 0.21 <= y < 0.82 and x <= width and y >= 0.21 + x * 0.22
            inset = 0.31 < y < 0.70 and x <= max(0, min(0.17, width - 0.055))
            pixels.extend((125, 232, 213) if shield and not inset else (10, 20, 35))
    return (b'\x89PNG\r\n\x1a\n'
            + png_chunk(b'IHDR', struct.pack('!IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + png_chunk(b'IDAT', zlib.compress(pixels, 9))
            + png_chunk(b'IEND', b''))


def zip_tree(root, path):
    with ZipFile(path, 'w') as archive:
        for file in sorted(root.rglob('*')):
            if file.is_file():
                entry = ZipInfo(file.relative_to(root).as_posix())
                entry.external_attr = 0o644 << 16
                archive.writestr(entry, file.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)


def pack(dist, version):
    zip_tree(dist / 'extension', dist / 'extension.zip')
    zip_tree(dist / 'web', dist / 'site.zip')
    root = dist / 'cli/package'
    with (dist / f'cli/promptveil-{version}.tgz').open('wb') as handle:
        with gzip.GzipFile(filename='', mode='wb', fileobj=handle, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode='w') as archive:
                for file in sorted(root.rglob('*')):
                    if not file.is_file():
                        continue
                    name = file.relative_to(root).as_posix()
                    data = file.read_bytes()
                    entry = tarfile.TarInfo(f'package/{name}')
                    entry.size = len(data)
                    entry.mode = 0o755 if name == 'apps/cli/index.js' else 0o644
                    archive.addfile(entry, io.BytesIO(data))


if __name__ == '__main__':
    if sys.argv[1] == 'icons':
        for size in (map(int, sys.argv[3:]) if len(sys.argv) > 3 else (192, 512)):
            (Path(sys.argv[2]) / f'icon-{size}.png').write_bytes(icon(size))
    elif sys.argv[1] == 'pack':
        pack(Path(sys.argv[2]), sys.argv[3])
    else:
        raise SystemExit('Unknown artifact action')
