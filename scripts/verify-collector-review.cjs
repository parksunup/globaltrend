const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs=require('node:fs'), assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
(async()=>{
 const c=JSON.parse(fs.readFileSync(process.env.LOCAL_COLLECTOR_CASE_FILE || 'work/collector-ui-case.json'));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/work');
 assert.equal(await page.getByRole('heading',{name:'자동 수집 자료와 한국어 초안'}).count(),0);
 await page.getByLabel('이메일',{exact:true}).fill(c.email);await page.getByLabel('비밀번호',{exact:true}).fill(c.password);
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 await page.getByRole('heading',{name:'자동 수집 자료와 한국어 초안'}).waitFor();
 const panel=page.getByLabel('자동 수집 자료 검수');
 assert(await panel.getByText('로컬 합성 검사: 개인정보 지침 초안',{exact:true}).count());
 await panel.getByText('현재 저장된 원문 본문',{exact:true}).click();
 assert(await panel.getByText('Synthetic source says the board published guidelines on personal data.',{exact:true}).count());
 await panel.getByText('상세 설명·핵심 내용·근거',{exact:true}).click();
 assert(await panel.getByText('DB에 저장한 미검수 초안이 기존 작업 화면에 나타나는지 검사합니다.',{exact:true}).count());
 // Change only local DB, refresh the same running build, and confirm the new text.
 execFileSync('docker',['exec','supabase_db_globaltrend','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update public.reports set title_ko='DB 변경 즉시 표시: 로컬 합성 검사', key_points='[null]'::jsonb where codex_run_id='${c.worker}';`],{stdio:'ignore'});
 const response=await page.reload();assert.equal(response.status(),200);
 assert(await panel.getByText('DB 변경 즉시 표시: 로컬 합성 검사',{exact:true}).count());
 await panel.getByText('상세 설명·핵심 내용·근거',{exact:true}).click();
 assert(await panel.getByText('형식을 확인해야 하는 핵심 내용',{exact:true}).count());
 await page.goto('http://127.0.0.1:3000/public');assert.equal(await page.getByText('DB 변경 즉시 표시: 로컬 합성 검사').count(),0);
 assert.equal(await page.getByRole('link',{name:/피드백/}).count(),0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({test:'local_synthetic_db_to_existing_review_ui',login:true,reviewer_without_db_admin:true,db_refresh_without_rebuild:true,exact_original:true,null_keypoint_safe:true,unpublished_hidden:true,public_feedback_menu_absent:true,console_errors:errors,scope:'synthetic local only; no official live article or deployed preview tested'}));
 await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
