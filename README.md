# 연구비 프리플라이트

국가 R&D 연구비 자료 사이의 **기계적 불일치 후보**를 내 PC에서 찾는 무료 오픈소스 도구입니다.

> 현재 상태: `v0.1.0` 공개 미리보기. 가상 데이터와 자동 테스트를 통과했지만, 익명화된 실제 RCMS 자료에 대한 정확도 검증은 아직 완료되지 않았습니다.

## 내려받기

[Windows x64 최신 실행 파일](https://github.com/qkrwlgns101/kr-rnd-preflight/releases/latest/download/kr-rnd-preflight-windows-x64.exe)

문서와 제3자 라이선스를 함께 받으려면 [Windows x64 ZIP 묶음](https://github.com/qkrwlgns101/kr-rnd-preflight/releases/latest/download/kr-rnd-preflight-windows-x64.zip)을 사용하세요.

설치가 필요하지 않습니다. 내려받은 `kr-rnd-preflight-windows-x64.exe`를 더블클릭하면 기본 브라우저에서 로컬 화면이 열립니다.

이 초기 실행 파일은 코드 서명 인증서로 서명되지 않았습니다. Windows가 경고를 표시할 수 있으므로, GitHub Release의 `SHA256SUMS.txt`와 다음 명령으로 파일 해시를 비교하세요.

```powershell
Get-FileHash .\kr-rnd-preflight-windows-x64.exe -Algorithm SHA256
```

## 사용법

1. 과제명과 현재 승인된 협약기간을 입력합니다.
2. 예산표, 참여인력, 증빙목록, 집행내역을 Excel에서 `CSV UTF-8`로 저장합니다.
3. 네 파일을 선택하고 `불일치 검사 시작`을 누릅니다.
4. 결과를 CSV 또는 JSON으로 저장합니다.
5. 화면 상단의 `검증기 종료`를 누릅니다. 30분 동안 사용하지 않아도 자동 종료됩니다.

처음에는 `예시 데이터 불러오기`를 눌러 동작을 확인할 수 있습니다. 예시 데이터에는 의도적인 오류 8건이 들어 있습니다.

### 필수 열

| 파일 | 필수 열 | 추가하면 검사 가능한 열 |
|---|---|---|
| 예산표 | `비목코드`, `예산액` | `비목명` |
| 참여인력 | `참여인력ID` 또는 `성명` | 이름 |
| 증빙목록 | `증빙ID`, `증빙번호` 또는 `파일명` | 증빙유형 |
| 집행내역 | `집행일자`, `비목코드`, `집행금액` | 집행번호, 증빙번호, 증빙ID, 참여인력ID, 거래처ID, 거래처명, 상태, 적요 |

영문 헤더도 지원합니다. 정확한 형식은 [`examples`](examples) 폴더의 CSV를 참고하세요. `.xlsx` 직접 입력과 기관별 RCMS 내보내기 형식 자동 매핑은 아직 지원하지 않습니다.

## 현재 검사 규칙

- 현재 협약기간 밖 집행
- 취소되지 않은 거래의 증빙번호 중복
- 증빙 ID 공란 또는 증빙목록 연결 누락
- 예산표에 없는 비목코드
- 비목별 누적 집행액의 예산 초과
- 지정한 인건비 비목의 참여인력 불일치
- 같은 거래처 ID의 거래처명 표기 불일치

취소 상태(`취소`, `취소됨`, `환입`, `cancelled`, `canceled`)의 거래는 중복·예산 누적 등 검사에서 제외합니다. 규칙의 상세 정의와 한계는 [검사 규칙](docs/RULES.md)을 확인하세요.

## 개인정보와 보안

- 실행 파일은 `127.0.0.1`에만 임시 서버를 열며, 임의의 긴 경로 토큰을 사용합니다.
- 선택한 CSV는 외부 서버나 GitHub로 전송되지 않습니다.
- 텔레메트리, 광고, 사용자 계정, 자동 업데이트가 없습니다.
- 입력 데이터는 디스크에 별도로 저장하지 않습니다. 결과 파일은 사용자가 저장할 때만 생성됩니다.
- 실제 연구비 자료나 개인정보를 GitHub Issue에 첨부하지 마세요.

자세한 내용은 [보안 정책](SECURITY.md)을 확인하세요.

## 반드시 알아야 할 한계

이 도구는 RCMS/GAIA 또는 정부기관의 공식 제품이 아니며, 제휴·승인 관계도 없습니다. 결과는 입력 데이터 사이의 단순한 불일치 후보일 뿐입니다. 다음을 제공하지 않습니다.

- 연구비 집행 적정성 확정
- 회계·세무·법률 자문
- 정산 통과 또는 환수 방지 보장
- 원본 증빙의 진위와 충분성 판단
- 최신 규정의 자동 반영

결과가 0건이어도 정산에 문제가 없다는 뜻이 아닙니다. 최종 판단은 주관기관, 회계법인 또는 관련 전문가에게 확인하세요. 전체 내용은 [면책 고지](DISCLAIMER.md)에 있습니다.

## 소스에서 실행

필요 환경은 Node.js 24 이상입니다.

```powershell
npm install
npm test
npm start
```

Windows 단일 실행 파일 빌드:

```powershell
npm run build:windows
```

빌드는 Node.js Single Executable Application 기능을 사용합니다. `dist`에 실행 파일, SHA-256 체크섬과 Node.js 제3자 라이선스가 생성됩니다.

## 라이선스

프로젝트 소스는 [MIT License](LICENSE)로 배포합니다. Windows 실행 파일은 Node.js를 포함하며, 앱의 `제3자 라이선스` 링크와 Release의 `THIRD_PARTY_LICENSES.txt`에서 관련 고지를 확인할 수 있습니다.

공식 기준 참고:

- [국가연구개발사업 연구개발비 사용 기준](https://www.law.go.kr/admRulLsInfoP.do?admRulId=75386&efYd=0)
- [GAIA 개요](https://www.gaia.go.kr/sub01/sub01_01.do)
