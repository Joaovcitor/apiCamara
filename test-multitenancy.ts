import { MunicipioService } from './src/services/municipioService';
import { UserService } from './src/services/userService';
import { LeiService } from './src/services/leiService';
import { LeiStructure } from './src/types';

async function main() {
  const municipioService = new MunicipioService();
  const userService = new UserService();
  const leiService = new LeiService();

  try {
    console.log('--- Iniciando Teste Multi-tenancy ---');

    // 1. Criar Municípios
    console.log('Criando municípios...');
    const quixada = await municipioService.createMunicipio({ nome: 'Quixadá', slug: 'quixada' }).catch(() => municipioService.getMunicipioBySlug('quixada'));
    const baturite = await municipioService.createMunicipio({ nome: 'Baturité', slug: 'baturite' }).catch(() => municipioService.getMunicipioBySlug('baturite'));

    if (!quixada || !baturite) throw new Error('Falha ao criar municípios');
    console.log('Municípios criados:', quixada.nome, baturite.nome);

    // 2. Criar Usuários
    console.log('Criando usuários...');
    const userQuixada = await userService.createUser({
      email: 'admin@quixada.ce.gov.br',
      password: '123',
      role: 'admin',
      municipioId: quixada.id
    }).catch(() => userService.getUserByEmail('admin@quixada.ce.gov.br'));

    const userBaturite = await userService.createUser({
      email: 'admin@baturite.ce.gov.br',
      password: '123',
      role: 'admin',
      municipioId: baturite.id
    }).catch(() => userService.getUserByEmail('admin@baturite.ce.gov.br'));

    if (!userQuixada || !userBaturite) throw new Error('Falha ao criar usuários');
    console.log('Usuários criados');

    // 3. Criar Lei para Quixadá
    console.log('Criando lei para Quixadá...');
    const leiData: LeiStructure = {
      titulo: 'Lei Orgânica de Quixadá',
      numero: '001/2024',
      origem: 'manual',
      textoCompleto: 'Dispõe sobre a organização do município.',
      artigos: []
    };

    const leiQuixada = await leiService.saveLei(leiData, quixada.id, userQuixada.id);
    console.log('Lei criada:', leiQuixada.titulo);

    // 4. Verificar visibilidade (Admin Quixadá)
    console.log('Verificando visibilidade para Admin Quixadá...');
    const leisQuixada = await leiService.getLeis({ page: 1, limit: 10 }, quixada.id);
    console.log(`Admin Quixadá vê ${leisQuixada.data.length} leis.`);
    if (leisQuixada.data.length === 0) console.error('ERRO: Admin Quixadá deveria ver a lei.');

    // 5. Verificar visibilidade (Admin Baturité)
    console.log('Verificando visibilidade para Admin Baturité...');
    const leisBaturite = await leiService.getLeis({ page: 1, limit: 10 }, baturite.id);
    console.log(`Admin Baturité vê ${leisBaturite.data.length} leis.`);
    if (leisBaturite.data.length > 0) console.error('ERRO: Admin Baturité NÃO deveria ver a lei.');

    // 6. Verificar acesso público via slug
    console.log('Verificando acesso público via slug (Quixadá)...');
    const publicQuixada = await leiService.getLeisByMunicipio('quixada', { page: 1, limit: 10 });
    console.log(`Público Quixadá vê ${publicQuixada.data.length} leis.`);
    if (publicQuixada.data.length === 0) console.error('ERRO: Público deveria ver a lei de Quixadá.');

    console.log('Verificando acesso público via slug (Baturité)...');
    const publicBaturite = await leiService.getLeisByMunicipio('baturite', { page: 1, limit: 10 });
    console.log(`Público Baturité vê ${publicBaturite.data.length} leis.`);
    if (publicBaturite.data.length > 0) console.error('ERRO: Público não deveria ver leis em Baturité.');

    console.log('--- Teste Concluído ---');

  } catch (error) {
    console.error('Erro no teste:', error);
  } finally {
    await municipioService.disconnect(); // Assuming disconnect exists or prisma disconnects
    await userService.disconnect();
    await leiService.disconnect();
  }
}

main();
