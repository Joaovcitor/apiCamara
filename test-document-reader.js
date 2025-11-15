const fs = require('fs');
const path = require('path');

// Simulando o DocumentService (versão simplificada para teste)
const mammoth = require('mammoth');

async function testDocumentReading() {
    console.log('🔍 Iniciando teste de leitura de documentos Word...\n');
    
    const testFilesDir = path.join(__dirname, 'test-files');
    const files = fs.readdirSync(testFilesDir).filter(file => file.endsWith('.docx'));
    
    console.log(`📁 Encontrados ${files.length} arquivos para teste:`);
    files.forEach(file => console.log(`   - ${file}`));
    console.log('');
    
    for (const filename of files) {
        console.log(`📄 Processando: ${filename}`);
        console.log('─'.repeat(50));
        
        try {
            const filePath = path.join(testFilesDir, filename);
            const buffer = fs.readFileSync(filePath);
            
            console.log(`📊 Tamanho do arquivo: ${buffer.length} bytes`);
            
            // Extrair texto usando mammoth
            const result = await mammoth.extractRawText({ buffer });
            const extractedText = result.value;
            
            console.log(`📝 Texto extraído (${extractedText.length} caracteres):`);
            console.log('─'.repeat(30));
            
            // Mostrar primeiros 500 caracteres
            const preview = extractedText.substring(0, 500);
            console.log(preview);
            if (extractedText.length > 500) {
                console.log('\n... (texto truncado) ...');
            }
            
            console.log('\n');
            
            // Tentar identificar informações básicas
            const leiInfo = extractBasicInfo(extractedText);
            console.log('🔍 Informações identificadas:');
            console.log(`   Título: ${leiInfo.titulo || 'Não identificado'}`);
            console.log(`   Número: ${leiInfo.numero || 'Não identificado'}`);
            console.log(`   Data: ${leiInfo.data || 'Não identificada'}`);
            console.log(`   Ementa: ${leiInfo.ementa || 'Não identificada'}`);
            
            // Simular estrutura de dados que seria salva no banco
            const leiStructure = {
                titulo: leiInfo.titulo || `Lei extraída de ${filename}`,
                numero: leiInfo.numero || 'S/N',
                data: leiInfo.data || new Date().toISOString().split('T')[0],
                ementa: leiInfo.ementa || 'Ementa não identificada',
                textoCompleto: extractedText,
                origem: filename,
                artigos: extractArticles(extractedText),
                status: 'ATIVA',
                tipo: 'ORDINARIA'
            };
            
            console.log(`📋 Estrutura simulada para banco:`);
            console.log(`   Artigos encontrados: ${leiStructure.artigos.length}`);
            console.log(`   Status: ${leiStructure.status}`);
            console.log(`   Tipo: ${leiStructure.tipo}`);
            
        } catch (error) {
            console.error(`❌ Erro ao processar ${filename}:`, error.message);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
    }
    
    console.log('✅ Teste de leitura concluído!');
}

function extractBasicInfo(text) {
    const info = {};
    
    // Tentar extrair número da lei
    const numeroMatch = text.match(/LEI\s+N[°º]?\s*(\d+(?:[.,]\d+)*)/i);
    if (numeroMatch) {
        info.numero = numeroMatch[1];
    }
    
    // Tentar extrair data
    const dataMatch = text.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (dataMatch) {
        const meses = {
            'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
            'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
            'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };
        const dia = dataMatch[1].padStart(2, '0');
        const mes = meses[dataMatch[2].toLowerCase()] || '01';
        const ano = dataMatch[3];
        info.data = `${ano}-${mes}-${dia}`;
    }
    
    // Tentar extrair título/ementa (primeira linha significativa)
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 10);
    if (lines.length > 0) {
        // Procurar por uma linha que pareça ser o título
        for (const line of lines.slice(0, 5)) {
            if (line.toLowerCase().includes('dispõe') || 
                line.toLowerCase().includes('institui') || 
                line.toLowerCase().includes('estabelece') ||
                line.toLowerCase().includes('autoriza')) {
                info.ementa = line;
                break;
            }
        }
        
        if (!info.ementa && lines[0]) {
            info.titulo = lines[0];
        }
    }
    
    return info;
}

function extractArticles(text) {
    const articles = [];
    const articleRegex = /Art\.?\s*(\d+)[°º]?\s*[-–—]?\s*(.*?)(?=Art\.?\s*\d+|$)/gis;
    let match;
    
    while ((match = articleRegex.exec(text)) !== null) {
        const numero = parseInt(match[1]);
        const conteudo = match[2].trim();
        
        if (conteudo.length > 10) { // Filtrar artigos muito pequenos
            articles.push({
                numero,
                conteudo: conteudo.substring(0, 1000) // Limitar tamanho
            });
        }
    }
    
    return articles;
}

// Executar o teste
testDocumentReading().catch(console.error);