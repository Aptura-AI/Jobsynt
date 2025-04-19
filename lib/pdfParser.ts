import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
export async function parsePdfText(pdf: PDFDocumentProxy): Promise<string> {
  const maxPages = pdf.numPages
  const pageTexts: string[] = []

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item) => {
      if ('str' in item) return item.str
      return ''
    }).join(' ')
    pageTexts.push(text)
  }

  return pageTexts.join('\n')
}
