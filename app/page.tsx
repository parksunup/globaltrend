import PublicHome from './public/page';
import {PublicThemeProvider} from './public/public-theme';
export const dynamic='force-dynamic';
export default async function Home(){return <PublicThemeProvider><PublicHome /></PublicThemeProvider>;}
