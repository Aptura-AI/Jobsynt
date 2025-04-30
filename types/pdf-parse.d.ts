// types/pdfjs.d.ts
declare module 'pdfjs-dist' {
  export interface PDFJSStatic {
    GlobalWorkerOptions: {
      workerSrc: string;
    };
    getDocument(source: string | ArrayBuffer | Uint8Array): {
      promise: Promise<PDFDocument>;
    };
  }

  export interface PDFDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPage>;
  }

  export interface PDFPage {
    getTextContent(): Promise<{
      items: Array<{ str: string }>;
    }>;
  }

  const pdfjsLib: PDFJSStatic;
  export = pdfjsLib;
}

declare module 'pdfjs-dist/build/pdf.min.js';
declare module 'pdfjs-dist/build/pdf.worker.min.js';