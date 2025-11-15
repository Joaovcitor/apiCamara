const { PrismaClient } = require('@prisma/client');

async function testDatabaseSave() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('🔍 Testando salvamento no banco de dados...\n');

    // Testar conexão
    console.log('1️⃣ Testando conexão com o banco...');
    await prisma.$connect();
    console.log('✅ Conexão estabelecida com sucesso');

    // Limpar dados existentes para teste
    console.log('\n2️⃣ Limpando dados existentes...');
    await prisma.item.deleteMany();
    await prisma.alinea.deleteMany();
    await prisma.inciso.deleteMany();
    await prisma.paragrafo.deleteMany();
    await prisma.artigo.deleteMany();
    await prisma.lei.deleteMany();
    console.log('✅ Dados limpos');

    // Criar estrutura de teste simples
    console.log('\n3️⃣ Criando estrutura de teste...');
    const testLei = {
      titulo: 'INSTITUI A SEMANA BRANCA DA ODONTOLOGIA DO MUNICÍPIO DE QUIXADÁ',
      ementa: 'INSTITUI A SEMANA BRANCA DA ODONTOLOGIA DO MUNICÍPIO DE QUIXADÁ, NA FORMA QUE INDICA.',
      numero: '2.992',
      data: new Date('2019-10-02'),
      origem: 'Upload de arquivo - Teste',
      textoCompleto: 'Texto completo da lei para teste...',
      artigos: [
        {
          numero: 'Art. 1º',
          texto: 'Fica instituído no município de Quixadá a Semana Branca da Odontologia, a ser comemorada na última semana de setembro de cada ano.',
          ordem: 1,
          paragrafos: [],
          incisos: []
        },
        {
          numero: 'Art. 2º',
          texto: 'A Semana Branca de odontologia é um evento multidisciplinar dos profissionais e acadêmicos da área odontológica e afins.',
          ordem: 2,
          paragrafos: [],
          incisos: []
        }
      ]
    };

    console.log('📊 Estrutura de teste criada:');
    console.log('- Título:', testLei.titulo);
    console.log('- Número:', testLei.numero);
    console.log('- Data:', testLei.data);
    console.log('- Artigos:', testLei.artigos.length);

    // Tentar salvar no banco
    console.log('\n4️⃣ Salvando no banco de dados...');
    
    const savedLei = await prisma.lei.create({
      data: {
        titulo: testLei.titulo,
        ementa: testLei.ementa,
        numero: testLei.numero,
        data: testLei.data,
        origem: testLei.origem,
        textoCompleto: testLei.textoCompleto,
        artigos: {
          create: testLei.artigos.map(artigo => ({
            numero: artigo.numero,
            texto: artigo.texto,
            ordem: artigo.ordem,
            paragrafos: {
              create: artigo.paragrafos?.map(paragrafo => ({
                numero: paragrafo.numero,
                texto: paragrafo.texto,
                ordem: paragrafo.ordem,
                incisos: {
                  create: paragrafo.incisos?.map(inciso => ({
                    numero: inciso.numero,
                    texto: inciso.texto,
                    ordem: inciso.ordem,
                    alineas: {
                      create: inciso.alineas?.map(alinea => ({
                        numero: alinea.numero,
                        texto: alinea.texto,
                        ordem: alinea.ordem,
                        itens: {
                          create: alinea.itens?.map(item => ({
                            numero: item.numero,
                            texto: item.texto,
                            ordem: item.ordem,
                          })) || [],
                        },
                      })) || [],
                    },
                  })) || [],
                },
              })) || [],
            },
            Inciso: {
              create: artigo.incisos?.map(inciso => ({
                numero: inciso.numero,
                texto: inciso.texto,
                ordem: inciso.ordem,
                alineas: {
                  create: inciso.alineas?.map(alinea => ({
                    numero: alinea.numero,
                    texto: alinea.texto,
                    ordem: alinea.ordem,
                    itens: {
                      create: alinea.itens?.map(item => ({
                        numero: item.numero,
                        texto: item.texto,
                        ordem: item.ordem,
                      })) || [],
                    },
                  })) || [],
                },
              })) || [],
            },
          })),
        },
      },
      include: {
        artigos: {
          include: {
            paragrafos: {
              include: {
                incisos: true,
              },
            },
            Inciso: {
              include: {
                alineas: {
                  include: {
                    itens: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    console.log('✅ Lei salva com sucesso!');
    console.log('📊 Dados salvos:');
    console.log('- ID:', savedLei.id);
    console.log('- Título:', savedLei.titulo);
    console.log('- Número:', savedLei.numero);
    console.log('- Artigos:', savedLei.artigos.length);

    // Verificar se os dados foram salvos corretamente
    console.log('\n5️⃣ Verificando dados salvos...');
    const retrievedLei = await prisma.lei.findUnique({
      where: { id: savedLei.id },
      include: {
        artigos: {
          include: {
            paragrafos: true,
            Inciso: true,
          },
        },
      },
    });

    if (retrievedLei) {
      console.log('✅ Lei recuperada com sucesso');
      console.log('📄 Primeiro artigo:', retrievedLei.artigos[0]?.texto?.substring(0, 100) + '...');
    } else {
      console.log('❌ Erro ao recuperar lei');
    }

    // Contar registros totais
    console.log('\n6️⃣ Estatísticas finais...');
    const totalLeis = await prisma.lei.count();
    const totalArtigos = await prisma.artigo.count();
    console.log('📊 Total de leis:', totalLeis);
    console.log('📊 Total de artigos:', totalArtigos);

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('🔍 Stack trace:', error.stack);
    
    if (error.code) {
      console.error('🔍 Código do erro:', error.code);
    }
    
    if (error.meta) {
      console.error('🔍 Meta informações:', error.meta);
    }
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Conexão com banco encerrada');
  }
}

// Executar teste
testDatabaseSave().catch(console.error);