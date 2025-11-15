const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const prisma = new PrismaClient();

async function simulateDatabaseCreation() {
    console.log('🗄️  Iniciando simulação de criação no banco de dados...\n');
    
    try {
        // Verificar conexão com o banco
        await prisma.$connect();
        console.log('✅ Conexão com banco de dados estabelecida');
        
        // Limpar dados existentes para teste limpo
        console.log('🧹 Limpando dados existentes...');
        await prisma.item.deleteMany();
        await prisma.alinea.deleteMany();
        await prisma.inciso.deleteMany();
        await prisma.paragrafo.deleteMany();
        await prisma.artigo.deleteMany();
        await prisma.lei.deleteMany();
        console.log('✅ Dados limpos\n');
        
        const testFilesDir = path.join(__dirname, 'test-files');
        const files = fs.readdirSync(testFilesDir).filter(file => file.endsWith('.docx'));
        
        console.log(`📁 Processando ${files.length} arquivos:\n`);
        
        for (const filename of files) {
            console.log(`📄 Processando: ${filename}`);
            console.log('─'.repeat(50));
            
            try {
                const filePath = path.join(testFilesDir, filename);
                const buffer = fs.readFileSync(filePath);
                
                // Extrair texto
                const result = await mammoth.extractRawText({ buffer });
                const extractedText = result.value;
                
                // Extrair informações básicas
                const leiInfo = extractBasicInfo(extractedText);
                const artigos = extractArticles(extractedText);
                
                console.log(`📝 Informações extraídas:`);
                console.log(`   Título: ${leiInfo.titulo || 'Não identificado'}`);
                console.log(`   Número: ${leiInfo.numero || 'S/N'}`);
                console.log(`   Data: ${leiInfo.data || 'Não identificada'}`);
                console.log(`   Artigos: ${artigos.length}`);
                
                // Criar registro da lei no banco
                const leiData = {
                    titulo: leiInfo.titulo || `Lei extraída de ${filename}`,
                    numero: leiInfo.numero || 'S/N',
                    ementa: leiInfo.ementa || 'Ementa não identificada',
                    data: leiInfo.data ? new Date(leiInfo.data) : new Date(),
                    origem: filename,
                    textoCompleto: extractedText
                };
                
                console.log('💾 Salvando no banco de dados...');
                
                const leiCriada = await prisma.lei.create({
                    data: leiData
                });
                
                console.log(`✅ Lei criada com ID: ${leiCriada.id}`);
                
                // Criar artigos
                if (artigos.length > 0) {
                    console.log(`📋 Criando ${artigos.length} artigos...`);
                    
                    for (let i = 0; i < artigos.length; i++) {
                        const artigo = artigos[i];
                        
                        await prisma.artigo.create({
                            data: {
                                numero: `Art. ${artigo.numero}º`,
                                texto: artigo.conteudo,
                                ordem: i + 1,
                                leiId: leiCriada.id
                            }
                        });
                    }
                    
                    console.log(`✅ ${artigos.length} artigos criados`);
                }
                
                // Verificar dados salvos
                const leiComArtigos = await prisma.lei.findUnique({
                    where: { id: leiCriada.id },
                    include: {
                        artigos: {
                            orderBy: { ordem: 'asc' }
                        }
                    }
                });
                
                console.log('📊 Dados salvos no banco:');
                console.log(`   ID da Lei: ${leiComArtigos.id}`);
                console.log(`   Título: ${leiComArtigos.titulo}`);
                console.log(`   Número: ${leiComArtigos.numero}`);
                console.log(`   Data: ${leiComArtigos.data?.toISOString().split('T')[0]}`);
                console.log(`   Artigos salvos: ${leiComArtigos.artigos.length}`);
                console.log(`   Criado em: ${leiComArtigos.criadoEm.toLocaleString('pt-BR')}`);
                
            } catch (error) {
                console.error(`❌ Erro ao processar ${filename}:`, error.message);
            }
            
            console.log('\n' + '='.repeat(60) + '\n');
        }
        
        // Estatísticas finais
        const totalLeis = await prisma.lei.count();
        const totalArtigos = await prisma.artigo.count();
        
        console.log('📈 Estatísticas finais:');
        console.log(`   Total de leis no banco: ${totalLeis}`);
        console.log(`   Total de artigos no banco: ${totalArtigos}`);
        
        // Listar todas as leis criadas
        console.log('\n📋 Leis criadas:');
        const leis = await prisma.lei.findMany({
            include: {
                _count: {
                    select: { artigos: true }
                }
            },
            orderBy: { criadoEm: 'desc' }
        });
        
        leis.forEach((lei, index) => {
            console.log(`   ${index + 1}. ${lei.titulo}`);
            console.log(`      Número: ${lei.numero} | Artigos: ${lei._count.artigos} | Origem: ${lei.origem}`);
        });
        
        console.log('\n✅ Simulação de banco de dados concluída com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na simulação:', error);
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Conexão com banco de dados encerrada');
    }
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
    
    // Tentar extrair título/ementa
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 10);
    if (lines.length > 0) {
        // Procurar por uma linha que pareça ser o título
        for (const line of lines.slice(0, 10)) {
            if (line.toLowerCase().includes('dispõe') || 
                line.toLowerCase().includes('institui') || 
                line.toLowerCase().includes('estabelece') ||
                line.toLowerCase().includes('autoriza') ||
                line.toLowerCase().includes('inclui') ||
                line.toLowerCase().includes('altera')) {
                info.ementa = line;
                break;
            }
        }
        
        // Se não encontrou ementa, usar a primeira linha significativa como título
        if (!info.ementa) {
            const firstSignificantLine = lines.find(line => 
                !line.toLowerCase().includes('autógrafo') && 
                !line.toLowerCase().includes('lei n') &&
                line.length > 20
            );
            if (firstSignificantLine) {
                info.titulo = firstSignificantLine;
            }
        } else {
            info.titulo = info.ementa;
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
                conteudo: conteudo.substring(0, 2000) // Limitar tamanho para o banco
            });
        }
    }
    
    return articles;
}

// Executar a simulação
simulateDatabaseCreation().catch(console.error);