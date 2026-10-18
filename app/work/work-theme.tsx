"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import styles from './work.module.css';
const Theme=createContext<{dark:boolean;toggle:()=>void}|null>(null);
export function WorkTheme({children}:{children:ReactNode}){const [dark,setDark]=useState(false);useEffect(()=>{try{setDark(localStorage.getItem('globaltrend-public-theme')==='dark');}catch{}},[]);const toggle=()=>{const next=!dark;setDark(next);try{localStorage.setItem('globaltrend-public-theme',next?'dark':'light');}catch{}};return <Theme.Provider value={{dark,toggle}}><div data-work-theme={dark?'dark':'light'}>{children}</div></Theme.Provider>;}
export function WorkThemeToggle(){const value=useContext(Theme);if(!value)return null;return <button className={styles.themeToggle} type="button" aria-label={value.dark?'밝은 테마로 전환':'어두운 테마로 전환'} onClick={value.toggle}>{value.dark?'☀ 밝게':'☾ 어둡게'}</button>;}
