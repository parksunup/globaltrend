interface Window {
  advisor: {
    status(): Promise<{ signedIn: boolean; storageAvailable: boolean }>
    connect(): Promise<{ ok: boolean; message?: string }>
    disconnect(): Promise<void>
    ask(question: string, jurisdictions: string[]): Promise<{ answer: string; evidence: { jurisdictionName: string; lawTitle: string; version: string; sectionTitle: string; officialUrl: string; reviewStatus: "published" | "official" }[]; notice: string; model: string }>
    openSource(url: string): Promise<void>
  }
}
