declare module 'word-extractor' {
  interface ExtractedDoc { getBody(): string }
  export default class WordExtractor {
    extract(filePath: string): Promise<ExtractedDoc>;
  }
}