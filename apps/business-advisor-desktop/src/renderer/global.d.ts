interface AdvisorSource {
  id: string
  title: string
  kind: string
  jurisdiction: string
  excerpt: string
  url: string
  officialUrl: string
  version: string
}
interface AdvisorCitation { title: string; url: string }
interface AdvisorModel { id: string; label: string }
interface AdvisorTurn { role: 'user' | 'assistant'; content: string }
interface Window {
  advisor: {
    status(): Promise<{ signedIn: boolean; storageAvailable: boolean; account?: string }>
    connect(): Promise<{ ok: boolean; message?: string }>
    disconnect(): Promise<void>
    models(): Promise<AdvisorModel[]>
    ask(question: string, history: AdvisorTurn[], model: string, assessmentContext?: string): Promise<{ answer: string; evidence: AdvisorSource[]; webCitations: AdvisorCitation[]; notice: string; model: string; webSearchUsed: boolean; corpus: { staticMaterials: number; publishedMaterials: number; publicContentAvailable: boolean } }>
    takeAssessment(): Promise<string | null>
    onAssessmentHandoff(callback: () => void): void
    openSource(url: string): Promise<void>
  }
}
