declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>,
  ): Promise<PDFParseResult>;

  export default pdfParse;
}

declare module "mammoth" {
  export function extractRawText(options: {
    buffer: Buffer;
  }): Promise<{ value: string }>;
}

declare module "xlsx" {
  export function read(
    data: Buffer | ArrayBuffer | Uint8Array,
    opts?: { type?: string },
  ): Workbook;

  interface Workbook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  interface WorkSheet {
    [key: string]: unknown;
  }

  export const utils: {
    sheet_to_csv(sheet: WorkSheet): string;
    sheet_to_json<T = Record<string, unknown>>(sheet: WorkSheet): T[];
  };
}
