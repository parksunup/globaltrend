"use client";
import Link from 'next/link';
import {useRef,useState} from 'react';
import type {PublicPodcast} from '../../lib/public-podcast';
import styles from './home-podcast.module.css';
import {formatMonthlyWeek,podcastEditionNumber} from '../../lib/weekly-label';
export default function HomePodcastPlayer({podcast}:{podcast:PublicPodcast}){
 const audio=useRef<HTMLAudioElement>(null);const [playing,setPlaying]=useState(false),[error,setError]=useState(false);
 async function toggle(){if(!audio.current)return;if(playing){audio.current.pause();return;}try{setError(false);await audio.current.play();}catch{setError(true);}}
 return <section className={styles.player} aria-label="최신 주간 팟캐스트"><div className={styles.heading}><p>WEEKLY PODCAST · {formatMonthlyWeek(podcast.start)}-{podcastEditionNumber(podcast.issueKey)}</p><h2>{podcast.title}</h2><p>{podcast.description}</p><Link href="/public/weekly/podcast">팟캐스트 전체 보기 →</Link></div><div className={styles.controls}><button type="button" onClick={toggle} aria-label={playing?'팟캐스트 일시정지':'팟캐스트 재생'}>{playing?'Ⅱ 일시정지':'▶ 팟캐스트 재생'}</button><audio ref={audio} controls preload="none" aria-label="최신 팟캐스트 오디오" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError(true);}}><source src={podcast.audioUrl} type={podcast.mime}/></audio>{error&&<p role="alert">오디오를 재생하지 못했습니다. <Link href="/public">페이지를 새로 열어 주세요.</Link></p>}</div></section>;
}
