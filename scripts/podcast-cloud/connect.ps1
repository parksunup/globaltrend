param([string]$PythonExecutable = 'python')
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$privateFolder = Join-Path $repoRoot '.podcast-private'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw '먼저 https://cli.github.com 에서 GitHub CLI를 설치하고 gh auth login으로 본인 GitHub 계정에 로그인해 주세요. Google 비밀번호나 로그인 파일을 채팅에 보내지 마세요.'
}
& gh auth status
if ($LASTEXITCODE -ne 0) { throw 'gh auth login을 먼저 실행해 주세요.' }
if ($env:NOTEBOOKLM_AUTH_JSON) { throw '기존 NOTEBOOKLM_AUTH_JSON 환경변수를 제거한 별도 창에서 실행해 주세요.' }
New-Item -ItemType Directory -Force -Path $privateFolder | Out-Null
# Limit this local credential directory to this Windows user. Do not alter
# browser profiles or operating-system permissions outside this folder.
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
    [System.Security.Principal.WindowsIdentity]::GetCurrent().Name, 'FullControl',
    'ContainerInherit,ObjectInherit', 'None', 'Allow')))
Set-Acl -LiteralPath $privateFolder -AclObject $acl
$venv = Join-Path $privateFolder 'venv'
if (-not (Test-Path (Join-Path $venv 'Scripts/python.exe'))) {
    & $PythonExecutable -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'Python 가상환경을 만들지 못했습니다.' }
}
$python = Join-Path $venv 'Scripts/python.exe'
& $python -m pip install 'notebooklm-py[browser]==0.8.5'
if ($LASTEXITCODE -ne 0) { throw '연결 패키지 설치 실패' }
& $python -m playwright install chromium
if ($LASTEXITCODE -ne 0) { throw '전용 로그인 브라우저 설치 실패' }
$env:NOTEBOOKLM_HOME = Join-Path $privateFolder 'profile'
$state = Join-Path $privateFolder 'storage_state.json'
Write-Host '지금부터 별도 브라우저가 열립니다. 업무용 주 계정이 아닌 팟캐스트 전용 Google 계정으로 직접 로그인하세요.'
& $python -m notebooklm --storage $state login --browser-timeout 600
if ($LASTEXITCODE -ne 0) { throw 'Google 로그인 완료를 확인하지 못했습니다. 세션은 전송하지 않았습니다.' }
& $python -m notebooklm --storage $state auth check --test --passive --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Google 로그인 검증 실패. 세션은 전송하지 않았습니다.' }
$confirm = Read-Host '전용 계정의 로그인 세션을 parksunup/globaltrend의 GitHub 비밀 저장소에 보관하려면 확인 입력'
if ($confirm -ne '확인') { throw '전송하지 않았습니다. 로그인 파일은 이 PC의 비공개 폴더에만 남습니다.' }
# Send through stdin, never command-line arguments, console, git, or transcripts.
Get-Content -LiteralPath $state -Raw | & gh secret set NOTEBOOKLM_AUTH_JSON --repo parksunup/globaltrend
if ($LASTEXITCODE -ne 0) { throw 'GitHub 비밀 저장소 연결 실패' }
Write-Host '전용 Google 연결을 저장했습니다. 비밀번호는 저장하지 않았습니다. Codex에 연결 완료라고 알려주세요. 예약 실행은 아직 켜지 않았습니다.'
