import * as cheerio from 'cheerio';
import { chromium, Browser } from 'playwright';
import { ScrapingResult, LeiStructure, SupportedSites, ScrapingConfig, CustomScrapeSelectors, ListedLink } from '../types';
import { TextParser } from '../utils/textParser';
import { logger } from '../utils/logger';
import { cacheManager } from '../utils/cache';
import { AppError } from '../middlewares/errorHandler';

export class ScrapingService {
  private static readonly DEFAULT_CONFIG: ScrapingConfig = {
    timeout: parseInt(process.env['SCRAPING_TIMEOUT'] ?? '30000', 10),
    maxRetries: 3,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  private browser: Browser | null = null;

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeLei(url: string): Promise<ScrapingResult> {
    const cacheKey = cacheManager.generateUrlKey(url);
    const cachedResult = cacheManager.get<ScrapingResult>(cacheKey);
    if (cachedResult) {
      logger.info('Returning cached scraping result', { url });
      return cachedResult;
    }

    logger.info('Starting scraping process', { url });
    let attempt = 0;
    const max = ScrapingService.DEFAULT_CONFIG.maxRetries;
    const site = this.identifySite(url);
    while (attempt < max) {
      try {
        let result: ScrapingResult;
        switch (site) {
          case 'planalto.gov.br':
            result = await this.scrapePlanalto(url);
            break;
          case 'camara.leg.br':
            result = await this.scrapeCamara(url);
            break;
          case 'senado.leg.br':
            result = await this.scrapeSenado(url);
            break;
          case 'diariomunicipal.org.br':
            result = await this.scrapeDiarioMunicipal(url);
            break;
          default:
            throw new AppError(`Site não suportado: ${site}`, 400);
        }
        if (result.success) {
          cacheManager.set(cacheKey, result);
        }
        return result;
      } catch (error: any) {
        attempt++;
        const isTimeout = typeof error?.message === 'string' && /timeout/i.test(error.message);
        const isConn = typeof error?.message === 'string' && /(ENOTFOUND|ECONNREFUSED|ERR_CONNECTION|net::ERR)/i.test(error.message);
        if (attempt >= max || (!isTimeout && !isConn)) {
          logger.error('Scraping failed', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido no scraping',
            url,
          };
        }
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        await this.sleep(delay);
      }
    }
    return { success: false, error: 'Falha no scraping após tentativas', url };
  }

  private identifySite(url: string): SupportedSites {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes('planalto.gov.br')) return 'planalto.gov.br';
    if (hostname.includes('camara.leg.br')) return 'camara.leg.br';
    if (hostname.includes('senado.leg.br')) return 'senado.leg.br';
    if (hostname.includes('diariomunicipal.org.br')) return 'diariomunicipal.org.br';
    
    throw new AppError('Site não suportado', 400);
  }

