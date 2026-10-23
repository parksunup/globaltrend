import {NextResponse} from "next/server";
import {buildWeeklyPodcastScript} from "../../../../lib/weekly-podcast-script";
export const runtime="nodejs";
export async function POST(){
 const apiKey=process.env.GEMINI_API_KEY;
 if(!apiKey)return NextResponse.json({error:"GEMINI_API_KEY를 설정해야 음성을 만들 수 있습니다."},{status:503});
 const {turns}=buildWeeklyPodcastScript();
 const input=turns.map(turn=>({type:"text",text:turn.text,annotations:[{type:"speech_metadata",speaker:turn.speaker,style:turn.speaker==="Mina"?"차분하고 또렷한 한국어 진행자, 따뜻한 설명조":"차분하고 친근한 한국어 공동 진행자, 자연스러운 대화조"}]}));
 try{
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{method:"POST",headers:{"x-goog-api-key":apiKey,"content-type":"application/json"},body:JSON.stringify({model:"gemini-3.8-flash-lite-tts",input:[{type:"user_input",content:input}],response_format:{type:"audio"},generation_config:{speech_config:{mode:"conversational",speakers:[{speaker:"Mina",voice:"Kore"},{speaker:"Joon",voice:"Puck"}]}}}),signal:AbortSignal.timeout(90000)});
  const payload=await response.json();
  if(!response.ok){const limited=response.status===429||response.status===403;return NextResponse.json({error:limited?"Gemini 무료 사용 한도 또는 접근 조건에 도달했습니다. 유료 호출은 하지 않았습니다.":`음성 생성 실패 (HTTP ${response.status})`},{status:limited?429:502});}
  const audio=payload.steps?.flatMap((step:{content?:Array<{type?:string;data?:string}>})=>step.content??[]).filter((part:{type?:string})=>part.type==="audio").at(-1)?.data;
  if(!audio)return NextResponse.json({error:"Gemini 응답에서 오디오를 찾지 못했습니다."},{status:502});
  return new NextResponse(Buffer.from(audio,"base64"),{headers:{"content-type":"audio/wav","cache-control":"no-store","content-disposition":'inline; filename="weekly-podcast-sample.wav"'}});
 }catch{return NextResponse.json({error:"음성 생성에 연결하지 못했습니다. 유료 대체 호출은 실행하지 않았습니다."},{status:502});}
}
