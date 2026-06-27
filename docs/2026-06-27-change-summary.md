# 2026-06-27 Change Summary

## 개요

이번 변경은 기록/운동/우선순위/탭 편집 전반의 수정 가능 범위를 넓히고, 탭 편집 UI를 다듬는 작업을 중심으로 진행됐다.

## 주요 변경 사항

### 1. 기록(Calendar) 데이터 편집 기능 추가

- 기록 화면에서 날짜별 데이터를 직접 수정/삭제할 수 있도록 기능 확장
- To Do 기록의 완료 상태 변경, 이름 수정, 삭제 지원
- 운동 기록의 항목 수정/삭제 및 세부 기록 편집 지원
- 공부 기록의 시간/텍스트 수정 및 삭제 지원
- 기록 편집 시 공통 포맷 처리와 보조 유틸 추가

관련 파일:

- `src/features/calendar.js`
- `src/storage/storage.js`

### 2. 날짜별 저장 헬퍼 추가

- 기록/공부/운동 데이터를 날짜 기준으로 읽고 저장할 수 있는 storage helper 추가

관련 파일:

- `src/storage/storage.js`

### 3. 운동 시간 선택 UI 공통화

- 운동 기록에서 쓰던 시간 선택 UI를 별도 모듈로 분리
- 운동 화면과 기록 편집 화면에서 같은 시간 선택 로직을 재사용할 수 있도록 정리

관련 파일:

- `src/features/exerciseTimePicker.js`
- `src/features/exercise.js`
- `src/main.js`

### 4. Priority 기본 항목 삭제 기능 추가

- Priority 탭의 메인 To Do 항목에도 삭제 버튼 추가

관련 파일:

- `src/features/priority.js`

### 5. 탭 이름 커스터마이징 지원

- 탭 편집 모달에서 기본 탭과 커스텀 탭 이름을 모두 수정 가능하게 변경
- 탭별 커스텀 라벨을 저장/복원하도록 탭 설정 구조 확장

관련 파일:

- `src/features/tabSettings.js`
- `src/tabs.js`
- `src/storage/storage.js`

### 6. 탭 편집 Inline Edit UI 조정

- 탭 편집의 이름 수정 UI를 별도 inline edit 방식으로 변경
- 편집 시 박스가 과하게 커지지 않도록 같은 영역 안에서 읽기/편집 상태만 전환하도록 조정
- 이중 테두리처럼 보이던 상태를 줄이기 위해 탭 편집 전용 스타일 정리

관련 파일:

- `src/features/tabSettings.js`
- `src/styles/style.css`

### 7. 공통 인라인 편집 동작 보완

- 공통 텍스트 편집에서 바깥 클릭 시 저장 후 닫히도록 동작 보완

관련 파일:

- `src/utils/dom.js`

## 검증

- `npm run build`

## 커밋 대상에서 제외한 항목

- `AGENTS.md`는 앱 기능 변경 파일이 아니므로 이번 작업 커밋 범위에서 제외
