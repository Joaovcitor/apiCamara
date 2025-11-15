const fs = require('fs');
const path = require('path');

// Simular o processamento de documento para debug
async function debugDocumentProcessing() {
  try {
    console.log('🔍 Debug do processamento de documentos\n');

    // Importar fetch dinamicamente
    const { default: fetch } = await import('node-fetch');

    // Testar primeiro o endpoint de health
    console.log('1️⃣ Testando endpoint de health...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);

    // Testar endpoint de leis (listar)
    console.log('\n2️⃣ Testando endpoint de leis...');
    const leisResponse = await fetch('http://localhost:3000/api/leis');
    const leisData = await leisResponse.json();
    console.log('📋 Leis existentes:', leisData.data?.length || 0);

    // Verificar estrutura do banco
    console.log('\n3️⃣ Verificando estrutura do banco...');
    if (leisData.data && leisData.data.length > 0) {
      console.log('📄 Exemplo de lei no banco:', JSON.stringify(leisData.data[0], null, 2));
    }

    // Testar processamento de um arquivo específico
    console.log('\n4️⃣ Testando processamento de arquivo...');
    const testFile = 'test-files/AUTÓGRAFO DE LEI N 2992 e 2993.docx';
    
    if (!fs.existsSync(testFile)) {
      console.error('❌ Arquivo de teste não encontrado:', testFile);
      return;
    }

    // Ler arquivo e criar FormData
    const FormData = require('form-data');
    const form = new FormData();
    const fileStream = fs.createReadStream(testFile);
    
    form.append('file', fileStream, {
      filename: path.basename(testFile),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    console.log('📤 Enviando arquivo para processamento...');
    console.log('📁 Arquivo:', testFile);
    console.log('📏 Tamanho:', fs.statSync(testFile).size, 'bytes');

    const uploadResponse = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    console.log('📊 Status da resposta:', uploadResponse.status);
    console.log('📋 Headers da resposta:', Object.fromEntries(uploadResponse.headers));

    const responseText = await uploadResponse.text();
    console.log('\n📄 Resposta completa:');
    console.log(responseText);

    try {
      const responseJson = JSON.parse(responseText);
      if (responseJson.success) {
        console.log('\n✅ Processamento bem-sucedido!');
        console.log('📝 Dados da lei:', {
          id: responseJson.data?.id,
          titulo: responseJson.data?.titulo,
          numero: responseJson.data?.numero,
          artigos: responseJson.data?.artigos?.length || 0
        });
      } else {
        console.log('\n❌ Erro no processamento:', responseJson.error);
        if (responseJson.stack) {
          console.log('🔍 Stack trace:', responseJson.stack);
        }
      }
    } catch (parseError) {
      console.log('\n⚠️ Resposta não é JSON válido');
    }

  } catch (error) {
    console.error('❌ Erro durante o debug:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Verifique se o servidor está rodando em http://localhost:3000');
    }
  }
}

// Executar debug
debugDocumentProcessing().catch(console.error);