import {buildWeeklyPodcastScript} from "../../../../lib/weekly-podcast-script";
import {PublicFooter, PublicHeader} from "../../public-navigation";
import publicStyles from "../../public.module.css";
import styles from "./podcast-preview.module.css";
import PodcastPreview from "./podcast-preview";

export const dynamic = "force-dynamic";

export default function Page() {
  const sample = buildWeeklyPodcastScript();

  return (
    <main className={`${publicStyles.site} ${styles.page}`}>
      <PublicHeader active="/public/weekly" />
      <div className={styles.content}>
        <header className={styles.hero}>
          <p className={styles.kicker}>PODCAST · PRODUCTION TEST</p>
          <h1>{sample.title}</h1>
          <p className={styles.notice}>{sample.notice}</p>
        </header>
        <PodcastPreview
          turns={sample.turns}
          featuredStories={sample.featuredStories}
          styles={styles}
        />
      </div>
      <PublicFooter />
    </main>
  );
}