  // Scraping configurável com seletores fornecidos pelo cliente
  async scrapeWithSelectors(url: string, selectors: CustomScrapeSelectors): Promise<ScrapingResult> {
    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();

      await page.setExtraHTTPHeaders({
        'User-Agent': ScrapingService.DEFAULT_CONFIG.userAgent,
      });

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: ScrapingService.DEFAULT_CONFIG.timeout,
      });

      const content = await page.content();
      const $ = cheerio.load(content);

      const pickFirstText = (sels?: string[]) => {
        if (!sels || sels.length === 0) return '';
        for (const s of sels) {
          const t = $(s).first().text().trim();
          if (t) return t;
        }
        return '';
      };

      const titulo = pickFirstText(selectors.title);
      const ementa = pickFirstText(selectors.ementa);

      let textoCompleto = '';
      for (const sel of selectors.content) {
        $(sel).each((_, el) => {
          const t = $(el).text().trim();
          if (t) textoCompleto += t + '\n';
        });
      }
      if (!textoCompleto) {
        textoCompleto = $('body').text();
      }

      await page.close();

      if (!textoCompleto.trim()) {
        return { success: false, error: 'Conteúdo não encontrado', url };
      }

      const leiStructure = this.processScrapedContent(textoCompleto, titulo, ementa, url);

      return { success: true, data: leiStructure, url };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido no scraping custom',
        url,
      };
    }
  }

  // Listagem de links em página de índice
  async listLinksFromPage(url: string, selectors: string[], hrefInclude?: string): Promise<ListedLink[]> {
    await this.initBrowser();
    const page = await this.browser!.newPage();

    await page.setExtraHTTPHeaders({
      'User-Agent': ScrapingService.DEFAULT_CONFIG.userAgent,
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: ScrapingService.DEFAULT_CONFIG.timeout,
    });

    const content = await page.content();
    const $ = cheerio.load(content);

    const links: ListedLink[] = [];
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (!href) return;
        if (hrefInclude && !href.includes(hrefInclude)) return;
        const absoluteUrl = new URL(href, url).toString();
        links.push({ url: absoluteUrl, text });
      });
    }

    await page.close();

    const seen = new Set<string>();
    const unique = links.filter(l => {
      if (seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    });

    return unique;
  }

  private async scrapePlanalto(url: string): Promise<ScrapingResult> {
    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();
      
      await page.setExtraHTTPHeaders({
        'User-Agent': ScrapingService.DEFAULT_CONFIG.userAgent
      });
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: ScrapingService.DEFAULT_CONFIG.timeout 
      });

      const content = await page.content();
      const $ = cheerio.load(content);
      this.normalizeDom($);
      const titulo = this.pickFirstText($, ['.titulo-lei', '.lei-titulo', 'h1', 'h2']);
      const ementa = this.pickFirstText($, ['.ementa', '.lei-ementa']);
      let textoCompleto = this.extractContentText($, ['.texto-lei', '.lei-texto', '.artigo', 'article', '#content', 'main', '.conteudo']);
      if (!textoCompleto.trim()) {
        textoCompleto = await page.evaluate<string>(() => {
          const d: any = (globalThis as any).document;
          return (d && d.body && d.body.innerText) ? d.body.innerText : '';
        });
      }

      await page.close();

      if (!textoCompleto.trim()) {
        throw new AppError('Não foi possível extrair o conteúdo da lei', 400);
      }

      const leiStructure = this.processScrapedContent(textoCompleto, titulo, ementa, url);

      return {
        success: true,
        data: leiStructure,
        url,
      };
    } catch (error) {
      throw new AppError(`Erro ao fazer scraping do Planalto: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 500);
    }
  }

  private async scrapeCamara(url: string): Promise<ScrapingResult> {
    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();
      
      await page.setExtraHTTPHeaders({
        'User-Agent': ScrapingService.DEFAULT_CONFIG.userAgent
      });
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: ScrapingService.DEFAULT_CONFIG.timeout 
      });

      const content = await page.content();
      const $ = cheerio.load(content);
      this.normalizeDom($);
      const titulo = this.pickFirstText($, ['.proposicao-titulo', '.lei-titulo', 'h1', 'h2']);
      const ementa = this.pickFirstText($, ['.proposicao-ementa', '.ementa']);
      let textoCompleto = this.extractContentText($, ['.proposicao-texto', '.texto-proposicao', '.artigo', 'main', '.conteudo', '.content']);
      if (!textoCompleto.trim()) {
        textoCompleto = await page.evaluate<string>(() => {
          const d: any = (globalThis as any).document;
          return (d && d.body && d.body.innerText) ? d.body.innerText : '';
        });
      }

      await page.close();

      if (!textoCompleto.trim()) {
        throw new AppError('Não foi possível extrair o conteúdo da lei', 400);
      }

      const leiStructure = this.processScrapedContent(textoCompleto, titulo, ementa, url);

      return {
        success: true,
        data: leiStructure,
        url,
      };
    } catch (error) {
      throw new AppError(`Erro ao fazer scraping da Câmara: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 500);
    }
  }

  private async scrapeSenado(url: string): Promise<ScrapingResult> {
    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();
      
      await page.setExtraHTTPHeaders({
        'User-Agent': ScrapingService.DEFAULT_CONFIG.userAgent
      });
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: ScrapingService.DEFAULT_CONFIG.timeout 
      });

      const content = await page.content();
      const $ = cheerio.load(content);
      this.normalizeDom($);
      const titulo = this.pickFirstText($, ['.materia-titulo', '.lei-titulo', 'h1', 'h2']);
      const ementa = this.pickFirstText($, ['.materia-ementa', '.ementa']);
      let textoCompleto = this.extractContentText($, ['.materia-texto', '.texto-materia', '.artigo', '.conteudo-principal', '.content', 'main']);
      if (!textoCompleto.trim()) {
        textoCompleto = await page.evaluate<string>(() => {
          const d: any = (globalThis as any).document;
          return (d && d.body && d.body.innerText) ? d.body.innerText : '';
        });
      }

      await page.close();

      if (!textoCompleto.trim()) {
        throw new AppError('Não foi possível extrair o conteúdo da lei', 400);
      }

      const leiStructure = this.processScrapedContent(textoCompleto, titulo, ementa, url);

      return {
        success: true,
        data: leiStructure,
        url,
      };
    } catch (error) {
      throw new AppError(`Erro ao fazer scraping do Senado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 500);
    }
  }

  private async scrapeDiarioMunicipal(url: string): Promise<ScrapingResult> {
    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();
      
      await page.setExtraHTTPHeaders({
        'User-Agent': ScrapingService.DEFAULT_CONFIG.userAgent
      });
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: ScrapingService.DEFAULT_CONFIG.timeout 
      });

      const content = await page.content();
      const $ = cheerio.load(content);
      this.normalizeDom($);
      const titulo = this.pickFirstText($, ['.lei-titulo', '.documento-titulo', 'h1', 'h2']);
      const ementa = this.pickFirstText($, ['.lei-ementa', '.documento-ementa', '.ementa']);
      let textoCompleto = this.extractContentText($, ['.lei-texto', '.documento-texto', '.conteudo-lei', '.conteudo', 'main', '.content']);
      if (!textoCompleto.trim()) {
        textoCompleto = await page.evaluate<string>(() => {
          const d: any = (globalThis as any).document;
          return (d && d.body && d.body.innerText) ? d.body.innerText : '';
        });
      }

      await page.close();

      if (!textoCompleto.trim()) {
        throw new AppError('Não foi possível extrair o conteúdo da lei', 400);
      }

      const leiStructure = this.processScrapedContent(textoCompleto, titulo, ementa, url);

      return {
        success: true,
        data: leiStructure,
        url,
      };
    } catch (error) {
      throw new AppError(`Erro ao fazer scraping do Diário Municipal: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 500);
    }
  }

  private processScrapedContent(
    textoCompleto: string,
    titulo: string,
    ementa: string,
    url: string
  ): LeiStructure {
    const cleanText = TextParser.cleanText(textoCompleto);
    
    // Tentar extrair informações do título se não foram fornecidas
    if (!titulo) {
      const titleInfo = TextParser.extractTitleAndNumber(cleanText);
      if (titleInfo) {
        titulo = titleInfo.titulo;
      }
    }

    if (!ementa) {
      const e = TextParser.extractEmenta(cleanText);
      if (e) {
        ementa = e;
      }
    }

    // Parse da estrutura hierárquica
    const leiStructure = TextParser.parseHierarchicalText(cleanText);
    
    // Sobrescrever com dados extraídos do scraping se disponíveis
    if (titulo) leiStructure.titulo = titulo;
    if (ementa) leiStructure.ementa = ementa;
    leiStructure.origem = url;
    leiStructure.textoCompleto = cleanText;

    const artigosCount = (leiStructure.artigos || []).length;
    logger.info('Scraped lei parsed', { url, artigos: artigosCount });

    return leiStructure;
  }

  private pickFirstText($: cheerio.CheerioAPI, selectors: string[]): string {
    for (const sel of selectors) {
      const t = $(sel).first().text().trim();
      if (t) return t;
    }
    return '';
  }

  private extractContentText($: cheerio.CheerioAPI, selectors: string[]): string {
    let content = '';
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const t = $(el).text().trim();
        if (t) content += t + '\n';
      });
      if (content.trim()) break;
    }
    if (!content.trim()) {
      content = $('body').text();
    }
    return content;
  }

  private normalizeDom($: cheerio.CheerioAPI): void {
    $('script, style, noscript, nav, header, footer, aside, iframe').remove();
    const bodyText = $('body').text();
    $('body').text(bodyText.replace(/\s+$/gm, '').replace(/[\t ]+/g, ' '));
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(r => setTimeout(r, ms));
  }
}
