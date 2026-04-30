#!/usr/bin/env python3
"""
매일 할 것들 - 로컬 서버
실행: python3 server.py
접속: http://localhost:3000
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json, os, sys

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.json')

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.endswith(('.html', '.js', '.css')) or any(ext + '?' in self.path for ext in ('.html', '.js', '.css')):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, format, *args):
        # 불필요한 요청 로그 억제 (저장/불러오기만 출력)
        message = str(args[0]) if args else ''
        if '/api/' in message:
            print(f'  [{args[1]}] {args[0].split()[1]}')

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
            return super().do_GET()
        if self.path == '/api/load':
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self._cors()
                self.end_headers()
                self.wfile.write(data.encode('utf-8'))
                print(f'  [불러오기] data.json → 브라우저')
            else:
                self.send_response(404)
                self._cors()
                self.end_headers()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/save':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data = json.loads(body)
                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self._cors()
                self.end_headers()
                print(f'  [저장] data.json 업데이트')
            except Exception as e:
                print(f'  [오류] {e}')
                self.send_response(500)
                self.end_headers()

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')


if __name__ == '__main__':
    PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 3000))
    httpd = HTTPServer(('', PORT), Handler)
    print('─' * 40)
    print(f'  매일 할 것들 서버 시작!')
    print(f'  http://localhost:{PORT}')
    print(f'  종료: Ctrl+C')
    print('─' * 40)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n  서버 종료')
