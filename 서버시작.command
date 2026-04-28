#!/bin/bash
cd "$(dirname "$0")"

# 포트 3000이 이미 사용 중이면 종료
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "────────────────────────────────"
echo "  매일 할 것들 서버 시작!"
echo "  http://localhost:3000"
echo "  종료하려면 이 창을 닫으세요"
echo "────────────────────────────────"

sleep 0.5
open -a "Google Chrome" http://localhost:3000

python3 server.py
