"""Local static preview with byte-range support for indexed MP4 playback."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re


class RangeHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Accept-Ranges','bytes')
        super().end_headers()

    def send_head(self):
        self.byte_range = None
        header = self.headers.get('Range')
        path = Path(self.translate_path(self.path))
        if not header or not path.is_file():return super().send_head()
        match = re.fullmatch(r'bytes=(\d*)-(\d*)',header)
        size = path.stat().st_size
        if not match or not any(match.groups()):
            self.send_error(416);return None
        first,last = match.groups()
        start = int(first) if first else max(0,size-int(last))
        end = min(size-1,int(last)) if first and last else size-1
        if start<0 or start>=size or end<start:
            self.send_response(416);self.send_header('Content-Range',f'bytes */{size}')
            self.send_header('Content-Length','0');self.end_headers();return None
        stream = path.open('rb');stream.seek(start)
        self.byte_range = end-start+1
        self.send_response(206)
        self.send_header('Content-Type',self.guess_type(str(path)))
        self.send_header('Content-Length',str(self.byte_range))
        self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.end_headers()
        return stream

    def copyfile(self, source, outputfile):
        if self.byte_range is None:return super().copyfile(source,outputfile)
        remaining = self.byte_range
        while remaining:
            block = source.read(min(262144,remaining))
            if not block:break
            outputfile.write(block);remaining-=len(block)


if __name__=='__main__':
    from functools import partial
    parser = argparse.ArgumentParser()
    parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--port',type=int,default=8766)
    args = parser.parse_args()
    ThreadingHTTPServer(('127.0.0.1',args.port),partial(RangeHandler,directory=str(args.site))).serve_forever()
