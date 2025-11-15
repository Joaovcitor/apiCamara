const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testUpload() {
  try {
    console.log('🚀 Testando endpoint de upload...\n');

    // Importar fetch dinamicamente
    const { default: fetch } = await import('node-fetch');

    // Arquivo de teste
    const testFile = 'test-files/AUTÓGRAFO DE LEI N 2992 e 2993.docx';
    
    if (!fs.existsSync(testFile)) {
      console.error('❌ Arquivo de teste não encontrado:', testFile);
      return;
    }

    // Criar FormData
    const form = new FormData();
    const fileStream = fs.createReadStream(testFile);
    form.append('file', fileStream, {
      filename: path.basename(testFile),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    console.log('📤 Enviando arquivo:', testFile);
    console.log('🔗 URL:', 'http://localhost:3000/api/upload');

    // Fazer upload
    const response = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    console.log('📊 Status da resposta:', response.status);
    console.log('📋 Headers da resposta:', Object.fromEntries(response.headers));

    const result = await response.text();
    console.log('\n📄 Resposta do servidor:');
    
    try {
      const jsonResult = JSON.parse(result);
      console.log(JSON.stringify(jsonResult, null, 2));
      
      if (jsonResult.success) {
        console.log('\n✅ Upload realizado com sucesso!');
        console.log('📝 Lei criada:', jsonResult.data?.titulo || 'Título não disponível');
        console.log('🔢 ID da lei:', jsonResult.data?.id || 'ID não disponível');
        console.log('📊 Artigos encontrados:', jsonResult.data?.artigos?.length || 0);
      } else {
        console.log('\n❌ Erro no upload:', jsonResult.error);
      }
    } catch (parseError) {
      console.log('Resposta (texto):', result);
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Verifique se o servidor está rodando em http://localhost:3000');
    }
  }
}

// Testar múltiplos arquivos
async function testBatchUpload() {
  try {
    console.log('\n🚀 Testando upload em lote...\n');

    // Importar fetch dinamicamente
    const { default: fetch } = await import('node-fetch');

    const testFiles = [
      'test-files/AUTÓGRAFO DE LEI N 2992 e 2993.docx',
      'test-files/Autógrofos de Lei 3.010.docx',
      'test-files/Autógrafo de Lei 2023 novo.docx'
    ];

    // Verificar se os arquivos existem
    const existingFiles = testFiles.filter(file => fs.existsSync(file));
    console.log('📁 Arquivos encontrados:', existingFiles.length);

    if (existingFiles.length === 0) {
      console.error('❌ Nenhum arquivo de teste encontrado');
      return;
    }

    // Criar FormData para múltiplos arquivos
    const form = new FormData();
    existingFiles.forEach(file => {
      const fileStream = fs.createReadStream(file);
      form.append('files', fileStream, {
        filename: path.basename(file),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    });

    console.log('📤 Enviando arquivos:', existingFiles.map(f => path.basename(f)));
    console.log('🔗 URL:', 'http://localhost:3000/api/upload/batch');

    // Fazer upload em lote
    const response = await fetch('http://localhost:3000/api/upload/batch', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    console.log('📊 Status da resposta:', response.status);

    const result = await response.text();
    console.log('\n📄 Resposta do servidor:');
    
    try {
      const jsonResult = JSON.parse(result);
      console.log(JSON.stringify(jsonResult, null, 2));
      
      if (jsonResult.success) {
        console.log('\n✅ Upload em lote realizado com sucesso!');
        console.log('📈 Sucessos:', jsonResult.data?.successful?.length || 0);
        console.log('❌ Falhas:', jsonResult.data?.failed?.length || 0);
      } else {
        console.log('\n❌ Erro no upload em lote:', jsonResult.error);
      }
    } catch (parseError) {
      console.log('Resposta (texto):', result);
    }

  } catch (error) {
    console.error('❌ Erro durante o teste em lote:', error.message);
  }
}

// Executar testes
async function runTests() {
  console.log('🧪 Iniciando testes de upload\n');
  console.log('=' .repeat(50));
  
  // Teste 1: Upload único
  await testUpload();
  
  console.log('\n' + '=' .repeat(50));
  
  // Teste 2: Upload em lote
  await testBatchUpload();
  
  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Testes concluídos!');
}

runTests().catch(console.error);