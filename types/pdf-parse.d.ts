declare module "pdf-parse" {
  export interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  }

  export default function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
}

