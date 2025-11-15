const fs = require('fs');
const mammoth = require('mammoth');
const path = require('path');

// Simular o processamento básico de documento
async function testDocumentProcessing() {
  try {
    console.log('🔍 Testando processamento de documento...\n');

    const testFile = 'test-files/AUTÓGRAFO DE LEI N 2992 e 2993.docx';
    
    if (!fs.existsSync(testFile)) {
      console.error('❌ Arquivo de teste não encontrado:', testFile);
      return;
    }

    console.log('📁 Processando arquivo:', testFile);
    console.log('📏 Tamanho:', fs.statSync(testFile).size, 'bytes');

    // Ler arquivo
    const buffer = fs.readFileSync(testFile);
    
    // Extrair texto usando mammoth
    console.log('\n1️⃣ Extraindo texto com mammoth...');
    const result = await mammoth.extractRawText({ buffer });
    const extractedText = result.value;
    
    console.log('📄 Texto extraído (primeiros 500 caracteres):');
    console.log(extractedText.substring(0, 500) + '...');
    console.log('\n📊 Estatísticas do texto:');
    console.log('- Comprimento total:', extractedText.length);
    console.log('- Linhas:', extractedText.split('\n').length);

    // Tentar identificar informações básicas
    console.log('\n2️⃣ Identificando informações básicas...');
    
    // Buscar número da lei
    const numeroMatch = extractedText.match(/(?:LEI\s+N[ºº°]?\s*|N[ºº°]?\s*)(\d+(?:[.,]\d+)*)/i);
    const numero = numeroMatch ? numeroMatch[1] : 'Não identificado';
    console.log('🔢 Número da lei:', numero);

    // Buscar data
    const dataMatch = extractedText.match(/(\d{1,2})\s*de\s*(\w+)\s*de\s*(\d{4})/i);
    const data = dataMatch ? `${dataMatch[1]} de ${dataMatch[2]} de ${dataMatch[3]}` : 'Não identificada';
    console.log('📅 Data:', data);

    // Buscar título/ementa
    const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const titulo = lines.find(line => line.length > 20 && !line.match(/^(Art|Artigo|§|Parágrafo)/i)) || 'Não identificado';
    console.log('📝 Título/Ementa:', titulo.substring(0, 100) + (titulo.length > 100 ? '...' : ''));

    // Buscar artigos
    console.log('\n3️⃣ Identificando artigos...');
    const articleMatches = extractedText.match(/Art\.?\s*\d+[ºº°]?/gi) || [];
    console.log('📋 Artigos encontrados:', articleMatches.length);
    console.log('📄 Primeiros 5 artigos:', articleMatches.slice(0, 5));

    // Tentar extrair artigos com conteúdo
    const articleSections = extractedText.split(/(?=Art\.?\s*\d+[ºº°]?)/i);
    const articles = [];
    
    articleSections.forEach((section, index) => {
      const trimmedSection = section.trim();
      if (!trimmedSection) return;

      const match = trimmedSection.match(/^(Art\.?\s*\d+[ºº°]?)/i);
      if (match && match[1]) {
        const articleText = trimmedSection.substring(match[1].length).trim();
        articles.push({
          numero: match[1],
          texto: articleText.substring(0, 200) + (articleText.length > 200 ? '...' : ''),
          ordem: index + 1,
        });
      }
    });

    console.log('\n4️⃣ Artigos processados:', articles.length);
    if (articles.length > 0) {
      console.log('📄 Exemplo do primeiro artigo:');
      console.log(JSON.stringify(articles[0], null, 2));
    }

    // Criar estrutura de dados simulada
    console.log('\n5️⃣ Criando estrutura de dados...');
    const leiStructure = {
      titulo: titulo,
      ementa: titulo !== 'Não identificado' ? titulo : undefined,
      numero: numero,
      data: dataMatch ? new Date(`${dataMatch[3]}-${getMonthNumber(dataMatch[2])}-${dataMatch[1].padStart(2, '0')}`) : undefined,
      origem: 'Upload de arquivo',
      textoCompleto: extractedText,
      artigos: articles.map(art => ({
        numero: art.numero,
        texto: art.texto,
        ordem: art.ordem,
        paragrafos: [],
        incisos: []
      }))
    };

    console.log('📊 Estrutura final:');
    console.log('- Título:', leiStructure.titulo ? 'OK' : 'FALTANDO');
    console.log('- Número:', leiStructure.numero ? 'OK' : 'FALTANDO');
    console.log('- Data:', leiStructure.data ? 'OK' : 'FALTANDO');
    console.log('- Artigos:', leiStructure.artigos.length);
    console.log('- Texto completo:', leiStructure.textoCompleto.length, 'caracteres');

    // Verificar se a estrutura está válida para o banco
    console.log('\n6️⃣ Validando estrutura para o banco...');
    const isValid = validateLeiStructure(leiStructure);
    console.log('✅ Estrutura válida:', isValid ? 'SIM' : 'NÃO');

    if (!isValid) {
      console.log('❌ Problemas encontrados:');
      if (!leiStructure.titulo) console.log('- Título obrigatório');
      if (!leiStructure.numero) console.log('- Número obrigatório');
      if (!leiStructure.origem) console.log('- Origem obrigatória');
      if (!leiStructure.artigos || leiStructure.artigos.length === 0) console.log('- Pelo menos um artigo obrigatório');
    }

    return leiStructure;

  } catch (error) {
    console.error('❌ Erro durante o processamento:', error.message);
    console.error('🔍 Stack trace:', error.stack);
  }
}

function getMonthNumber(monthName) {
  const months = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };
  return months[monthName.toLowerCase()] || '01';
}

function validateLeiStructure(lei) {
  if (!lei.titulo || typeof lei.titulo !== 'string') return false;
  if (!lei.numero || typeof lei.numero !== 'string') return false;
  if (!lei.origem || typeof lei.origem !== 'string') return false;
  if (!lei.artigos || !Array.isArray(lei.artigos) || lei.artigos.length === 0) return false;
  
  // Validar cada artigo
  for (const artigo of lei.artigos) {
    if (!artigo.numero || typeof artigo.numero !== 'string') return false;
    if (!artigo.texto || typeof artigo.texto !== 'string') return false;
    if (typeof artigo.ordem !== 'number') return false;
  }
  
  return true;
}

// Executar teste
testDocumentProcessing().catch(console.error);