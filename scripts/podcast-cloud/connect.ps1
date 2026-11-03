param([string]$PythonExecutable = 'python', [string]$DedicatedAccount = '')
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
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$existingAcl = Get-Acl -LiteralPath $privateFolder
$rules = @($existingAcl.Access)
$alreadyPrivate = $existingAcl.AreAccessRulesProtected -and $rules.Count -eq 1 -and
    $rules[0].IdentityReference.Value -eq $currentUser -and
    $rules[0].AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and
    $rules[0].FileSystemRights.HasFlag([System.Security.AccessControl.FileSystemRights]::FullControl)
if (-not $alreadyPrivate) {
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
        $currentUser, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    Set-Acl -LiteralPath $privateFolder -AclObject $acl
}
$venv = Join-Path $privateFolder 'venv'
if (-not (Test-Path (Join-Path $venv 'Scripts/python.exe'))) {
    & $PythonExecutable -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'Python 가상환경을 만들지 못했습니다.' }
}
$python = Join-Path $venv 'Scripts/python.exe'
& $python -m pip install 'notebooklm-py[browser]==0.8.5'
if ($LASTEXITCODE -ne 0) { throw '연결 패키지 설치 실패' }
# This Windows network can use a locally trusted inspection CA that certifi
# does not know. Export trusted Windows roots for this process only; never
# disable TLS verification or change system/browser certificate settings.
$env:PODCAST_CA_PATH = Join-Path $privateFolder 'windows-ca.pem'
& $python -c 'import os, ssl, pathlib; roots=ssl.create_default_context().get_ca_certs(binary_form=True); pathlib.Path(os.environ["PODCAST_CA_PATH"]).write_text("".join(ssl.DER_cert_to_PEM_cert(root) for root in roots), encoding="ascii")'
if ($LASTEXITCODE -ne 0) { throw 'Windows 신뢰 인증서를 읽지 못했습니다.' }
$env:SSL_CERT_FILE = $env:PODCAST_CA_PATH
$env:NOTEBOOKLM_HOME = Join-Path $privateFolder 'profile'
$state = Join-Path $env:NOTEBOOKLM_HOME 'profiles/default/storage_state.json'
Write-Host '지금부터 설치된 Chrome의 별도 로그인 창이 열립니다. 업무용 주 계정이 아닌 팟캐스트 전용 Google 계정으로 직접 로그인하세요.'
& $python -m notebooklm --storage $state login --browser chrome --browser-timeout 600
if ($LASTEXITCODE -ne 0) { throw 'Google 로그인 완료를 확인하지 못했습니다. 세션은 전송하지 않았습니다.' }
if (-not (Test-Path -LiteralPath $state)) { throw 'Google 로그인 파일을 찾지 못했습니다. 세션은 전송하지 않았습니다.' }
& $python -m notebooklm --storage $state auth check --test --passive --json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Google 로그인 검증 실패. 세션은 전송하지 않았습니다.' }
$confirm = Read-Host '전용 계정의 로그인 세션을 parksunup/globaltrend의 GitHub 비밀 저장소에 보관하려면 확인 입력'
if ($confirm -ne '확인') { throw '전송하지 않았습니다. 로그인 파일은 이 PC의 비공개 폴더에만 남습니다.' }
$account = (Get-Content -LiteralPath $state -Raw | ConvertFrom-Json).notebooklm.account.email
if (-not $account -or ($DedicatedAccount -and $account -ne $DedicatedAccount)) { throw '전용 Google 계정이 일치하지 않습니다. 전송하지 않았습니다.' }
$secretNames = @(& gh secret list --repo parksunup/globaltrend --json name | ConvertFrom-Json | ForEach-Object { $_.name })
if ($LASTEXITCODE -ne 0) { throw '기존 Secret 목록을 확인하지 못했습니다.' }
if ($secretNames -notcontains 'PODCAST_SESSION_KEY') {
    $env:PODCAST_KEY_FILE = Join-Path $privateFolder 'session-key.txt'
    & $python -c 'import base64,os,pathlib,secrets; p=pathlib.Path(os.environ["PODCAST_KEY_FILE"]); p.exists() or p.write_text(base64.b64encode(secrets.token_bytes(32)).decode(),encoding="ascii")'
    if ($LASTEXITCODE -ne 0) { throw '암호화 키 준비 실패' }
    Get-Content -LiteralPath $env:PODCAST_KEY_FILE -Raw | & gh secret set PODCAST_SESSION_KEY --repo parksunup/globaltrend
    if ($LASTEXITCODE -ne 0) { throw '암호화 키 연결 실패' }
}
$account | & gh secret set PODCAST_ACCOUNT_EMAIL --repo parksunup/globaltrend
if ($LASTEXITCODE -ne 0) { throw '전용 계정 확인값 연결 실패' }
# Send through stdin, never command-line arguments, console, git, or transcripts.
Get-Content -LiteralPath $state -Raw | & gh secret set NOTEBOOKLM_AUTH_JSON --repo parksunup/globaltrend
if ($LASTEXITCODE -ne 0) { throw 'GitHub 비밀 저장소 연결 실패' }
Write-Host '최초 전달용 연결을 저장했습니다. 클라우드에 넘긴 뒤 이 로컬 세션을 사용하지 마세요. 기존 암호화 세션이 이미 있으면 자동으로 덮어쓰지 않으므로, 재연결은 운영자가 시험을 멈추고 별도로 처리해야 합니다. 예약 실행은 아직 켜지 않았습니다.'
