// Global type declaration for pdf-parse (v2 CJS module, no proper ESM default export)
declare module "pdf-parse" {
  interface PageData {
    getTextContent(): Promise<{ items: Array<{ str: string; hasEOL?: boolean }> }>;
  }

  interface Options {
    pagerender?: (pageData: PageData) => Promise<string>;
    max?: number;
  }

  interface ParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: Options): Promise<ParseResult>;
  export = pdfParse;
}
