import fs from 'node:fs/promises';
import path from 'node:path';
import { parseTrendEdit } from '../lib/team-trends.ts';
const [command,...args]=process.argv.slice(2),directory='.team-workspace/edits';
const option=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
async function edits() {
  const files=await fs.readdir(directory).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
  const result=[];
  for(const file of files.filter(file=>file.endsWith('.json'))) {
    const entry=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
    const edit=parseTrendEdit(entry.edit);
    if(file!==edit.report_id+'.json'||!Number.isSafeInteger(entry.expected_revision)||entry.expected_revision<0)throw Error('원고 ID와 작업실 수정 판본을 확인하세요: '+file);
    result.push({edit,expected_revision:entry.expected_revision});
  }
  return result;
}
function connection() {
  const origin=new URL(option('--url'));
  if(origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))throw Error('HTTPS 작업실 주소를 사용하세요.');
  const name=option('--token-env'),token=name?process.env[name]:null;
  if(name&&(!token||!/^[a-f0-9]{64}$/.test(token)))throw Error('임시 환경변수에 작업실 연결키가 없습니다. 키 자체는 출력하지 않습니다.');
  return {origin,headers:token?{Authorization:'Bearer '+token}:{}};
}
try {
  if(command==='validate') {
    console.log('작업실 수정본 형식 검사 통과: '+(await edits()).length+'건. 사실 확인·사람 승인 결과는 아닙니다.');
  } else if(command==='pull'||command==='save') {
    const role=command==='save'?'trends':option('--role');
    if(!['legal','trends'].includes(role))throw Error('--role trends|legal을 지정하세요.');
    const {origin,headers}=connection();
    if(role==='trends'&&!headers.Authorization)throw Error('화면에서 복사한 연결 프롬프트의 키를 --token-env로 지정하세요.');
    const url=new URL('/api/team-workspace?role='+role,origin);
    let submitted=[];
    if(command==='save') {
      submitted=await edits();if(!submitted.length)throw Error('저장할 수정본이 없습니다.');
      const response=await fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({edits:submitted}),redirect:'error',signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw Error('저장 실패: '+response.status+' '+await response.text());
      const result=await response.json();if(result.saved!==submitted.length||result.published!==false)throw Error('저장 결과를 확인하지 못했습니다.');
      console.log('작업실 수정본 '+result.saved+'건 저장. 대외 발행하지 않았습니다.');
    }
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(60000),redirect:'error'});
    if(!response.ok)throw Error('읽기 실패: '+response.status+' '+await response.text());
    const data=await response.json();
    if(data.role!==role||!/^[a-f0-9]{40}$/i.test(data.commitSha))throw Error('작업실 응답을 확인할 수 없습니다.');
    if(data.stale)throw Error('최신 GitHub 자료가 아닙니다. '+(data.error??''));
    if(role==='trends'&&!data.databaseAvailable)throw Error('DB 연결을 확인하지 못해 전체 원고를 받지 못했습니다.');
    for(const {edit,expected_revision} of submitted) {
      const actual=data.trends.find(row=>row.id===edit.report_id);
      if(!actual||actual.workspace_revision<=expected_revision||['title_ko','summary_ko','details_ko'].some(key=>actual[key]!==edit[key]))throw Error('저장은 접수됐지만 다시 읽은 수정 내용이 일치하지 않습니다. 최신 원고를 확인하세요.');
    }
    await fs.mkdir('.team-workspace',{recursive:true});
    await fs.writeFile('.team-workspace/'+role+'.json',JSON.stringify(data,null,2)+'\n');
    console.log('확인 자료: .team-workspace/'+role+'.json · '+data.commitSha);
    if(data.warnings?.length)console.warn(data.warnings.join('\n'));
  } else if(command==='prepare') {
    const data=JSON.parse(await fs.readFile('.team-workspace/trends.json','utf8')),row=data.trends.find(row=>row.id===args[0]);
    if(!row)throw Error('먼저 pull한 원고에서 정확한 ID를 지정하세요.');
    if(row.editState==='conflict')throw Error('충돌한 수정본과 최신 원고를 대조해 해결하세요.');
    const edit=parseTrendEdit({report_id:row.id,base_revision:row.revision,title_ko:row.title_ko,summary_ko:row.summary_ko,details_ko:row.details_ko});
    await fs.mkdir(directory,{recursive:true});
    const file=path.join(directory,edit.report_id+'.json');
    await fs.writeFile(file,JSON.stringify({edit,expected_revision:row.workspace_revision??0},null,2)+'\n',{flag:'wx'});
    console.log('수정할 파일: '+file+' · 편집/validate 후 save하세요. Git에 커밋하지 않습니다.');
  } else throw Error('사용법: pull --url <주소> --role trends|legal [--token-env 변수명] / prepare <원고 UUID> / validate / save --url <주소> --token-env 변수명');
} catch(error) {console.error(error.message);process.exitCode=1;}
